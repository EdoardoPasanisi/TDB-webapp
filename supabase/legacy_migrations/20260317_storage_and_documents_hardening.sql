-- 20260317_storage_and_documents_hardening.sql
-- Hardening bucket/storage e metadata documenti utente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-documents',
  'identity-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dog-images',
  'dog-images',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "identity_documents_select_own" on storage.objects;
create policy "identity_documents_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "identity_documents_insert_own" on storage.objects;
create policy "identity_documents_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "identity_documents_delete_own" on storage.objects;
create policy "identity_documents_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.user_documents enable row level security;

drop policy if exists user_documents_select_own on public.user_documents;
create policy user_documents_select_own
on public.user_documents
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_documents_insert_own_pending on public.user_documents;
create policy user_documents_insert_own_pending
on public.user_documents
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'PENDING'
  and accepted_at is null
  and rejected_at is null
  and staff_note is null
);

drop policy if exists user_documents_delete_own_pending on public.user_documents;
create policy user_documents_delete_own_pending
on public.user_documents
for delete
to authenticated
using (
  user_id = auth.uid()
  and status = 'PENDING'
);

revoke update on public.user_documents from authenticated;
