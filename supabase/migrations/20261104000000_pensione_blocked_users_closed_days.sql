-- Clienti bloccati per la pensione.
-- Lo staff può impedire a clienti specifici di prenotare la pensione: in fase di
-- prenotazione vedranno il normale avviso "non c'è posto" per qualsiasi periodo,
-- senza sapere di essere bloccati. Le prenotazioni create dal gestionale non sono
-- soggette al blocco.
--
-- Tabella separata (e non una colonna su profiles) perché il cliente può aggiornare
-- il proprio profilo dal client: qui invece si passa solo dal service role.

CREATE TABLE IF NOT EXISTS pensione_blocked_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pensione_blocked_users ENABLE ROW LEVEL SECURITY;

-- Giorni di chiusura pensione (niente ingressi né uscite, si può restare a cavallo).
-- Di base sono chiusi tutti i festivi nazionali, calcolati nel codice
-- (lib/services/pensione/holidays.ts). Qui si salvano solo le eccezioni decise dallo
-- staff, giorno per giorno:
--   closed = true  → giorno di chiusura aggiunto (es. patrono, 24/12);
--   closed = false → festivo riaperto (ingressi/uscite consentiti quel giorno).
CREATE TABLE IF NOT EXISTS pensione_closed_days (
  day date PRIMARY KEY,
  closed boolean NOT NULL,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pensione_closed_days ENABLE ROW LEVEL SECURITY;
