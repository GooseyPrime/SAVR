import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCheckoutSessionParams,
  findBlockingSubscription,
  findOpenSubscriptionCheckoutSession,
  getSubscriptionPeriodEndUnix,
  loadCustomerBillingSnapshotsByEmail,
  isPlan,
  mapStripeStatusToDatabase,
  pickCurrentSubscription,
  resolvePriceId,
  resolveStripeSubscriptionSnapshot,
  selectCustomerBillingSnapshot,
  TRIAL_PERIOD_DAYS,
} from '../lib/stripe-billing';
import { makeCustomer, makeSession, makeSubscription, MockStripe } from './stripe-billing-kit';

process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';

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

test('selectCustomerBillingSnapshot recovers the newest historical-activity customer when no current subscriptions conflict', () => {
  const snapshot = selectCustomerBillingSnapshot(
    [
      {
        customer: makeCustomer({ id: 'cus_older', created: 10 }),
        subscriptions: [makeSubscription({ id: 'sub_older', customerId: 'cus_older', status: 'canceled', created: 10 })],
        openCheckoutSessions: [],
      },
      {
        customer: makeCustomer({ id: 'cus_newer', created: 20 }),
        subscriptions: [makeSubscription({ id: 'sub_newer', customerId: 'cus_newer', status: 'canceled', created: 20 })],
        openCheckoutSessions: [],
      },
    ],
    'user_123',
  );

  assert.equal(snapshot?.customer.id, 'cus_newer');
});

test('loadCustomerBillingSnapshotsByEmail ignores stale customer IDs when at least one customer remains valid', async () => {
  const stripe = new MockStripe();
  stripe.customersByEmail.set('chef@example.com', [
    makeCustomer({ id: 'cus_stale', metadata: { userId: 'user_123' } }),
    makeCustomer({ id: 'cus_valid', metadata: { userId: 'user_123' } }),
  ]);
  stripe.missingCustomerIds.add('cus_stale');
  stripe.subscriptionsByCustomer.set(
    'cus_valid',
    [makeSubscription({ id: 'sub_active', customerId: 'cus_valid', status: 'active' })],
  );

  const snapshots = await loadCustomerBillingSnapshotsByEmail(
    stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    'chef@example.com',
  );

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.customer.id, 'cus_valid');
  assert.equal(snapshots[0]?.subscriptions.length, 1);
});

test('loadCustomerBillingSnapshotsByEmail returns empty when all discovered customers are stale', async () => {
  const stripe = new MockStripe();
  stripe.customersByEmail.set('chef@example.com', [
    makeCustomer({ id: 'cus_stale_a', metadata: { userId: 'user_123' } }),
    makeCustomer({ id: 'cus_stale_b', metadata: { userId: 'user_123' } }),
  ]);
  stripe.missingCustomerIds.add('cus_stale_a');
  stripe.missingCustomerIds.add('cus_stale_b');

  const snapshots = await loadCustomerBillingSnapshotsByEmail(
    stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    'chef@example.com',
  );

  assert.deepEqual(snapshots, []);
});

test('loadCustomerBillingSnapshotsByEmail throws when stale customers are mixed with hard Stripe errors and no valid snapshot remains', async () => {
  const stripe = new MockStripe();
  stripe.customersByEmail.set('chef@example.com', [
    makeCustomer({ id: 'cus_stale', metadata: { userId: 'user_123' } }),
    makeCustomer({ id: 'cus_error', metadata: { userId: 'user_123' } }),
  ]);
  stripe.missingCustomerIds.add('cus_stale');
  stripe.customerActivityErrors.set('cus_error', new Error('stripe upstream unavailable'));

  await assert.rejects(
    () =>
      loadCustomerBillingSnapshotsByEmail(
        stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
        'chef@example.com',
      ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.message, /cus_error/);
      return true;
    },
  );
});

test('loadCustomerBillingSnapshotsByEmail throws when a hard Stripe error occurs even if another snapshot succeeded', async () => {
  const stripe = new MockStripe();
  stripe.customersByEmail.set('chef@example.com', [
    makeCustomer({ id: 'cus_valid', metadata: { userId: 'user_123' } }),
    makeCustomer({ id: 'cus_error', metadata: { userId: 'user_123' } }),
  ]);
  stripe.subscriptionsByCustomer.set(
    'cus_valid',
    [makeSubscription({ id: 'sub_active', customerId: 'cus_valid', status: 'active' })],
  );
  stripe.customerActivityErrors.set('cus_error', new Error('stripe upstream unavailable'));

  await assert.rejects(
    () =>
      loadCustomerBillingSnapshotsByEmail(
        stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
        'chef@example.com',
      ),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.message, /cus_error/);
      return true;
    },
  );
});
