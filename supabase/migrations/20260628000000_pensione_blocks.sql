-- Blocco prenotazioni pensione per periodo.
-- Lo staff può "chiudere" un intervallo di date per la pensione, o per tutti gli
-- utenti (scope = ALL) oppure solo per alcune razze (scope = BREEDS, lista in
-- `breeds`). Se un utente possiede anche un solo cane di razza bloccata, è bloccato
-- per l'intero periodo, qualunque cane voglia prenotare.

CREATE TABLE IF NOT EXISTS pensione_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date   date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('ALL', 'BREEDS')),
  breeds text[] NOT NULL DEFAULT '{}',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pensione_blocks_range_check CHECK (end_date >= start_date),
  CONSTRAINT pensione_blocks_breeds_check CHECK (scope = 'ALL' OR array_length(breeds, 1) >= 1)
);

CREATE INDEX IF NOT EXISTS pensione_blocks_range_idx
  ON pensione_blocks (start_date, end_date)
  WHERE is_active;

-- Le query passano sempre dal service role (supabaseAdmin); abilitiamo comunque RLS
-- senza policy pubbliche per impedire accessi dal client anonimo.
ALTER TABLE pensione_blocks ENABLE ROW LEVEL SECURITY;
