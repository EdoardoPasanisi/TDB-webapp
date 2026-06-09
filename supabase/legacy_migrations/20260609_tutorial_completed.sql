-- 20260609_tutorial_completed.sql
-- Onboarding tutorial: traccia quando un utente ha completato (o saltato) il tour guidato,
-- così non viene riproposto automaticamente ad ogni accesso.

alter table public.profiles
add column if not exists tutorial_completed_at timestamptz;
