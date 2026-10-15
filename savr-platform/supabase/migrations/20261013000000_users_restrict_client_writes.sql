-- Migration: users_restrict_client_writes
--
-- Problem: the "Users can update own data" RLS policy (initial schema) limits
-- clients to their own row but not to particular columns, and Supabase's
-- default privileges grant the API roles table-wide INSERT/UPDATE/DELETE.
-- A signed-in user could therefore set their own subscription_tier,
-- subscription_status, period fields and Stripe IDs through PostgREST:
-- self-granted entitlements, and a forged stripe_subscription_id that the
-- webhook treats as SAVR ownership and that /api/account/delete cancels.
--
-- Change: privileges, not policies. The API roles lose INSERT, UPDATE,
-- DELETE, TRUNCATE, REFERENCES and TRIGGER on public.users. `authenticated`
-- gets UPDATE back on only the two columns clients legitimately edit
-- (lib/db.ts updateUserProfile on web and mobile: display_name, preferences).
-- SELECT is unchanged, so profile reads and realtime keep working. RLS
-- policies are unchanged: users can still only touch their own row.
--
-- Unaffected writers:
--   * service_role (webhook, checkout, sync, account deletion via
--     getSupabaseAdmin) keeps its own grants and BYPASSRLS.
--   * handle_new_user() is SECURITY DEFINER and inserts as its owner.
--   * handle_updated_at() sets updated_at in a trigger; trigger assignments
--     need no column privilege.
--
-- Data ownership: billing and entitlement columns (subscription_*, stripe_*,
-- trial_*, current_period_end, cancel_at_period_end, last_payment_*,
-- payment_action_required) become writable only by server code holding
-- the service-role key. No data is changed.
--
-- Rollback (restores the previous effective privileges exactly):
--   begin;
--   grant insert, update, delete, truncate, references, trigger
--     on table public.users to anon, authenticated;
--   commit;
-- Rolling back reopens client writes to billing columns; do it only
-- together with reverting the webhook's stored-subscription ownership check.

begin;

revoke insert, update, delete, truncate, references, trigger
  on table public.users from anon, authenticated;

grant update (display_name, preferences)
  on table public.users to authenticated;

commit;
