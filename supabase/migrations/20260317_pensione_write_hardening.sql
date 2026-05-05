-- 20260317_pensione_write_hardening.sql
-- Sposta le scritture pensione lato server e chiude le policy DML client-side legacy.

drop policy if exists bookings_insert_own on public.bookings;
drop policy if exists bookings_update_own on public.bookings;
drop policy if exists bookings_delete_own on public.bookings;

drop policy if exists booking_dogs_insert_own on public.booking_dogs;
drop policy if exists booking_dogs_update_own on public.booking_dogs;
drop policy if exists booking_dogs_delete_own on public.booking_dogs;

revoke insert, update, delete on public.bookings from authenticated;
revoke insert, update, delete on public.booking_dogs from authenticated;
revoke insert, update, delete on public.service_passes from authenticated;
revoke insert, update, delete on public.service_slot_bookings from authenticated;
