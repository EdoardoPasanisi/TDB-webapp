-- 20260610_payments_and_settle_wallet.sql
-- Conferma pagamenti dal gestionale: quando un saldo viene effettivamente pagato,
-- l'operatore segna "pagato" inserendo l'importo realmente incassato (gestione sconti).
-- Questo:
--   - registra il pagamento nella tabella public.payments (per analisi entrate),
--   - azzera il saldo (wallet_due_eur) dell'utente,
--   - sblocca i pacchetti multi-credito ancora in attesa (LOCKED -> ACTIVE).

-- 1) Storico pagamenti (sorgente per l'analisi entrate).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_eur numeric not null default 0,     -- importo effettivamente incassato
  balance_before numeric not null default 0, -- saldo prima dell'azzeramento
  note text null,
  created_by uuid null references auth.users(id) on delete set null,
  paid_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_paid_at_idx on public.payments (paid_at);

-- Solo il gestionale (service role) accede a payments: RLS attiva senza policy
-- per gli utenti normali; il service role bypassa comunque la RLS.
alter table public.payments enable row level security;

-- 2) Settle atomico: registra il pagamento, azzera il saldo, sblocca i pacchetti.
create or replace function public.settle_user_wallet(
  p_user_id uuid,
  p_amount_eur numeric,
  p_staff_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance_before numeric;
  v_payment public.payments%rowtype;
begin
  if p_user_id is null then
    raise exception 'Utente mancante';
  end if;

  select coalesce(wallet_due_eur, 0)
  into v_balance_before
  from public.profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Profilo utente non trovato';
  end if;

  insert into public.payments (user_id, amount_eur, balance_before, created_by)
  values (p_user_id, greatest(0, coalesce(p_amount_eur, 0)), v_balance_before, p_staff_id)
  returning * into v_payment;

  update public.profiles
  set wallet_due_eur = 0
  where user_id = p_user_id;

  -- sblocca i pacchetti acquistati in attesa di conferma pagamento
  update public.service_passes
  set status = 'ACTIVE',
      unlocked_at = now(),
      unlocked_by = p_staff_id
  where user_id = p_user_id
    and status = 'LOCKED';

  return v_payment;
end;
$function$;

-- Eseguibile solo dal gestionale via service role.
revoke all on function public.settle_user_wallet(uuid, numeric, uuid) from public;
revoke all on function public.settle_user_wallet(uuid, numeric, uuid) from anon;
revoke all on function public.settle_user_wallet(uuid, numeric, uuid) from authenticated;
