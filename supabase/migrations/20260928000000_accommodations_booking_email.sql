-- 2026-09-28
-- 1) Email "esito prenotazione" attiva di default
-- 2) Catalogo alloggi pensione gestito dal gestionale (prezzi 1/2/3+ cani + climatizzazione
--    attivabile dallo staff per alloggio)
--
-- Rieseguibile: ogni blocco è idempotente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Notifiche email prenotazione: default attivo (solo prenotazioni, le altre
--    email restano spente). Vale per i nuovi utenti e per chi non ha mai toccato le
--    preferenze (nessuna riga → default nel codice, lib/notifications/preferences.ts).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE notification_preferences ALTER COLUMN booking_email SET DEFAULT true;

-- Chi ha già una riga l'ha creata cambiando un'ALTRA preferenza, quando il default
-- era false: non c'è modo di distinguere chi l'ha spenta apposta. La accendiamo a tutti;
-- chi non la vuole può spegnerla da Impostazioni → Notifiche.
UPDATE notification_preferences SET booking_email = true WHERE booking_email = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Alloggi pensione
--    Prezzi = TOTALE €/giorno per numero di cani dello stesso cliente nella
--    prenotazione (sconto multi-cane incorporato). Le prenotazioni salvano i prezzi
--    su booking_dogs, quindi modificare qui non cambia quelle esistenti.
--    "Elimina" dal gestionale = is_active false (resta per lo storico).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pensione_accommodations (
  key text PRIMARY KEY CHECK (key ~ '^[A-Z0-9_]{1,48}$'),
  label text NOT NULL CHECK (length(trim(label)) > 0),
  species text NOT NULL DEFAULT 'DOG' CHECK (species IN ('DOG', 'CAT')),
  price_1_dog numeric(10,2) NOT NULL CHECK (price_1_dog > 0),
  price_2_dogs numeric(10,2) NOT NULL CHECK (price_2_dogs >= 0),
  price_3_dogs numeric(10,2) NOT NULL CHECK (price_3_dogs >= 0),
  -- Climatizzazione: la accende lo staff; quando è attiva ogni prenotazione in questo
  -- alloggio paga climate_price_per_day €/giorno per cane (il cliente non può toglierla).
  climate_active boolean NOT NULL DEFAULT false,
  climate_price_per_day numeric(10,2) NOT NULL DEFAULT 3 CHECK (climate_price_per_day >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Accesso solo dal server (service role); nessuna policy per i client.
ALTER TABLE pensione_accommodations ENABLE ROW LEVEL SECURITY;

-- Alloggi di serie (allineati a DEFAULT_ACCOMMODATIONS in
-- lib/services/pensione/accommodations.ts). ON CONFLICT DO NOTHING: rieseguire la
-- migration non sovrascrive le modifiche fatte dal gestionale.
--   Box 30 / 54 / 81 e Box con giardino 40 / 72 / 108 → sconto 10% dal 2° cane.
INSERT INTO pensione_accommodations (key, label, species, price_1_dog, price_2_dogs, price_3_dogs, sort_order) VALUES
  ('BOX',                     'Box',                                          'DOG',  30,  54,  81, 10),
  ('BOX_GARDEN',              'Box con giardino',                             'DOG',  40,  72, 108, 20),
  ('CHALET',                  'Chalet',                                       'DOG',  35,  60,  90, 30),
  ('HOTEL',                   'Hotel - stanza luxury con giardino',           'DOG',  45,  80, 110, 40),
  ('APT_GARDEN',              'Appartamento con giardino',                    'DOG',  50,  90, 120, 50),
  ('APT_GARDEN_NIGHT_PERSON', 'Appartamento con giardino (presenza notturna)', 'DOG', 100, 180, 240, 60),
  ('CATTERY',                 'Gattile',                                      'CAT',  25,  45,  60, 70)
ON CONFLICT (key) DO NOTHING;

-- (Tag pagamenti C/CC: vedi 20260929000000_wallet_ledger.sql)
