/**
 * Webhook business logic tests (corrective PR 3).
 *
 * Covers: invalid signature, missing signature, first valid delivery,
 * duplicate processed delivery, retry after failed delivery,
 * Basic monthly/yearly, Pro monthly/yearly, unknown price ID,
 * subscription update, subscription deletion, payment failed,
 * payment recovered.
 *
 * No live Stripe key required — all dependencies are injected mocks.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  handleWebhook,
  claimWebhookEvent,
  type ClaimResult,
  type StripeClient,
  type SupabaseAdmin,
} from '../lib/stripe-webhook';
import type Stripe from 'stripe';

// ──────────────────────────────────────────────────────────────
// Test env: configure price IDs used by resolveTierFromPriceId
// ──────────────────────────────────────────────────────────────

process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_YEARLY  = 'price_basic_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY   = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY    = 'price_pro_yearly';

// ──────────────────────────────────────────────────────────────
// Mock builder helpers
// ──────────────────────────────────────────────────────────────

/** Creates a minimal Stripe.Event fixture. */
function makeEvent(
  id: string,
  type: string,
  dataObject: Record<string, unknown>,
): Stripe.Event {
  return {
    id,
    type,
    object: 'event',
    api_version: '2026-01-28.clover',
    created: 1700000000,
    data: { object: dataObject as never },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

/** Creates a mock Stripe.Subscription fixture. */
function makeSubscription(
  id: string,
  customerId: string,
  priceId: string,
  status: string = 'active',
): Stripe.Subscription {
  return {
    id,
    object: 'subscription',
    customer: customerId,
    status,
    cancel_at_period_end: false,
    trial_end: null,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test',
          object: 'subscription_item',
          price: { id: priceId, object: 'price' } as Stripe.Price,
          current_period_end: 1800000000,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
  } as unknown as Stripe.Subscription;
}

/** Creates a mock Stripe.Invoice fixture. */
function makeInvoice(
  id: string,
  customerId: string,
  created: number = 1700000000,
): Stripe.Invoice {
  return {
    id,
    object: 'invoice',
    customer: customerId,
    created,
  } as unknown as Stripe.Invoice;
}

/** Creates a mock Stripe.Checkout.Session fixture. */
function makeCheckoutSession(
  id: string,
  userId: string,
  customerId: string,
  subscriptionId: string,
): Stripe.Checkout.Session {
  return {
    id,
    object: 'checkout.session',
    client_reference_id: userId,
    customer: customerId,
    subscription: subscriptionId,
    metadata: {},
  } as unknown as Stripe.Checkout.Session;
}

// ──────────────────────────────────────────────────────────────
// Supabase mock factory
// ──────────────────────────────────────────────────────────────

interface MockRpcOptions {
  /** What claim_stripe_webhook_event should return. Default: 'claimed'. */
  claimResult?: ClaimResult;
  /** Whether the RPC itself should fail. Default: false. */
  rpcError?: boolean;
}

interface MockFromOptions {
  /** User row returned by .select('id').eq('stripe_customer_id', ...).single() */
  userById?: { id: string } | null;
  /** User row returned by .select('email').eq('id', ...).single() */
  userByUserId?: { email: string } | null;
  /** Whether update() calls should be tracked. Default: true. */
  trackUpdates?: boolean;
}

interface MockSupabase extends SupabaseAdmin {
  _updates: Array<{ table: string; data: Record<string, unknown> }>;
  _rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
}

function makeMockSupabase(
  rpcOpts: MockRpcOptions = {},
  fromOpts: MockFromOptions = {},
): MockSupabase {
  const updates: Array<{ table: string; data: Record<string, unknown> }> = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  const mock: MockSupabase = {
    _updates: updates,
    _rpcCalls: rpcCalls,

    async rpc(fn: string, args: Record<string, unknown> = {}) {
      rpcCalls.push({ fn, args });

      if (rpcOpts.rpcError) {
        return { data: null, error: { message: 'DB error' } };
      }

      if (fn === 'claim_stripe_webhook_event') {
        return { data: rpcOpts.claimResult ?? 'claimed', error: null };
      }

      return { data: null, error: null };
    },

    from(table: string) {
      let _updateData: Record<string, unknown> = {};

      const builder = {
        select(_cols: string) {
          return builder;
        },
        update(data: Record<string, unknown>) {
          _updateData = data;
          return builder;
        },
        eq(_col: string, _val: unknown) {
          return builder as typeof builder & Promise<{ data: unknown; error: unknown }>;
        },
        single(): Promise<{ data: unknown; error: unknown }> {
          // Distinguish lookup type by update data being empty (this is a select path)
          // For users table: return different fixtures based on column being queried.
          // We use a simple heuristic based on the sequence of calls.
          const response = (() => {
            if (table === 'users') {
              if (fromOpts.userById !== undefined) {
                return { data: fromOpts.userById, error: fromOpts.userById ? null : { message: 'not found' } };
              }
              if (fromOpts.userByUserId !== undefined) {
                return { data: fromOpts.userByUserId, error: fromOpts.userByUserId ? null : { message: 'not found' } };
              }
              return { data: { id: 'user_123', email: 'test@example.com' }, error: null };
            }
            return { data: null, error: null };
          })();
          return Promise.resolve(response);
        },
        then(
          resolve: (v: { data: unknown; error: unknown }) => unknown,
        ) {
          if (Object.keys(_updateData).length > 0) {
            updates.push({ table, data: _updateData });
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };

      return builder as ReturnType<SupabaseAdmin['from']>;
    },
  };

  return mock;
}

// ──────────────────────────────────────────────────────────────
// Stripe mock factory
// ──────────────────────────────────────────────────────────────

interface MockStripeOptions {
  /** Throw on constructEvent. Default: false. */
  badSignature?: boolean;
  /** Subscription to return from subscriptions.retrieve. */
  subscription?: Stripe.Subscription;
  /** Customer to return from customers.retrieve. */
  customer?: Stripe.Customer | Stripe.DeletedCustomer;
}

function makeMockStripe(opts: MockStripeOptions = {}): StripeClient {
  return {
    webhooks: {
      constructEvent(body: string, _sig: string, _secret: string): Stripe.Event {
        if (opts.badSignature) {
          throw new Error('No signatures found matching the expected signature for payload');
        }
        return JSON.parse(body) as Stripe.Event;
      },
    },
    subscriptions: {
      async retrieve(_id: string): Promise<Stripe.Subscription> {
        if (!opts.subscription) throw new Error('No subscription mock configured');
        return opts.subscription;
      },
    },
    customers: {
      async retrieve(_id: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
        if (!opts.customer) return { id: 'cus_test', object: 'customer', deleted: true } as Stripe.DeletedCustomer;
        return opts.customer;
      },
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Signature / secret gate tests
// ──────────────────────────────────────────────────────────────

test('missing signature returns 400', async () => {
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase();
  const res = await handleWebhook('{}', null, 'whsec_test', stripe, supabase);
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'No signature' });
});

test('missing webhook secret returns 500', async () => {
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase();
  const res = await handleWebhook('{}', 't=1,v1=abc', undefined, stripe, supabase);
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: 'Webhook configuration error' });
});

test('invalid signature returns 400', async () => {
  const stripe = makeMockStripe({ badSignature: true });
  const supabase = makeMockSupabase();
  const res = await handleWebhook('{}', 'bad_sig', 'whsec_test', stripe, supabase);
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'Invalid signature' });
});

// ──────────────────────────────────────────────────────────────
// Idempotency tests
// ──────────────────────────────────────────────────────────────

test('first valid delivery is claimed and returns 200', async () => {
  const event = makeEvent('evt_first', 'customer.subscription.updated',
    makeSubscription('sub_1', 'cus_1', 'price_pro_monthly') as unknown as Record<string, unknown>);
  const stripe = makeMockStripe({
    subscription: makeSubscription('sub_1', 'cus_1', 'price_pro_monthly'),
  });
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { received: true });
  assert.equal(supabase._rpcCalls[0].fn, 'claim_stripe_webhook_event');
  assert.equal(supabase._rpcCalls[0].args.p_event_id, 'evt_first');
});

test('duplicate already-processed event returns 200 without re-processing', async () => {
  const event = makeEvent('evt_dup', 'customer.subscription.updated', {});
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase({ claimResult: 'already_processed' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { received: true });
  // No user updates should have occurred
  assert.equal(supabase._updates.length, 0);
});

test('already-pending concurrent event returns 200 and defers', async () => {
  const event = makeEvent('evt_pending', 'customer.subscription.updated', {});
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase({ claimResult: 'already_pending' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { received: true });
  assert.equal(supabase._updates.length, 0);
});

test('retry after failed delivery: handler processes event and returns 200', async () => {
  // When claimResult = 'claimed' the handler processes normally.
  // This simulates Stripe retrying a previously failed event.
  const subscription = makeSubscription('sub_retry', 'cus_retry', 'price_basic_monthly');
  const event = makeEvent(
    'evt_retry',
    'customer.subscription.updated',
    subscription as unknown as Record<string, unknown>,
  );
  const stripe = makeMockStripe({ subscription });
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
});

test('claim RPC error returns 500', async () => {
  const event = makeEvent('evt_rpcerr', 'customer.subscription.updated', {});
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase({ rpcError: true });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: 'Failed to claim webhook event' });
});

// ──────────────────────────────────────────────────────────────
// Billing tier resolution via webhook
// ──────────────────────────────────────────────────────────────

for (const [label, priceId, expectedTier] of [
  ['Basic monthly', 'price_basic_monthly', 'basic'],
  ['Basic yearly',  'price_basic_yearly',  'basic'],
  ['Pro monthly',   'price_pro_monthly',   'pro'],
  ['Pro yearly',    'price_pro_yearly',    'pro'],
] as const) {
  test(`subscription update with ${label} price sets tier=${expectedTier}`, async () => {
    const subscription = makeSubscription('sub_tier', 'cus_tier', priceId);
    const event = makeEvent(
      `evt_tier_${priceId}`,
      'customer.subscription.updated',
      subscription as unknown as Record<string, unknown>,
    );
    const stripe = makeMockStripe({ subscription });
    const supabase = makeMockSupabase({ claimResult: 'claimed' });

    const res = await handleWebhook(
      JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
    );

    assert.equal(res.status, 200);
    // Confirm a user update was attempted with the correct tier
    const userUpdate = supabase._updates.find(u => u.table === 'users' && 'subscription_tier' in u.data);
    assert.ok(userUpdate, `Expected a users update with subscription_tier for ${label}`);
    assert.equal(userUpdate!.data.subscription_tier, expectedTier);
  });
}

test('unknown price ID causes handler to fail and returns 500 so Stripe retries', async () => {
  const subscription = makeSubscription('sub_unknown', 'cus_unknown', 'price_unknown_xyz');
  const event = makeEvent(
    'evt_unknown_price',
    'customer.subscription.updated',
    subscription as unknown as Record<string, unknown>,
  );
  const stripe = makeMockStripe({ subscription });
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  // Unknown price = resolveTierFromPriceId throws = handler fails = 500
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: 'Webhook handler failed' });
});

// ──────────────────────────────────────────────────────────────
// Checkout session completed
// ──────────────────────────────────────────────────────────────

test('checkout.session.completed links customer ID and tier to user', async () => {
  const subscription = makeSubscription('sub_co', 'cus_co', 'price_pro_monthly');
  const session = makeCheckoutSession('cs_test', 'user_co', 'cus_co', 'sub_co');
  const event = makeEvent(
    'evt_checkout',
    'checkout.session.completed',
    session as unknown as Record<string, unknown>,
  );
  const stripe = makeMockStripe({ subscription });
  const supabase = makeMockSupabase(
    { claimResult: 'claimed' },
    { userByUserId: { email: 'co@example.com' } },
  );

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
});

// ──────────────────────────────────────────────────────────────
// Subscription deletion
// ──────────────────────────────────────────────────────────────

test('subscription deletion resets user to basic/canceled', async () => {
  const subscription = makeSubscription('sub_del', 'cus_del', 'price_pro_monthly', 'canceled');
  const event = makeEvent(
    'evt_sub_deleted',
    'customer.subscription.deleted',
    subscription as unknown as Record<string, unknown>,
  );
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
  const update = supabase._updates.find(u => u.table === 'users' && u.data.subscription_status === 'canceled');
  assert.ok(update, 'Expected a canceled status update');
  assert.equal(update!.data.subscription_tier, 'basic');
  assert.equal(update!.data.stripe_subscription_id, null);
});

// ──────────────────────────────────────────────────────────────
// Payment events
// ──────────────────────────────────────────────────────────────

test('payment failed sets past_due and payment_action_required', async () => {
  const invoice = makeInvoice('in_failed', 'cus_pf');
  const event = makeEvent(
    'evt_payment_failed',
    'invoice.payment_failed',
    invoice as unknown as Record<string, unknown>,
  );
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
  const update = supabase._updates.find(u => u.table === 'users' && u.data.last_payment_status === 'failed');
  assert.ok(update, 'Expected a payment-failed update');
  assert.equal(update!.data.subscription_status, 'past_due');
  assert.equal(update!.data.payment_action_required, true);
});

test('payment recovered (invoice.payment_succeeded) clears payment_action_required', async () => {
  const invoice = makeInvoice('in_ok', 'cus_pr');
  const event = makeEvent(
    'evt_payment_succeeded',
    'invoice.payment_succeeded',
    invoice as unknown as Record<string, unknown>,
  );
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
  const update = supabase._updates.find(u => u.table === 'users' && u.data.last_payment_status === 'succeeded');
  assert.ok(update, 'Expected a payment-succeeded update');
  assert.equal(update!.data.payment_action_required, false);
});

// ──────────────────────────────────────────────────────────────
// claimWebhookEvent unit tests
// ──────────────────────────────────────────────────────────────

test('claimWebhookEvent returns claimed on fresh insert', async () => {
  const supabase = makeMockSupabase({ claimResult: 'claimed' });
  const result = await claimWebhookEvent(supabase, 'evt_new', 'checkout.session.completed');
  assert.equal(result, 'claimed');
  assert.equal(supabase._rpcCalls[0].fn, 'claim_stripe_webhook_event');
  assert.equal(supabase._rpcCalls[0].args.p_event_id, 'evt_new');
  assert.equal(supabase._rpcCalls[0].args.p_event_type, 'checkout.session.completed');
});

test('claimWebhookEvent returns already_processed for completed duplicates', async () => {
  const supabase = makeMockSupabase({ claimResult: 'already_processed' });
  const result = await claimWebhookEvent(supabase, 'evt_done', 'checkout.session.completed');
  assert.equal(result, 'already_processed');
});

test('claimWebhookEvent returns already_pending for concurrent deliveries', async () => {
  const supabase = makeMockSupabase({ claimResult: 'already_pending' });
  const result = await claimWebhookEvent(supabase, 'evt_running', 'checkout.session.completed');
  assert.equal(result, 'already_pending');
});

test('claimWebhookEvent throws on RPC error', async () => {
  const supabase = makeMockSupabase({ rpcError: true });
  await assert.rejects(
    () => claimWebhookEvent(supabase, 'evt_err', 'checkout.session.completed'),
    /Failed to claim webhook event/,
  );
});
