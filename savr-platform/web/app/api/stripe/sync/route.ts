/**
 * POST /api/stripe/sync
 *
 * Manually reconcile a user's subscription state from Stripe.
 *
 * Use when the Stripe webhook was not delivered (e.g. coupon-based $0 checkout,
 * mis-configured webhook endpoint, or transient network failure) and the user's
 * subscription_status / subscription_tier remain stale in the database.
 *
 * Flow:
 *  1. Authenticate the caller.
 *  2. Find or discover the Stripe customer linked to this user.
 *  3. List the customer's subscriptions and pick the most relevant one.
 *  4. Resolve the billing tier from the price ID.
 *  5. Write the canonical fields back to the `users` row.
 *  6. Return a summary so the client can refresh its local state.
 */

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { authenticateRequest } from '@/lib/middleware';
import { getStripeInstance } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveTierFromPriceId } from '@/lib/billing';

// Subscription statuses that confer product access, ordered by preference.
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/** Pick the best subscription from a list (active > trialing > past_due > newest). */
function pickBestSubscription(
  subs: Stripe.Subscription[],
): Stripe.Subscription | null {
  if (subs.length === 0) return null;

  for (const status of ACTIVE_STATUSES) {
    const match = subs.find((s) => s.status === status);
    if (match) return match;
  }

  // Fallback: most recently created
  return subs.sort((a: Stripe.Subscription, b: Stripe.Subscription) => b.created - a.created)[0] ?? null;
}

export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  // ── 2. Stripe init ───────────────────────────────────────────────────────
  let stripe: ReturnType<typeof getStripeInstance>;
  try {
    stripe = getStripeInstance();
  } catch {
    return NextResponse.json(
      { error: 'Payment service is not configured' },
      { status: 503 },
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  // ── 3. Load user row ─────────────────────────────────────────────────────
  const { data: userRow, error: userError } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();

  if (userError || !userRow) {
    return NextResponse.json({ error: 'User record not found' }, { status: 404 });
  }

  // ── 4. Resolve Stripe customer ───────────────────────────────────────────
  let customerId: string | null =
    (userRow as { stripe_customer_id?: string | null }).stripe_customer_id ?? null;

  if (!customerId) {
    // Discover by email — common after coupon-based $0 checkouts where
    // the customer was created in Stripe but the webhook was not delivered.
    const email = (userRow as { email?: string | null }).email ?? user.email;
    if (!email) {
      return NextResponse.json(
        { error: 'No Stripe customer linked and no email available for lookup' },
        { status: 400 },
      );
    }

    const customers = await stripe.customers.list({ email, limit: 5 });
    if (customers.data.length === 0) {
      return NextResponse.json(
        {
          error:
            'No Stripe customer found for this account. Complete checkout first.',
        },
        { status: 404 },
      );
    }

    // Use the most recently created customer.
    const discovered = customers.data.sort(
      (a: Stripe.Customer | Stripe.DeletedCustomer, b: Stripe.Customer | Stripe.DeletedCustomer) =>
        (b as Stripe.Customer).created - (a as Stripe.Customer).created,
    )[0];
    customerId = discovered.id;

    // Persist so future calls skip this lookup.
    await supabaseAdmin
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  // ── 5. Fetch subscriptions ───────────────────────────────────────────────
  const subscriptionList = await stripe.subscriptions.list({
    customer: customerId,
    limit: 10,
    expand: ['data.items.data.price'],
  });

  const subscription = pickBestSubscription(subscriptionList.data);

  if (!subscription) {
    return NextResponse.json(
      {
        synced: false,
        message:
          'No subscription found in Stripe for this customer. If you recently completed checkout, wait 60 seconds and try again.',
        stripe_customer_id: customerId,
      },
      { status: 200 },
    );
  }

  // ── 6. Resolve tier ──────────────────────────────────────────────────────
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    return NextResponse.json(
      { error: 'Subscription has no price item — cannot resolve tier' },
      { status: 500 },
    );
  }

  let tier: 'basic' | 'pro';
  try {
    tier = resolveTierFromPriceId(priceId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Could not resolve tier: ${msg}` },
      { status: 500 },
    );
  }

  // ── 7. Write back ────────────────────────────────────────────────────────
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const trialEnd = subscription.trial_end;

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_tier: tier,
      subscription_status: subscription.status,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      trial_ends_at: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('sync: failed to update user row', updateError);
    return NextResponse.json(
      { error: 'Failed to update subscription record' },
      { status: 500 },
    );
  }

  console.log(
    `✅ Subscription synced for user ${user.id}: ${subscription.status}, tier=${tier}`,
  );

  return NextResponse.json({
    synced: true,
    subscription_status: subscription.status,
    subscription_tier: tier,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  });
}
