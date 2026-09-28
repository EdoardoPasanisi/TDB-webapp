-- ═════════════════════════════════════════════════════════════════════════════
-- 2026-09-29 — Registro movimenti del saldo (wallet ledger)
--
-- PRIMA: il saldo era un numero unico (profiles.wallet_due_eur) aggiunto e tolto da
-- una decina di punti diversi del codice, senza storico. Errori trovati:
--   * "Segna come pagato" azzerava il saldo lasciando le prenotazioni "confermate":
--     un annullamento/modifica successivo le stornava di nuovo;
--   * "Segna pagata" sulla prenotazione e "Segna come pagato" sul cliente toglievano
--     entrambi soldi → doppio storno;
--   * il saldo non poteva scendere sotto zero: gli storni oltre lo zero sparivano;
--   * il taxi dei servizi lo aggiungeva il telefono del cliente e non veniva mai tolto
--     se il cliente annullava; un pacchetto rimosso dallo staff restava addebitato.
--
-- ORA: ogni addebito, pagamento, sconto o rettifica è una riga di wallet_entries e
-- il saldo è la loro somma (profiles.wallet_due_eur resta come copia, aggiornata da
-- trigger, così tutto il codice che lo legge continua a funzionare).
-- Gli addebiti SEGUONO I SERVIZI in automatico, tramite trigger sulle tabelle:
--   * pensione (bookings): totale della prenotazione se CONFIRMED/PAID/COMPLETED;
--   * servizi (service_slot_bookings): prezzo del taxi se attivo e non annullata;
--   * pacchetti (service_passes): prezzo del pacchetto se non annullato.
-- Qualunque modifica (conferma, annullamento, modifica, eliminazione, da app o da
-- gestionale) porta l'addebito di quella voce esattamente al valore dovuto.
--
-- Il saldo può essere negativo = credito del cliente.
--
-- Applicabile PRIMA del deploy del nuovo codice: le vecchie funzioni che il codice
-- online chiama ancora (add_wallet_due, settle a 3 argomenti) diventano compatibili
-- e non raddoppiano gli addebiti, perché ora li fanno i trigger.
--
-- Presuppone l'hotfix supabase/hotfix/20260928_rpc_hardening.sql già applicato (ma
-- ridefinisce comunque tutte le funzioni che tocca, con i controlli).
-- ═════════════════════════════════════════════════════════════════════════════

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Colonne di supporto
-- ─────────────────────────────────────────────────────────────────────────────

-- Tag del pagamento (C / CC) scelto in "Segna come pagato". NULL = storico.
alter table public.payments add column if not exists tag text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_tag_check') then
    alter table public.payments
      add constraint payments_tag_check check (tag is null or tag in ('C', 'CC'));
  end if;
end $$;
create index if not exists payments_tag_paid_at_idx on public.payments (tag, paid_at desc);

-- Prezzo del pacchetto al momento dell'acquisto (prima si leggeva dal prodotto, che
-- può cambiare prezzo nel tempo).
alter table public.service_passes add column if not exists price_eur numeric(10,2);
update public.service_passes sp
set price_eur = coalesce(pr.price_eur, 0)
from public.service_products pr
where sp.product_id = pr.id and sp.price_eur is null;
update public.service_passes set price_eur = 0 where price_eur is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Registro movimenti
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- > 0 addebito (il cliente deve), < 0 pagamento / sconto / credito
  amount_eur numeric(12,2) not null,
  kind text not null check (kind in ('CHARGE', 'PAYMENT', 'DISCOUNT', 'ADJUSTMENT', 'OPENING')),
  -- A cosa si riferisce: prenotazione pensione, taxi di un servizio, pacchetto, pagamento.
  source_type text check (source_type in ('BOOKING', 'SLOT_TAXI', 'PASS', 'PAYMENT')),
  source_id uuid,
  label text not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  -- Solo per le righe OPENING (differenze emerse al passaggio al registro).
  reviewed_at timestamptz,
  reviewed_by uuid
);

create index if not exists wallet_entries_user_idx on public.wallet_entries (user_id, created_at desc);
create index if not exists wallet_entries_source_idx on public.wallet_entries (source_type, source_id);
create index if not exists wallet_entries_opening_idx on public.wallet_entries (kind) where kind = 'OPENING' and reviewed_at is null;

-- Solo il server scrive. Il cliente può leggere i propri movimenti.
alter table public.wallet_entries enable row level security;
drop policy if exists wallet_entries_select_own on public.wallet_entries;
create policy wallet_entries_select_own on public.wallet_entries
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.wallet_entries from anon, authenticated;
grant select on public.wallet_entries to authenticated;

-- Log delle pulizie dei dati di prova (eliminazione pagamenti "C").
create table if not exists public.data_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  items_count integer not null,
  total_eur numeric(12,2) not null,
  performed_by uuid,
  performed_at timestamptz not null default now()
);
alter table public.data_cleanup_log enable row level security;
revoke all on public.data_cleanup_log from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Funzioni interne (solo server / trigger)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ricalcola la copia del saldo su profiles.
create or replace function public.wallet_refresh_due(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_user_id is null then return; end if;
  update public.profiles
  set wallet_due_eur = coalesce((
    select sum(amount_eur) from public.wallet_entries where user_id = p_user_id
  ), 0)
  where user_id = p_user_id;
end;
$function$;

create or replace function public.wallet_entries_after_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.wallet_refresh_due(new.user_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.user_id is distinct from new.user_id) then
    perform public.wallet_refresh_due(old.user_id);
  end if;
  return null;
end;
$function$;

-- Porta l'addebito di una voce (prenotazione, taxi, pacchetto) al valore dovuto,
-- aggiungendo solo la differenza. Idempotente: chiamarla due volte non cambia nulla.
create or replace function public.wallet_sync_charge(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_desired numeric,
  p_label text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_current numeric;
  v_delta numeric;
  v_label text;
begin
  if p_user_id is null or p_source_id is null then return; end if;

  select coalesce(sum(amount_eur), 0) into v_current
  from public.wallet_entries
  where user_id = p_user_id
    and kind = 'CHARGE'
    and source_type = p_source_type
    and source_id = p_source_id;

  v_delta := round(coalesce(p_desired, 0) - v_current, 2);
  if v_delta = 0 then return; end if;

  v_label := case
    when v_current = 0 then p_label
    when coalesce(p_desired, 0) = 0 then 'Storno: ' || p_label
    else 'Variazione: ' || p_label
  end;

  insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_by)
  values (p_user_id, v_delta, 'CHARGE', p_source_type, p_source_id, v_label, auth.uid());
end;
$function$;

-- Valori dovuti, in un solo posto.
create or replace function public.wallet_booking_due(p_service_type text, p_status text, p_total numeric)
returns numeric language sql immutable as $$
  select case
    when p_service_type = 'PENSIONE' and p_status in ('CONFIRMED', 'PAID', 'COMPLETED')
      then greatest(coalesce(p_total, 0), 0)
    else 0
  end
$$;

create or replace function public.wallet_slot_taxi_due(p_taxi_enabled boolean, p_status text, p_taxi_price numeric)
returns numeric language sql immutable as $$
  select case
    when coalesce(p_taxi_enabled, false) and coalesce(p_status, '') not in ('CANCELLED', 'REJECTED')
      then greatest(coalesce(p_taxi_price, 0), 0)
    else 0
  end
$$;

create or replace function public.wallet_pass_due(p_status text, p_price numeric)
returns numeric language sql immutable as $$
  select case when coalesce(p_status, '') <> 'CANCELLED' then greatest(coalesce(p_price, 0), 0) else 0 end
$$;

create or replace function public.wallet_booking_label(p_start date, p_end date)
returns text language sql immutable as $$
  select 'Pensione ' || to_char(p_start, 'DD/MM/YYYY')
    || case when p_end is not null and p_end <> p_start then ' – ' || to_char(p_end, 'DD/MM/YYYY') else '' end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Situazione di partenza (una volta sola)
--    Ricostruiamo addebiti e pagamenti noti. La differenza con il saldo attuale
--    diventa UNA riga "OPENING" per cliente: così nessun saldo cambia oggi, ma nel
--    gestionale ogni differenza inspiegata è visibile e verificabile (Verifica saldi).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.wallet_entries) then
    raise notice 'wallet_entries già popolata: salto la ricostruzione iniziale.';
    return;
  end if;

  -- Pensione
  insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_at)
  select b.user_id,
         public.wallet_booking_due(b.service_type, b.status, b.total_price),
         'CHARGE', 'BOOKING', b.id,
         public.wallet_booking_label(b.start_date, b.end_date),
         coalesce(b.updated_at, b.created_at, now())
  from public.bookings b
  join public.profiles pr on pr.user_id = b.user_id
  where public.wallet_booking_due(b.service_type, b.status, b.total_price) > 0;

  -- Prenotazioni segnate "Pagata" con il vecchio pulsante: il vecchio sistema le
  -- toglieva dal saldo senza registrare un pagamento. Le rappresentiamo come pagate.
  insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_at)
  select b.user_id,
         -public.wallet_booking_due(b.service_type, b.status, b.total_price),
         'PAYMENT', 'BOOKING', b.id,
         'Segnata pagata sulla prenotazione (storico): ' || public.wallet_booking_label(b.start_date, b.end_date),
         coalesce(b.updated_at, b.created_at, now())
  from public.bookings b
  join public.profiles pr on pr.user_id = b.user_id
  where b.status = 'PAID'
    and public.wallet_booking_due(b.service_type, b.status, b.total_price) > 0;

  -- Taxi dei servizi
  insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_at)
  select sb.user_id,
         public.wallet_slot_taxi_due(sb.taxi_enabled, sb.status, sb.taxi_price_eur),
         'CHARGE', 'SLOT_TAXI', sb.id,
         'Taxi servizio', coalesce(sb.created_at, now())
  from public.service_slot_bookings sb
  join public.profiles pr on pr.user_id = sb.user_id
  where public.wallet_slot_taxi_due(sb.taxi_enabled, sb.status, sb.taxi_price_eur) > 0;

  -- Pacchetti
  insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_at)
  select sp.user_id,
         public.wallet_pass_due(sp.status, sp.price_eur),
         'CHARGE', 'PASS', sp.id,
         'Pacchetto ' || sp.service_type || ' (' || sp.credits_total || ' crediti)',
         coalesce(sp.purchased_at, now())
  from public.service_passes sp
  join public.profiles pr on pr.user_id = sp.user_id
  where public.wallet_pass_due(sp.status, sp.price_eur) > 0;

  -- Pagamenti registrati e sconti impliciti (importo incassato < saldo dell'epoca).
  insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_by, created_at)
  select p.user_id, -coalesce(p.amount_eur, 0), 'PAYMENT', 'PAYMENT', p.id,
         'Pagamento' || coalesce(' ' || p.tag, ''), p.created_by, p.paid_at
  from public.payments p
  join public.profiles pr on pr.user_id = p.user_id
  where coalesce(p.amount_eur, 0) <> 0;

  insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_by, created_at)
  select p.user_id, -(p.balance_before - p.amount_eur), 'DISCOUNT', 'PAYMENT', p.id,
         'Sconto al pagamento', p.created_by, p.paid_at
  from public.payments p
  join public.profiles pr on pr.user_id = p.user_id
  where coalesce(p.balance_before, 0) > coalesce(p.amount_eur, 0);

  -- Differenza con il saldo attuale → una riga OPENING da verificare.
  insert into public.wallet_entries (user_id, amount_eur, kind, label, note)
  select pr.user_id,
         round(coalesce(pr.wallet_due_eur, 0) - coalesce(s.total, 0), 2),
         'OPENING',
         'Differenza da verificare (saldo precedente al registro movimenti)',
         'Saldo registrato: ' || coalesce(pr.wallet_due_eur, 0)
           || ' € — ricostruito da servizi e pagamenti: ' || coalesce(s.total, 0) || ' €'
  from public.profiles pr
  left join (
    select user_id, sum(amount_eur) as total from public.wallet_entries group by user_id
  ) s on s.user_id = pr.user_id
  where round(coalesce(pr.wallet_due_eur, 0) - coalesce(s.total, 0), 2) <> 0;
end $$;

-- Da qui in poi la copia su profiles segue il registro.
drop trigger if exists wallet_entries_after_change on public.wallet_entries;
create trigger wallet_entries_after_change
  after insert or update or delete on public.wallet_entries
  for each row execute function public.wallet_entries_after_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Trigger: gli addebiti seguono i servizi
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.wallet_track_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    perform public.wallet_sync_charge(old.user_id, 'BOOKING', old.id, 0,
      public.wallet_booking_label(old.start_date, old.end_date) || ' (eliminata)');
    return null;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.wallet_sync_charge(old.user_id, 'BOOKING', old.id, 0,
      public.wallet_booking_label(old.start_date, old.end_date));
  end if;

  perform public.wallet_sync_charge(new.user_id, 'BOOKING', new.id,
    public.wallet_booking_due(new.service_type, new.status, new.total_price),
    public.wallet_booking_label(new.start_date, new.end_date));
  return null;
end;
$function$;

drop trigger if exists wallet_track_booking on public.bookings;
create trigger wallet_track_booking
  after insert or update or delete on public.bookings
  for each row execute function public.wallet_track_booking();

create or replace function public.wallet_track_slot_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    perform public.wallet_sync_charge(old.user_id, 'SLOT_TAXI', old.id, 0, 'Taxi servizio (eliminato)');
    return null;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.wallet_sync_charge(old.user_id, 'SLOT_TAXI', old.id, 0, 'Taxi servizio');
  end if;

  perform public.wallet_sync_charge(new.user_id, 'SLOT_TAXI', new.id,
    public.wallet_slot_taxi_due(new.taxi_enabled, new.status, new.taxi_price_eur),
    'Taxi servizio');
  return null;
end;
$function$;

drop trigger if exists wallet_track_slot_booking on public.service_slot_bookings;
create trigger wallet_track_slot_booking
  after insert or update or delete on public.service_slot_bookings
  for each row execute function public.wallet_track_slot_booking();

create or replace function public.wallet_track_pass()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    perform public.wallet_sync_charge(old.user_id, 'PASS', old.id, 0,
      'Pacchetto ' || old.service_type || ' (eliminato)');
    return null;
  end if;

  perform public.wallet_sync_charge(new.user_id, 'PASS', new.id,
    public.wallet_pass_due(new.status, new.price_eur),
    'Pacchetto ' || new.service_type || ' (' || new.credits_total || ' crediti)');
  return null;
end;
$function$;

drop trigger if exists wallet_track_pass on public.service_passes;
create trigger wallet_track_pass
  after insert or update of status, price_eur, user_id or delete on public.service_passes
  for each row execute function public.wallet_track_pass();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Funzioni chiamate dal codice
-- ─────────────────────────────────────────────────────────────────────────────

-- Staff con poteri di gestione (stesso criterio di lib/admin/auth.ts: canManage).
create or replace function public.is_manage_staff(p_user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.staff_accounts sa
    where sa.user_id = p_user_id and sa.is_active = true and sa.role in ('ADMIN', 'SUPER_ADMIN')
  )
$$;

-- "Segna come pagato": registra l'incasso (con tag), l'eventuale sconto per arrivare
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
  if p_tag is not null and p_tag not in ('C', 'CC') then
    raise exception 'Tag pagamento non valido (C o CC)';
  end if;

  -- Blocca il profilo: due incassi contemporanei non devono leggere lo stesso saldo.
  perform 1 from public.profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'Profilo utente non trovato';
  end if;

  select coalesce(sum(amount_eur), 0) into v_balance_before
  from public.wallet_entries where user_id = p_user_id;

  v_amount := round(greatest(0, coalesce(p_amount_eur, 0)), 2);

  insert into public.payments (user_id, amount_eur, balance_before, created_by, tag)
  values (p_user_id, v_amount, v_balance_before, p_staff_id, p_tag)
  returning * into v_payment;

  if v_amount > 0 then
    insert into public.wallet_entries (user_id, amount_eur, kind, source_type, source_id, label, created_by)
    values (p_user_id, -v_amount, 'PAYMENT', 'PAYMENT', v_payment.id,
            'Pagamento' || coalesce(' ' || p_tag, ''), p_staff_id);
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

-- Versione a 3 argomenti: la usa il codice oggi online. Resta compatibile finché non
-- si pubblica il nuovo codice (pagamento senza tag).
create or replace function public.settle_user_wallet(
  p_user_id uuid,
  p_amount_eur numeric,
  p_staff_id uuid
)
returns public.payments
language sql
security definer
set search_path to 'public'
as $$
  select * from public.settle_user_wallet(p_user_id, p_amount_eur, p_staff_id, null::text)
$$;

-- Rettifica manuale dal gestionale (sempre con motivazione).
create or replace function public.wallet_adjust(
  p_user_id uuid,
  p_amount_eur numeric,
  p_note text,
  p_staff_id uuid
)
returns public.wallet_entries
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry public.wallet_entries%rowtype;
begin
  if not public.is_manage_staff(p_staff_id) then
    raise exception 'Solo lo staff può rettificare il saldo';
  end if;
  if coalesce(p_amount_eur, 0) = 0 then
    raise exception 'Importo non valido';
  end if;
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Scrivi il motivo della rettifica';
  end if;

  insert into public.wallet_entries (user_id, amount_eur, kind, label, note, created_by)
  values (p_user_id, round(p_amount_eur, 2), 'ADJUSTMENT',
          case when p_amount_eur > 0 then 'Rettifica (addebito)' else 'Rettifica (accredito)' end,
          trim(p_note), p_staff_id)
  returning * into v_entry;
  return v_entry;
end;
$function$;

-- Verifica saldi: chiude una differenza OPENING, correggendola (il saldo torna a
-- "servizi − pagamenti") oppure confermandola così com'è.
create or replace function public.wallet_review_opening(
  p_entry_id uuid,
  p_apply_correction boolean,
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entry public.wallet_entries%rowtype;
begin
  if not public.is_manage_staff(p_staff_id) then
    raise exception 'Solo lo staff può verificare i saldi';
  end if;

  select * into v_entry from public.wallet_entries
  where id = p_entry_id and kind = 'OPENING' for update;
  if not found then raise exception 'Differenza non trovata'; end if;
  if v_entry.reviewed_at is not null then raise exception 'Differenza già verificata'; end if;

  if p_apply_correction then
    insert into public.wallet_entries (user_id, amount_eur, kind, label, note, created_by)
    values (v_entry.user_id, -v_entry.amount_eur, 'ADJUSTMENT', 'Correzione differenza saldo',
            'Annulla la differenza emersa al passaggio al registro movimenti', p_staff_id);
  end if;

  update public.wallet_entries
  set reviewed_at = now(), reviewed_by = p_staff_id
  where id = p_entry_id;
end;
$function$;

-- Pulizia dei dati di prova: elimina i pagamenti con un dato tag e i loro movimenti.
-- I saldi dei clienti tornano come se quei pagamenti non ci fossero mai stati.
-- Resta una riga in data_cleanup_log (quando, chi, quanti, totale).
create or replace function public.delete_tagged_payments(p_tag text, p_staff_id uuid)
returns table (deleted_count integer, deleted_total numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids uuid[];
  v_total numeric;
begin
  if not public.is_manage_staff(p_staff_id) then
    raise exception 'Solo lo staff può eliminare i pagamenti';
  end if;
  if p_tag is distinct from 'C' then
    raise exception 'Si possono eliminare solo i pagamenti C';
  end if;

  select coalesce(array_agg(id), '{}'), coalesce(sum(amount_eur), 0)
  into v_ids, v_total
  from public.payments where tag = p_tag;

  delete from public.wallet_entries where source_type = 'PAYMENT' and source_id = any(v_ids);
  delete from public.payments where id = any(v_ids);

  insert into public.data_cleanup_log (action, items_count, total_eur, performed_by)
  values ('DELETE_PAYMENTS_' || p_tag, coalesce(array_length(v_ids, 1), 0), v_total, p_staff_id);

  return query select coalesce(array_length(v_ids, 1), 0), v_total;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Vecchie funzioni del saldo: ora gli addebiti li fanno i trigger.
--    Restano (vuote) solo perché il codice oggi online le chiama ancora: se
--    aggiungessero soldi, ogni addebito verrebbe contato due volte.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_wallet_due(p_user_id uuid, p_amount_eur numeric)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  -- Deprecata (2026-09-29): il saldo segue i servizi tramite trigger (wallet_entries).
  return;
end;
$function$;

create or replace function public.add_wallet_due(p_amount_eur numeric)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  -- Deprecata (2026-09-29): il taxi dei servizi lo addebita il trigger sulla prenotazione.
  return;
end;
$function$;

-- Acquisto pacchetto: salva il prezzo sul pacchetto; l'addebito lo fa il trigger.
create or replace function public.purchase_service_pass(p_product_id uuid)
returns public.service_passes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_product public.service_products%rowtype;
  v_pass public.service_passes%rowtype;
  v_initial_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non autorizzato';
  end if;
  if p_product_id is null then
    raise exception 'Prodotto mancante';
  end if;

  select * into v_product from public.service_products
  where id = p_product_id and is_active = true;
  if not found then
    raise exception 'Prodotto non trovato o non attivo';
  end if;

  if not exists (select 1 from public.profiles where user_id = v_user_id) then
    raise exception 'Profilo utente non trovato';
  end if;

  v_initial_status := case
    when v_product.service_type in ('ASILO', 'ADDESTRAMENTO', 'CONSULENZA')
      and coalesce(v_product.credits, 0) > 1
      then 'LOCKED'
    else 'ACTIVE'
  end;

  insert into public.service_passes (
    user_id, service_type, service_variant, product_id,
    credits_total, credits_used, status, unlocked_at, price_eur
  )
  values (
    v_user_id, v_product.service_type, v_product.service_variant, v_product.id,
    v_product.credits, 0, v_initial_status,
    case when v_initial_status = 'ACTIVE' then now() else null end,
    coalesce(v_product.price_eur, 0)
  )
  returning * into v_pass;

  return v_pass;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Permessi: tutto il saldo passa dal server. Il cliente conserva solo
--    purchase_service_pass (con il suo controllo auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.wallet_refresh_due(uuid)',
    'public.wallet_entries_after_change()',
    'public.wallet_sync_charge(uuid, text, uuid, numeric, text)',
    'public.wallet_track_booking()',
    'public.wallet_track_slot_booking()',
    'public.wallet_track_pass()',
    'public.is_manage_staff(uuid)',
    'public.settle_user_wallet(uuid, numeric, uuid, text)',
    'public.settle_user_wallet(uuid, numeric, uuid)',
    'public.wallet_adjust(uuid, numeric, text, uuid)',
    'public.wallet_review_opening(uuid, boolean, uuid)',
    'public.delete_tagged_payments(text, uuid)',
    'public.add_wallet_due(uuid, numeric)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Il vecchio client chiama ancora add_wallet_due(numeric) per il taxi: resta
-- eseguibile (non fa nulla) finché il nuovo codice non è pubblicato.
revoke all on function public.add_wallet_due(numeric) from public, anon;
grant execute on function public.add_wallet_due(numeric) to authenticated;

revoke all on function public.purchase_service_pass(uuid) from public, anon;
grant execute on function public.purchase_service_pass(uuid) to authenticated;

commit;
