import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

import {
  buildCheckoutSessionParams,
  findBlockingSubscription,
  findOpenSubscriptionCheckoutSession,
  getSubscriptionPeriodEndUnix,
  isPlan,
  mapStripeStatusToDatabase,
  pickCurrentSubscription,
  resolvePriceId,
  resolveStripeSubscriptionSnapshot,
  selectCustomerBillingSnapshot,
  TRIAL_PERIOD_DAYS,
} from '../lib/stripe-billing';
import { createCheckoutSessionResponse } from '../app/api/stripe/checkout/route';
import { syncStripeSubscriptionResponse } from '../app/api/stripe/sync/route';

process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';

function makeSubscription(args: {
  id: string;
  customerId?: string;
  priceId?: string;
  status?: Stripe.Subscription.Status;
  created?: number;
  metadata?: Record<string, string>;
  currentPeriodEnd?: number | null;
  trialEnd?: number | null;
}): Stripe.Subscription {
  return {
    id: args.id,
    object: 'subscription',
    customer: args.customerId ?? 'cus_test',
    status: args.status ?? 'active',
    created: args.created ?? 1700000000,
    cancel_at_period_end: false,
    trial_end: args.trialEnd ?? null,
    metadata: args.metadata ?? {},
    items: {
      object: 'list',
      data: [
        {
          id: `si_${args.id}`,
          object: 'subscription_item',
          price: { id: args.priceId ?? 'price_pro_monthly', object: 'price' } as Stripe.Price,
          current_period_end: args.currentPeriodEnd ?? 1800000000,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
  } as unknown as Stripe.Subscription;
}

function makeSession(args: {
  id: string;
  url?: string | null;
  status?: Stripe.Checkout.Session.Status | null;
  created?: number;
  mode?: Stripe.Checkout.Session.Mode | null;
}): Stripe.Checkout.Session {
  return {
    id: args.id,
    object: 'checkout.session',
    url: args.url ?? 'https://checkout.stripe.test/session',
    status: args.status ?? 'open',
    created: args.created ?? 1700000000,
    mode: args.mode ?? 'subscription',
  } as Stripe.Checkout.Session;
}

function makeCustomer(args: {
  id: string;
  created?: number;
  metadata?: Record<string, string>;
}): Stripe.Customer {
  return {
    id: args.id,
    object: 'customer',
    created: args.created ?? 1700000000,
    metadata: args.metadata ?? {},
  } as Stripe.Customer;
}

type QueryResult = { data: unknown; error: unknown };

class MockSupabase {
  public updates: Array<{ table: string; data: Record<string, unknown> }> = [];
  public userRow: Record<string, unknown> | null = null;
  public selectError: unknown = null;
  public updateError: unknown = null;

  from(table: string) {
    let updateData: Record<string, unknown> | null = null;

    const builder = {
      select: (_columns: string) => {
        return builder;
      },
      update: (data: Record<string, unknown>) => {
        updateData = data;
        return builder;
      },
      eq: (_column: string, _value: unknown) => {
        return builder as typeof builder & Promise<QueryResult>;
      },
      single: (): Promise<QueryResult> => {
        if (this.selectError) {
          return Promise.resolve({ data: null, error: this.selectError });
        }
        return Promise.resolve({ data: this.userRow, error: null });
      },
      then: (resolve: (value: QueryResult) => unknown) => {
        if (updateData) {
          this.updates.push({ table, data: updateData });
        }
        return Promise.resolve({ data: null, error: this.updateError }).then(resolve);
      },
    };

    return builder;
  }
}

class MockStripe {
  public createCalls: Array<{
    params: Stripe.Checkout.SessionCreateParams;
    options?: { idempotencyKey?: string };
  }> = [];
  public subscriptionsByCustomer = new Map<string, Stripe.Subscription[]>();
  public openSessionsByCustomer = new Map<string, Stripe.Checkout.Session[]>();
  public customersByEmail = new Map<string, Array<Stripe.Customer | Stripe.DeletedCustomer>>();
  public missingCustomerIds = new Set<string>();
  public nextSession: Stripe.Checkout.Session = makeSession({ id: 'cs_new', url: 'https://checkout.stripe.test/new' });

  private throwIfMissingCustomer(customerId: string | null | undefined) {
    if (!customerId || !this.missingCustomerIds.has(customerId)) return;
    throw {
      code: 'resource_missing',
      rawType: 'invalid_request_error',
      type: 'StripeInvalidRequestError',
      message: `No such customer: '${customerId}'`,
    };
  }

  checkout = {
    sessions: {
      create: async (
        params: Stripe.Checkout.SessionCreateParams,
        options?: { idempotencyKey?: string },
      ) => {
        this.createCalls.push({ params, options });
        return this.nextSession;
      },
      list: async (params: Stripe.Checkout.SessionListParams) => {
        this.throwIfMissingCustomer(params.customer);
        return {
          data: this.openSessionsByCustomer.get(params.customer ?? '') ?? [],
        };
      },
    },
  };

  customers = {
    list: async (params: Stripe.CustomerListParams) => ({
      data: this.customersByEmail.get(params.email ?? '') ?? [],
    }),
  };

  subscriptions = {
    list: async (params: Stripe.SubscriptionListParams) => {
      this.throwIfMissingCustomer(params.customer);
      return {
        data: this.subscriptionsByCustomer.get(params.customer ?? '') ?? [],
      };
    },
  };
}

test('isPlan validates known checkout plans', () => {
  assert.equal(isPlan('basic_monthly'), true);
  assert.equal(isPlan('basic_yearly'), true);
  assert.equal(isPlan('pro_monthly'), true);
  assert.equal(isPlan('pro_yearly'), true);
  assert.equal(isPlan('starter_monthly'), false);
  assert.equal(isPlan(null), false);
});

test('resolvePriceId maps every checkout plan to the configured Stripe price', () => {
  assert.equal(resolvePriceId('basic_monthly'), 'price_basic_monthly');
  assert.equal(resolvePriceId('basic_yearly'), 'price_basic_yearly');
  assert.equal(resolvePriceId('pro_monthly'), 'price_pro_monthly');
  assert.equal(resolvePriceId('pro_yearly'), 'price_pro_yearly');
});

test('resolvePriceId supports legacy STRIPE_PRICE_ID_* env names', () => {
  delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
  delete process.env.STRIPE_PRICE_BASIC_YEARLY;
  delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  delete process.env.STRIPE_PRICE_PRO_YEARLY;
  process.env.STRIPE_PRICE_ID_BASIC_MONTHLY = 'price_basic_monthly_legacy';
  process.env.STRIPE_PRICE_ID_BASIC_YEARLY = 'price_basic_yearly_legacy';
  process.env.STRIPE_PRICE_ID_PRO_MONTHLY = 'price_pro_monthly_legacy';
  process.env.STRIPE_PRICE_ID_PRO_YEARLY = 'price_pro_yearly_legacy';

  assert.equal(resolvePriceId('basic_monthly'), 'price_basic_monthly_legacy');
  assert.equal(resolvePriceId('basic_yearly'), 'price_basic_yearly_legacy');
  assert.equal(resolvePriceId('pro_monthly'), 'price_pro_monthly_legacy');
  assert.equal(resolvePriceId('pro_yearly'), 'price_pro_yearly_legacy');

  process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
  process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly';
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
  process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';
  delete process.env.STRIPE_PRICE_ID_BASIC_MONTHLY;
  delete process.env.STRIPE_PRICE_ID_BASIC_YEARLY;
  delete process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
  delete process.env.STRIPE_PRICE_ID_PRO_YEARLY;
});

test('resolvePriceId trims values and falls back when canonical env is blank', () => {
  process.env.STRIPE_PRICE_BASIC_MONTHLY = '   ';
  process.env.STRIPE_PRICE_ID_BASIC_MONTHLY = '  price_basic_monthly_legacy  ';

  assert.equal(resolvePriceId('basic_monthly'), 'price_basic_monthly_legacy');

  process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
  delete process.env.STRIPE_PRICE_ID_BASIC_MONTHLY;
});

test('buildCheckoutSessionParams includes coupon support and the 5-day trial policy', () => {
  const params = buildCheckoutSessionParams({
    priceId: 'price_pro_yearly',
    userId: 'user_123',
    email: 'chef@example.com',
    origin: 'https://savr.app',
  });

  assert.equal(params.allow_promotion_codes, true);
  assert.equal(params.payment_method_collection, 'if_required');
  assert.equal(params.subscription_data?.trial_period_days, TRIAL_PERIOD_DAYS);
  assert.equal(params.subscription_data?.metadata?.userId, 'user_123');
  assert.equal(params.customer_email, 'chef@example.com');
  assert.equal(params.success_url, 'https://savr.app/dashboard?stripeSuccess=true');
  assert.equal(params.cancel_url, 'https://savr.app/pricing');
});

test('findBlockingSubscription returns an active or trialing subscription', () => {
  const blocking = findBlockingSubscription([
    makeSubscription({ id: 'sub_old', status: 'canceled', created: 1 }),
    makeSubscription({ id: 'sub_trial', status: 'trialing', created: 2 }),
  ]);

  assert.equal(blocking?.id, 'sub_trial');
});

test('findOpenSubscriptionCheckoutSession returns the newest open subscription session', () => {
  const session = findOpenSubscriptionCheckoutSession([
    makeSession({ id: 'cs_complete', status: 'complete', created: 1 }),
    makeSession({ id: 'cs_open_old', status: 'open', created: 2 }),
    makeSession({ id: 'cs_open_new', status: 'open', created: 3 }),
  ]);

  assert.equal(session?.id, 'cs_open_new');
});

test('pickCurrentSubscription prioritizes active states over newer canceled history', () => {
  const subscription = pickCurrentSubscription([
    makeSubscription({ id: 'sub_canceled', status: 'canceled', created: 20 }),
    makeSubscription({ id: 'sub_active', status: 'active', created: 10 }),
  ]);

  assert.equal(subscription?.id, 'sub_active');
});

test('selectCustomerBillingSnapshot prefers verified subscription metadata over a newer email match', () => {
  const snapshot = selectCustomerBillingSnapshot(
    [
      {
        customer: makeCustomer({ id: 'cus_new', created: 20 }),
        subscriptions: [makeSubscription({ id: 'sub_new', customerId: 'cus_new', created: 20 })],
        openCheckoutSessions: [],
      },
      {
        customer: makeCustomer({ id: 'cus_verified', created: 10 }),
        subscriptions: [
          makeSubscription({
            id: 'sub_verified',
            customerId: 'cus_verified',
            created: 10,
            metadata: { userId: 'user_123' },
          }),
        ],
        openCheckoutSessions: [],
      },
    ],
    'user_123',
  );

  assert.equal(snapshot?.customer.id, 'cus_verified');
});

test('selectCustomerBillingSnapshot returns null for ambiguous duplicate customers', () => {
  const snapshot = selectCustomerBillingSnapshot(
    [
      {
        customer: makeCustomer({ id: 'cus_a', created: 10 }),
        subscriptions: [makeSubscription({ id: 'sub_a', customerId: 'cus_a', created: 10 })],
        openCheckoutSessions: [],
      },
      {
        customer: makeCustomer({ id: 'cus_b', created: 11 }),
        subscriptions: [makeSubscription({ id: 'sub_b', customerId: 'cus_b', created: 11 })],
        openCheckoutSessions: [],
      },
    ],
    'user_123',
  );

  assert.equal(snapshot, null);
});

test('resolveStripeSubscriptionSnapshot uses item period end and maps paused to an allowed database status', () => {
  const snapshot = resolveStripeSubscriptionSnapshot(
    makeSubscription({
      id: 'sub_paused',
      status: 'paused',
      priceId: 'price_pro_monthly',
      currentPeriodEnd: 1800000123,
      trialEnd: 1800000999,
    }),
  );

  assert.equal(snapshot.tier, 'pro');
  assert.equal(snapshot.status, 'past_due');
  assert.equal(snapshot.currentPeriodEnd, 1800000123);
  assert.equal(snapshot.trialEnd, 1800000999);
});

test('resolveStripeSubscriptionSnapshot throws for an unknown price ID', () => {
  assert.throws(
    () =>
      resolveStripeSubscriptionSnapshot(
        makeSubscription({ id: 'sub_unknown', priceId: 'price_unknown', status: 'active' }),
      ),
    /Unknown Stripe price ID/,
  );
});

test('getSubscriptionPeriodEndUnix reads the item-level billing period end', () => {
  assert.equal(
    getSubscriptionPeriodEndUnix(
      makeSubscription({ id: 'sub_period', currentPeriodEnd: 1800000555 }),
    ),
    1800000555,
  );
});

test('mapStripeStatusToDatabase converts paused to past_due', () => {
  assert.equal(mapStripeStatusToDatabase('paused'), 'past_due');
  assert.equal(mapStripeStatusToDatabase('active'), 'active');
});

test('createCheckoutSessionResponse reuses the existing customer and creates a trial checkout session', async () => {
  const stripe = new MockStripe();
  const supabase = new MockSupabase();
  supabase.userRow = { stripe_customer_id: 'cus_existing' };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'pro_monthly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://checkout.stripe.test/new');
  assert.equal(stripe.createCalls.length, 1);
  assert.equal(stripe.createCalls[0].params.customer, 'cus_existing');
  assert.equal(stripe.createCalls[0].params.customer_email, undefined);
  assert.equal(
    stripe.createCalls[0].params.subscription_data?.trial_period_days,
    TRIAL_PERIOD_DAYS,
  );
  assert.equal(
    stripe.createCalls[0].options?.idempotencyKey,
    'stripe-checkout:cus_existing:pro_monthly',
  );
});

test('createCheckoutSessionResponse blocks duplicate recurring subscriptions', async () => {
  const stripe = new MockStripe();
  stripe.subscriptionsByCustomer.set(
    'cus_existing',
    [makeSubscription({ id: 'sub_active', customerId: 'cus_existing', status: 'active' })],
  );
  const supabase = new MockSupabase();
  supabase.userRow = { stripe_customer_id: 'cus_existing' };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'basic_monthly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 409);
  assert.match(String(result.body.error), /active or trialing subscription/i);
  assert.equal(stripe.createCalls.length, 0);
});

test('createCheckoutSessionResponse reuses an open checkout session instead of creating another one', async () => {
  const stripe = new MockStripe();
  stripe.openSessionsByCustomer.set(
    'cus_existing',
    [makeSession({ id: 'cs_open', url: 'https://checkout.stripe.test/open' })],
  );
  const supabase = new MockSupabase();
  supabase.userRow = { stripe_customer_id: 'cus_existing' };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'basic_yearly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://checkout.stripe.test/open');
  assert.equal(stripe.createCalls.length, 0);
});

test('syncStripeSubscriptionResponse prefers the verified customer, syncs paused safely, and persists the customer ID', async () => {
  const stripe = new MockStripe();
  const supabase = new MockSupabase();
  supabase.userRow = {
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: 'pending',
    email: 'chef@example.com',
  };

  stripe.customersByEmail.set('chef@example.com', [
    makeCustomer({ id: 'cus_newer', created: 20 }),
    makeCustomer({ id: 'cus_verified', created: 10 }),
  ]);
  stripe.subscriptionsByCustomer.set(
    'cus_newer',
    [makeSubscription({ id: 'sub_newer', customerId: 'cus_newer', status: 'canceled', created: 20 })],
  );
  stripe.subscriptionsByCustomer.set(
    'cus_verified',
    [
      makeSubscription({
        id: 'sub_verified',
        customerId: 'cus_verified',
        status: 'paused',
        created: 10,
        metadata: { userId: 'user_123' },
        priceId: 'price_basic_yearly',
      }),
    ],
  );

  const result = await syncStripeSubscriptionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.synced, true);
  assert.equal(result.body.subscription_status, 'past_due');
  assert.equal(result.body.subscription_tier, 'basic');
  assert.equal(supabase.updates[0]?.data.stripe_customer_id, 'cus_verified');
});

test('syncStripeSubscriptionResponse clears stale entitlement when Stripe has only canceled history', async () => {
  const stripe = new MockStripe();
  stripe.subscriptionsByCustomer.set(
    'cus_existing',
    [makeSubscription({ id: 'sub_canceled', customerId: 'cus_existing', status: 'canceled' })],
  );
  const supabase = new MockSupabase();
  supabase.userRow = {
    stripe_customer_id: 'cus_existing',
    stripe_subscription_id: 'sub_local',
    subscription_status: 'active',
    email: 'chef@example.com',
  };

  const result = await syncStripeSubscriptionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.synced, true);
  assert.equal(result.body.subscription_status, 'canceled');
  // Clearing stale entitlement intentionally resets the user to the canonical
  // non-subscribed Basic baseline, matching the deletion webhook behavior.
  assert.equal(result.body.subscription_tier, 'basic');
  assert.equal(supabase.updates[0]?.data.stripe_subscription_id, null);
});

test('syncStripeSubscriptionResponse keeps pending state while checkout is still open', async () => {
  const stripe = new MockStripe();
  stripe.openSessionsByCustomer.set(
    'cus_existing',
    [makeSession({ id: 'cs_open', status: 'open', url: 'https://checkout.stripe.test/open' })],
  );
  const supabase = new MockSupabase();
  supabase.userRow = {
    stripe_customer_id: 'cus_existing',
    stripe_subscription_id: null,
    subscription_status: 'pending',
    email: 'chef@example.com',
  };

  const result = await syncStripeSubscriptionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.synced, false);
  assert.match(String(result.body.message), /still open in Stripe/i);
  assert.equal(supabase.updates.length, 0);
});

test('syncStripeSubscriptionResponse fails when it cannot safely select among duplicate customers', async () => {
  const stripe = new MockStripe();
  stripe.customersByEmail.set('chef@example.com', [
    makeCustomer({ id: 'cus_a', created: 10 }),
    makeCustomer({ id: 'cus_b', created: 20 }),
  ]);
  stripe.subscriptionsByCustomer.set(
    'cus_a',
    [makeSubscription({ id: 'sub_a', customerId: 'cus_a', status: 'active' })],
  );
  stripe.subscriptionsByCustomer.set(
    'cus_b',
    [makeSubscription({ id: 'sub_b', customerId: 'cus_b', status: 'trialing' })],
  );
  const supabase = new MockSupabase();
  supabase.userRow = {
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: 'pending',
    email: 'chef@example.com',
  };

  const result = await syncStripeSubscriptionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 409);
  assert.match(String(result.body.error), /none could be safely verified/i);
});

test('syncStripeSubscriptionResponse surfaces failed database writes', async () => {
  const stripe = new MockStripe();
  stripe.subscriptionsByCustomer.set(
    'cus_existing',
    [makeSubscription({ id: 'sub_active', customerId: 'cus_existing', status: 'active' })],
  );
  const supabase = new MockSupabase();
  supabase.userRow = {
    stripe_customer_id: 'cus_existing',
    stripe_subscription_id: null,
    subscription_status: 'pending',
    email: 'chef@example.com',
  };
  supabase.updateError = { message: 'write failed' };

  const result = await syncStripeSubscriptionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 500);
  assert.equal(result.body.error, 'Failed to update subscription record');
});

test('syncStripeSubscriptionResponse recovers when persisted customer no longer exists in Stripe', async () => {
  const stripe = new MockStripe();
  stripe.missingCustomerIds.add('cus_stale');
  stripe.customersByEmail.set('chef@example.com', [
    makeCustomer({ id: 'cus_recovered', metadata: { userId: 'user_123' } }),
  ]);
  stripe.subscriptionsByCustomer.set(
    'cus_recovered',
    [makeSubscription({ id: 'sub_active', customerId: 'cus_recovered', status: 'active' })],
  );

  const supabase = new MockSupabase();
  supabase.userRow = {
    stripe_customer_id: 'cus_stale',
    stripe_subscription_id: null,
    subscription_status: 'pending',
    email: 'chef@example.com',
  };

  const result = await syncStripeSubscriptionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.synced, true);
  assert.equal(result.body.stripe_customer_id, 'cus_recovered');
  assert.equal(supabase.updates.length, 3);
  assert.equal(supabase.updates[0]?.data.stripe_customer_id, null);
  assert.equal(supabase.updates[0]?.data.stripe_subscription_id, null);
  assert.equal(supabase.updates[0]?.data.subscription_tier, 'basic');
  assert.equal(supabase.updates[0]?.data.subscription_status, 'pending');
  assert.equal(supabase.updates[1]?.data.stripe_customer_id, 'cus_recovered');
  assert.equal(supabase.updates[2]?.data.subscription_status, 'active');
  assert.equal(supabase.updates[2]?.data.stripe_customer_id, 'cus_recovered');
});

test('syncStripeSubscriptionResponse clears stale entitlement when missing customer cannot be rediscovered', async () => {
  const stripe = new MockStripe();
  stripe.missingCustomerIds.add('cus_stale');

  const supabase = new MockSupabase();
  supabase.userRow = {
    stripe_customer_id: 'cus_stale',
    stripe_subscription_id: 'sub_local_stale',
    subscription_status: 'active',
    email: null,
  };

  const result = await syncStripeSubscriptionResponse({
    user: { id: 'user_123', email: null },
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 400);
  assert.equal(
    result.body.error,
    'No Stripe customer linked and no email available for lookup',
  );
  assert.equal(supabase.updates.length, 1);
  assert.equal(typeof supabase.updates[0]?.data.updated_at, 'string');
  assert.deepEqual(supabase.updates[0]?.data, {
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_tier: 'basic',
    subscription_status: 'pending',
    current_period_end: null,
    trial_ends_at: null,
    cancel_at_period_end: false,
    updated_at: supabase.updates[0]?.data.updated_at,
  });
});
