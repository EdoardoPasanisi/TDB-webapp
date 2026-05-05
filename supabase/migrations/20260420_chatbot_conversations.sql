create extension if not exists "pgcrypto";

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'BOT_ACTIVE'
    check (status in ('BOT_ACTIVE', 'HANDOFF_REQUESTED', 'ADMIN_ACTIVE', 'CLOSED')),
  title text null,
  handoff_reason text null
    check (handoff_reason in ('USER_REQUEST', 'MODEL_UNCERTAIN', 'SENSITIVE_TOPIC', 'SYSTEM_ERROR')),
  handoff_summary text null,
  assigned_admin_user_id uuid null references auth.users(id) on delete set null,
  handoff_requested_at timestamptz null,
  admin_claimed_at timestamptz null,
  closed_at timestamptz null,
  last_message_at timestamptz not null default now(),
  last_message_preview text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chat_conversations_user_active_idx
  on public.chat_conversations (user_id)
  where status <> 'CLOSED';

create index if not exists chat_conversations_status_last_message_idx
  on public.chat_conversations (status, last_message_at desc);

create index if not exists chat_conversations_assigned_admin_idx
  on public.chat_conversations (assigned_admin_user_id, status, last_message_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_type text not null
    check (sender_type in ('USER', 'ASSISTANT', 'ADMIN', 'SYSTEM')),
  admin_user_id uuid null references auth.users(id) on delete set null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at asc);

create index if not exists chat_messages_sender_created_idx
  on public.chat_messages (sender_type, created_at desc);

create or replace function public.chat_set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists chat_conversations_set_updated_at on public.chat_conversations;
create trigger chat_conversations_set_updated_at
before update on public.chat_conversations
for each row
execute function public.chat_set_updated_at();

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chat_conversations_select_own_or_admin on public.chat_conversations;
create policy chat_conversations_select_own_or_admin
on public.chat_conversations
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.staff_accounts sa
    where sa.user_id = auth.uid()
      and sa.is_active = true
      and sa.role = 'ADMIN'
  )
);

drop policy if exists chat_messages_select_own_or_admin on public.chat_messages;
create policy chat_messages_select_own_or_admin
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chat_conversations c
    where c.id = chat_messages.conversation_id
      and c.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.staff_accounts sa
    where sa.user_id = auth.uid()
      and sa.is_active = true
      and sa.role = 'ADMIN'
  )
);
