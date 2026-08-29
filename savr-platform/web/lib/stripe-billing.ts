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

type StripeBillingClient = Pick<
  Stripe,
  'checkout' | 'customers' | 'prices' | 'promotionCodes' | 'subscriptions'
>;

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
    typedError.type === 'invalid_request_error' ||
    typedError.type === 'StripeInvalidRequestError';
  const errorMessage = typedError.message ?? '';
  const matchesMessageForCustomer =
    /no such customer/i.test(errorMessage) &&
    (!customerId || errorMessage.includes(customerId));

  return (
    typedError.code === 'resource_missing' &&
    matchesMessageForCustomer &&
    matchesAuthoritativeStripeType
  );
}

export function isStripeTrialIneligibleError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '');

  return /trial/i.test(message) && (
    /already/i.test(message) ||
    /cannot have a trial/i.test(message) ||
    /not eligible/i.test(message) ||
    /trial_end/i.test(message)
  );
}

export function customerHasConsumedTrial(subscriptions: Stripe.Subscription[]): boolean {
  return subscriptions.some((subscription) => subscription.trial_end != null);
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

export function sessionIncludesTrial(session: Stripe.Checkout.Session): boolean {
  // Legacy open sessions predate includeTrial metadata and always created a trial.
  return session.metadata?.includeTrial !== 'false';
}

export function findReusableCheckoutSession(
  sessions: Stripe.Checkout.Session[],
  priceId: string,
  includeTrial: boolean,
): Stripe.Checkout.Session | null {
  return (
    sessions
      .filter((session) => (
        session.mode === 'subscription' &&
        session.status === 'open' &&
        Boolean(session.url) &&
        session.metadata?.priceId === priceId &&
        sessionIncludesTrial(session) === includeTrial
      ))
      .sort((a, b) => b.created - a.created)[0] ?? null
  );
}

/**
 * True when a promotion code removes every charge for the whole life of the
 * subscription, so the customer will never owe anything and a card is
 * pointless.
 *
 * Only a permanent 100%-off discount qualifies. A `once` or `repeating`
 * discount still bills later, so a payment method is required up front —
 * otherwise the subscription silently fails at the first real invoice.
 */
function getPromotionCoupon(
  promotionCode: Stripe.PromotionCode | null | undefined,
): Stripe.Coupon | null {
  const coupon = promotionCode?.promotion?.coupon;
  return !coupon || typeof coupon === 'string' ? null : coupon;
}

function getPriceProductId(price: Stripe.Price): string | null {
  if (typeof price.product === 'string') return price.product;
  return price.product?.id ?? null;
}

function getPriceUnitAmount(price: Stripe.Price): number | null {
  if (typeof price.unit_amount === 'number') return price.unit_amount;
  if (typeof price.unit_amount_decimal !== 'string') return null;

  const parsed = Number(price.unit_amount_decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPromotionCustomerId(promotionCode: Stripe.PromotionCode): string | null {
  if (typeof promotionCode.customer === 'string') return promotionCode.customer;
  if (promotionCode.customer?.deleted) return null;
  return promotionCode.customer?.id ?? null;
}

function getCouponAmountOffForPrice(coupon: Stripe.Coupon, price: Stripe.Price): number | null {
  if (coupon.amount_off != null) {
    return coupon.currency?.toLowerCase() === price.currency.toLowerCase()
      ? coupon.amount_off
      : null;
  }

  const currencyOptions = coupon.currency_options as
    | Record<string, { amount_off?: number | null }>
    | null
    | undefined;
  const priceCurrencyOption = currencyOptions?.[price.currency.toLowerCase()];
  return typeof priceCurrencyOption?.amount_off === 'number'
    ? priceCurrencyOption.amount_off
    : null;
}

export function promotionCodeAppliesToPrice(
  promotionCode: Stripe.PromotionCode | null | undefined,
  price: Stripe.Price | null | undefined,
): boolean {
  const coupon = getPromotionCoupon(promotionCode);
  if (!coupon?.valid || !price) return false;

  const appliesToProducts = coupon.applies_to?.products;
  if (appliesToProducts?.length) {
    const productId = getPriceProductId(price);
    if (!productId || !appliesToProducts.includes(productId)) return false;
  }

  return coupon.amount_off == null || getCouponAmountOffForPrice(coupon, price) != null;
}

export function discountRemovesAllCharges(
  promotionCode: Stripe.PromotionCode | null | undefined,
  price: Stripe.Price | null | undefined,
): boolean {
  const coupon = getPromotionCoupon(promotionCode);
  // An unexpanded coupon is just an id, so the discount cannot be evaluated.
  // Fail closed: require a payment method rather than assume the plan is free.
  if (!coupon?.valid || !price) return false;
  if (!promotionCodeAppliesToPrice(promotionCode, price)) return false;
  if (coupon.duration !== 'forever') return false;
  if (coupon.percent_off === 100) return true;

  const amountOff = getCouponAmountOffForPrice(coupon, price);
  const unitAmount = getPriceUnitAmount(price);
  return amountOff != null && unitAmount != null && amountOff >= unitAmount;
}

/**
 * Look up an active promotion code by the customer-facing code.
 * Returns null when the code does not exist or is no longer redeemable.
 */
export async function findActivePromotionCode(
  stripe: Pick<Stripe, 'promotionCodes'>,
  code: string,
  customerId?: string | null,
): Promise<Stripe.PromotionCode | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const result = await stripe.promotionCodes.list({
    code: trimmed,
    active: true,
    limit: 100,
    // The coupon carries the discount terms that decide whether a payment
    // method is needed, so it must come back expanded rather than as an id.
    expand: ['data.promotion.coupon'],
  });

  const matches = result.data.filter((promotionCode) => {
    const promotionCustomerId = getPromotionCustomerId(promotionCode);
    return promotionCustomerId == null || promotionCustomerId === customerId;
  });

  if (customerId) {
    return (
      matches.find((promotionCode) => getPromotionCustomerId(promotionCode) === customerId) ??
      matches.find((promotionCode) => getPromotionCustomerId(promotionCode) == null) ??
      null
    );
  }

  return matches.find((promotionCode) => getPromotionCustomerId(promotionCode) == null) ?? null;
}

export async function loadCheckoutPrice(
  stripe: Pick<Stripe, 'prices'>,
  priceId: string,
): Promise<Stripe.Price> {
  return stripe.prices.retrieve(priceId);
}

export function buildCheckoutSessionParams(args: {
  priceId: string;
  userId: string;
  email?: string | null;
  customerId?: string | null;
  origin: string;
  includeTrial?: boolean;
  plan?: Plan;
  /** Pre-applied promotion code. Mutually exclusive with the Checkout coupon field. */
  promotionCodeId?: string | null;
  /**
   * Whether Stripe must collect a payment method. Defaults to true: a card is
   * always required, including during the free trial, so the subscription can
   * bill when the trial ends. Pass false only when the discount removes every
   * charge for the life of the subscription.
   */
  collectPaymentMethod?: boolean;
}): Stripe.Checkout.SessionCreateParams {
  const includeTrial = args.includeTrial !== false;
  const collectPaymentMethod = args.collectPaymentMethod !== false;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: args.priceId, quantity: 1 }],
    // 'always' keeps the card requirement during the free trial. 'if_required'
    // is what Stripe uses to start a trial WITHOUT payment details, which is
    // only correct when nothing will ever be charged.
    payment_method_collection: collectPaymentMethod ? 'always' : 'if_required',
    // Stripe rejects allow_promotion_codes together with discounts, so the
    // in-Checkout coupon field is offered only when no code was pre-applied.
    ...(args.promotionCodeId
      ? { discounts: [{ promotion_code: args.promotionCodeId }] }
      : { allow_promotion_codes: true }),
    client_reference_id: args.userId,
    metadata: {
      userId: args.userId,
      priceId: args.priceId,
      includeTrial: includeTrial ? 'true' : 'false',
      ...(args.plan ? { plan: args.plan } : {}),
    },
    subscription_data: {
      ...(includeTrial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
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
  includeTrial?: boolean;
  promotionCodeId?: string | null;
}): string {
  const trialPart = args.includeTrial === false ? 'no-trial' : 'trial';
  // The promotion code changes the session's discounts and its
  // payment-collection rule, so it must change the identity of the request.
  const promoPart = args.promotionCodeId ? `:${args.promotionCodeId}` : '';
  return `stripe-checkout:${args.customerId ?? args.userId}:${args.plan}:${trialPart}${promoPart}`;
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

  if (hardErrors.length > 0) {
    throw new AggregateError(
      hardErrors.map((entry) => entry.error),
      `Failed to load Stripe billing activity for customers: ${hardErrors.map((entry) => entry.customerId).join(', ')}`,
    );
  }

  return snapshots;
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

  const withCurrentSubscription = snapshots
    .filter((snapshot) => Boolean(pickCurrentSubscription(snapshot.subscriptions)))
    .sort(compareCustomerSnapshots);
  if (withCurrentSubscription.length === 1) return withCurrentSubscription[0];
  if (withCurrentSubscription.length > 1) return null;

  const withActivity = snapshots
    .filter(hasBillingActivity)
    .sort(compareCustomerSnapshots);
  // Multiple current subscriptions already failed closed above. Historical
  // activity (canceled/expired subs or open sessions) is not a conflict —
  // pick the newest ranked record so checkout/sync can recover.
  if (withActivity[0]) return withActivity[0];

  return snapshots.sort(compareCustomerSnapshots)[0] ?? null;
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
