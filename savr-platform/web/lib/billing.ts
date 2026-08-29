/**
 * Canonical billing helpers for SAVR web.
 *
 * All entitlement decisions must go through these functions.
 * Do not duplicate ad-hoc tier comparisons across pages or API routes.
 *
 * ADR-001: basic and pro are the only valid tier values.
 * Access requires an active or trialing subscription — tier alone is not sufficient.
 */

export type SubscriptionTier = 'basic' | 'pro';

/**
 * Returns true when the value is a known canonical tier.
 * Legacy values (free, plus, premium) are not valid and return false.
 */
export function isKnownTier(value: unknown): value is SubscriptionTier {
  return value === 'basic' || value === 'pro';
}

/**
 * Returns true when the subscription status allows product access.
 * Only 'active' and 'trialing' confer entitlement.
 */
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

interface BillingUserData {
  subscription_tier?: string | null;
  subscription_status?: string | null;
}

/**
 * Returns true when the user has an active Basic or Pro subscription.
 * Basic access is granted to active/trialing users on either plan.
 */
export function hasBasicAccess(userData: BillingUserData | null | undefined): boolean {
  if (!userData) return false;
  const tier = userData.subscription_tier;
  return isSubscriptionActive(userData.subscription_status) && (tier === 'basic' || tier === 'pro');
}

/**
 * Returns true when the user has an active Pro subscription.
 * Pro access is granted only to active/trialing users whose tier is exactly 'pro'.
 */
export function hasProAccess(userData: BillingUserData | null | undefined): boolean {
  if (!userData) return false;
  return isSubscriptionActive(userData.subscription_status) && userData.subscription_tier === 'pro';
}

function firstConfiguredEnvValue(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

/**
 * Resolve a Stripe price ID to a canonical billing tier.
 *
 * Uses the four server-only price ID environment variables:
 *   STRIPE_PRICE_BASIC_MONTHLY — 499 cents, interval month, currency usd
 *   STRIPE_PRICE_BASIC_YEARLY  — 4999 cents, interval year,  currency usd
 *   STRIPE_PRICE_PRO_MONTHLY   — 999 cents, interval month, currency usd
 *   STRIPE_PRICE_PRO_YEARLY    — 9999 cents, interval year,  currency usd
 *
 * Throws when the price ID is not recognized — never silently defaults.
 */
export function resolveTierFromPriceId(priceId: string): SubscriptionTier {
  const basicMonthly = firstConfiguredEnvValue(
    process.env.STRIPE_PRICE_BASIC_MONTHLY,
    process.env.STRIPE_PRICE_ID_BASIC_MONTHLY,
  );
  const basicYearly = firstConfiguredEnvValue(
    process.env.STRIPE_PRICE_BASIC_YEARLY,
    process.env.STRIPE_PRICE_ID_BASIC_YEARLY,
  );
  const proMonthly = firstConfiguredEnvValue(
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
  );
  const proYearly = firstConfiguredEnvValue(
    process.env.STRIPE_PRICE_PRO_YEARLY,
    process.env.STRIPE_PRICE_ID_PRO_YEARLY,
  );

  if (!basicMonthly || !basicYearly || !proMonthly || !proYearly) {
    throw new Error('One or more STRIPE_PRICE_* (or legacy STRIPE_PRICE_ID_*) environment variables are not configured');
  }

  if (priceId === basicMonthly || priceId === basicYearly) return 'basic';
  if (priceId === proMonthly   || priceId === proYearly)   return 'pro';

  throw new Error(`Unknown Stripe price ID: ${priceId} — tier cannot be resolved`);
}
