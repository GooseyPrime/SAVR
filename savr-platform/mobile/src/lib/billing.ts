/**
 * Canonical billing helpers for SAVR mobile.
 *
 * All entitlement decisions must go through these functions.
 * Do not duplicate ad-hoc tier comparisons across screens.
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

/**
 * Returns a display label for the canonical subscription tier.
 * Unknown or unavailable values are surfaced explicitly instead of being
 * collapsed into a plan the user may not currently hold.
 */
export function getSubscriptionPlanLabel(tier: string | null | undefined): string {
  if (tier === 'basic') return 'Basic';
  if (tier === 'pro') return 'Pro';
  return 'Unavailable';
}

/**
 * Returns a display label for the server-driven subscription status.
 */
export function getSubscriptionStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trialing';
    case 'pending':
      return 'Pending';
    case 'past_due':
      return 'Past due';
    case 'canceled':
      return 'Canceled';
    case 'incomplete':
      return 'Incomplete';
    case 'incomplete_expired':
      return 'Expired';
    case 'unpaid':
      return 'Unpaid';
    default:
      return 'Unavailable';
  }
}

interface BillingUserData {
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
}

/**
 * Returns true when the user has an active Basic or Pro subscription.
 * Basic access is granted to active/trialing users on either plan.
 */
export function hasBasicAccess(userData: BillingUserData | null | undefined): boolean {
  if (!userData) return false;
  const tier = userData.subscriptionTier;
  return isSubscriptionActive(userData.subscriptionStatus) && (tier === 'basic' || tier === 'pro');
}

/**
 * Returns true when the user has an active Pro subscription.
 * Pro access is granted only to active/trialing users whose tier is exactly 'pro'.
 */
export function hasProAccess(userData: BillingUserData | null | undefined): boolean {
  if (!userData) return false;
  return isSubscriptionActive(userData.subscriptionStatus) && userData.subscriptionTier === 'pro';
}
