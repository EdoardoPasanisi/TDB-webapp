create extension if not exists "pgcrypto";

create table if not exists public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN', 'VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_accounts_role_idx
  on public.staff_accounts (role, is_active);

alter table public.staff_accounts enable row level security;

do $$
begin
  create policy staff_accounts_select_own
    on public.staff_accounts
    for select
    to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then
  null;
end $$;
