# ADR-006 — Server-Owned Billing State and Subscription-Scoped Webhook Updates

**Status:** Proposed (GooseyPrime/SAVR#180)  
**Date:** 2026-10-13  
**Deciders:** GooseyPrime (Echo reviews and merges)

---

## Context

Two defects were found in review of #180 at `d72a664`.

1. **Clients could write billing state.** The initial schema's `Users can update own data` policy restricts clients to their own row but not to particular columns, and Supabase's default privileges grant `anon` and `authenticated` table-wide `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` on `public.users`. No later migration narrowed this. A local Postgres 16 proof (Supabase roles, default privileges, `auth.uid()` from JWT claims, and every SAVR migration applied) showed that a signed-in user could set their own:
   - `subscription_tier = 'pro'` and `subscription_status = 'active'` (self-granted entitlement);
   - `stripe_subscription_id` (forged ownership: the webhook's stored-subscription fallback trusts this column, and `/api/account/delete` cancels whatever subscription it names, using the user-scoped client);
   - `stripe_customer_id` (`/api/stripe/portal` opens the billing portal for whatever customer it names). Only the `unique` constraint blocked claiming an already-linked ID;
   - period, trial, payment and email columns.
2. **The webhook updated users by customer, not by subscription.** Deletion, pause and invoice handlers updated whichever user owned the Stripe customer, and the update handler overwrote `stripe_subscription_id`. A delayed event for an old subscription could therefore revoke or overwrite a newer subscription's entitlement. Event snapshots, which can be stale, were also trusted as current state.

## Decision

### 1. Billing columns are server-owned (`20261013000000_users_restrict_client_writes.sql`)
- Revoke `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` on `public.users` from `anon` and `authenticated`.
- Grant `UPDATE (display_name, preferences)` to `authenticated`. These are the only columns the clients edit (`updateUserProfile` in `web/lib/db.ts` and `mobile/src/lib/db.ts`; the web preferences page).
- `SELECT`, all RLS policies, `service_role`, the `handle_new_user` (`SECURITY DEFINER`) signup trigger and the `updated_at` trigger are unchanged.
- From then on, only server code holding the service-role key can write billing and entitlement columns: `subscription_*`, `stripe_*`, `trial_*`, `current_period_end`, `cancel_at_period_end`, `last_payment_*`, `payment_action_required`. This is what makes `users.stripe_subscription_id` trustworthy as durable ownership evidence for the webhook.

### 2. Webhook updates are scoped to one subscription
- Every subscription, invoice and checkout event names a subscription. Its **current Stripe state** (`subscriptions.retrieve`) is used, never the event snapshot.
- The subscription changes the user only if it is the stored subscription of record, or it **becomes** the subscription of record:
  - nothing stored, and it is live: adopt;
  - the stored subscription has ended or no longer exists in Stripe: adopt;
  - both are live: an entitled one (`active`/`trialing`) outranks a non-entitled one, then the newer `created` wins.
- An ended subscription never displaces anything. Because the outcome depends only on Stripe's current state, delayed and reordered events converge on the same result.
- When the subscription of record ends: tier becomes `basic`, the status is mirrored, and `stripe_subscription_id` is cleared.
- Invoice payment fields only move forward in invoice time. `payment_action_required` is derived from the current Stripe status.
- Every write is a **compare-and-set** on the stored `stripe_subscription_id`, and on `last_payment_date` when payment fields are written. A concurrent change fails the event with 500, so Stripe retries against fresh state.
- Stripe or database failures return 500 and record the attempt as failed, never as processed.

## Consequences
- **More Stripe API reads:** one `subscriptions.retrieve` per subscription, invoice or checkout event, plus one more when two subscriptions compete. These are reads, not paid calls.
- **Clients can no longer change `email`** on `public.users`. No client code does so; auth email changes go through Supabase Auth.
- **Unused client fields:** `updateUserProfile`'s TypeScript type also names `dietary_preferences` and `allergens`. These are not columns, so such updates already failed and still do.

## Deployment gates
1. Apply `20261010000000` (stale-claim takeover) and `20261013000000` (privileges) **before or together with** the web deploy. The 409 retry contract depends on the first; the stored-ownership fallback depends on the second.
2. After applying, run `supabase/checks/users_client_write_privileges.sql` against the target database. It must print `users client write privileges: PASS`.
3. All four Stripe plans must be configured (`STRIPE_PRICE_*` or legacy `STRIPE_PRICE_ID_*`).

## Rollback
- **Privileges:** `begin; grant insert, update, delete, truncate, references, trigger on table public.users to anon, authenticated; commit;`. This restores the previous effective privileges, which the SQL check confirms by failing. It also reopens client writes to billing columns, so roll back together with the webhook code.
- **Webhook code:** redeploy the previous web build. The handlers keep no schema of their own beyond the migrations above.
