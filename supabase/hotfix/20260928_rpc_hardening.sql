-- ═════════════════════════════════════════════════════════════════════════════
-- HOTFIX SICUREZZA — funzioni del database chiamabili da chiunque
-- Da eseguire SUBITO nell'editor SQL di Supabase. Nessun deploy necessario:
-- è compatibile con il codice attualmente online (il server usa la service role,
-- il client aggiunge al saldo solo importi positivi).
--
-- Problema (vedi TDB_VULNERABILITA_FUNZIONI_PRIVILEGIATE.md, verificato su TDB):
--   funzioni SECURITY DEFINER eseguibili da anon/authenticated che agiscono sul
--   p_user_id passato dal chiamante senza verificarlo.
--
-- Differenze rispetto al documento, specifiche di TDB:
--   * add_wallet_due(p_amount_eur) — l'overload "a un argomento" NON è sicuro come
--     dice il documento: accetta importi negativi, quindi ogni cliente può azzerarsi
--     il proprio debito. Qui lo limitiamo agli importi positivi.
--   * settle_user_wallet(uuid, numeric, uuid) — in TDB la migration del 10/06 revocava
--     già i permessi pubblici; aggiungiamo comunque il controllo staff (difesa doppia).
--   * book_service_slot — oltre a "chi prenota", verifichiamo che i cani appartengano
--     al cliente: prima si potevano usare cani (e crediti) di altri.
--
-- Tutto in una transazione: se qualcosa non torna, non cambia niente.
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) add_wallet_due(p_user_id, p_amount_eur): solo server (service role) o staff.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_wallet_due(p_user_id uuid, p_amount_eur numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Con la service role (server) auth.uid() è null: percorso già privilegiato.
  -- Chiunque altro deve essere staff attivo con poteri di gestione.
  if auth.uid() is not null and not exists (
    select 1 from public.staff_accounts sa
    where sa.user_id = auth.uid()
      and sa.is_active = true
      and sa.role in ('ADMIN', 'SUPER_ADMIN')
  ) then
    raise exception 'Non autorizzato a modificare il saldo';
  end if;

  update public.profiles
  set wallet_due_eur = greatest(0, wallet_due_eur + coalesce(p_amount_eur, 0))
  where user_id = p_user_id;
end;
$function$;

revoke all on function public.add_wallet_due(uuid, numeric) from public, anon, authenticated;
grant execute on function public.add_wallet_due(uuid, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) add_wallet_due(p_amount_eur): il cliente può solo AGGIUNGERE al proprio saldo
--    (oggi serve per il taxi dei servizi). Mai toglierlo.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_wallet_due(p_amount_eur numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Non autorizzato';
  end if;

  if p_amount_eur is null or p_amount_eur = 0 then
    return;
  end if;

  if p_amount_eur < 0 then
    raise exception 'Importo non valido';
  end if;

  update public.profiles
  set wallet_due_eur = coalesce(wallet_due_eur, 0) + p_amount_eur
  where user_id = v_user_id;

  if not found then
    raise exception 'Profilo utente non trovato';
  end if;
end;
$function$;

revoke all on function public.add_wallet_due(numeric) from public, anon;
grant execute on function public.add_wallet_due(numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) settle_user_wallet(3 argomenti, versione oggi online): chi incassa dev'essere staff.
--    Corpo identico a supabase/legacy_migrations/20260610_payments_and_settle_wallet.sql
--    più il controllo. PRIMA di eseguire confrontalo con quello in produzione (query
--    in fondo al file, sezione VERIFICHE, punto B).
-- ─────────────────────────────────────────────────────────────────────────────
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

  if not exists (
    select 1 from public.staff_accounts sa
    where sa.user_id = p_staff_id
      and sa.is_active = true
      and sa.role in ('ADMIN', 'SUPER_ADMIN')
  ) then
    raise exception 'Chi registra il pagamento non fa parte dello staff';
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

  update public.service_passes
  set status = 'ACTIVE',
      unlocked_at = now(),
      unlocked_by = p_staff_id
  where user_id = p_user_id
    and status = 'LOCKED';

  return v_payment;
end;
$function$;

revoke all on function public.settle_user_wallet(uuid, numeric, uuid) from public, anon, authenticated;
grant execute on function public.settle_user_wallet(uuid, numeric, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) book_service_slot: si prenota solo per sé stessi (o si è staff) e solo con i
--    propri cani. La funzione è lunga e la versione in produzione può differire dal
--    repo: invece di riscriverla, inseriamo il controllo subito dopo il primo `begin`
--    del corpo attuale. Se la struttura non è quella attesa ci fermiamo con un errore
--    (e la transazione annulla tutto).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_def text;
  v_marker text := E'\nbegin\n';
  -- Testo inserito al posto del primo "begin" del corpo: stesso begin + controlli.
  v_guard text := $g$
begin
  -- [hotfix 2026-09-28] Si prenota per sé stessi (o si è staff), con i propri cani.
  if p_user_id is null then
    raise exception 'Utente mancante';
  end if;
  if auth.uid() is not null and auth.uid() <> p_user_id and not exists (
    select 1 from public.staff_accounts sa where sa.user_id = auth.uid() and sa.is_active = true
  ) then
    raise exception 'Non puoi prenotare per conto di un altro utente';
  end if;
  if p_dog_ids is not null and exists (
    select 1 from unnest(p_dog_ids) as x(dog_id)
    left join public.dogs d on d.id = x.dog_id
    where d.id is null or d.owner_id <> p_user_id
  ) then
    raise exception 'Uno o più cani non appartengono al cliente';
  end if;
$g$;
  v_pos int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  where p.oid = 'public.book_service_slot(uuid, uuid, uuid, text, text, uuid[], integer, boolean, numeric, numeric, text)'::regprocedure;

  if v_def like '%[hotfix 2026-09-28]%' then
    raise notice 'book_service_slot: controllo già presente, salto.';
    return;
  end if;

  v_pos := position(v_marker in v_def);
  if v_pos = 0 then
    raise exception 'book_service_slot: struttura inattesa (manca "begin" a inizio riga). Applica il controllo a mano.';
  end if;

  v_def := overlay(v_def placing v_guard from v_pos for length(v_marker));
  execute v_def;
end $$;

revoke all on function public.book_service_slot(
  uuid, uuid, uuid, text, text, uuid[], integer, boolean, numeric, numeric, text) from public, anon;
grant execute on function public.book_service_slot(
  uuid, uuid, uuid, text, text, uuid[], integer, boolean, numeric, numeric, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Porte inutili: comprare richiede l'accesso; la funzione di trigger non si chiama.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.purchase_service_pass(uuid) from public, anon;
grant execute on function public.purchase_service_pass(uuid) to authenticated;

do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'revoke all on function public.handle_new_user() from public, anon, authenticated';
  end if;
end $$;

commit;

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICHE (sola lettura) — eseguile PRIMA e DOPO il blocco sopra.
-- ═════════════════════════════════════════════════════════════════════════════

-- A) Chi può eseguire cosa. Dopo il fix: add_wallet_due(uuid,…) e settle_user_wallet
--    senza ruoli pubblici; book_service_slot e purchase_service_pass solo authenticated.
-- select p.oid::regprocedure as funzione,
--        case when p.prosecdef then 'DEFINER' else 'invoker' end as modo,
--        has_function_privilege('anon', p.oid, 'execute') as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('add_wallet_due', 'settle_user_wallet', 'book_service_slot',
--                     'purchase_service_pass', 'cancel_service_slot_booking', 'handle_new_user')
-- order by 1;

-- B) Corpo attuale di settle_user_wallet (da confrontare con il punto 3 PRIMA del fix).
-- select pg_get_functiondef('public.settle_user_wallet(uuid, numeric, uuid)'::regprocedure);

-- C) Segni di uso improprio (nessun risultato ≠ prova di innocenza).
--    Nota: in TDB la colonna è paid_at, non created_at come nel documento.
-- select id, user_id, amount_eur, balance_before, paid_at from public.payments
--   where created_by = user_id order by paid_at desc;
-- select id, user_id, amount_eur, balance_before, paid_at from public.payments
--   where coalesce(amount_eur, 0) = 0 and coalesce(balance_before, 0) > 0 order by paid_at desc;
-- select p.id, p.user_id, p.created_by, p.amount_eur, p.paid_at from public.payments p
--   where p.created_by is not null
--     and not exists (select 1 from public.staff_accounts sa where sa.user_id = p.created_by)
--   order by p.paid_at desc;
-- -- Prenotazioni slot con cani di un altro proprietario (sia dog_id sia dog_ids):
-- select b.id, b.user_id, x.dog_id, d.owner_id, b.created_at
-- from public.service_slot_bookings b
-- cross join lateral unnest(coalesce(b.dog_ids, '{}') || coalesce(array[b.dog_id], '{}')) as x(dog_id)
-- join public.dogs d on d.id = x.dog_id
-- where d.owner_id <> b.user_id
-- order by b.created_at desc;

-- D) Riproduzione dell'attacco dentro una transazione annullata (vedi documento §3.2):
--    dopo il fix la chiamata deve fallire con "Non autorizzato a modificare il saldo".
--    Sostituisci <UUID> con uno user_id di prova ed esegui TUTTO in un colpo solo.
-- begin;
-- update public.profiles set wallet_due_eur = 250 where user_id = '<UUID>';
-- set local role authenticated;
-- select set_config('request.jwt.claims', json_build_object('sub', '<UUID>')::text, true);
-- select public.add_wallet_due('<UUID>'::uuid, -999999);
-- rollback;
