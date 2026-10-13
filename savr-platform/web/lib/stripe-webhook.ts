/**
 * Stripe webhook business logic.
 *
 * Extracted from the Next.js route handler so the core processing
 * pipeline is testable without a running Next.js server.
 *
 * The route handler in app/api/stripe/webhook/route.ts is a thin
 * wrapper that supplies the real Stripe instance, Supabase admin
 * client, and webhook secret, then delegates to handleWebhook().
 */

import type Stripe from 'stripe';
import { resolveTierFromPriceId } from '@/lib/billing';
import {
  getConfiguredSavrPriceIds,
  getMissingSavrPricePlans,
  getSubscriptionPeriodEndUnix,
  hasSavrProductMarker,
  mapStripeStatusToDatabase,
} from '@/lib/stripe-billing';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/**
 * Result of an atomic event-claim attempt.
 *
 * - 'claimed'           – this caller owns processing
 * - 'already_processed' – event was already completed; return 200 and skip
 * - 'already_pending'   – another invocation holds an unfinished claim; return
 *                         a retryable non-2xx so Stripe redelivers later
 */
export type ClaimResult = 'claimed' | 'already_processed' | 'already_pending';

export interface WebhookResponse {
  status: number;
  body: unknown;
}

// ──────────────────────────────────────────────────────────────
// Idempotency helpers
// ──────────────────────────────────────────────────────────────

/**
 * Atomically claims a Stripe event for processing.
 *
 * Delegates to the `claim_stripe_webhook_event` Supabase function which
 * performs an INSERT … ON CONFLICT with a serialising FOR UPDATE lock.
 */
export async function claimWebhookEvent(
  supabaseAdmin: SupabaseAdmin,
  eventId: string,
  eventType: string,
): Promise<ClaimResult> {
  const { data, error } = await supabaseAdmin.rpc('claim_stripe_webhook_event', {
    p_event_id: eventId,
    p_event_type: eventType,
  });

  if (error) {
    throw new Error(`Failed to claim webhook event ${eventId}: ${error.message}`);
  }

  const result = data as ClaimResult;
  if (result !== 'claimed' && result !== 'already_processed' && result !== 'already_pending') {
    throw new Error(`Unexpected claim result for event ${eventId}: ${String(result)}`);
  }
  return result;
}

/** Marks an event as successfully processed. */
export async function markEventProcessed(
  supabaseAdmin: SupabaseAdmin,
  eventId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('stripe_webhook_events')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) {
    console.error(`Failed to mark webhook event ${eventId} as processed:`, error);
  }
}

/**
 * Marks an event as failed and stores a sanitised error string.
 * Sensitive details such as stack frames and internal IDs are stripped.
 */
export async function markEventFailed(
  supabaseAdmin: SupabaseAdmin,
  eventId: string,
  err: unknown,
): Promise<void> {
  const sanitised = sanitiseError(err);
  const { error } = await supabaseAdmin
    .from('stripe_webhook_events')
    .update({
      processing_status: 'failed',
      last_error: sanitised,
    })
    .eq('event_id', eventId);

  if (error) {
    console.error(`Failed to mark webhook event ${eventId} as failed:`, error);
  }
}

// ──────────────────────────────────────────────────────────────
// Event ownership (shared Stripe account)
// ──────────────────────────────────────────────────────────────

/**
 * The Stripe account that delivers to this endpoint also serves other
 * products, so this endpoint receives their events too. An event is SAVR's
 * when it references one of SAVR's configured prices, carries the SAVR
 * product metadata marker, or concerns a subscription SAVR already stores on
 * a user row (users.stripe_subscription_id, written only by this webhook for
 * SAVR events). The stored link keeps legacy subscriptions that predate the
 * marker reconciling after their price is retired from configuration.
 * Everything else is acknowledged with 200; the only database access for it
 * is that read-only ownership lookup.
 */
const HANDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.resumed',
  'customer.subscription.pending_update_applied',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'invoice.payment_succeeded',
  'invoice.paid',
  'invoice.payment_failed',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Safe nested read for payload fields whose shape varies by API version. */
function readPath(value: unknown, ...keys: string[]): unknown {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function readId(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  const id = readPath(value, 'id');
  return typeof id === 'string' && id ? id : null;
}

function subscriptionPriceIds(subscription: unknown): string[] {
  const items = readPath(subscription, 'items', 'data');
  if (!Array.isArray(items)) return [];
  const ids: string[] = [];
  for (const item of items) {
    const id = readId(readPath(item, 'price'));
    if (id) ids.push(id);
  }
  return ids;
}

function isSavrSubscription(subscription: unknown, savrPrices: ReadonlySet<string>): boolean {
  return (
    hasSavrProductMarker(readPath(subscription, 'metadata')) ||
    subscriptionPriceIds(subscription).some((id) => savrPrices.has(id))
  );
}

/**
 * Durable ownership: the subscription is already linked to a SAVR user.
 * A lookup failure throws, so the event is retried rather than misclassified.
 */
async function isStoredSavrSubscription(
  subscriptionId: string | null,
  supabaseAdmin: SupabaseAdmin,
): Promise<boolean> {
  if (!subscriptionId) return false;
  const rows = await selectUserRows(supabaseAdmin, 'id', 'stripe_subscription_id', subscriptionId);
  return rows.length > 0;
}

function invoiceSubscriptionId(invoice: unknown): string | null {
  // Current API versions: invoice.parent.subscription_details.subscription.
  // Older API versions: invoice.subscription.
  return (
    readId(readPath(invoice, 'parent', 'subscription_details', 'subscription')) ??
    readId(readPath(invoice, 'subscription'))
  );
}

function invoicePriceIds(invoice: unknown): string[] {
  const lines = readPath(invoice, 'lines', 'data');
  if (!Array.isArray(lines)) return [];
  const ids: string[] = [];
  for (const line of lines) {
    // Current API versions: line.pricing.price_details.price.
    // Older API versions: line.price / line.plan.
    for (const candidate of [
      readPath(line, 'pricing', 'price_details', 'price'),
      readPath(line, 'price'),
      readPath(line, 'plan'),
    ]) {
      const id = readId(candidate);
      if (id) ids.push(id);
    }
  }
  return ids;
}

function isSavrInvoice(invoice: unknown, savrPrices: ReadonlySet<string>): boolean {
  return (
    hasSavrProductMarker(readPath(invoice, 'metadata')) ||
    hasSavrProductMarker(readPath(invoice, 'parent', 'subscription_details', 'metadata')) ||
    hasSavrProductMarker(readPath(invoice, 'subscription_details', 'metadata')) ||
    invoicePriceIds(invoice).some((id) => savrPrices.has(id))
  );
}

/**
 * Decides whether a verified event belongs to SAVR.
 *
 * Subscription and invoice events are classified from the payload first and
 * then, if the payload does not identify SAVR, from the stored subscription
 * link. A checkout session payload carries no line items, so a
 * subscription-mode session without SAVR metadata is classified by
 * retrieving its subscription. Any Stripe or database failure propagates
 * (the event cannot be classified, so Stripe must retry).
 */
async function isSavrEvent(
  event: Stripe.Event,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
  savrPrices: ReadonlySet<string>,
): Promise<boolean> {
  const object: unknown = event.data.object;

  if (event.type.startsWith('customer.subscription.')) {
    if (isSavrSubscription(object, savrPrices)) return true;
    return isStoredSavrSubscription(readId(object), supabaseAdmin);
  }

  if (event.type.startsWith('invoice.')) {
    if (isSavrInvoice(object, savrPrices)) return true;
    return isStoredSavrSubscription(invoiceSubscriptionId(object), supabaseAdmin);
  }

  if (event.type.startsWith('checkout.session.')) {
    const metadata = readPath(object, 'metadata');
    if (hasSavrProductMarker(metadata)) return true;

    const metadataPriceId = readPath(metadata, 'priceId');
    if (typeof metadataPriceId === 'string' && savrPrices.has(metadataPriceId)) return true;

    // SAVR only sells subscriptions.
    const subscriptionId = readId(readPath(object, 'subscription'));
    if (!subscriptionId) return false;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (isSavrSubscription(subscription, savrPrices)) return true;
    return isStoredSavrSubscription(subscription.id, supabaseAdmin);
  }

  return false;
}

// ──────────────────────────────────────────────────────────────
// Top-level handler (signature verification → ownership → claim → process)
// ──────────────────────────────────────────────────────────────

/**
 * Full webhook processing pipeline.
 *
 * 1. Verify Stripe signature.
 * 2. Return 200 for event types SAVR does not handle.
 * 3. Return 500 if any plan has no configured price (cannot classify).
 * 4. Return 200 for events that belong to another product on the shared
 *    Stripe account (no writes, no event-ledger row, no error log).
 * 5. Atomically claim the event.
 * 6. Return 200 immediately for already-processed duplicates.
 * 7. Return 409 for unfinished ('already_pending') claims so Stripe retries.
 * 8. Dispatch to the appropriate event handler.
 * 9. Mark the event as processed on success.
 * 10. On failure: mark failed, return 500 so Stripe retries.
 */
export async function handleWebhook(
  body: string,
  signature: string | null,
  webhookSecret: string | undefined,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<WebhookResponse> {
  if (!signature) {
    return { status: 400, body: { error: 'No signature' } };
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return { status: 500, body: { error: 'Webhook configuration error' } };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return { status: 400, body: { error: 'Invalid signature' } };
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    console.debug(`Ignoring Stripe event ${event.id}: unhandled type ${event.type}`);
    return { status: 200, body: { received: true } };
  }

  // Every plan needs a price before any event is classified: an event for a
  // plan whose price is missing would otherwise look foreign and be dropped.
  const missingPlans = getMissingSavrPricePlans();
  if (missingPlans.length > 0) {
    console.error(
      `Stripe price configuration incomplete; no STRIPE_PRICE_* or STRIPE_PRICE_ID_* value for: ${missingPlans.join(', ')}`,
    );
    return { status: 500, body: { error: 'Webhook configuration error' } };
  }
  const savrPrices = getConfiguredSavrPriceIds();

  let ownEvent: boolean;
  try {
    ownEvent = await isSavrEvent(event, stripe, supabaseAdmin, savrPrices);
  } catch (err) {
    console.error(`Could not classify Stripe event ${event.id}:`, err);
    return { status: 500, body: { error: 'Failed to classify webhook event' } };
  }

  if (!ownEvent) {
    console.debug(`Ignoring Stripe event ${event.id} (${event.type}): not a SAVR event`);
    return { status: 200, body: { received: true } };
  }

  console.log(`🔔 Received Stripe webhook: ${event.type} (event ID: ${event.id})`);

  // Atomic claim — ensures exactly-once processing even under concurrent delivery.
  let claimResult: ClaimResult;
  try {
    claimResult = await claimWebhookEvent(supabaseAdmin, event.id, event.type);
  } catch (err) {
    console.error('Webhook claim error:', err);
    return { status: 500, body: { error: 'Failed to claim webhook event' } };
  }

  if (claimResult === 'already_processed') {
    console.log(`ℹ️  Duplicate event ${event.id} — already processed, skipping`);
    return { status: 200, body: { received: true } };
  }

  if (claimResult === 'already_pending') {
    // Never acknowledge an unfinished claim: a 2xx ends Stripe's retries, and
    // if the owning invocation died the event would never be processed. A
    // non-2xx keeps Stripe redelivering until the owner marks it processed
    // (then 'already_processed') or the claim goes stale and is taken over.
    console.log(`ℹ️  Event ${event.id} is still being processed elsewhere — asking Stripe to retry`);
    return { status: 409, body: { error: 'Event is still being processed; retry later' } };
  }

  // 'claimed' — process the event.
  try {
    await dispatchWebhookEvent(event, stripe, supabaseAdmin, savrPrices);
    await markEventProcessed(supabaseAdmin, event.id);
    return { status: 200, body: { received: true } };
  } catch (err) {
    console.error(`Webhook handler error for event ${event.id}:`, err);
    await markEventFailed(supabaseAdmin, event.id, err);
    return { status: 500, body: { error: 'Webhook handler failed' } };
  }
}

// ──────────────────────────────────────────────────────────────
// Event dispatcher
// ──────────────────────────────────────────────────────────────

/** Only ever called for events already attributed to SAVR by isSavrEvent(). */
async function dispatchWebhookEvent(
  event: Stripe.Event,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
  savrPrices: ReadonlySet<string>,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, stripe, supabaseAdmin, savrPrices);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.resumed':
    case 'customer.subscription.pending_update_applied':
    case 'customer.subscription.paused':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionEvent(subscription, stripe, supabaseAdmin, savrPrices);
      break;
    }

    case 'invoice.payment_succeeded':
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoiceEvent(invoice, 'succeeded', stripe, supabaseAdmin, savrPrices);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoiceEvent(invoice, 'failed', stripe, supabaseAdmin, savrPrices);
      break;
    }

    default:
      console.debug(`Unhandled event type: ${event.type}`);
  }
}

// ──────────────────────────────────────────────────────────────
// Database helpers — Supabase returns { error } instead of throwing
// ──────────────────────────────────────────────────────────────

function describeDbError(error: unknown): string {
  const message = readPath(error, 'message');
  return typeof message === 'string' && message ? message : String(error);
}

async function selectUserRows(
  supabaseAdmin: SupabaseAdmin,
  columns: string,
  column: string,
  value: string,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabaseAdmin.from('users').select(columns).eq(column, value);
  if (error) {
    throw new Error(`Failed to look up user by ${column}: ${describeDbError(error)}`);
  }
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

async function updateUser(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from('users').update(updates).eq('id', userId);
  if (error) {
    throw new Error(`Failed to update user ${userId}: ${describeDbError(error)}`);
  }
}

/**
 * The currently configured SAVR price on a subscription, or null.
 *
 * Null means the subscription is SAVR's (ownership was already established)
 * but its price has been retired from configuration. Callers then keep the
 * stored tier and still reconcile status, period and cancellation fields,
 * instead of failing the event until Stripe stops retrying.
 */
function findConfiguredSavrPriceId(
  subscription: Stripe.Subscription,
  savrPrices: ReadonlySet<string>,
): string | null {
  return subscriptionPriceIds(subscription).find((id) => savrPrices.has(id)) ?? null;
}

function warnRetainedTier(subscription: Stripe.Subscription, userId: string): void {
  console.warn(
    `Subscription ${subscription.id} for user ${userId} has no configured SAVR price ` +
      `(retired price?) — keeping the stored tier and reconciling status only`,
  );
}

// ──────────────────────────────────────────────────────────────
// Event-specific handlers
// ──────────────────────────────────────────────────────────────

/**
 * Resolves the SAVR user for a Stripe customer.
 *
 * Callers must only pass customers taken from an event that isSavrEvent()
 * attributed to SAVR. That is what makes the email fallback safe: it can
 * only link a customer that demonstrably holds a SAVR subscription, never a
 * customer belonging to another product that happens to share an email.
 */
async function findUserByCustomerId(
  customerId: string | null,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<string | null> {
  if (!customerId) return null;

  const linked = await selectUserRows(supabaseAdmin, 'id', 'stripe_customer_id', customerId);
  if (linked.length === 1 && typeof linked[0].id === 'string') return linked[0].id;
  if (linked.length > 1) {
    console.error(`Stripe customer ${customerId} is linked to more than one user`);
    return null;
  }

  // Fallback: SAVR subscription created outside the app checkout (no
  // customer link yet). Match the customer's email to exactly one user.
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !customer.email) return null;

  const byEmail = await selectUserRows(supabaseAdmin, 'id', 'email', customer.email);
  if (byEmail.length !== 1 || typeof byEmail[0].id !== 'string') return null;

  const userId = byEmail[0].id;
  await updateUser(supabaseAdmin, userId, { stripe_customer_id: customerId });
  return userId;
}

// ──────────────────────────────────────────────────────────────
// Subscription-scoped reconciliation
// ──────────────────────────────────────────────────────────────

/** Stripe statuses after which a subscription can never become live again. */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['canceled', 'incomplete_expired']);
/** Statuses that grant access; preferred over other live statuses. */
const ENTITLED_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);
/** Live statuses in which the customer still owes action on a payment. */
const PAYMENT_ACTION_STATUSES: ReadonlySet<string> = new Set(['past_due', 'unpaid', 'incomplete']);

interface BillingRow {
  id: string;
  stripe_subscription_id: string | null;
  last_payment_date: string | null;
}

async function loadBillingRow(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
): Promise<BillingRow | null> {
  const rows = await selectUserRows(
    supabaseAdmin,
    'id, stripe_subscription_id, last_payment_date',
    'id',
    userId,
  );
  const row = rows[0];
  if (!row || typeof row.id !== 'string') return null;
  return {
    id: row.id,
    stripe_subscription_id:
      typeof row.stripe_subscription_id === 'string' && row.stripe_subscription_id
        ? row.stripe_subscription_id
        : null,
    last_payment_date: typeof row.last_payment_date === 'string' ? row.last_payment_date : null,
  };
}

function isStripeResourceMissing(error: unknown): boolean {
  return readPath(error, 'code') === 'resource_missing' || readPath(error, 'statusCode') === 404;
}

/**
 * Current Stripe state of a subscription, never the event's snapshot (events
 * can arrive late or out of order). Null only when Stripe reports the
 * subscription does not exist; any other failure throws so Stripe retries.
 */
async function retrieveCurrentSubscription(
  stripe: StripeClient,
  subscriptionId: string,
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if (isStripeResourceMissing(error)) return null;
    throw error;
  }
}

const isTerminal = (subscription: Stripe.Subscription) => TERMINAL_STATUSES.has(subscription.status);

/** Higher wins: entitled live > other live; ties broken by newer `created`. */
function outranks(candidate: Stripe.Subscription, incumbent: Stripe.Subscription): boolean {
  const rank = (s: Stripe.Subscription) => (ENTITLED_STATUSES.has(s.status) ? 2 : 1);
  if (rank(candidate) !== rank(incumbent)) return rank(candidate) > rank(incumbent);
  return (candidate.created ?? 0) > (incumbent.created ?? 0);
}

type Ownership = 'current' | 'adopt' | 'ignore';

/**
 * Whether `subscription` (current Stripe state) is, or should become, the
 * user's subscription of record. The answer depends only on Stripe's current
 * state, so delayed or reordered events converge on the same result:
 *   - the stored subscription itself: 'current';
 *   - an ended subscription never displaces anything: 'ignore';
 *   - nothing stored: 'adopt';
 *   - another subscription stored: 'adopt' only if the stored one has ended,
 *     no longer exists, or is outranked; otherwise 'ignore'.
 */
async function decideOwnership(
  stored: string | null,
  subscription: Stripe.Subscription,
  stripe: StripeClient,
): Promise<Ownership> {
  if (stored === subscription.id) return 'current';
  if (isTerminal(subscription)) return 'ignore';
  if (!stored) return 'adopt';
  const incumbent = await retrieveCurrentSubscription(stripe, stored);
  if (!incumbent || isTerminal(incumbent)) return 'adopt';
  return outranks(subscription, incumbent) ? 'adopt' : 'ignore';
}

/** User columns that mirror one subscription's current Stripe state. */
function subscriptionStateUpdates(
  subscription: Stripe.Subscription,
  userId: string,
  savrPrices: ReadonlySet<string>,
): Record<string, unknown> {
  const now = new Date().toISOString();
  if (isTerminal(subscription)) {
    // The subscription of record ended: revoke paid access and unlink it.
    return {
      subscription_tier: 'basic',
      subscription_status: mapStripeStatusToDatabase(subscription.status),
      stripe_subscription_id: null,
      cancel_at_period_end: false,
      payment_action_required: false,
      updated_at: now,
    };
  }

  const periodEnd = getSubscriptionPeriodEndUnix(subscription);
  const trialEnd = subscription.trial_end;
  const updates: Record<string, unknown> = {
    subscription_status: mapStripeStatusToDatabase(subscription.status),
    stripe_subscription_id: subscription.id,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    payment_action_required: PAYMENT_ACTION_STATUSES.has(subscription.status),
    updated_at: now,
  };

  const priceId = findConfiguredSavrPriceId(subscription, savrPrices);
  if (priceId) {
    // Throws if configuration cannot resolve the price — returns 500 so Stripe retries.
    updates.subscription_tier = resolveTierFromPriceId(priceId);
  } else {
    warnRetainedTier(subscription, userId);
  }
  return updates;
}

/**
 * Compare-and-set write: applies only while the stored subscription (and,
 * when given, last_payment_date) still match what this event read. A
 * concurrent change makes it throw, so the event is retried against fresh
 * state instead of overwriting a newer entitlement.
 */
async function updateUserGuarded(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  expected: { stripe_subscription_id: string | null; last_payment_date?: string | null },
  updates: Record<string, unknown>,
): Promise<void> {
  let query = supabaseAdmin.from('users').update(updates).eq('id', userId);
  for (const [column, value] of Object.entries(expected)) {
    if (value === undefined) continue;
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }
  const { data, error } = await query.select('id');
  if (error) {
    throw new Error(`Failed to update user ${userId}: ${describeDbError(error)}`);
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Billing state for user ${userId} changed concurrently; retrying against current state`,
    );
  }
}

/**
 * Applies one subscription's current Stripe state to the user if it is (or
 * becomes) their subscription of record. Returns the decision, or null when
 * Stripe no longer has the subscription and it is not the stored one.
 */
async function reconcileSubscription(
  userId: string,
  subscriptionId: string,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
  savrPrices: ReadonlySet<string>,
  extra: { updates?: Record<string, unknown>; lastPaymentDate?: string | null } = {},
): Promise<Ownership | null> {
  const row = await loadBillingRow(supabaseAdmin, userId);
  if (!row) {
    console.error(`User ${userId} not found`);
    return null;
  }

  const subscription = await retrieveCurrentSubscription(stripe, subscriptionId);
  if (!subscription) {
    if (row.stripe_subscription_id !== subscriptionId) {
      console.warn(`Subscription ${subscriptionId} no longer exists in Stripe; not current for ${userId}`);
      return null;
    }
    // The subscription of record is gone from Stripe: treat it as ended.
    await updateUserGuarded(
      supabaseAdmin,
      userId,
      { stripe_subscription_id: row.stripe_subscription_id },
      {
        subscription_tier: 'basic',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        cancel_at_period_end: false,
        payment_action_required: false,
        updated_at: new Date().toISOString(),
      },
    );
    return 'current';
  }

  const ownership = await decideOwnership(row.stripe_subscription_id, subscription, stripe);
  if (ownership === 'ignore') {
    console.log(
      `ℹ️  Subscription ${subscription.id} (${subscription.status}) is not current for user ${userId} ` +
        `(stored ${row.stripe_subscription_id ?? 'none'}); no change`,
    );
    return ownership;
  }

  const updates = {
    ...subscriptionStateUpdates(subscription, userId, savrPrices),
    ...extra.updates,
  };
  // When payment fields are written, guard on the last_payment_date the
  // caller's "is this invoice newest" decision was based on.
  const expected =
    extra.lastPaymentDate === undefined
      ? { stripe_subscription_id: row.stripe_subscription_id }
      : { stripe_subscription_id: row.stripe_subscription_id, last_payment_date: extra.lastPaymentDate };
  await updateUserGuarded(supabaseAdmin, userId, expected, updates);

  console.log(
    `✅ ${ownership === 'adopt' ? 'Adopted' : 'Reconciled'} subscription ${subscription.id} for user ${userId}: ` +
      `${subscription.status}, tier ${String(updates.subscription_tier ?? 'unchanged')}`,
  );
  return ownership;
}

// ──────────────────────────────────────────────────────────────
// Event-specific handlers
// ──────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
  savrPrices: ReadonlySet<string>,
): Promise<void> {
  console.log(`Processing ${session.id}`, {
    customer: readId(session.customer),
    subscription: readId(session.subscription),
  });

  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) {
    console.error('No user ID in checkout session');
    return;
  }

  const customerId = readId(session.customer);
  const subscriptionId = readId(session.subscription);

  if (!subscriptionId) {
    // Nothing to reconcile; only record the customer link.
    const users = await selectUserRows(supabaseAdmin, 'id', 'id', userId);
    if (users.length === 0) {
      console.error(`User ${userId} not found`);
      return;
    }
    if (customerId) {
      await updateUser(supabaseAdmin, userId, {
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      });
    }
    return;
  }

  // A delayed checkout for an older subscription must not replace a newer one,
  // so the customer link is written only together with an accepted subscription.
  await reconcileSubscription(userId, subscriptionId, stripe, supabaseAdmin, savrPrices, {
    updates: customerId ? { stripe_customer_id: customerId } : {},
  });
}

/**
 * created / updated / resumed / pending_update_applied / paused / deleted.
 * The event only names the subscription; its current Stripe state decides.
 */
async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
  savrPrices: ReadonlySet<string>,
): Promise<void> {
  const customerId = readId(subscription.customer);
  const userId = await findUserByCustomerId(customerId, stripe, supabaseAdmin);
  if (!userId) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }
  await reconcileSubscription(userId, subscription.id, stripe, supabaseAdmin, savrPrices);
}

/**
 * invoice.paid / invoice.payment_succeeded / invoice.payment_failed.
 * Subscription state comes from Stripe; payment fields only move forward in
 * invoice time, so a delayed invoice never overwrites a newer outcome.
 */
async function handleInvoiceEvent(
  invoice: Stripe.Invoice,
  outcome: 'succeeded' | 'failed',
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
  savrPrices: ReadonlySet<string>,
): Promise<void> {
  const userId = await findUserByCustomerId(readId(invoice.customer), stripe, supabaseAdmin);
  if (!userId) return;

  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    console.warn(`Invoice ${invoice.id} has no subscription; entitlement unchanged for ${userId}`);
    return;
  }

  const row = await loadBillingRow(supabaseAdmin, userId);
  const invoiceDate = new Date(invoice.created * 1000).toISOString();
  const isNewest =
    !row?.last_payment_date || Date.parse(invoiceDate) >= Date.parse(row.last_payment_date);

  const ownership = await reconcileSubscription(
    userId,
    subscriptionId,
    stripe,
    supabaseAdmin,
    savrPrices,
    isNewest
      ? {
          updates: { last_payment_status: outcome, last_payment_date: invoiceDate },
          lastPaymentDate: row?.last_payment_date ?? null,
        }
      : {},
  );

  if (ownership && ownership !== 'ignore') {
    console.log(
      `${outcome === 'succeeded' ? '✅' : '❌'} Payment ${outcome} for user ${userId}` +
        (isNewest ? '' : ' (older invoice; payment fields kept)'),
    );
  }
}

// ──────────────────────────────────────────────────────────────
// Internal utilities
// ──────────────────────────────────────────────────────────────

function sanitiseError(err: unknown): string {
  if (err instanceof Error) {
    // Exclude stack frames; preserve only the message.
    return err.message.slice(0, 500);
  }
  return String(err).slice(0, 500);
}

// ──────────────────────────────────────────────────────────────
// Injectable dependency interfaces (used in tests)
// ──────────────────────────────────────────────────────────────

/** Minimal Stripe surface required by the webhook handler. */
export interface StripeClient {
  webhooks: {
    constructEvent(body: string, signature: string, secret: string): Stripe.Event;
  };
  subscriptions: {
    retrieve(id: string): Promise<Stripe.Subscription>;
  };
  customers: {
    retrieve(id: string): Promise<Stripe.Customer | Stripe.DeletedCustomer>;
  };
}

/** Minimal Supabase admin surface required by the webhook handler. */
export interface SupabaseAdmin {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
  from(table: string): SupabaseQueryBuilder;
}

type SupabaseResult = PromiseLike<{ data: unknown; error: unknown }>;

interface SupabaseQueryBuilder {
  select(cols: string): SupabaseQueryBuilder & SupabaseResult;
  update(data: Record<string, unknown>): SupabaseQueryBuilder;
  eq(col: string, val: unknown): SupabaseQueryBuilder & SupabaseResult;
  is(col: string, val: null): SupabaseQueryBuilder & SupabaseResult;
}
