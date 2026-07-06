-- Device token per le push notification native.
-- Un utente può avere più device (più token). Il token APNs è la chiave: se lo
-- stesso device si ri-registra, l'upsert aggiorna la riga esistente.
-- La FK con ON DELETE CASCADE fa sì che i token spariscano automaticamente quando
-- l'account viene eliminato (purgeUserAccount cancella l'utente auth.users).

CREATE TABLE IF NOT EXISTS push_tokens (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  platform   text NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);

-- Le query passano sempre dal service role (supabaseAdmin); abilitiamo comunque RLS
-- senza policy pubbliche per impedire accessi dal client anonimo.
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
