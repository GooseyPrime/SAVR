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
  getSubscriptionPeriodEndUnix,
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
 * - 'already_pending'   – another invocation is processing; defer to it
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
// Top-level handler (signature verification → claim → process)
// ──────────────────────────────────────────────────────────────

/**
 * Full webhook processing pipeline.
 *
 * 1. Verify Stripe signature.
 * 2. Atomically claim the event.
 * 3. Return 200 immediately for already-processed duplicates.
 * 4. Return 200 immediately for already-pending concurrent deliveries.
 * 5. Dispatch to the appropriate event handler.
 * 6. Mark the event as processed on success.
 * 7. On failure: mark failed, return 500 so Stripe retries.
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
    console.log(`ℹ️  Concurrent event ${event.id} — another invocation is processing, deferring`);
    return { status: 200, body: { received: true } };
  }

  // 'claimed' — process the event.
  try {
    await dispatchWebhookEvent(event, stripe, supabaseAdmin);
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

async function dispatchWebhookEvent(
  event: Stripe.Event,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, stripe, supabaseAdmin);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.resumed':
    case 'customer.subscription.pending_update_applied': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription, stripe, supabaseAdmin);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription, stripe, supabaseAdmin);
      break;
    }

    case 'customer.subscription.paused': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionPaused(subscription, stripe, supabaseAdmin);
      break;
    }

    case 'invoice.payment_succeeded':
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentSucceeded(invoice, stripe, supabaseAdmin);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice, stripe, supabaseAdmin);
      break;
    }

    default:
      console.log(`ℹ️  Unhandled event type: ${event.type}`);
  }
}

// ──────────────────────────────────────────────────────────────
// Event-specific handlers
// ──────────────────────────────────────────────────────────────

async function findUserByCustomerId(
  customerId: string,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !data) {
    // Fallback: look up by customer email
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted && customer.email) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', customer.email)
          .single();

        if (userData) {
          const ud = userData as { id: string };
          await supabaseAdmin
            .from('users')
            .update({ stripe_customer_id: customerId })
            .eq('id', ud.id);
          return ud.id;
        }
      }
    } catch (err) {
      console.error('Error in customer email fallback:', err);
    }
    return null;
  }

  return (data as { id: string }).id;
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  console.log(`Processing checkout.session.completed for ${session.id}`, {
    customer: session.customer,
    subscription: session.subscription,
  });

  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) {
    console.error('No user ID in checkout session');
    return;
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (!user) {
    console.error(`User ${userId} not found`);
    return;
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  const updates: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    updated_at: new Date().toISOString(),
  };

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    if (priceId) {
      // Throws on unknown price — propagates to outer catch and returns 500 so Stripe retries.
      updates.subscription_tier = resolveTierFromPriceId(priceId);
    }
    updates.subscription_status = subscription.status;
  }

  await supabaseAdmin.from('users').update(updates).eq('id', userId);

  console.log(`✅ Linked checkout to user ${userId}`, {
    customerId,
    subscriptionId,
    subscriptionStatus: updates.subscription_status,
  });
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as { id: string })?.id;
  const userId = await findUserByCustomerId(customerId!, stripe, supabaseAdmin);

  if (!userId) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error(
      `No price ID found on subscription ${subscription.id} — skipping tier update`,
    );
    return;
  }
  // Throws on unknown price — propagates to outer catch and returns 500 so Stripe retries.
  const tier = resolveTierFromPriceId(priceId);

  const periodEnd = getSubscriptionPeriodEndUnix(subscription);
  const trialEnd = subscription.trial_end;

  await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: mapStripeStatusToDatabase(subscription.status),
      stripe_subscription_id: subscription.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(
    `✅ Updated subscription for user ${userId}: ${subscription.status}, tier ${tier}`,
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as { id: string })?.id;
  const userId = await findUserByCustomerId(customerId!, stripe, supabaseAdmin);

  if (!userId) return;

  await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: 'basic',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`✅ Subscription deleted for user ${userId}`);
}

async function handleSubscriptionPaused(
  subscription: Stripe.Subscription,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as { id: string })?.id;
  const userId = await findUserByCustomerId(customerId!, stripe, supabaseAdmin);

  if (!userId) return;

  await supabaseAdmin
    .from('users')
    .update({
      subscription_status: mapStripeStatusToDatabase(subscription.status),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`✅ Subscription paused for user ${userId}`);
}

async function handlePaymentSucceeded(
  invoice: Stripe.Invoice,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : (invoice.customer as { id: string })?.id;
  const userId = await findUserByCustomerId(customerId!, stripe, supabaseAdmin);

  if (!userId) return;

  await supabaseAdmin
    .from('users')
    .update({
      last_payment_status: 'succeeded',
      last_payment_date: new Date(invoice.created * 1000).toISOString(),
      payment_action_required: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`✅ Payment succeeded for user ${userId}`);
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  stripe: StripeClient,
  supabaseAdmin: SupabaseAdmin,
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : (invoice.customer as { id: string })?.id;
  const userId = await findUserByCustomerId(customerId!, stripe, supabaseAdmin);

  if (!userId) return;

  await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'past_due',
      last_payment_status: 'failed',
      last_payment_date: new Date(invoice.created * 1000).toISOString(),
      payment_action_required: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`❌ Payment failed for user ${userId}`);
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

interface SupabaseQueryBuilder {
  select(cols: string): SupabaseQueryBuilder;
  update(data: Record<string, unknown>): SupabaseQueryBuilder;
  eq(col: string, val: unknown): SupabaseQueryBuilder & Promise<{ data: unknown; error: unknown }>;
  single(): Promise<{ data: unknown; error: unknown }>;
}
