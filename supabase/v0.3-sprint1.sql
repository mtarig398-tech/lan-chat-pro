-- LAN Chat Pro v0.3 Sprint 1
-- Run once in Supabase SQL Editor as postgres.

create index if not exists idx_profiles_status_last_seen
on public.profiles(status, last_seen);

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
