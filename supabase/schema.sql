-- LAN Chat Pro v0.2 - Initial secure schema
create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('super_admin', 'admin', 'moderator', 'user');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  role public.app_role not null default 'user',
  status text not null default 'offline' check (status in ('online','busy','offline')),
  last_seen timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('private','group')),
  name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  chat_id uuid references public.chats(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','admin','member')),
  is_muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  message_type text not null default 'text' check (message_type in ('text','image','file')),
  reply_to uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.message_receipts (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create index if not exists messages_chat_created_idx on public.messages(chat_id, created_at desc);
create index if not exists chat_members_user_idx on public.chat_members(user_id);

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;

create policy "profiles visible to authenticated users" on public.profiles
for select to authenticated using (true);

create policy "users update own profile" on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "members see their chats" on public.chats
for select to authenticated using (
  exists (select 1 from public.chat_members cm where cm.chat_id = id and cm.user_id = (select auth.uid()))
);

create policy "members list own chat memberships" on public.chat_members
for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.chat_members mine where mine.chat_id = chat_id and mine.user_id = (select auth.uid())
  )
);

create policy "members read messages" on public.messages
for select to authenticated using (
  exists (select 1 from public.chat_members cm where cm.chat_id = chat_id and cm.user_id = (select auth.uid()))
);

create policy "members send messages" on public.messages
for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.chat_members cm where cm.chat_id = chat_id and cm.user_id = (select auth.uid())
  )
);

create policy "sender edits own messages" on public.messages
for update to authenticated
using (sender_id = (select auth.uid()))
with check (sender_id = (select auth.uid()));

create policy "users manage own receipts" on public.message_receipts
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
