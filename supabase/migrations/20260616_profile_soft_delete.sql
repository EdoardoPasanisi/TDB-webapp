-- =============================================================
-- Gestionale full management — soft-delete utenti
-- Idempotente: aggiunge profiles.deleted_at per il soft-delete.
-- L'hard-delete (auth.users + dati collegati) avviene via service role
-- dalla pagina "Utenti eliminati" del gestionale.
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Lista "attivi" del gestionale = profili non soft-deleted.
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON public.profiles (deleted_at);
