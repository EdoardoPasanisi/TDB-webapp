-- 20260317_profile_and_dog_delete_hardening.sql
-- Rimuove delete fisici client-side non necessari.

drop policy if exists profiles_delete_own on public.profiles;
drop policy if exists dogs_delete_own on public.dogs;

revoke delete on public.profiles from authenticated;
revoke delete on public.dogs from authenticated;
