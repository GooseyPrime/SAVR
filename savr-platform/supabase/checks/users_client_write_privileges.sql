-- Regression check for 20261013000000_users_restrict_client_writes.sql.
--
-- Run against a database with all migrations applied (for example the local
-- stack after `npx supabase@latest db reset`):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/users_client_write_privileges.sql
-- Everything runs in one transaction that is rolled back: no data is kept.
-- Prints "users client write privileges: PASS" or raises an exception.

begin;

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'priv-a@example.test'),
       ('22222222-2222-4222-8222-222222222222', 'priv-b@example.test');

do $$
declare
  a constant uuid := '11111111-1111-4111-8111-111111111111';
  b constant uuid := '22222222-2222-4222-8222-222222222222';
  denied_sql text[] := array[
    'update public.users set subscription_tier = ''pro'' where id = %L',
    'update public.users set subscription_status = ''active'' where id = %L',
    'update public.users set stripe_customer_id = ''cus_forged'' where id = %L',
    'update public.users set stripe_subscription_id = ''sub_forged'' where id = %L',
    'update public.users set current_period_end = now() + interval ''1 year'' where id = %L',
    'update public.users set trial_ends_at = now() + interval ''1 year'' where id = %L',
    'update public.users set cancel_at_period_end = false where id = %L',
    'update public.users set payment_action_required = false where id = %L',
    'update public.users set last_payment_status = ''succeeded'' where id = %L',
    'update public.users set email = ''forged@example.test'' where id = %L',
    'delete from public.users where id = %L'
  ];
  stmt text;
  n int;
begin
  -- Act as user A through the API role, as PostgREST does.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  foreach stmt in array denied_sql loop
    begin
      execute format(stmt, a);
      raise exception 'expected permission denied for: %', format(stmt, a);
    exception when insufficient_privilege then
      null; -- expected
    end;
  end loop;

  begin
    execute format('insert into public.users (id) values (%L)', '33333333-3333-4333-8333-333333333333');
    raise exception 'expected permission denied for client insert';
  exception when insufficient_privilege then
    null;
  end;

  -- Legitimate profile edits still work and return the row.
  execute format('update public.users set display_name = ''Priv A'', preferences = ''{"cuisines":["thai"]}'' where id = %L', a);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'own profile update affected % rows, expected 1', n; end if;

  -- RLS still confines updates to the caller's own row.
  execute format('update public.users set display_name = ''x'' where id = %L', b);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'update of another user''s row affected % rows', n; end if;

  -- Own row stays readable.
  select count(*) into n from public.users where id = a;
  if n <> 1 then raise exception 'own row not readable (% rows)', n; end if;

  -- Anonymous callers cannot write at all.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    execute format('update public.users set subscription_tier = ''pro'' where id = %L', a);
    raise exception 'expected permission denied for anon update';
  exception when insufficient_privilege then
    null;
  end;

  -- Server code (service role) keeps full billing writes.
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute format('update public.users set subscription_tier = ''pro'', stripe_subscription_id = ''sub_server'' where id = %L', a);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'service_role billing update affected % rows, expected 1', n; end if;

  perform set_config('role', 'postgres', true);
  raise notice 'users client write privileges: PASS';
end
$$;

rollback;
