-- Supporto ai video gestiti tramite Cloudflare Stream.
-- I video non sono piu archiviati su Supabase Storage: vengono caricati direttamente
-- su Cloudflare (upload resumable) e riprodotti via player firmato.
-- Le foto restano su Supabase Storage con il flusso firmato esistente.

alter table public.customer_media
  add column if not exists provider text not null default 'supabase',
  add column if not exists stream_uid text,
  add column if not exists status text not null default 'ready',
  add column if not exists duration_seconds numeric,
  add column if not exists thumbnail_url text;

-- I video Cloudflare non hanno uno storage_path su Supabase.
alter table public.customer_media
  alter column storage_path drop not null;

-- Lookup rapido dal webhook Cloudflare (match per stream_uid).
create index if not exists customer_media_stream_uid_idx
  on public.customer_media (stream_uid);

-- Coerenza: o c'e uno storage_path (foto Supabase) o uno stream_uid (video Cloudflare).
alter table public.customer_media
  drop constraint if exists customer_media_source_present;
alter table public.customer_media
  add constraint customer_media_source_present
  check (storage_path is not null or stream_uid is not null);
