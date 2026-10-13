/**
 * Webhook business logic tests (corrective PR 3).
 *
 * Covers: invalid signature, missing signature, first valid delivery,
 * duplicate processed delivery, retry after failed delivery,
 * Basic monthly/yearly, Pro monthly/yearly, unknown price ID,
 * subscription update, subscription deletion, payment failed,
 * payment recovered.
 *
 * Also covers the shared-Stripe-account contract: events belonging to other
 * products are acknowledged with 200 and no side effects, database failures
 * on SAVR's own events return 500, and the email fallback only links
 * customers that hold a SAVR subscription.
 *
 * Retry contract: only completed duplicates are acknowledged with 200; an
 * unfinished ('already_pending') claim answers 409 so Stripe keeps retrying.
 * Ownership survives price retirement through the stored subscription link,
 * and an incomplete price configuration is rejected before classification.
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
import { buildCheckoutSessionParams } from '../lib/stripe-billing';
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

/** Creates a mock Stripe.Invoice fixture billing the given price. */
function makeInvoice(
  id: string,
  customerId: string,
  created: number = 1700000000,
  priceId: string = 'price_pro_monthly',
): Stripe.Invoice {
  return {
    id,
    object: 'invoice',
    customer: customerId,
    created,
    lines: {
      object: 'list',
      data: [{ id: 'il_test', pricing: { price_details: { price: priceId } } }],
    },
  } as unknown as Stripe.Invoice;
}

/** Creates a mock Stripe.Checkout.Session fixture. */
function makeCheckoutSession(
  id: string,
  userId: string,
  customerId: string,
  subscriptionId: string,
  metadata: Record<string, string> = {},
): Stripe.Checkout.Session {
  return {
    id,
    object: 'checkout.session',
    client_reference_id: userId,
    customer: customerId,
    subscription: subscriptionId,
    metadata,
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

interface MockUserRow {
  id: string;
  email?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

interface MockFromOptions {
  /**
   * Rows of the users table. When omitted, every lookup matches a single
   * default user (user_123) regardless of the filter.
   */
  users?: MockUserRow[];
  /** Make every users SELECT fail. */
  selectError?: boolean;
  /** Make every users UPDATE fail. */
  updateError?: boolean;
}

interface MockSupabase extends SupabaseAdmin {
  _updates: Array<{ table: string; data: Record<string, unknown> }>;
  _selects: Array<{ table: string; column: string; value: unknown }>;
  _rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
}

function makeMockSupabase(
  rpcOpts: MockRpcOptions = {},
  fromOpts: MockFromOptions = {},
): MockSupabase {
  const updates: MockSupabase['_updates'] = [];
  const selects: MockSupabase['_selects'] = [];
  const rpcCalls: MockSupabase['_rpcCalls'] = [];

  const mock: MockSupabase = {
    _updates: updates,
    _selects: selects,
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
      let updateData: Record<string, unknown> | null = null;
      let filter: { column: string; value: unknown } | null = null;

      const resolveQuery = (): { data: unknown; error: unknown } => {
        if (updateData) {
          updates.push({ table, data: updateData });
          if (table === 'users' && fromOpts.updateError) {
            return { data: null, error: { message: 'update failed' } };
          }
          return { data: null, error: null };
        }

        if (table !== 'users' || !filter) return { data: [], error: null };
        selects.push({ table, column: filter.column, value: filter.value });
        if (fromOpts.selectError) {
          return { data: null, error: { message: 'select failed' } };
        }
        if (!fromOpts.users) {
          return { data: [{ id: 'user_123', email: 'test@example.com' }], error: null };
        }
        const { column, value } = filter;
        const rows = fromOpts.users.filter(
          (row) => (row as unknown as Record<string, unknown>)[column] === value,
        );
        return { data: rows, error: null };
      };

      const builder = {
        select(_cols: string) {
          return builder;
        },
        update(data: Record<string, unknown>) {
          updateData = data;
          return builder;
        },
        eq(column: string, value: unknown) {
          filter = { column, value };
          return builder;
        },
        then<T>(resolve: (v: { data: unknown; error: unknown }) => T) {
          return Promise.resolve(resolveQuery()).then(resolve);
        },
      };

      return builder as unknown as ReturnType<SupabaseAdmin['from']>;
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

interface MockStripe extends StripeClient {
  _customerRetrievals: string[];
  _subscriptionRetrievals: string[];
}

function makeMockStripe(opts: MockStripeOptions = {}): MockStripe {
  const customerRetrievals: string[] = [];
  const subscriptionRetrievals: string[] = [];
  return {
    _customerRetrievals: customerRetrievals,
    _subscriptionRetrievals: subscriptionRetrievals,
    webhooks: {
      constructEvent(body: string, _sig: string, _secret: string): Stripe.Event {
        if (opts.badSignature) {
          throw new Error('No signatures found matching the expected signature for payload');
        }
        return JSON.parse(body) as Stripe.Event;
      },
    },
    subscriptions: {
      async retrieve(id: string): Promise<Stripe.Subscription> {
        subscriptionRetrievals.push(id);
        if (!opts.subscription) throw new Error('No subscription mock configured');
        return opts.subscription;
      },
    },
    customers: {
      async retrieve(id: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
        customerRetrievals.push(id);
        if (!opts.customer) return { id: 'cus_test', object: 'customer', deleted: true } as Stripe.DeletedCustomer;
        return opts.customer;
      },
    },
  };
}

/** Runs fn while recording console.error calls (and silencing them). */
async function captureErrorLogs(fn: () => Promise<void>): Promise<unknown[][]> {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return calls;
}

/** Runs fn while recording console.warn calls (and silencing them). */
async function captureWarnLogs(fn: () => Promise<void>): Promise<unknown[][]> {
  const original = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return calls;
}

/** Foreign events may only run the read-only stored-subscription ownership lookup. */
function assertOnlyOwnershipLookups(supabase: MockSupabase): void {
  for (const select of supabase._selects) {
    assert.equal(select.table, 'users');
    assert.equal(select.column, 'stripe_subscription_id', 'only the ownership lookup may read users');
  }
}

function deliver(event: Stripe.Event, stripe: StripeClient, supabase: SupabaseAdmin) {
  return handleWebhook(JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase);
}

function asObject(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
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
  const event = makeEvent('evt_dup', 'customer.subscription.updated',
    asObject(makeSubscription('sub_x', 'cus_x', 'price_pro_monthly')));
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

test('already-pending (unfinished) claim returns retryable 409, never a 2xx, and defers', async () => {
  const event = makeEvent('evt_pending', 'customer.subscription.updated',
    asObject(makeSubscription('sub_x', 'cus_x', 'price_pro_monthly')));
  const stripe = makeMockStripe();
  const supabase = makeMockSupabase({ claimResult: 'already_pending' });

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 409);
  assert.ok(res.status < 200 || res.status >= 300, 'Stripe must not record the delivery as successful');
  assert.deepEqual(res.body, { error: 'Event is still being processed; retry later' });
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
  const event = makeEvent('evt_rpcerr', 'customer.subscription.updated',
    asObject(makeSubscription('sub_rpcerr', 'cus_rpcerr', 'price_pro_monthly')));
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

test('SAVR-marked subscription on a retired price reconciles status but keeps the stored tier', async () => {
  const subscription = makeSubscription('sub_unknown', 'cus_unknown', 'price_retired_xyz', 'past_due');
  (subscription as unknown as { metadata: Record<string, string> }).metadata = { product: 'savr' };
  const event = makeEvent('evt_unknown_price', 'customer.subscription.updated', asObject(subscription));
  const stripe = makeMockStripe({ subscription });
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  const warnings = await captureWarnLogs(async () => {
    res = await deliver(event, stripe, supabase);
  });

  assert.equal(res?.status, 200);
  const userUpdate = supabase._updates.find((u) => u.table === 'users');
  assert.ok(userUpdate, 'status must still reconcile');
  assert.equal(userUpdate!.data.subscription_status, 'past_due');
  assert.ok(!('subscription_tier' in userUpdate!.data), 'tier is never guessed from an unknown price');
  assert.equal(warnings.length, 1, 'the retained tier is logged');
  assert.ok(
    supabase._updates.some(
      (u) => u.table === 'stripe_webhook_events' && u.data.processing_status === 'processed',
    ),
  );
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
    { users: [{ id: 'user_co', email: 'co@example.com' }] },
  );

  const res = await handleWebhook(
    JSON.stringify(event), 't=1,v1=abc', 'whsec_test', stripe, supabase,
  );

  assert.equal(res.status, 200);
  const update = supabase._updates.find((u) => u.table === 'users');
  assert.ok(update, 'Expected the user row to be updated');
  assert.equal(update.data.stripe_customer_id, 'cus_co');
  assert.equal(update.data.stripe_subscription_id, 'sub_co');
  assert.equal(update.data.subscription_tier, 'pro');
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

// ──────────────────────────────────────────────────────────────
// Shared Stripe account: events that are not SAVR's
// ──────────────────────────────────────────────────────────────

const FOREIGN_PRICE = 'price_other_product';

const foreignEvents: Array<[string, () => Stripe.Event]> = [
  ['customer.subscription.created', () => makeEvent('evt_f1', 'customer.subscription.created',
    asObject(makeSubscription('sub_f', 'cus_f', FOREIGN_PRICE)))],
  ['customer.subscription.updated', () => makeEvent('evt_f2', 'customer.subscription.updated',
    asObject(makeSubscription('sub_f', 'cus_f', FOREIGN_PRICE)))],
  ['customer.subscription.deleted', () => makeEvent('evt_f3', 'customer.subscription.deleted',
    asObject(makeSubscription('sub_f', 'cus_f', FOREIGN_PRICE, 'canceled')))],
  ['customer.subscription.paused', () => makeEvent('evt_f4', 'customer.subscription.paused',
    asObject(makeSubscription('sub_f', 'cus_f', FOREIGN_PRICE, 'paused')))],
  ['invoice.paid', () => makeEvent('evt_f5', 'invoice.paid',
    asObject(makeInvoice('in_f', 'cus_f', 1700000000, FOREIGN_PRICE)))],
  ['invoice.payment_failed', () => makeEvent('evt_f6', 'invoice.payment_failed',
    asObject(makeInvoice('in_f', 'cus_f', 1700000000, FOREIGN_PRICE)))],
  ['invoice.payment_failed (legacy line shape)', () => makeEvent('evt_f7', 'invoice.payment_failed', {
    id: 'in_f', object: 'invoice', customer: 'cus_f', created: 1700000000,
    lines: { data: [{ price: { id: FOREIGN_PRICE } }] },
  })],
  ['checkout.session.completed (subscription)', () => makeEvent('evt_f8', 'checkout.session.completed',
    asObject(makeCheckoutSession('cs_f', 'someone_elses_user', 'cus_f', 'sub_f', { userId: 'someone_elses_user' })))],
  ['checkout.session.completed (one-off payment)', () => makeEvent('evt_f9', 'checkout.session.completed', {
    id: 'cs_f2', object: 'checkout.session', mode: 'payment', customer: 'cus_f',
    client_reference_id: 'order_42', subscription: null, metadata: { product: 'another-product' },
  })],
  ['payment_intent.succeeded (unhandled type)', () => makeEvent('evt_f10', 'payment_intent.succeeded', {
    id: 'pi_f', object: 'payment_intent', customer: 'cus_f',
  })],
];

for (const [label, build] of foreignEvents) {
  test(`another product's ${label} returns 200, writes nothing and logs no error`, async () => {
    const stripe = makeMockStripe({
      subscription: makeSubscription('sub_f', 'cus_f', FOREIGN_PRICE),
      // The foreign customer shares an email with a SAVR user and is even
      // linked to a SAVR user row — neither may cause any effect.
      customer: { id: 'cus_f', object: 'customer', email: 'shared@example.com' } as Stripe.Customer,
    });
    const supabase = makeMockSupabase(
      { claimResult: 'claimed' },
      { users: [{ id: 'user_savr', email: 'shared@example.com', stripe_customer_id: 'cus_f' }] },
    );

    let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
    const errors = await captureErrorLogs(async () => {
      res = await deliver(build(), stripe, supabase);
    });

    assert.equal(res?.status, 200);
    assert.deepEqual(res?.body, { received: true });
    assert.equal(errors.length, 0, 'no error-level log for a foreign event');
    assert.equal(supabase._rpcCalls.length, 0, 'foreign events are not recorded in the event table');
    assert.equal(supabase._updates.length, 0, 'foreign events never write');
    assertOnlyOwnershipLookups(supabase);
    assert.equal(stripe._customerRetrievals.length, 0, 'no email lookup for foreign events');
  });
}

test('missing SAVR price configuration returns 500 instead of guessing ownership', async () => {
  const saved: Record<string, string | undefined> = {};
  const keys = [
    'STRIPE_PRICE_BASIC_MONTHLY', 'STRIPE_PRICE_BASIC_YEARLY',
    'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY',
  ];
  for (const key of keys) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    const event = makeEvent('evt_noconf', 'customer.subscription.updated',
      asObject(makeSubscription('sub_1', 'cus_1', 'price_pro_monthly')));
    const supabase = makeMockSupabase();
    let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
    await captureErrorLogs(async () => {
      res = await deliver(event, makeMockStripe(), supabase);
    });
    assert.equal(res?.status, 500);
    assert.equal(supabase._updates.length, 0);
  } finally {
    for (const key of keys) process.env[key] = saved[key];
  }
});

// ──────────────────────────────────────────────────────────────
// SAVR's own events: ownership signals
// ──────────────────────────────────────────────────────────────

test('new SAVR checkouts stamp the product marker on the session and the subscription', () => {
  const params = buildCheckoutSessionParams({
    priceId: 'price_pro_yearly',
    userId: 'user_123',
    origin: 'https://savr.app',
  });

  assert.equal(params.metadata?.product, 'savr');
  assert.equal(params.subscription_data?.metadata?.product, 'savr');
  assert.equal(params.subscription_data?.metadata?.userId, 'user_123');
});

test('checkout session carrying the SAVR marker is processed without a classification lookup', async () => {
  const subscription = makeSubscription('sub_m', 'cus_m', 'price_basic_yearly');
  const session = makeCheckoutSession('cs_m', 'user_m', 'cus_m', 'sub_m', { product: 'savr', userId: 'user_m' });
  const stripe = makeMockStripe({ subscription });
  const supabase = makeMockSupabase({}, { users: [{ id: 'user_m' }] });

  const res = await deliver(makeEvent('evt_m', 'checkout.session.completed', asObject(session)), stripe, supabase);

  assert.equal(res.status, 200);
  assert.equal(stripe._subscriptionRetrievals.length, 1, 'only the handler retrieves the subscription');
  const update = supabase._updates.find((u) => u.table === 'users');
  assert.equal(update?.data.subscription_tier, 'basic');
});

test('checkout session that cannot be classified (Stripe lookup fails) returns 500', async () => {
  const session = makeCheckoutSession('cs_u', 'user_u', 'cus_u', 'sub_u');
  const stripe = makeMockStripe(); // subscriptions.retrieve throws
  const supabase = makeMockSupabase();

  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  await captureErrorLogs(async () => {
    res = await deliver(makeEvent('evt_u', 'checkout.session.completed', asObject(session)), stripe, supabase);
  });

  assert.equal(res?.status, 500);
  assert.equal(supabase._rpcCalls.length, 0);
});

test('invoice identified as SAVR by subscription metadata snapshot is processed', async () => {
  const invoice = {
    id: 'in_meta', object: 'invoice', customer: 'cus_meta', created: 1700000000,
    parent: { subscription_details: { metadata: { product: 'savr' } } },
    lines: { data: [] },
  };
  const supabase = makeMockSupabase();
  const res = await deliver(makeEvent('evt_meta', 'invoice.paid', invoice), makeMockStripe(), supabase);

  assert.equal(res.status, 200);
  assert.ok(supabase._updates.some((u) => u.table === 'users' && u.data.last_payment_status === 'succeeded'));
});

test('SAVR subscription with several items resolves the tier from the SAVR price', async () => {
  const subscription = makeSubscription('sub_multi', 'cus_multi', FOREIGN_PRICE);
  subscription.items.data.push({
    id: 'si_savr',
    object: 'subscription_item',
    price: { id: 'price_pro_yearly', object: 'price' },
    current_period_end: 1800000000,
  } as unknown as Stripe.SubscriptionItem);
  const supabase = makeMockSupabase();

  const res = await deliver(
    makeEvent('evt_multi', 'customer.subscription.updated', asObject(subscription)),
    makeMockStripe(),
    supabase,
  );

  assert.equal(res.status, 200);
  const update = supabase._updates.find((u) => u.table === 'users');
  assert.equal(update?.data.subscription_tier, 'pro');
});

// ──────────────────────────────────────────────────────────────
// Database write/read failures on SAVR's own events
// ──────────────────────────────────────────────────────────────

const ownEventsThatWrite: Array<[string, () => Stripe.Event]> = [
  ['checkout.session.completed', () => makeEvent('evt_w1', 'checkout.session.completed',
    asObject(makeCheckoutSession('cs_w', 'user_123', 'cus_w', 'sub_w')))],
  ['customer.subscription.updated', () => makeEvent('evt_w2', 'customer.subscription.updated',
    asObject(makeSubscription('sub_w', 'cus_w', 'price_pro_monthly')))],
  ['customer.subscription.deleted', () => makeEvent('evt_w3', 'customer.subscription.deleted',
    asObject(makeSubscription('sub_w', 'cus_w', 'price_pro_monthly', 'canceled')))],
  ['customer.subscription.paused', () => makeEvent('evt_w4', 'customer.subscription.paused',
    asObject(makeSubscription('sub_w', 'cus_w', 'price_pro_monthly', 'paused')))],
  ['invoice.paid', () => makeEvent('evt_w5', 'invoice.paid', asObject(makeInvoice('in_w', 'cus_w')))],
  ['invoice.payment_failed', () => makeEvent('evt_w6', 'invoice.payment_failed',
    asObject(makeInvoice('in_w', 'cus_w')))],
];

for (const [label, build] of ownEventsThatWrite) {
  test(`failed users write on own ${label} returns 500 and records the attempt as failed`, async () => {
    const stripe = makeMockStripe({ subscription: makeSubscription('sub_w', 'cus_w', 'price_pro_monthly') });
    const supabase = makeMockSupabase({}, { updateError: true });

    let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
    await captureErrorLogs(async () => {
      res = await deliver(build(), stripe, supabase);
    });

    assert.equal(res?.status, 500);
    assert.ok(
      supabase._updates.some(
        (u) => u.table === 'stripe_webhook_events' && u.data.processing_status === 'failed',
      ),
    );
    assert.ok(
      !supabase._updates.some(
        (u) => u.table === 'stripe_webhook_events' && u.data.processing_status === 'processed',
      ),
      'a failed attempt must not be marked processed',
    );
  });
}

test('failed users lookup on an own event returns 500 rather than dropping the event', async () => {
  const supabase = makeMockSupabase({}, { selectError: true });
  const event = makeEvent('evt_sel', 'customer.subscription.updated',
    asObject(makeSubscription('sub_s', 'cus_s', 'price_pro_monthly')));

  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  await captureErrorLogs(async () => {
    res = await deliver(event, makeMockStripe(), supabase);
  });

  assert.equal(res?.status, 500);
});

test('successful own event is marked processed', async () => {
  const supabase = makeMockSupabase();
  const event = makeEvent('evt_ok', 'customer.subscription.updated',
    asObject(makeSubscription('sub_ok', 'cus_ok', 'price_pro_monthly')));

  const res = await deliver(event, makeMockStripe(), supabase);

  assert.equal(res.status, 200);
  assert.ok(
    supabase._updates.some(
      (u) => u.table === 'stripe_webhook_events' && u.data.processing_status === 'processed',
    ),
  );
});

// ──────────────────────────────────────────────────────────────
// Email fallback (customer not yet linked to a user)
// ──────────────────────────────────────────────────────────────

const sharedEmailCustomer = {
  id: 'cus_new', object: 'customer', email: 'shared@example.com',
} as Stripe.Customer;

test('email fallback links a customer only via a SAVR subscription event', async () => {
  const stripe = makeMockStripe({ customer: sharedEmailCustomer });
  const supabase = makeMockSupabase({}, { users: [{ id: 'user_savr', email: 'shared@example.com' }] });
  const event = makeEvent('evt_link', 'customer.subscription.created',
    asObject(makeSubscription('sub_new', 'cus_new', 'price_basic_monthly', 'trialing')));

  const res = await deliver(event, stripe, supabase);

  assert.equal(res.status, 200);
  assert.deepEqual(stripe._customerRetrievals, ['cus_new']);
  assert.ok(
    supabase._updates.some((u) => u.table === 'users' && u.data.stripe_customer_id === 'cus_new'),
    'customer with a SAVR subscription is linked',
  );
  assert.ok(supabase._updates.some((u) => u.table === 'users' && u.data.subscription_tier === 'basic'));
});

test('email fallback never attaches a customer that has no SAVR subscription', async () => {
  const stripe = makeMockStripe({ customer: sharedEmailCustomer });
  const supabase = makeMockSupabase({}, { users: [{ id: 'user_savr', email: 'shared@example.com' }] });

  for (const event of [
    makeEvent('evt_nl1', 'customer.subscription.created',
      asObject(makeSubscription('sub_other', 'cus_new', FOREIGN_PRICE))),
    makeEvent('evt_nl2', 'invoice.paid', asObject(makeInvoice('in_other', 'cus_new', 1700000000, FOREIGN_PRICE))),
    makeEvent('evt_nl3', 'invoice.payment_failed',
      asObject(makeInvoice('in_other', 'cus_new', 1700000000, FOREIGN_PRICE))),
  ]) {
    const res = await deliver(event, stripe, supabase);
    assert.equal(res.status, 200);
  }

  assert.equal(stripe._customerRetrievals.length, 0);
  assert.equal(supabase._updates.length, 0, 'no stripe_customer_id may be written');
});

test('email fallback does not attach when the email matches more than one user', async () => {
  const stripe = makeMockStripe({ customer: sharedEmailCustomer });
  const supabase = makeMockSupabase({}, {
    users: [
      { id: 'user_a', email: 'shared@example.com' },
      { id: 'user_b', email: 'shared@example.com' },
    ],
  });
  const event = makeEvent('evt_amb', 'customer.subscription.created',
    asObject(makeSubscription('sub_new', 'cus_new', 'price_basic_monthly')));

  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  await captureErrorLogs(async () => {
    res = await deliver(event, stripe, supabase);
  });

  assert.equal(res?.status, 200);
  assert.ok(!supabase._updates.some((u) => u.table === 'users'));
});

test("another product's cancellation or downgrade never changes a linked SAVR user", async () => {
  // The SAVR user's stored Stripe customer also holds another product's
  // subscription on the shared account.
  const stripe = makeMockStripe({ customer: sharedEmailCustomer });
  const supabase = makeMockSupabase({}, {
    users: [{ id: 'user_savr', email: 'shared@example.com', stripe_customer_id: 'cus_shared' }],
  });

  for (const event of [
    makeEvent('evt_x1', 'customer.subscription.deleted',
      asObject(makeSubscription('sub_other', 'cus_shared', FOREIGN_PRICE, 'canceled'))),
    makeEvent('evt_x2', 'customer.subscription.updated',
      asObject(makeSubscription('sub_other', 'cus_shared', FOREIGN_PRICE, 'past_due'))),
    makeEvent('evt_x3', 'customer.subscription.paused',
      asObject(makeSubscription('sub_other', 'cus_shared', FOREIGN_PRICE, 'paused'))),
  ]) {
    const res = await deliver(event, stripe, supabase);
    assert.equal(res.status, 200);
  }

  assert.equal(supabase._updates.length, 0, 'SAVR user must be untouched');
  assertOnlyOwnershipLookups(supabase);

  // Control: the same customer's SAVR subscription being deleted does downgrade.
  const res = await deliver(
    makeEvent('evt_x4', 'customer.subscription.deleted',
      asObject(makeSubscription('sub_savr', 'cus_shared', 'price_pro_monthly', 'canceled'))),
    stripe,
    supabase,
  );
  assert.equal(res.status, 200);
  assert.ok(supabase._updates.some((u) => u.table === 'users' && u.data.subscription_status === 'canceled'));
});

// ──────────────────────────────────────────────────────────────
// Retry contract against a stateful event ledger
// ──────────────────────────────────────────────────────────────

const STALE_CLAIM_MS = 10 * 60 * 1000;

interface LedgerRow {
  status: 'pending' | 'processed' | 'failed';
  updatedAt: number;
}

/**
 * Mirrors claim_stripe_webhook_event (20261010000000) and the ledger updates
 * made by markEventProcessed / markEventFailed, against a controllable clock.
 */
function withLedger(base: MockSupabase, clock: { now: number }) {
  const ledger = new Map<string, LedgerRow>();

  const supabase: MockSupabase & { ledger: Map<string, LedgerRow> } = {
    ...base,
    ledger,
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      if (fn !== 'claim_stripe_webhook_event') return base.rpc(fn, args);
      base._rpcCalls.push({ fn, args });
      const id = String(args.p_event_id);
      const row = ledger.get(id);
      if (!row) {
        ledger.set(id, { status: 'pending', updatedAt: clock.now });
        return { data: 'claimed', error: null };
      }
      if (row.status === 'processed') return { data: 'already_processed', error: null };
      if (row.status === 'failed' || clock.now - row.updatedAt > STALE_CLAIM_MS) {
        ledger.set(id, { status: 'pending', updatedAt: clock.now });
        return { data: 'claimed', error: null };
      }
      return { data: 'already_pending', error: null };
    },
    from(table: string) {
      const builder = base.from(table);
      if (table !== 'stripe_webhook_events') return builder;
      let pendingStatus: LedgerRow['status'] | undefined;
      const wrapper = {
        select: (cols: string) => {
          builder.select(cols);
          return wrapper;
        },
        update: (data: Record<string, unknown>) => {
          pendingStatus = data.processing_status as LedgerRow['status'];
          builder.update(data);
          return wrapper;
        },
        eq: (column: string, value: unknown) => {
          if (pendingStatus) ledger.set(String(value), { status: pendingStatus, updatedAt: clock.now });
          return builder.eq(column, value);
        },
      };
      return wrapper as unknown as ReturnType<SupabaseAdmin['from']>;
    },
  };
  return supabase;
}

function userWrites(supabase: MockSupabase) {
  return supabase._updates.filter((u) => u.table === 'users');
}

test('orphaned claim: early retries get 409, a retry after the stale window takes over and processes', async () => {
  const clock = { now: Date.UTC(2026, 9, 13, 12, 0, 0) };
  const supabase = withLedger(makeMockSupabase(), clock);
  const event = makeEvent('evt_orphan', 'customer.subscription.updated',
    asObject(makeSubscription('sub_o', 'cus_o', 'price_pro_monthly', 'past_due')));

  // A previous invocation claimed the event and was killed before finishing.
  supabase.ledger.set('evt_orphan', { status: 'pending', updatedAt: clock.now });

  for (const minutes of [0, 1, 9]) {
    clock.now += minutes * 60 * 1000;
    const res = await deliver(event, makeMockStripe(), supabase);
    assert.equal(res.status, 409, `retry at +${minutes}m must stay retryable`);
  }
  assert.equal(userWrites(supabase).length, 0, 'no work is done while another claim is live');

  clock.now += 2 * 60 * 1000; // now 12 minutes after the orphaned claim
  const takeover = await deliver(event, makeMockStripe(), supabase);
  assert.equal(takeover.status, 200);
  assert.equal(supabase.ledger.get('evt_orphan')?.status, 'processed');
  assert.equal(userWrites(supabase).length, 1);
  assert.equal(userWrites(supabase)[0].data.subscription_status, 'past_due');

  const duplicate = await deliver(event, makeMockStripe(), supabase);
  assert.equal(duplicate.status, 200, 'only a completed duplicate is acknowledged');
  assert.equal(userWrites(supabase).length, 1, 'completed duplicates are not reprocessed');
});

test('concurrent duplicate deliveries: one processes, the other gets 409, a later redelivery gets 200', async () => {
  const clock = { now: Date.UTC(2026, 9, 13, 12, 0, 0) };
  const supabase = withLedger(makeMockSupabase(), clock);
  const event = makeEvent('evt_dup', 'invoice.payment_failed', asObject(makeInvoice('in_dup', 'cus_dup')));

  const [first, second] = await Promise.all([
    deliver(event, makeMockStripe(), supabase),
    deliver(event, makeMockStripe(), supabase),
  ]);

  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  assert.equal(userWrites(supabase).length, 1, 'exactly one delivery writes');

  const redelivery = await deliver(event, makeMockStripe(), supabase);
  assert.equal(redelivery.status, 200);
  assert.equal(userWrites(supabase).length, 1);
});

test('a failed attempt is reclaimed immediately by the next delivery', async () => {
  const clock = { now: Date.UTC(2026, 9, 13, 12, 0, 0) };
  const supabase = withLedger(makeMockSupabase(), clock);
  supabase.ledger.set('evt_failed', { status: 'failed', updatedAt: clock.now });
  const event = makeEvent('evt_failed', 'customer.subscription.updated',
    asObject(makeSubscription('sub_fl', 'cus_fl', 'price_basic_yearly')));

  const res = await deliver(event, makeMockStripe(), supabase);

  assert.equal(res.status, 200);
  assert.equal(supabase.ledger.get('evt_failed')?.status, 'processed');
});

// ──────────────────────────────────────────────────────────────
// Retired prices: ownership through the stored subscription link
// ──────────────────────────────────────────────────────────────

const RETIRED_PRICE = 'price_retired_2025';
const legacyUser: MockUserRow = {
  id: 'user_legacy',
  email: 'legacy@example.com',
  stripe_customer_id: 'cus_legacy',
  stripe_subscription_id: 'sub_legacy',
};

/** A pre-marker SAVR subscription whose price is no longer configured. */
function legacySubscription(status: string) {
  return makeSubscription('sub_legacy', 'cus_legacy', RETIRED_PRICE, status);
}

test('legacy subscription on a retired price still reconciles updates (tier kept)', async () => {
  const supabase = makeMockSupabase({}, { users: [legacyUser] });
  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  await captureWarnLogs(async () => {
    res = await deliver(
      makeEvent('evt_lg1', 'customer.subscription.updated', asObject(legacySubscription('past_due'))),
      makeMockStripe(),
      supabase,
    );
  });

  assert.equal(res?.status, 200);
  assert.ok(
    supabase._selects.some((s) => s.column === 'stripe_subscription_id' && s.value === 'sub_legacy'),
    'ownership comes from the stored subscription link',
  );
  const update = userWrites(supabase)[0];
  assert.equal(update?.data.subscription_status, 'past_due');
  assert.equal(update?.data.stripe_subscription_id, 'sub_legacy');
  assert.ok(!('subscription_tier' in (update?.data ?? {})));
});

test('legacy subscription on a retired price: cancellation downgrades the user', async () => {
  const supabase = makeMockSupabase({}, { users: [legacyUser] });
  const res = await deliver(
    makeEvent('evt_lg2', 'customer.subscription.deleted', asObject(legacySubscription('canceled'))),
    makeMockStripe(),
    supabase,
  );

  assert.equal(res.status, 200);
  const update = userWrites(supabase)[0];
  assert.equal(update?.data.subscription_status, 'canceled');
  assert.equal(update?.data.subscription_tier, 'basic');
  assert.equal(update?.data.stripe_subscription_id, null);
});

test('legacy subscription on a retired price: invoice failures and recoveries reconcile', async () => {
  const supabase = makeMockSupabase({}, { users: [legacyUser] });

  const failed = await deliver(
    makeEvent('evt_lg3', 'invoice.payment_failed', {
      id: 'in_lg', object: 'invoice', customer: 'cus_legacy', created: 1700000000,
      parent: { subscription_details: { subscription: 'sub_legacy', metadata: {} } },
      lines: { data: [{ pricing: { price_details: { price: RETIRED_PRICE } } }] },
    }),
    makeMockStripe(),
    supabase,
  );
  // Older API versions put the subscription ID on the invoice itself.
  const paid = await deliver(
    makeEvent('evt_lg4', 'invoice.paid', {
      id: 'in_lg2', object: 'invoice', customer: 'cus_legacy', created: 1700000100,
      subscription: 'sub_legacy',
      lines: { data: [{ price: { id: RETIRED_PRICE } }] },
    }),
    makeMockStripe(),
    supabase,
  );

  assert.equal(failed.status, 200);
  assert.equal(paid.status, 200);
  const [failure, recovery] = userWrites(supabase);
  assert.equal(failure?.data.subscription_status, 'past_due');
  assert.equal(failure?.data.payment_action_required, true);
  assert.equal(recovery?.data.payment_action_required, false);
});

test('retired-price subscription that SAVR never stored stays foreign', async () => {
  const supabase = makeMockSupabase({}, { users: [legacyUser] });
  const res = await deliver(
    makeEvent('evt_lg5', 'customer.subscription.deleted',
      asObject(makeSubscription('sub_unrelated', 'cus_legacy', RETIRED_PRICE, 'canceled'))),
    makeMockStripe(),
    supabase,
  );

  assert.equal(res.status, 200);
  assert.equal(supabase._updates.length, 0);
  assert.equal(supabase._rpcCalls.length, 0);
});

// ──────────────────────────────────────────────────────────────
// Incomplete price configuration
// ──────────────────────────────────────────────────────────────

const PRICE_ENV_KEYS = [
  'STRIPE_PRICE_BASIC_MONTHLY', 'STRIPE_PRICE_BASIC_YEARLY',
  'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_YEARLY',
  'STRIPE_PRICE_ID_BASIC_MONTHLY', 'STRIPE_PRICE_ID_BASIC_YEARLY',
  'STRIPE_PRICE_ID_PRO_MONTHLY', 'STRIPE_PRICE_ID_PRO_YEARLY',
];

async function withPriceEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(PRICE_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const key of PRICE_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('partial price configuration returns 500 before any event is classified', async () => {
  await withPriceEnv({ STRIPE_PRICE_PRO_YEARLY: undefined, STRIPE_PRICE_ID_PRO_YEARLY: undefined }, async () => {
    // A legacy pro_yearly event carries no marker; with pro_yearly unconfigured
    // it would otherwise look foreign and be acknowledged forever.
    const supabase = makeMockSupabase({}, { users: [legacyUser] });
    let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
    const errors = await captureErrorLogs(async () => {
      res = await deliver(
        makeEvent('evt_cfg1', 'customer.subscription.updated',
          asObject(makeSubscription('sub_py', 'cus_py', 'price_pro_yearly_live'))),
        makeMockStripe(),
        supabase,
      );
    });

    assert.equal(res?.status, 500);
    assert.deepEqual(res?.body, { error: 'Webhook configuration error' });
    assert.ok(String(errors[0]?.[0]).includes('pro_yearly'), 'the missing plan is named');
    assert.equal(supabase._selects.length, 0, 'no classification lookup');
    assert.equal(supabase._rpcCalls.length, 0, 'no ledger row');
    assert.equal(supabase._updates.length, 0);
  });
});

test('a blank price variable counts as missing', async () => {
  await withPriceEnv({ STRIPE_PRICE_BASIC_MONTHLY: '   ', STRIPE_PRICE_ID_BASIC_MONTHLY: undefined }, async () => {
    let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
    await captureErrorLogs(async () => {
      res = await deliver(
        makeEvent('evt_cfg2', 'invoice.paid', asObject(makeInvoice('in_cfg', 'cus_cfg'))),
        makeMockStripe(),
        makeMockSupabase(),
      );
    });
    assert.equal(res?.status, 500);
  });
});

test('a plan configured only through its legacy STRIPE_PRICE_ID_* variable is complete', async () => {
  await withPriceEnv(
    { STRIPE_PRICE_PRO_YEARLY: undefined, STRIPE_PRICE_ID_PRO_YEARLY: 'price_pro_yearly_legacy' },
    async () => {
      const supabase = makeMockSupabase();
      const res = await deliver(
        makeEvent('evt_cfg3', 'customer.subscription.updated',
          asObject(makeSubscription('sub_lg', 'cus_lg', 'price_pro_yearly_legacy'))),
        makeMockStripe(),
        supabase,
      );
      assert.equal(res.status, 200);
      assert.equal(userWrites(supabase)[0]?.data.subscription_tier, 'pro');
    },
  );
});

test('unhandled event types are acknowledged even when price configuration is incomplete', async () => {
  await withPriceEnv({ STRIPE_PRICE_BASIC_YEARLY: undefined, STRIPE_PRICE_ID_BASIC_YEARLY: undefined }, async () => {
    const res = await deliver(
      makeEvent('evt_cfg4', 'payment_intent.succeeded', { id: 'pi_1', object: 'payment_intent' }),
      makeMockStripe(),
      makeMockSupabase(),
    );
    assert.equal(res.status, 200);
  });
});

// ──────────────────────────────────────────────────────────────
// Database and provider failures
// ──────────────────────────────────────────────────────────────

test('ownership lookup failure returns 500 instead of treating the event as foreign', async () => {
  const supabase = makeMockSupabase({}, { selectError: true });
  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  await captureErrorLogs(async () => {
    res = await deliver(
      makeEvent('evt_db1', 'customer.subscription.deleted', asObject(legacySubscription('canceled'))),
      makeMockStripe(),
      supabase,
    );
  });

  assert.equal(res?.status, 500);
  assert.deepEqual(res?.body, { error: 'Failed to classify webhook event' });
  assert.equal(supabase._rpcCalls.length, 0);
  assert.equal(supabase._updates.length, 0);
});

test('Stripe failure while handling an owned checkout returns 500 and records the attempt as failed', async () => {
  const session = makeCheckoutSession('cs_p', 'user_p', 'cus_p', 'sub_p', { product: 'savr', userId: 'user_p' });
  const supabase = makeMockSupabase({}, { users: [{ id: 'user_p' }] });
  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  await captureErrorLogs(async () => {
    // subscriptions.retrieve throws: the provider is unavailable.
    res = await deliver(makeEvent('evt_p', 'checkout.session.completed', asObject(session)), makeMockStripe(), supabase);
  });

  assert.equal(res?.status, 500);
  assert.ok(
    supabase._updates.some((u) => u.table === 'stripe_webhook_events' && u.data.processing_status === 'failed'),
  );
  assert.equal(userWrites(supabase).length, 0);
});
