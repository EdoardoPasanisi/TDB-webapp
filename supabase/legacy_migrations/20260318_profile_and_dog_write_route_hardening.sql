-- 20260318_profile_and_dog_write_route_hardening.sql
-- Sposta le mutazioni profilo/cane su route server-side e chiude il DML client-side.

drop policy if exists dogs_insert_own on public.dogs;
drop policy if exists dogs_update_own on public.dogs;

revoke insert, update on public.dogs from authenticated;

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

revoke insert, update on public.profiles from authenticated;
