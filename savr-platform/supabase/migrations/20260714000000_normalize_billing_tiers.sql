-- Migration: normalize_billing_tiers
-- Resolves ADR-001: establishes basic and pro as the only canonical tier values.
--
-- Legacy mappings applied:
--   free    -> basic
--   plus    -> pro
--   premium -> pro
--
-- After this migration the subscription_tier column accepts only 'basic' or 'pro'.
-- The default remains 'basic'.

begin;

-- 1. Normalize existing rows with legacy tier values.
update public.users set subscription_tier = 'basic' where subscription_tier = 'free';
update public.users set subscription_tier = 'pro'   where subscription_tier = 'plus';
update public.users set subscription_tier = 'pro'   where subscription_tier = 'premium';

-- 2. Drop the old check constraint (auto-named by PostgreSQL at table creation time).
alter table public.users drop constraint if exists users_subscription_tier_check;

-- 3. Add a new constraint allowing only the two canonical tier values.
alter table public.users
  add constraint users_subscription_tier_check
  check (subscription_tier in ('basic', 'pro'));

commit;
