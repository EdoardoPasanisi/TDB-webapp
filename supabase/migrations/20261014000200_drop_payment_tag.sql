-- Tolta la colonna payments.tag (C / CC). I pagamenti restano tutti come normali
-- incassi; le etichette "Pagamento C" / "Pagamento CC" nel registro diventano "Pagamento".
--
-- settle_user_wallet tiene il parametro p_tag solo per compatibilità con il codice
-- oggi online (che lo passa ancora): viene ignorato.

begin;

-- "Segna come pagato": registra l'incasso, l'eventuale sconto per arrivare
-- a zero, segna "Pagata" le prenotazioni pensione a saldo e sblocca i pacchetti.
-- Se l'importo supera il dovuto, la differenza resta come credito del cliente.
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
  update public.bookings
  set status = 'PAID'
  where user_id = p_user_id
    and service_type = 'PENSIONE'
    and status in ('CONFIRMED', 'COMPLETED');

  update public.service_passes
  set status = 'ACTIVE', unlocked_at = now(), unlocked_by = p_staff_id
  where user_id = p_user_id and status = 'LOCKED';

  return v_payment;
end;
$function$;

update public.wallet_entries
set label = 'Pagamento'
where kind = 'PAYMENT' and label in ('Pagamento C', 'Pagamento CC');

drop index if exists public.payments_tag_paid_at_idx;
alter table public.payments drop constraint if exists payments_tag_check;
alter table public.payments drop column if exists tag;

commit;
