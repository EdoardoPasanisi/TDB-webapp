-- Blocco informazioni cane verificate dallo staff.
-- Quando lo staff conferma una prenotazione pensione, le informazioni "da libretto"
-- del cane (nome sul libretto, razza, microchip, data di nascita — con taglia/difficoltà
-- derivate) vengono verificate e bloccate: da quel momento l'utente non può più
-- modificarle autonomamente, solo lo staff dal gestionale.
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS info_locked boolean NOT NULL DEFAULT false;
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS info_locked_at timestamptz;
