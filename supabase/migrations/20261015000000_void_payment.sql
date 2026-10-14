-- "Annulla pagamento": per correggere un "Segna come pagato" sbagliato (importo,
-- cliente, registrato per errore). Il pagamento NON si cancella: resta registrato come
-- annullato (motivo, chi, quando) e non conta più negli incassi. Nel registro del saldo
-- si aggiunge una riga che compensa pagamento + sconto, così il saldo torna al dovuto.
-- Le prenotazioni segnate "Pagata" e i pacchetti sbloccati da quel pagamento tornano
-- com'erano: per saperlo con esattezza, da ora ogni pagamento ricorda cosa ha toccato
-- (payment_effects). Per i pagamenti registrati prima non c'è questa informazione:
-- lì si annulla solo il saldo e le prenotazioni vanno ricontrollate a mano.

begin;

alter table public.payments add column if not exists voided_at timestamptz;
alter table public.payments add column if not exists voided_by uuid;
alter table public.payments add column if not exists void_reason text;

create table if not exists public.payment_effects (
  payment_id uuid not null references public.payments(id) on delete cascade,
  target_type text not null check (target_type in ('BOOKING', 'PASS')),
  target_id uuid not null,
  previous_status text not null,
  primary key (payment_id, target_type, target_id)
);
alter table public.payment_effects enable row level security;
revoke all on public.payment_effects from anon, authenticated;

-- "Segna come pagato": come prima, in più registra quali prenotazioni e pacchetti tocca.
create or replace function public.settle_user_wallet(
  p_user_id uuid,
  p_amount_eur numeric,
  p_staff_id uuid,
  p_tag text
)
returns public.payments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance_before numeric;
  v_amount numeric;
  v_payment public.payments%rowtype;
begin
  if p_user_id is null then
    raise exception 'Utente mancante';
  end if;
  if not public.is_manage_staff(p_staff_id) then
    raise exception 'Chi registra il pagamento non fa parte dello staff';
  end if;

  -- Blocca il profilo: due incassi contemporanei non devono leggere lo stesso saldo.
  perform 1 from public.profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'Profilo utente non trovato';
  end if;

  select coalesce(sum(amount_eur), 0) into v_balance_before
  from public.wallet_entries where user_id = p_user_id;

  v_amount := round(greatest(0, coalesce(p_amount_eur, 0)), 2);

  insert into public.payments (user_id, amount_eur, balance_before, created_by)
  values (p_user_id, v_amount, v_balance_before, p_staff_id)
  returning * into v_payment;

  if v_amount > 0 then
    insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_by)
    values (p_user_id, -v_amount, 'PAYMENT', 'PAYMENT', v_payment.id,
            'Pagamento', p_staff_id);
  end if;

  if v_balance_before > v_amount then
    insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_by)
    values (p_user_id, -(v_balance_before - v_amount), 'DISCOUNT', 'PAYMENT', v_payment.id,
            'Sconto al pagamento', p_staff_id);
  end if;

  -- Le prenotazioni pensione a saldo risultano pagate (etichetta: l'importo resta
  -- addebitato e il pagamento qui sopra lo compensa).
  insert into public.payment_effects (payment_id, target_type, target_id, previous_status)
  select v_payment.id, 'BOOKING', id, status
  from public.bookings
  where user_id = p_user_id
    and service_type = 'PENSIONE'
    and status in ('CONFIRMED', 'COMPLETED');

  update public.bookings
  set status = 'PAID'
  where user_id = p_user_id
    and service_type = 'PENSIONE'
    and status in ('CONFIRMED', 'COMPLETED');

  insert into public.payment_effects (payment_id, target_type, target_id, previous_status)
  select v_payment.id, 'PASS', id, status
  from public.service_passes
  where user_id = p_user_id and status = 'LOCKED';

  update public.service_passes
  set status = 'ACTIVE', unlocked_at = now(), unlocked_by = p_staff_id
  where user_id = p_user_id and status = 'LOCKED';

  return v_payment;
end;
$function$;

create or replace function public.void_payment(
  p_payment_id uuid,
  p_reason text,
  p_staff_id uuid
)
returns table (restored_bookings integer, restored_passes integer, had_effects boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_payment public.payments%rowtype;
  v_total numeric;
  v_effects integer;
  v_bookings integer := 0;
  v_passes integer := 0;
begin
  if not public.is_manage_staff(p_staff_id) then
    raise exception 'Solo lo staff può annullare un pagamento';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Scrivi il motivo dell''annullamento';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Pagamento non trovato';
  end if;
  if v_payment.voided_at is not null then
    raise exception 'Pagamento già annullato';
  end if;

  perform 1 from public.profiles where user_id = v_payment.user_id for update;

  -- Riga che compensa pagamento + sconto collegati (stessa origine).
  select coalesce(sum(amount_eur), 0) into v_total
  from public.wallet_entries
  where source_type = 'PAYMENT' and source_id = p_payment_id;

  if v_total <> 0 then
    insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, note, created_by)
    values (v_payment.user_id, -v_total, 'ADJUSTMENT', 'PAYMENT', p_payment_id,
            'Pagamento annullato', trim(p_reason), p_staff_id);
  end if;

  select count(*) into v_effects from public.payment_effects where payment_id = p_payment_id;

  -- Solo ciò che è ancora nello stato lasciato dal pagamento.
  update public.bookings b
  set status = e.previous_status
  from public.payment_effects e
  where e.payment_id = p_payment_id and e.target_type = 'BOOKING'
    and b.id = e.target_id and b.status = 'PAID';
  get diagnostics v_bookings = row_count;

  update public.service_passes p
  set status = e.previous_status, unlocked_at = null, unlocked_by = null
  from public.payment_effects e
  where e.payment_id = p_payment_id and e.target_type = 'PASS'
    and p.id = e.target_id and p.status = 'ACTIVE';
  get diagnostics v_passes = row_count;

  update public.payments
  set voided_at = now(), voided_by = p_staff_id, void_reason = trim(p_reason)
  where id = p_payment_id;

  return query select v_bookings, v_passes, v_effects > 0;
end;
$function$;

revoke all on function public.void_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.void_payment(uuid, text, uuid) to service_role;
revoke all on function public.settle_user_wallet(uuid, numeric, uuid, text) from public, anon, authenticated;
grant execute on function public.settle_user_wallet(uuid, numeric, uuid, text) to service_role;

commit;
