import type Stripe from 'stripe';
import { resolveTierFromPriceId, type SubscriptionTier } from '@/lib/billing';

export type Plan = 'basic_monthly' | 'basic_yearly' | 'pro_monthly' | 'pro_yearly';

export type DatabaseSubscriptionStatus =
  | 'pending'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

export interface CustomerActivity {
  subscriptions: Stripe.Subscription[];
  openCheckoutSessions: Stripe.Checkout.Session[];
}

export interface CustomerBillingSnapshot extends CustomerActivity {
  customer: Stripe.Customer;
}

export const TRIAL_PERIOD_DAYS = 5;

export const PLAN_ENV_MAP: Record<Plan, string> = {
  basic_monthly: 'STRIPE_PRICE_BASIC_MONTHLY',
  basic_yearly: 'STRIPE_PRICE_BASIC_YEARLY',
  pro_monthly: 'STRIPE_PRICE_PRO_MONTHLY',
  pro_yearly: 'STRIPE_PRICE_PRO_YEARLY',
};
const PLAN_LEGACY_ENV_MAP: Record<Plan, string> = {
  basic_monthly: 'STRIPE_PRICE_ID_BASIC_MONTHLY',
  basic_yearly: 'STRIPE_PRICE_ID_BASIC_YEARLY',
  pro_monthly: 'STRIPE_PRICE_ID_PRO_MONTHLY',
  pro_yearly: 'STRIPE_PRICE_ID_PRO_YEARLY',
};

const CHECKOUT_BLOCKING_STATUSES = ['active', 'trialing'] as const;
const DATABASE_SUBSCRIPTION_STATUSES = [
  'pending',
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
] as const;
export const STALE_LOCAL_SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
] as const;
const CURRENT_SUBSCRIPTION_PRIORITY = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'incomplete',
] as const;
const HISTORICAL_SUBSCRIPTION_PRIORITY = ['canceled', 'incomplete_expired'] as const;
const CUSTOMER_SELECTION_PRIORITY = [
  ...CURRENT_SUBSCRIPTION_PRIORITY,
  ...HISTORICAL_SUBSCRIPTION_PRIORITY,
] as const;

type StripeBillingClient = Pick<Stripe, 'customers' | 'subscriptions' | 'checkout'>;

export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && value in PLAN_ENV_MAP;
}

export function isStripeMissingCustomerError(error: unknown, customerId: string): boolean {
  if (!error || typeof error !== 'object') return false;

  const typedError = error as {
    code?: string;
    message?: string;
    rawType?: string;
    type?: string;
  };

  const matchesAuthoritativeStripeType =
    typedError.rawType === 'invalid_request_error' ||
    typedError.type === 'StripeInvalidRequestError';
  const errorMessage = typedError.message ?? '';
  const matchesMessageForCustomer =
    /no such customer/i.test(errorMessage) &&
    errorMessage.includes(customerId);

  return (
    typedError.code === 'resource_missing' &&
    matchesMessageForCustomer &&
    matchesAuthoritativeStripeType
  );
}

function firstConfiguredEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return undefined;
}

export function resolvePriceId(plan: Plan): string {
  const envKey = PLAN_ENV_MAP[plan];
  const legacyEnvKey = PLAN_LEGACY_ENV_MAP[plan];
  const priceId = firstConfiguredEnvValue(envKey, legacyEnvKey);
  if (!priceId) {
    throw new Error(
      `Environment variable ${envKey} (or legacy ${legacyEnvKey}) is not set — cannot create checkout session`,
    );
  }
  return priceId;
}

function pickNewestWithStatus(
  subscriptions: Stripe.Subscription[],
  statuses: readonly Stripe.Subscription.Status[],
): Stripe.Subscription | null {
  for (const status of statuses) {
    const match = subscriptions
      .filter((subscription) => subscription.status === status)
      .sort((a, b) => b.created - a.created)[0];
    if (match) return match;
  }
  return null;
}

export function findBlockingSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  return pickNewestWithStatus(subscriptions, CHECKOUT_BLOCKING_STATUSES);
}

export function pickCurrentSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  return pickNewestWithStatus(subscriptions, CURRENT_SUBSCRIPTION_PRIORITY);
}

export function pickHistoricalSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  return pickNewestWithStatus(subscriptions, HISTORICAL_SUBSCRIPTION_PRIORITY);
}

export function findOpenSubscriptionCheckoutSession(
  sessions: Stripe.Checkout.Session[],
): Stripe.Checkout.Session | null {
  return (
    sessions
      .filter((session) => session.mode === 'subscription' && session.status === 'open')
      .sort((a, b) => b.created - a.created)[0] ?? null
  );
}

export function buildCheckoutSessionParams(args: {
  priceId: string;
  userId: string;
  email?: string | null;
  customerId?: string | null;
  origin: string;
}): Stripe.Checkout.SessionCreateParams {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: args.priceId, quantity: 1 }],
    payment_method_collection: 'if_required',
    allow_promotion_codes: true,
    client_reference_id: args.userId,
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: { userId: args.userId },
    },
    success_url: `${args.origin}/dashboard?stripeSuccess=true`,
    cancel_url: `${args.origin}/pricing`,
  };

  if (args.customerId) {
    params.customer = args.customerId;
  } else if (args.email) {
    params.customer_email = args.email;
  }

  return params;
}

export function buildCheckoutIdempotencyKey(args: {
  userId: string;
  customerId?: string | null;
  plan: Plan;
}): string {
  return `stripe-checkout:${args.customerId ?? args.userId}:${args.plan}`;
}

export async function loadCustomerActivity(
  stripe: StripeBillingClient,
  customerId: string,
): Promise<CustomerActivity> {
  const [subscriptionList, sessionList] = await Promise.all([
    stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price'],
    }),
    stripe.checkout.sessions.list({
      customer: customerId,
      status: 'open',
      limit: 10,
    }),
  ]);

  return {
    subscriptions: subscriptionList.data,
    openCheckoutSessions: sessionList.data,
  };
}

export async function loadCustomerBillingSnapshotsByEmail(
  stripe: StripeBillingClient,
  email: string,
): Promise<CustomerBillingSnapshot[]> {
  const customers = await stripe.customers.list({ email, limit: 10 });
  const activeCustomers = customers.data.filter(
    (customer): customer is Stripe.Customer => !customer.deleted,
  );

  const snapshots: CustomerBillingSnapshot[] = [];
  const hardErrors: Array<{ customerId: string; error: unknown }> = [];

  await Promise.all(
    activeCustomers.map(async (customer) => {
      try {
        const activity = await loadCustomerActivity(stripe, customer.id);
        snapshots.push({
          customer,
          ...activity,
        });
      } catch (error) {
        if (isStripeMissingCustomerError(error, customer.id)) {
          return;
        }
        hardErrors.push({ customerId: customer.id, error });
      }
    }),
  );

  if (snapshots.length > 0) {
    if (hardErrors.length > 0) {
      console.warn(
        `stripe-billing: recovered ${snapshots.length} customer snapshot(s) with hard discovery errors for customer IDs: ${hardErrors.map((entry) => entry.customerId).join(', ')}`,
      );
    }
    return snapshots;
  }
  if (hardErrors.length > 0) {
    throw new AggregateError(
      hardErrors.map((entry) => entry.error),
      `Failed to load Stripe billing activity for customers: ${hardErrors.map((entry) => entry.customerId).join(', ')}`,
    );
  }

  return [];
}

function getBestCustomerSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  return (
    pickNewestWithStatus(subscriptions, CUSTOMER_SELECTION_PRIORITY) ??
    subscriptions.sort((a, b) => b.created - a.created)[0] ??
    null
  );
}

function hasVerifiedCustomerOwnership(
  snapshot: CustomerBillingSnapshot,
  userId: string,
): boolean {
  if (snapshot.customer.metadata.userId === userId) return true;
  return snapshot.subscriptions.some(
    (subscription) => subscription.metadata.userId === userId,
  );
}

function hasBillingActivity(snapshot: CustomerBillingSnapshot): boolean {
  return (
    snapshot.subscriptions.length > 0 ||
    snapshot.openCheckoutSessions.length > 0
  );
}

function compareCustomerSnapshots(
  a: CustomerBillingSnapshot,
  b: CustomerBillingSnapshot,
): number {
  const aSubscription = getBestCustomerSubscription(a.subscriptions);
  const bSubscription = getBestCustomerSubscription(b.subscriptions);
  const aTimestamp = aSubscription?.created ?? a.customer.created;
  const bTimestamp = bSubscription?.created ?? b.customer.created;
  return bTimestamp - aTimestamp;
}

export function selectCustomerBillingSnapshot(
  snapshots: CustomerBillingSnapshot[],
  userId: string,
): CustomerBillingSnapshot | null {
  const verified = snapshots
    .filter((snapshot) => hasVerifiedCustomerOwnership(snapshot, userId))
    .sort(compareCustomerSnapshots);
  if (verified[0]) return verified[0];

  if (snapshots.length === 1) return snapshots[0];

  const withActivity = snapshots
    .filter(hasBillingActivity)
    .sort(compareCustomerSnapshots);
  if (withActivity.length === 1) return withActivity[0];

  return null;
}

export function mapStripeStatusToDatabase(
  status: Stripe.Subscription.Status,
): DatabaseSubscriptionStatus {
  if (status === 'paused') {
    // The canonical users.subscription_status constraint does not allow `paused`.
    // Map it to a non-entitling recoverable status without changing the schema.
    // This is a schema-compatibility workaround, not a semantic claim that
    // Stripe's paused state is identical to a genuinely overdue payment.
    // TODO: remove this fallback when the canonical users constraint allows paused.
    return 'past_due';
  }

  if (
    DATABASE_SUBSCRIPTION_STATUSES.includes(
      status as (typeof DATABASE_SUBSCRIPTION_STATUSES)[number],
    )
  ) {
    return status;
  }

  throw new Error(`Unsupported Stripe subscription status: ${status}`);
}

export function getSubscriptionPeriodEndUnix(
  subscription: Stripe.Subscription,
): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

export function resolveStripeSubscriptionSnapshot(subscription: Stripe.Subscription): {
  subscriptionId: string;
  tier: SubscriptionTier;
  status: DatabaseSubscriptionStatus;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  cancelAtPeriodEnd: boolean;
} {
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error('Subscription has no price item — cannot resolve tier');
  }

  return {
    subscriptionId: subscription.id,
    tier: resolveTierFromPriceId(priceId),
    status: mapStripeStatusToDatabase(subscription.status),
    currentPeriodEnd: getSubscriptionPeriodEndUnix(subscription),
    trialEnd: subscription.trial_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  };
}
