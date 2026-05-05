create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text not null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  title text not null,
  planned_date date not null,
  start_datetime timestamptz not null,
  status text not null default '進行中' check (status in ('進行中','已完成')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

create policy if not exists "profiles_select_own_or_admin"
on public.profiles
for select
using (
  auth.uid() = id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy if not exists "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy if not exists "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy if not exists "tasks_select_own_or_admin"
on public.tasks
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy if not exists "tasks_insert_own"
on public.tasks
for insert
with check (auth.uid() = user_id);

create policy if not exists "tasks_update_own_or_admin"
on public.tasks
for update
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy if not exists "tasks_delete_own_or_admin"
on public.tasks
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
