-- 20251223_services_schema_align.sql
-- Allineamento schema servizi per:
-- - calendar unico (booking già fissati)
-- - crediti/pacchetti (service_products, service_passes)
-- - modal "Fissa data" con slot prenotabili
-- - multi-cane (dog_ids[]) per ASILO/ADDESTRAMENTO
-- - consulenza senza cane
-- - taxi opzionale in prenotazione (prezzo per distanza)

create extension if not exists "pgcrypto";

-- =========================
-- 1) PATCH service_slots (tabella esistente)
-- =========================
alter table public.service_slots
  add column if not exists service_variant text null;

create index if not exists service_slots_type_variant_start_idx
  on public.service_slots (service_type, service_variant, start_at);

-- =========================
-- 2) PATCH service_slot_bookings (tabella esistente)
-- =========================
alter table public.service_slot_bookings
  add column if not exists service_variant text null;

-- Multi-cane: nuovo dog_ids[]
alter table public.service_slot_bookings
  add column if not exists dog_ids uuid[] null;

-- Taxi opzionale (solo al momento della prenotazione)
alter table public.service_slot_bookings
  add column if not exists taxi_enabled boolean not null default false;

alter table public.service_slot_bookings
  add column if not exists taxi_distance_km numeric null;

alter table public.service_slot_bookings
  add column if not exists taxi_price_eur numeric null;

-- Pass/crediti
alter table public.service_slot_bookings
  add column if not exists pass_id uuid null;

alter table public.service_slot_bookings
  add column if not exists credits_spent integer not null default 1;

-- Rimane dog_id per backward compatibility, ma NON lo useremo più.
-- (più avanti, quando migriamo i dati, potremo eliminarlo)
-- Qui non lo droppiamo per non rompere codice/record esistenti.

-- Indici utili
create index if not exists service_slot_bookings_user_idx
  on public.service_slot_bookings (user_id);

create index if not exists service_slot_bookings_slot_idx
  on public.service_slot_bookings (slot_id);

-- Safety: un utente non prenota 2 volte lo stesso slot
create unique index if not exists service_slot_bookings_unique_user_slot
  on public.service_slot_bookings (user_id, slot_id);

-- =========================
-- 3) CREATE service_products (mancante)
-- =========================
create table if not exists public.service_products (
  id uuid primary key default gen_random_uuid(),
  service_type text not null check (service_type in ('PENSIONE','ASILO','ADDESTRAMENTO','CONSULENZA')),
  service_variant text null,
  name text not null,
  credits integer not null check (credits >= 1),
  price_eur numeric not null check (price_eur >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists service_products_type_variant_idx
  on public.service_products (service_type, service_variant);

-- =========================
-- 4) CREATE service_passes (mancante)
-- =========================
create table if not exists public.service_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  service_type text not null check (service_type in ('PENSIONE','ASILO','ADDESTRAMENTO','CONSULENZA')),
  service_variant text null,
  product_id uuid null references public.service_products(id) on delete set null,

  credits_total integer not null check (credits_total >= 1),
  credits_used integer not null default 0 check (credits_used >= 0),

  status text not null default 'ACTIVE' check (status in ('ACTIVE','CONSUMED','EXPIRED','CANCELLED')),
  purchased_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists service_passes_user_idx
  on public.service_passes (user_id);

create index if not exists service_passes_user_type_variant_idx
  on public.service_passes (user_id, service_type, service_variant, status);

-- Aggancio FK su pass_id (che abbiamo appena aggiunto sopra)
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema='public'
      and tc.table_name='service_slot_bookings'
      and tc.constraint_type='FOREIGN KEY'
      and tc.constraint_name='service_slot_bookings_pass_id_fkey'
  ) then
    alter table public.service_slot_bookings
      add constraint service_slot_bookings_pass_id_fkey
      foreign key (pass_id) references public.service_passes(id)
      on delete set null;
  end if;
end $$;

-- =========================
-- 5) RLS (abilita e crea policy minime)
-- =========================
alter table public.service_products enable row level security;
alter table public.service_passes enable row level security;

-- service_slots e service_slot_bookings probabilmente hanno già RLS: abilitiamo comunque
alter table public.service_slots enable row level security;
alter table public.service_slot_bookings enable row level security;

-- Products: select attivi
drop policy if exists "service_products_select_active_authenticated" on public.service_products;
create policy "service_products_select_active_authenticated"
on public.service_products
for select
to authenticated
using (is_active = true);

-- Passes: select own
drop policy if exists "service_passes_select_own" on public.service_passes;
create policy "service_passes_select_own"
on public.service_passes
for select
to authenticated
using (user_id = auth.uid());

-- Passes: insert own (MVP acquisto simulato)
drop policy if exists "service_passes_insert_own" on public.service_passes;
create policy "service_passes_insert_own"
on public.service_passes
for insert
to authenticated
with check (user_id = auth.uid());

-- Slots: select attivi
drop policy if exists "service_slots_select_active_authenticated" on public.service_slots;
create policy "service_slots_select_active_authenticated"
on public.service_slots
for select
to authenticated
using (is_active = true);

-- Bookings: select own
drop policy if exists "service_slot_bookings_select_own" on public.service_slot_bookings;
create policy "service_slot_bookings_select_own"
on public.service_slot_bookings
for select
to authenticated
using (user_id = auth.uid());

-- Bookings: insert own (per ora, poi useremo RPC)
drop policy if exists "service_slot_bookings_insert_own" on public.service_slot_bookings;
create policy "service_slot_bookings_insert_own"
on public.service_slot_bookings
for insert
to authenticated
with check (user_id = auth.uid());

-- =========================
-- 6) Seed prodotti (prezzi definitivi)
-- =========================
insert into public.service_products (service_type, service_variant, name, credits, price_eur, is_active)
values
  ('ADDESTRAMENTO','SESSION_60','Addestramento - 1 lezione (60m)', 1, 40, true),
  ('ADDESTRAMENTO','SESSION_60','Addestramento - Pacchetto 10 lezioni (60m)', 10, 350, true),
  ('CONSULENZA','SESSION_60','Consulenza cinofila - 1 sessione (60m)', 1, 40, true),

  ('ASILO','HALF','Asilo - Mezza giornata (1 ingresso)', 1, 22, true),
  ('ASILO','HALF','Asilo - Mezza giornata (10 ingressi)', 10, 190, true),
  ('ASILO','HALF','Asilo - Mezza giornata (20 ingressi)', 20, 360, true),

  ('ASILO','FULL','Asilo - Giornata intera (1 ingresso)', 1, 34, true),
  ('ASILO','FULL','Asilo - Giornata intera (10 ingressi)', 10, 300, true),
  ('ASILO','FULL','Asilo - Giornata intera (20 ingressi)', 20, 560, true)
on conflict do nothing;
