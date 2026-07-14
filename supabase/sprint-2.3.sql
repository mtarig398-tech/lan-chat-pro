-- LAN Chat Pro Sprint 2.3
begin;

alter table public.chats
  add column if not exists last_message_at timestamptz;

alter table public.chat_members
  add column if not exists last_read_at timestamptz;

create or replace function public.delete_group(target_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin()
    or exists (
      select 1
      from public.chat_members
      where chat_id = target_chat_id
        and user_id = auth.uid()
        and member_role = 'owner'
    )
  ) then
    raise exception 'ليس لديك صلاحية حذف المجموعة';
  end if;

  delete from public.messages where chat_id = target_chat_id;
  delete from public.chat_members where chat_id = target_chat_id;
  delete from public.chats where id = target_chat_id and type = 'group';
end;
$$;

grant execute on function public.delete_group(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_members;
exception when duplicate_object then null;
end $$;

commit;
