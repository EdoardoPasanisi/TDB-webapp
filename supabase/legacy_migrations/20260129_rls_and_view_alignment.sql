-- 20260129_rls_and_view_alignment.sql
-- 1) Allinea la view service_slots_with_remaining con la logica della RPC book_service_slot
--    (la RPC considera occupati status IN ('CONFIRMED', 'PAID'))
-- 2) Abilita RLS e aggiunge policies per tabelle core: dogs, profiles, bookings, booking_dogs

-- =========================
-- 1) VIEW ALIGNMENT
-- =========================
create or replace view public.service_slots_with_remaining as
select
  s.id,
  s.service_type,
  s.start_at,
  s.end_at,
  s.capacity,
  s.is_active,
  s.notes,
  s.created_at,
  s.service_variant,
  s.capacity - coalesce(b.cnt, 0) as remaining_capacity
from public.service_slots s
left join (
  select
    ssb.slot_id,
    count(*)::integer as cnt
  from public.service_slot_bookings ssb
  where ssb.status in ('CONFIRMED', 'PAID')
  group by ssb.slot_id
) b on b.slot_id = s.id;

-- =========================
-- 2) RLS + POLICIES (CORE)
-- =========================

-- ---- dogs ----
alter table public.dogs enable row level security;

do $$
begin
  create policy dogs_select_own
    on public.dogs
    for select
    to authenticated
    using (owner_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy dogs_insert_own
    on public.dogs
    for insert
    to authenticated
    with check (owner_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy dogs_update_own
    on public.dogs
    for update
    to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy dogs_delete_own
    on public.dogs
    for delete
    to authenticated
    using (owner_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

-- ---- profiles ----
alter table public.profiles enable row level security;

do $$
begin
  create policy profiles_select_own
    on public.profiles
    for select
    to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy profiles_insert_own
    on public.profiles
    for insert
    to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy profiles_update_own
    on public.profiles
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy profiles_delete_own
    on public.profiles
    for delete
    to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

-- ---- bookings ----
alter table public.bookings enable row level security;

do $$
begin
  create policy bookings_select_own
    on public.bookings
    for select
    to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy bookings_insert_own
    on public.bookings
    for insert
    to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy bookings_update_own
    on public.bookings
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy bookings_delete_own
    on public.bookings
    for delete
    to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;

-- ---- booking_dogs ----
alter table public.booking_dogs enable row level security;

do $$
begin
  create policy booking_dogs_select_own
    on public.booking_dogs
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.bookings b
        where b.id = booking_dogs.booking_id
          and b.user_id = auth.uid()
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy booking_dogs_insert_own
    on public.booking_dogs
    for insert
    to authenticated
    with check (
      exists (
        select 1
        from public.bookings b
        where b.id = booking_dogs.booking_id
          and b.user_id = auth.uid()
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy booking_dogs_update_own
    on public.booking_dogs
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.bookings b
        where b.id = booking_dogs.booking_id
          and b.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.bookings b
        where b.id = booking_dogs.booking_id
          and b.user_id = auth.uid()
      )
    );
exception when duplicate_object then
  null;
end $$;

do $$
begin
  create policy booking_dogs_delete_own
    on public.booking_dogs
    for delete
    to authenticated
    using (
      exists (
        select 1
        from public.bookings b
        where b.id = booking_dogs.booking_id
          and b.user_id = auth.uid()
      )
    );
exception when duplicate_object then
  null;
end $$;
