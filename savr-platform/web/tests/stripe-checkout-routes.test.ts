import assert from 'node:assert/strict';
import test from 'node:test';

import { TRIAL_PERIOD_DAYS } from '../lib/stripe-billing';
import { createCheckoutSessionResponse } from '../app/api/stripe/checkout/route';
import { makeCustomer, makeSession, makeSubscription, MockStripe, MockSupabase } from './stripe-billing-kit';

process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';

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
    'stripe-checkout:cus_existing:pro_monthly:trial',
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
    [makeSession({
      id: 'cs_open',
      url: 'https://checkout.stripe.test/open',
      metadata: { priceId: 'price_basic_yearly', includeTrial: 'true' },
    })],
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

test('createCheckoutSessionResponse does not reuse an open session for a different price', async () => {
  const stripe = new MockStripe();
  stripe.openSessionsByCustomer.set(
    'cus_existing',
    [makeSession({
      id: 'cs_open_basic',
      url: 'https://checkout.stripe.test/open-basic',
      metadata: { priceId: 'price_basic_monthly', includeTrial: 'true' },
    })],
  );
  const supabase = new MockSupabase();
  supabase.userRow = { stripe_customer_id: 'cus_existing' };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'pro_yearly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://checkout.stripe.test/new');
  assert.equal(stripe.createCalls.length, 1);
  assert.equal(stripe.createCalls[0].params.line_items?.[0]?.price, 'price_pro_yearly');
});

test('createCheckoutSessionResponse does not reuse a trial session after the customer consumed a trial', async () => {
  const stripe = new MockStripe();
  stripe.subscriptionsByCustomer.set(
    'cus_existing',
    [makeSubscription({
      id: 'sub_old_trial',
      customerId: 'cus_existing',
      status: 'canceled',
      trialEnd: 1700000500,
    })],
  );
  stripe.openSessionsByCustomer.set(
    'cus_existing',
    [makeSession({
      id: 'cs_open_trial',
      url: 'https://checkout.stripe.test/open-trial',
      metadata: { priceId: 'price_pro_monthly', includeTrial: 'true' },
    })],
  );
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
  assert.equal(stripe.createCalls[0].params.subscription_data?.trial_period_days, undefined);
  assert.equal(stripe.createCalls[0].params.metadata?.includeTrial, 'false');
  assert.equal(
    stripe.createCalls[0].options?.idempotencyKey,
    'stripe-checkout:cus_existing:pro_monthly:no-trial',
  );
});

test('createCheckoutSessionResponse retries without a trial when Stripe rejects trial eligibility', async () => {
  const stripe = new MockStripe();
  stripe.createErrorWhenTrial = new Error('This customer is not eligible for another trial');
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
  assert.equal(stripe.createCalls.length, 2);
  assert.equal(stripe.createCalls[0].params.subscription_data?.trial_period_days, TRIAL_PERIOD_DAYS);
  assert.equal(stripe.createCalls[1].params.subscription_data?.trial_period_days, undefined);
  assert.equal(
    stripe.createCalls[1].options?.idempotencyKey,
    'stripe-checkout:cus_existing:pro_monthly:no-trial',
  );
});

test('createCheckoutSessionResponse returns 502 when loading customer activity fails unexpectedly', async () => {
  const stripe = new MockStripe();
  stripe.customerActivityErrors.set('cus_existing', new Error('stripe upstream unavailable'));
  const supabase = new MockSupabase();
  supabase.userRow = { stripe_customer_id: 'cus_existing' };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'basic_monthly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 502);
  assert.equal(
    result.body.error,
    'Could not load billing details from Stripe. Please try again shortly.',
  );
  assert.equal(stripe.createCalls.length, 0);
  assert.equal(supabase.updates.length, 0);
});

test('createCheckoutSessionResponse clears stale entitlement and reconciles a recovered customer', async () => {
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
  supabase.userRow = { stripe_customer_id: 'cus_stale' };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'pro_monthly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 409);
  assert.match(String(result.body.error), /active or trialing subscription/i);
  assert.equal(stripe.createCalls.length, 0);
  assert.equal(supabase.updates.length, 2);
  const clearedUpdatedAt = String(supabase.updates[0]?.data.updated_at ?? '');
  assert.notEqual(clearedUpdatedAt.length, 0);
  assert.equal(Number.isNaN(Date.parse(clearedUpdatedAt)), false);
  assert.deepEqual(
    {
      stripe_customer_id: supabase.updates[0]?.data.stripe_customer_id,
      stripe_subscription_id: supabase.updates[0]?.data.stripe_subscription_id,
      subscription_tier: supabase.updates[0]?.data.subscription_tier,
      subscription_status: supabase.updates[0]?.data.subscription_status,
      current_period_end: supabase.updates[0]?.data.current_period_end,
      trial_ends_at: supabase.updates[0]?.data.trial_ends_at,
      cancel_at_period_end: supabase.updates[0]?.data.cancel_at_period_end,
    },
    {
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_tier: 'basic',
    subscription_status: 'pending',
    current_period_end: null,
    trial_ends_at: null,
    cancel_at_period_end: false,
    },
  );
  assert.equal(supabase.updates[1]?.data.stripe_customer_id, 'cus_recovered');
  assert.equal(supabase.updates[1]?.data.stripe_subscription_id, 'sub_active');
  assert.equal(supabase.updates[1]?.data.subscription_tier, 'pro');
  assert.equal(supabase.updates[1]?.data.subscription_status, 'active');
});

test('createCheckoutSessionResponse returns 500 when stale-customer reset write fails', async () => {
  const stripe = new MockStripe();
  stripe.missingCustomerIds.add('cus_stale');
  const supabase = new MockSupabase();
  supabase.userRow = { stripe_customer_id: 'cus_stale' };
  supabase.updateError = { message: 'write failed' };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'basic_monthly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 500);
  assert.equal(result.body.error, 'Failed to update billing record');
  assert.equal(stripe.createCalls.length, 0);
  assert.equal(supabase.updates.length, 1);
});

test('createCheckoutSessionResponse returns 502 when Stripe customer discovery fails unexpectedly', async () => {
  const stripe = new MockStripe();
  stripe.customersListError = new Error('stripe upstream unavailable');
  const supabase = new MockSupabase();
  supabase.userRow = { stripe_customer_id: null };

  const result = await createCheckoutSessionResponse({
    user: { id: 'user_123', email: 'chef@example.com' },
    plan: 'basic_monthly',
    origin: 'https://savr.app',
    stripe: stripe as unknown as ReturnType<typeof import('../lib/stripe').getStripeInstance>,
    supabaseAdmin: supabase as unknown as ReturnType<typeof import('../lib/supabase').getSupabaseAdmin>,
  });

  assert.equal(result.status, 502);
  assert.equal(
    result.body.error,
    'Could not look up Stripe customers. Please try again shortly.',
  );
  assert.equal(stripe.createCalls.length, 0);
  assert.equal(supabase.updates.length, 0);
});
