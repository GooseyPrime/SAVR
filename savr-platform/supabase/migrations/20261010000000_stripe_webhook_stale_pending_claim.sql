-- Migration: stripe_webhook_stale_pending_claim
--
-- Lets a Stripe retry take over an event whose previous attempt never
-- finished.  If an invocation is killed mid-processing (timeout, crash) or
-- cannot record its failure, the row stays 'pending'.  A 'pending' claim
-- older than ten minutes (well beyond the maximum function duration) is now
-- treated as abandoned and handed to the caller.
--
-- Caller contract (savr-platform/web/lib/stripe-webhook.ts):
--   'claimed'           -> process the event.
--   'already_processed' -> HTTP 200 (completed duplicate).
--   'already_pending'   -> HTTP 409, never 2xx.  Stripe keeps redelivering,
--                          so a delivery after the ten-minute window always
--                          reaches the takeover branch below.  (Before this
--                          change the caller answered 200 and Stripe stopped
--                          retrying, so an orphaned claim was never retried.)
--
-- Data ownership and access:
--   public.stripe_webhook_events is a server-owned ledger.  It holds Stripe
--   event IDs and types only (no user data), has RLS enabled with no
--   policies, and is written only by the web webhook through the
--   service-role client.  This migration changes no table, column, index or
--   RLS policy.  The function is SECURITY DEFINER (runs as its owner, the
--   migration role) with a fixed search_path.  Execute is now limited to
--   service_role, matching consume_ai_usage_limit, sentinel_touch and
--   sentinel_status; previously the default PUBLIC grant let anon and
--   authenticated callers reach it through PostgREST and insert or reset
--   ledger rows.
--
-- Rollback (restores the 20260714020000 behaviour; no data migration needed):
--   1. Re-run the `create or replace function public.claim_stripe_webhook_event`
--      block from 20260714020000_stripe_webhook_events.sql (status-only check,
--      no updated_at read).  Existing rows remain valid under both versions.
--   2. Only if the previous grants must be restored exactly:
--        grant execute on function public.claim_stripe_webhook_event(text, text)
--          to public;
--   3. Roll back the web handler together with the function: the old function
--      never reclaims a stale 'pending' row, so a handler that answers 409 for
--      'already_pending' would leave an orphaned claim failing until Stripe
--      stops retrying.  Deploy the previous handler (200 for 'already_pending')
--      before or with step 1.

begin;

create or replace function public.claim_stripe_webhook_event(
  p_event_id   text,
  p_event_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_inserted boolean;
  v_status       text;
  v_updated_at   timestamptz;
begin
  insert into public.stripe_webhook_events
    (event_id, event_type, processing_status, created_at, updated_at)
  values
    (p_event_id, p_event_type, 'pending', now(), now())
  on conflict (event_id) do nothing
  returning true into v_was_inserted;

  -- Fresh insert: this caller owns processing.
  if v_was_inserted is true then
    return 'claimed';
  end if;

  -- Row already existed.  Lock it to serialise the status check and any
  -- conditional update against concurrent claims on the same event.
  select processing_status, updated_at
  into   v_status, v_updated_at
  from   public.stripe_webhook_events
  where  event_id = p_event_id
  for update;

  if v_status = 'processed' then
    return 'already_processed';
  end if;

  if v_status = 'failed'
     or (v_status = 'pending' and v_updated_at < now() - interval '10 minutes') then
    -- Previous attempt failed or was abandoned; permit a retry.
    update public.stripe_webhook_events
    set processing_status = 'pending',
        attempt_count     = attempt_count + 1,
        last_error        = null,
        updated_at        = now()
    where event_id = p_event_id;
    return 'claimed';
  end if;

  -- A recent 'pending' claim: another invocation is processing this event.
  return 'already_pending';
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text)
  to service_role;

commit;
