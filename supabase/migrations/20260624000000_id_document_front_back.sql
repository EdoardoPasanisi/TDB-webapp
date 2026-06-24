-- Documento d'identità su due lati (fronte + retro).
-- Il documento "singolo" esistente (profiles.id_document_path /
-- id_document_uploaded_at) diventa il FRONTE; aggiungiamo le colonne per il
-- RETRO e la colonna `side` su user_documents per distinguere i due lati.

-- 1) Profilo: colonne per il retro (il fronte resta su id_document_path).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_document_back_path text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_document_back_uploaded_at timestamptz;

-- 2) user_documents: lato del documento d'identità (NULL per le liberatorie).
ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS side text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_documents_side_check'
  ) THEN
    ALTER TABLE user_documents
      ADD CONSTRAINT user_documents_side_check
      CHECK (side IS NULL OR side = ANY (ARRAY['FRONT'::text, 'BACK'::text]));
  END IF;
END $$;

-- 3) Backfill: i documenti d'identità esistenti diventano il FRONTE.
UPDATE user_documents
SET side = 'FRONT'
WHERE kind = 'ID_DOCUMENT' AND side IS NULL;
