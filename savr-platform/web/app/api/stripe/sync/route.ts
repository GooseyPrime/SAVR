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
import { authenticateRequest } from '@/lib/middleware';
import { getStripeInstance } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  findOpenSubscriptionCheckoutSession,
  loadCustomerActivity,
  loadCustomerBillingSnapshotsByEmail,
  mapStripeStatusToDatabase,
  pickCurrentSubscription,
  pickHistoricalSubscription,
  resolveStripeSubscriptionSnapshot,
  selectCustomerBillingSnapshot,
} from '@/lib/stripe-billing';

interface SyncRouteUser {
  id: string;
  email?: string | null;
}

interface SyncRouteResult {
  status: number;
  body: Record<string, unknown>;
}

function shouldClearStaleEntitlement(args: {
  localStatus?: string | null;
  localSubscriptionId?: string | null;
}): boolean {
  return Boolean(args.localSubscriptionId) || ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(args.localStatus ?? '');
}

export async function syncStripeSubscriptionResponse(args: {
  user: SyncRouteUser;
  stripe: ReturnType<typeof getStripeInstance>;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
}): Promise<SyncRouteResult> {
  const { user, stripe, supabaseAdmin } = args;

  const { data: userRow, error: userError } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status, email')
    .eq('id', user.id)
    .single();

  if (userError || !userRow) {
    return { status: 404, body: { error: 'User record not found' } };
  }

  const typedUserRow = userRow as {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
    email?: string | null;
  };

  let customerId = typedUserRow.stripe_customer_id ?? null;
  let customerActivity = customerId
    ? await loadCustomerActivity(stripe, customerId)
    : null;

  if (!customerId) {
    const email = typedUserRow.email ?? user.email;
    if (!email) {
      return {
        status: 400,
        body: { error: 'No Stripe customer linked and no email available for lookup' },
      };
    }

    const snapshots = await loadCustomerBillingSnapshotsByEmail(stripe, email);
    if (snapshots.length === 0) {
      return {
        status: 404,
        body: {
          error: 'No Stripe customer found for this account. Complete checkout first.',
        },
      };
    }

    const discovered = selectCustomerBillingSnapshot(snapshots, user.id);
    if (!discovered) {
      return {
        status: 409,
        body: {
          error:
            'Multiple Stripe customer records matched this account and none could be safely verified. Contact support with your billing email.',
        },
      };
    }

    customerId = discovered.customer.id;
    customerActivity = {
      subscriptions: discovered.subscriptions,
      openCheckoutSessions: discovered.openCheckoutSessions,
    };

    const { error: persistCustomerError } = await supabaseAdmin
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);

    if (persistCustomerError) {
      console.error('sync: failed to persist stripe_customer_id', persistCustomerError);
      return { status: 500, body: { error: 'Failed to update subscription record' } };
    }
  }

  const currentSubscription = customerActivity
    ? pickCurrentSubscription(customerActivity.subscriptions)
    : null;

  if (!currentSubscription) {
    const openCheckoutSession = customerActivity
      ? findOpenSubscriptionCheckoutSession(customerActivity.openCheckoutSessions)
      : null;
    if (openCheckoutSession) {
      return {
        status: 200,
        body: {
          synced: false,
          message:
            'A subscription checkout is still open in Stripe. Complete it, then try syncing again.',
          stripe_customer_id: customerId,
        },
      };
    }

    const historicalSubscription = customerActivity
      ? pickHistoricalSubscription(customerActivity.subscriptions)
      : null;

    if (
      historicalSubscription ||
      shouldClearStaleEntitlement({
        localStatus: typedUserRow.subscription_status,
        localSubscriptionId: typedUserRow.stripe_subscription_id,
      })
    ) {
      const reconciledStatus = historicalSubscription
        ? mapStripeStatusToDatabase(historicalSubscription.status)
        : 'pending';
      const { error: clearError } = await supabaseAdmin
        .from('users')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          subscription_tier: 'basic',
          subscription_status: reconciledStatus,
          current_period_end: null,
          trial_ends_at: null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (clearError) {
        console.error('sync: failed to clear stale subscription state', clearError);
        return { status: 500, body: { error: 'Failed to update subscription record' } };
      }

      return {
        status: 200,
        body: {
          synced: true,
          subscription_status: reconciledStatus,
          subscription_tier: 'basic',
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          message:
            historicalSubscription
              ? 'No current Stripe subscription remains for this account. SAVR access was cleared to match Stripe.'
              : 'No Stripe subscription or open checkout remains for this account. SAVR access was reset to pending.',
        },
      };
    }

    return {
      status: 200,
      body: {
        synced: false,
        message:
          'No subscription found in Stripe for this customer. Complete checkout first.',
        stripe_customer_id: customerId,
      },
    };
  }

  let snapshot: ReturnType<typeof resolveStripeSubscriptionSnapshot>;
  try {
    snapshot = resolveStripeSubscriptionSnapshot(currentSubscription);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 500, body: { error: `Could not resolve tier: ${msg}` } };
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: snapshot.subscriptionId,
      subscription_tier: snapshot.tier,
      subscription_status: snapshot.status,
      current_period_end: snapshot.currentPeriodEnd
        ? new Date(snapshot.currentPeriodEnd * 1000).toISOString()
        : null,
      trial_ends_at: snapshot.trialEnd
        ? new Date(snapshot.trialEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: snapshot.cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('sync: failed to update user row', updateError);
    return { status: 500, body: { error: 'Failed to update subscription record' } };
  }

  console.log(`✅ Subscription synced: status=${snapshot.status}, tier=${snapshot.tier}`);

  return {
    status: 200,
    body: {
      synced: true,
      subscription_status: snapshot.status,
      subscription_tier: snapshot.tier,
      stripe_customer_id: customerId,
      stripe_subscription_id: snapshot.subscriptionId,
    },
  };
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

  const result = await syncStripeSubscriptionResponse({
    user: { id: user.id, email: user.email },
    stripe,
    supabaseAdmin: getSupabaseAdmin(),
  });

  return NextResponse.json(result.body, { status: result.status });
}
