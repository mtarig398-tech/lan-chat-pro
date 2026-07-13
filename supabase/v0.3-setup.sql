-- LAN Chat Pro v0.3
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin','admin')
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

update public.profiles
set role = 'super_admin'
where id = (select id from public.profiles order by created_at asc limit 1);

drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "chats_admin_all" on public.chats;
create policy "chats_admin_all"
on public.chats
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "chat_members_admin_all" on public.chat_members;
create policy "chat_members_admin_all"
on public.chat_members
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "messages_admin_all" on public.messages;
create policy "messages_admin_all"
on public.messages
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
