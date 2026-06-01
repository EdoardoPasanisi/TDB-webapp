-- 20260318_user_document_route_hardening.sql
-- I documenti utente vengono scritti solo tramite route server-side.

drop policy if exists "identity_documents_insert_own" on storage.objects;
drop policy if exists "identity_documents_delete_own" on storage.objects;

drop policy if exists user_documents_insert_own_pending on public.user_documents;
drop policy if exists user_documents_delete_own_pending on public.user_documents;

revoke insert on public.user_documents from authenticated;
revoke delete on public.user_documents from authenticated;
