-- =============================================================
-- Ruolo "Amministratore plus" (SUPER_ADMIN) + directory staff
-- Idempotente.
--   - SUPER_ADMIN: come ADMIN (poteri completi) + gestione degli altri staff.
--   - Aggiorna le policy RLS che riconoscono solo 'ADMIN' per includere SUPER_ADMIN.
--   - Vista staff_members_directory: email + nome/cognome dei membri staff (per il DB).
-- =============================================================

-- 1) Consenti il nuovo ruolo nel CHECK di staff_accounts.
ALTER TABLE public.staff_accounts
  DROP CONSTRAINT IF EXISTS staff_accounts_role_check;
ALTER TABLE public.staff_accounts
  ADD CONSTRAINT staff_accounts_role_check
  CHECK (role = ANY (ARRAY['ADMIN'::text, 'VIEWER'::text, 'SUPER_ADMIN'::text]));

-- 2) Policy RLS chat: lo staff con poteri completi (ADMIN o SUPER_ADMIN) può leggere.
DROP POLICY IF EXISTS "chat_conversations_select_own_or_admin" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select_own_or_admin" ON public.chat_conversations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid())
    OR (EXISTS (
      SELECT 1 FROM public.staff_accounts sa
      WHERE sa.user_id = auth.uid()
        AND sa.is_active = true
        AND sa.role = ANY (ARRAY['ADMIN'::text, 'SUPER_ADMIN'::text])
    ))
  );

DROP POLICY IF EXISTS "chat_messages_select_own_or_admin" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own_or_admin" ON public.chat_messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.user_id = auth.uid()
    ))
    OR (EXISTS (
      SELECT 1 FROM public.staff_accounts sa
      WHERE sa.user_id = auth.uid()
        AND sa.is_active = true
        AND sa.role = ANY (ARRAY['ADMIN'::text, 'SUPER_ADMIN'::text])
    ))
  );

-- 3) Directory staff: per vedere chi sono i membri (email + nome) direttamente dal DB.
--    La vista gira come owner (postgres) e può leggere auth.users.
CREATE OR REPLACE VIEW public.staff_members_directory AS
SELECT
  sa.user_id,
  sa.role,
  sa.is_active,
  sa.created_at,
  sa.updated_at,
  u.email,
  p.first_name,
  p.last_name
FROM public.staff_accounts sa
LEFT JOIN auth.users u ON u.id = sa.user_id
LEFT JOIN public.profiles p ON p.user_id = sa.user_id;
