-- Migration: stripe_webhook_events
--
-- Adds a persistence table and atomic-claim function for idempotent
-- Stripe webhook processing.  Duplicate event deliveries are detected
-- and deduplicated at the database level, making the webhook handler
-- safe for concurrent Vercel invocations and Stripe retries.

begin;

-- ----------------------------------------------------------------
-- Table: public.stripe_webhook_events
--
-- Stores one row per Stripe event ID.  The primary key on event_id
-- provides the uniqueness constraint used by the atomic-claim INSERT.
-- ----------------------------------------------------------------
create table if not exists public.stripe_webhook_events (
  event_id          text        primary key,
  event_type        text        not null,
  processing_status text        not null default 'pending',
  attempt_count     integer     not null default 1,
  last_error        text,
  created_at        timestamptz not null default now(),
  processed_at      timestamptz,
  updated_at        timestamptz not null default now()
);

alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_status_check
  check (processing_status in ('pending', 'processed', 'failed'));

-- No client access.  RLS is enabled with no permissive policies.
-- The service-role key (supabaseAdmin) bypasses RLS for all webhook writes.
alter table public.stripe_webhook_events enable row level security;

-- Keep updated_at current via the shared trigger procedure from the initial schema.
create trigger handle_stripe_webhook_events_updated_at
  before update on public.stripe_webhook_events
  for each row execute procedure public.handle_updated_at();

-- ----------------------------------------------------------------
-- Function: public.claim_stripe_webhook_event(event_id, event_type)
--
-- Atomically claims a Stripe webhook event for processing.
--
-- Return values:
--   'claimed'           – this caller acquired processing ownership.
--   'already_processed' – event completed successfully; caller should
--                         return HTTP 200 without re-processing.
--   'already_pending'   – another invocation is currently processing
--                         this event; caller should return HTTP 200 and
--                         defer to the owner.  If the owner later fails
--                         (status → 'failed') Stripe will retry and the
--                         next call will return 'claimed' again.
--
-- Race safety:
--   Two concurrent deliveries of the same event both attempt INSERT.
--   Exactly one succeeds and receives 'claimed'.  The other finds the
--   row with status='pending' and returns 'already_pending'.  The
--   FOR UPDATE lock serializes the status read so no lost-update can
--   occur between the insert path and the update path.
-- ----------------------------------------------------------------
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
begin
  -- Attempt a fresh insert.  On a duplicate event_id DO NOTHING so the
  -- caller can inspect the existing row below without raising an error.
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
  select processing_status
  into   v_status
  from   public.stripe_webhook_events
  where  event_id = p_event_id
  for update;

  if v_status = 'processed' then
    return 'already_processed';
  end if;

  if v_status = 'failed' then
    -- Previous attempt failed; permit a retry by resetting to pending
    -- and recording the new attempt count.
    update public.stripe_webhook_events
    set processing_status = 'pending',
        attempt_count     = attempt_count + 1,
        last_error        = null,
        updated_at        = now()
    where event_id = p_event_id;
    return 'claimed';
  end if;

  -- Status is 'pending': another invocation is actively processing this event.
  return 'already_pending';
end;
$$;

commit;
