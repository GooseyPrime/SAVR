-- Migration: stripe_webhook_stale_pending_claim
--
-- Lets a Stripe retry take over an event whose previous attempt never
-- finished.  If an invocation is killed mid-processing (timeout, crash) or
-- cannot record its failure, the row stays 'pending' and every later
-- delivery of that event was answered 'already_pending' and skipped, so the
-- event was never processed.  A 'pending' claim older than ten minutes
-- (well beyond the maximum function duration) is now treated as abandoned
-- and handed to the caller.  All other behaviour is unchanged.

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

commit;
