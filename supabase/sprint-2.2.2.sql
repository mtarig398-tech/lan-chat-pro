-- LAN Chat Pro Sprint 2.2.2
-- Run once in Supabase SQL Editor as postgres.

begin;

alter table public.chats
  add column if not exists last_message_at timestamptz;

alter table public.chat_members
  add column if not exists last_read_at timestamptz;

create index if not exists idx_chats_last_message_at
on public.chats(last_message_at desc nulls last);

create index if not exists idx_messages_chat_created_sender
on public.messages(chat_id, created_at desc, sender_id);

create or replace function public.touch_chat_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats
  set last_message_at = new.created_at
  where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_last_message on public.messages;

create trigger trg_touch_chat_last_message
after insert on public.messages
for each row execute function public.touch_chat_last_message();

update public.chats c
set last_message_at = latest.created_at
from (
  select distinct on (chat_id) chat_id, created_at
  from public.messages
  where deleted_at is null
  order by chat_id, created_at desc
) latest
where c.id = latest.chat_id;

drop policy if exists "chat_members_update_self_or_manager"
on public.chat_members;

create policy "chat_members_update_self_or_manager"
on public.chat_members
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or public.can_manage_chat(chat_id)
)
with check (
  user_id = auth.uid()
  or public.is_admin()
  or public.can_manage_chat(chat_id)
);

drop policy if exists "chats_delete_owner"
on public.chats;

create policy "chats_delete_owner"
on public.chats
for delete
to authenticated
using (
  public.is_admin()
  or created_by = auth.uid()
  or public.can_manage_chat(id)
);

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
