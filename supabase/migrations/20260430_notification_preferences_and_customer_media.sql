create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  booking_in_app boolean not null default true,
  booking_email boolean not null default false,
  document_in_app boolean not null default true,
  document_email boolean not null default false,
  chat_in_app boolean not null default true,
  chat_email boolean not null default false,
  media_in_app boolean not null default true,
  media_email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own
on public.notification_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own
on public.notification_preferences
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('customer-media', 'customer-media', false)
on conflict (id) do nothing;

create table if not exists public.customer_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  dog_id uuid null references public.dogs(id) on delete set null,
  media_type text not null check (media_type in ('IMAGE', 'VIDEO')),
  storage_path text not null,
  caption text null,
  visible_until timestamptz not null,
  created_by_staff_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_media_user_id_created_at_idx
  on public.customer_media (user_id, created_at desc);

create index if not exists customer_media_booking_id_created_at_idx
  on public.customer_media (booking_id, created_at desc);

create index if not exists customer_media_visible_until_idx
  on public.customer_media (visible_until desc);

alter table public.customer_media enable row level security;

drop policy if exists customer_media_select_own on public.customer_media;
create policy customer_media_select_own
on public.customer_media
for select
to authenticated
using (auth.uid() = user_id and visible_until >= now());
