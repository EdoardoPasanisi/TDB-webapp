-- =============================================================
-- Pet generici (cane/gatto/altro) + nome libretto + stato stampa pensione
-- Idempotente.
--   - dogs.species: DOG (default), CAT, OTHER. La tabella resta `dogs`.
--   - dogs.species_other: testo libero "specie" per OTHER.
--   - dogs.libretto_name: nome sul libretto (solo cani), default = nome.
--   - bookings.printed_at: stato "stampata" (solo pensione).
-- =============================================================

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS species text NOT NULL DEFAULT 'DOG';
ALTER TABLE public.dogs
  DROP CONSTRAINT IF EXISTS dogs_species_check;
ALTER TABLE public.dogs
  ADD CONSTRAINT dogs_species_check CHECK (species = ANY (ARRAY['DOG'::text, 'CAT'::text, 'OTHER'::text]));

ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS species_other text;
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS libretto_name text;

-- Backfill: i record esistenti sono cani e il nome libretto parte dal nome.
UPDATE public.dogs SET libretto_name = name WHERE libretto_name IS NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS printed_at timestamptz;
