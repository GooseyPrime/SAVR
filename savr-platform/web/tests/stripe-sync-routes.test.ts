import assert from 'node:assert/strict';
import test from 'node:test';

import {
  syncStripeSubscriptionPost,
  syncStripeSubscriptionResponse,
} from '../app/api/stripe/sync/route';
import { makeCustomer, makeSession, makeSubscription, MockStripe, MockSupabase } from './stripe-billing-kit';

process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';

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

test('syncStripeSubscriptionResponse returns 502 when Stripe customer discovery fails unexpectedly', async () => {
  const stripe = new MockStripe();
  stripe.customersListError = new Error('stripe upstream unavailable');

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

  assert.equal(result.status, 502);
  assert.equal(
    result.body.error,
    'Could not look up Stripe customers for this account. Please try again shortly.',
  );
  assert.equal(supabase.updates.length, 0);
});

test('POST /api/stripe/sync returns 503 when authentication throws unexpectedly', async () => {
  const response = await syncStripeSubscriptionPost(
    new Request('https://savr.app/api/stripe/sync', { method: 'POST' }) as unknown as import('next/server').NextRequest,
    {
      authenticateRequest: async () => {
        throw new Error('auth unavailable');
      },
      getStripeInstance: (() => {
        throw new Error('should not initialize Stripe when auth fails');
      }) as typeof import('../lib/stripe').getStripeInstance,
      getSupabaseAdmin: (() => {
        throw new Error('should not initialize Supabase when auth fails');
      }) as typeof import('../lib/supabase').getSupabaseAdmin,
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Authentication service is temporarily unavailable. Please try again.',
  });
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
