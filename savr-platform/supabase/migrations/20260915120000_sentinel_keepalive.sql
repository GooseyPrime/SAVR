-- Supabase sentinel: keep-alive heartbeat + capacity probe.
--
-- Supabase pauses a Free plan project when it sees too little *user database
-- activity* over a rolling 7 day window. The scheduled route at
-- /api/cron/supabase-sentinel writes to and reads from the table below once a
-- day, which is the activity that keeps the project out of the pause queue.
-- The same route reads sentinel_status() to compare the project against the
-- Free plan allowances.

create table if not exists public.sentinel_heartbeat (
  id smallint primary key default 1,
  last_ping_at timestamptz not null default now(),
  ping_count bigint not null default 0,
  constraint sentinel_heartbeat_single_row check (id = 1)
);

alter table public.sentinel_heartbeat enable row level security;

insert into public.sentinel_heartbeat (id) values (1) on conflict (id) do nothing;

-- Anonymous callers may read the single row and nothing else. The read is what
-- makes the keep-alive traverse the same PostgREST path a deployed client uses.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sentinel_heartbeat'
      and policyname = 'sentinel_heartbeat_anon_read'
  ) then
    create policy sentinel_heartbeat_anon_read
      on public.sentinel_heartbeat
      for select
      to anon, authenticated
      using (true);
  end if;
end
$$;

grant select on public.sentinel_heartbeat to anon, authenticated;

comment on table public.sentinel_heartbeat is
  'Managed by the Supabase sentinel cron. Touched daily so the Free plan project is never paused for inactivity.';

-- One call, one write: the touch the scheduled job makes each day.
create or replace function public.sentinel_touch()
returns timestamptz
language sql
security definer
set search_path = public, pg_catalog
as $$
  insert into public.sentinel_heartbeat (id, last_ping_at, ping_count)
  values (1, now(), 1)
  on conflict (id) do update
    set last_ping_at = now(),
        ping_count = public.sentinel_heartbeat.ping_count + 1
  returning last_ping_at;
$$;

revoke all on function public.sentinel_touch() from public, anon, authenticated;
grant execute on function public.sentinel_touch() to service_role;

comment on function public.sentinel_touch() is
  'Records one keep-alive touch. Service role only.';

-- Capacity snapshot. Definer rights are required to read pg_database_size,
-- storage.objects and auth.users; execution is restricted to the service role,
-- so no client-side caller can reach it.
create or replace function public.sentinel_status()
returns table (
  database_bytes bigint,
  storage_bytes bigint,
  monthly_active_users bigint,
  total_users bigint,
  last_ping_at timestamptz
)
language sql
security definer
set search_path = public, storage, auth, pg_catalog
as $$
  select
    pg_database_size(current_database())::bigint,
    (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects)::bigint,
    (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days')::bigint,
    (select count(*) from auth.users)::bigint,
    (select h.last_ping_at from public.sentinel_heartbeat h where h.id = 1);
$$;

revoke all on function public.sentinel_status() from public, anon, authenticated;
grant execute on function public.sentinel_status() to service_role;

comment on function public.sentinel_status() is
  'Free plan capacity snapshot for the Supabase sentinel cron. Service role only.';
