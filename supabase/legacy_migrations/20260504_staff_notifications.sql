create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('BOOKING_ACTION_REQUIRED', 'DOCUMENT_ACTION_REQUIRED', 'CHAT_ACTION_REQUIRED')),
  title text not null,
  body text not null,
  data_json jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists staff_notifications_user_id_created_at_idx
  on public.staff_notifications (user_id, created_at desc);

create index if not exists staff_notifications_user_id_read_at_idx
  on public.staff_notifications (user_id, read_at, created_at desc);

alter table public.staff_notifications enable row level security;

drop policy if exists staff_notifications_select_own on public.staff_notifications;
create policy staff_notifications_select_own
on public.staff_notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists staff_notifications_update_own on public.staff_notifications;
create policy staff_notifications_update_own
on public.staff_notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
