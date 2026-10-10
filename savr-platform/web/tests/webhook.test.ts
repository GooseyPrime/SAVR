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

test('already-pending concurrent event returns 200 and defers', async () => {
  const event = makeEvent('evt_pending', 'customer.subscription.updated',
    asObject(makeSubscription('sub_x', 'cus_x', 'price_pro_monthly')));
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

test('SAVR-marked subscription with an unrecognised price fails with 500 so Stripe retries', async () => {
  const subscription = makeSubscription('sub_unknown', 'cus_unknown', 'price_unknown_xyz');
  (subscription as unknown as { metadata: Record<string, string> }).metadata = { product: 'savr' };
  const event = makeEvent('evt_unknown_price', 'customer.subscription.updated', asObject(subscription));
  const stripe = makeMockStripe({ subscription });
  const supabase = makeMockSupabase({ claimResult: 'claimed' });

  let res: Awaited<ReturnType<typeof handleWebhook>> | undefined;
  await captureErrorLogs(async () => {
    res = await deliver(event, stripe, supabase);
  });

  assert.equal(res?.status, 500);
  assert.deepEqual(res?.body, { error: 'Webhook handler failed' });
  assert.ok(
    supabase._updates.some(
      (u) => u.table === 'stripe_webhook_events' && u.data.processing_status === 'failed',
    ),
    'a failed attempt must be recorded as failed (not processed) so the retry can claim it',
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
    assert.equal(supabase._selects.length, 0, 'foreign events never read users');
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
  assert.equal(supabase._selects.length, 0);

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
