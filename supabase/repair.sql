create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  display_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  owner_name text not null,
  title text not null,
  planned_date date not null,
  start_datetime timestamptz not null,
  status text not null default '進行中' check (status in ('進行中', '已完成')),
  created_at timestamptz not null default now()
);

alter table public.app_users disable row level security;
alter table public.tasks disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.app_users to anon, authenticated;
grant select, insert, update, delete on table public.tasks to anon, authenticated;

insert into public.app_users (username, password, display_name, role)
values ('admin', 'admin', '管理員', 'admin')
on conflict (username) do update
set password = excluded.password,
    display_name = excluded.display_name,
    role = excluded.role;

delete from public.tasks t
where not exists (
  select 1
  from public.app_users u
  where u.id = t.user_id
);

alter table public.tasks
drop constraint if exists tasks_user_id_fkey;

alter table public.tasks
add constraint tasks_user_id_fkey
foreign key (user_id) references public.app_users(id)
on delete cascade;
