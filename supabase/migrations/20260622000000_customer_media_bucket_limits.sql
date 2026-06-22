-- Allinea il bucket dei media cliente al flusso di upload firmato.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-media',
  'customer-media',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
