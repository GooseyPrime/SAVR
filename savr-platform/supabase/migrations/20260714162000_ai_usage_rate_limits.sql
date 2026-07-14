-- Durable AI usage tracking for corrective PR 5.
-- Stores per-user usage counters in bounded windows so AI limits survive restarts
-- and can be enforced atomically across concurrent requests.

create table if not exists public.ai_usage_limits (
  user_id uuid references public.users on delete cascade not null,
  feature text not null,
  window_start timestamp with time zone not null,
  window_seconds integer not null check (window_seconds > 0),
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, feature, window_start, window_seconds)
);

comment on table public.ai_usage_limits is 'Durable per-user AI usage counters for monthly quotas and short burst limits.';

alter table public.ai_usage_limits enable row level security;

create policy "Users can read own ai usage limits"
  on public.ai_usage_limits
  for select
  using (auth.uid() = user_id);

create policy "Service role can manage ai usage limits"
  on public.ai_usage_limits
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

create trigger handle_ai_usage_limits_updated_at
  before update on public.ai_usage_limits
  for each row execute procedure public.handle_updated_at();

create index ai_usage_limits_feature_window_idx
  on public.ai_usage_limits(feature, window_start desc);

create or replace function public.consume_ai_usage_limit(
  p_user_id uuid,
  p_feature text,
  p_window_start timestamp with time zone,
  p_window_seconds integer,
  p_limit integer
)
returns table (
  allowed boolean,
  request_count integer,
  remaining integer,
  reset_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reset_at timestamp with time zone := p_window_start + (p_window_seconds * interval '1 second');
  v_request_count integer;
begin
  if p_limit < 1 then
    raise exception 'p_limit must be positive';
  end if;

  if p_window_seconds < 1 then
    raise exception 'p_window_seconds must be positive';
  end if;

  insert into public.ai_usage_limits (
    user_id,
    feature,
    window_start,
    window_seconds,
    request_count
  )
  values (
    p_user_id,
    p_feature,
    p_window_start,
    p_window_seconds,
    0
  )
  on conflict do nothing;

  update public.ai_usage_limits
     set request_count = ai_usage_limits.request_count + 1,
         updated_at = timezone('utc'::text, now())
   where ai_usage_limits.user_id = p_user_id
     and ai_usage_limits.feature = p_feature
     and ai_usage_limits.window_start = p_window_start
     and ai_usage_limits.window_seconds = p_window_seconds
     and ai_usage_limits.request_count < p_limit
  returning ai_usage_limits.request_count
       into v_request_count;

  if found then
    return query
    select true,
           v_request_count,
           greatest(p_limit - v_request_count, 0),
           v_reset_at;
    return;
  end if;

  select ai_usage_limits.request_count
    into v_request_count
    from public.ai_usage_limits
   where ai_usage_limits.user_id = p_user_id
     and ai_usage_limits.feature = p_feature
     and ai_usage_limits.window_start = p_window_start
     and ai_usage_limits.window_seconds = p_window_seconds;

  return query
  select false,
         coalesce(v_request_count, p_limit),
         greatest(p_limit - coalesce(v_request_count, p_limit), 0),
         v_reset_at;
end;
$$;

revoke all on function public.consume_ai_usage_limit(uuid, text, timestamp with time zone, integer, integer)
  from public, anon, authenticated;

grant execute on function public.consume_ai_usage_limit(uuid, text, timestamp with time zone, integer, integer)
  to service_role;
