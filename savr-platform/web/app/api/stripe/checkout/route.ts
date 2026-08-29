/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a new subscription.
 *
 * Key behaviours:
 *  - `payment_method_collection: 'if_required'` — Stripe skips the payment
 *    form entirely when a promotion code (coupon) reduces the session total to
 *    $0.00. Without this flag Stripe always collects card details even on
 *    fully-discounted orders.
 *  - `allow_promotion_codes: true` — keeps the coupon-code input visible in
 *    the Stripe Checkout UI so users can apply codes themselves.
 *  - `client_reference_id` is set to the authenticated user's Supabase UID so
 *    the `checkout.session.completed` webhook can link the session back to the
 *    correct user row without relying on email matching.
 *
 * Body: { plan: 'basic_monthly' | 'basic_yearly' | 'pro_monthly' | 'pro_yearly' }
 *
 * Response: { url: string } — redirect the browser to this Stripe-hosted URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware';
import { getStripeInstance } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  buildCheckoutIdempotencyKey,
  buildCheckoutSessionParams,
  customerHasConsumedTrial,
  discountRemovesAllCharges,
  findActivePromotionCode,
  findBlockingSubscription,
  findReusableCheckoutSession,
  isPlan,
  isStripeMissingCustomerError,
  isStripeTrialIneligibleError,
  loadCustomerActivity,
  loadCustomerBillingSnapshotsByEmail,
  mapStripeStatusToDatabase,
  PLAN_ENV_MAP,
  pickCurrentSubscription,
  pickHistoricalSubscription,
  resolvePriceId,
  resolveStripeSubscriptionSnapshot,
  selectCustomerBillingSnapshot,
  type Plan,
} from '@/lib/stripe-billing';

interface CheckoutRouteUser {
  id: string;
  email?: string | null;
}

interface CheckoutRouteResult {
  status: number;
  body: { url?: string; error?: string };
}

export async function createCheckoutSessionResponse(args: {
  user: CheckoutRouteUser;
  plan: Plan;
  origin: string;
  stripe: ReturnType<typeof getStripeInstance>;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  /** Optional customer-facing coupon code entered before checkout. */
  promotionCode?: string | null;
}): Promise<CheckoutRouteResult> {
  const { user, plan, origin, stripe, supabaseAdmin } = args;

  let priceId: string;
  try {
    priceId = resolvePriceId(plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 503, body: { error: msg } };
  }

  // A payment method is required for every checkout. The single exception is a
  // coupon that removes every charge for the life of the subscription — there
  // is nothing to bill, so Stripe is told not to ask for a card.
  let promotion: Awaited<ReturnType<typeof findActivePromotionCode>> = null;
  if (args.promotionCode?.trim()) {
    try {
      promotion = await findActivePromotionCode(stripe, args.promotionCode);
    } catch (error) {
      console.error('checkout: failed to look up promotion code', error);
      return {
        status: 502,
        body: { error: 'Could not verify that coupon code. Please try again shortly.' },
      };
    }
    if (!promotion) {
      return {
        status: 400,
        body: { error: 'That coupon code is not valid or is no longer available.' },
      };
    }
  }

  const fullyDiscounted = discountRemovesAllCharges(promotion);
  const collectPaymentMethod = !fullyDiscounted;

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let customerId =
    (userRow as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id ?? null;
  let customerActivity = null as Awaited<ReturnType<typeof loadCustomerActivity>> | null;

  if (customerId) {
    try {
      customerActivity = await loadCustomerActivity(stripe, customerId);
    } catch (error) {
      if (isStripeMissingCustomerError(error, customerId)) {
        console.warn(
          `checkout: persisted stripe_customer_id (${customerId}) no longer exists; clearing and retrying via email`,
        );
        const { error: clearError } = await supabaseAdmin
          .from('users')
          .update({
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_tier: 'basic',
            subscription_status: 'pending',
            current_period_end: null,
            trial_ends_at: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        if (clearError) {
          console.error('checkout: failed to clear stale stripe_customer_id', clearError);
          return { status: 500, body: { error: 'Failed to update billing record' } };
        }
        customerId = null;
      } else {
        console.error('checkout: failed to load Stripe customer activity', error);
        return {
          status: 502,
          body: { error: 'Could not load billing details from Stripe. Please try again shortly.' },
        };
      }
    }
  }

  if (!customerId && user.email) {
    let snapshots: Awaited<ReturnType<typeof loadCustomerBillingSnapshotsByEmail>>;
    try {
      snapshots = await loadCustomerBillingSnapshotsByEmail(stripe, user.email);
    } catch (error) {
      console.error('checkout: failed to discover Stripe customers by email', error);
      return {
        status: 502,
        body: { error: 'Could not look up Stripe customers. Please try again shortly.' },
      };
    }
    if (snapshots.length > 0) {
      const reusableCustomer = selectCustomerBillingSnapshot(snapshots, user.id);
      if (!reusableCustomer) {
        return {
          status: 409,
          body: {
            error:
              'We found multiple Stripe customer records for this account and could not safely choose one. Please use subscription sync from Settings or contact support.',
          },
        };
      }

      customerId = reusableCustomer.customer.id;
      customerActivity = {
        subscriptions: reusableCustomer.subscriptions,
        openCheckoutSessions: reusableCustomer.openCheckoutSessions,
      };

      const currentSubscription = pickCurrentSubscription(customerActivity.subscriptions);
      const historicalSubscription = currentSubscription
        ? null
        : pickHistoricalSubscription(customerActivity.subscriptions);
      const subscriptionSnapshot = currentSubscription
        ? resolveStripeSubscriptionSnapshot(currentSubscription)
        : null;

      const { error: persistCustomerError } = await supabaseAdmin
        .from('users')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionSnapshot?.subscriptionId ?? null,
          subscription_tier: subscriptionSnapshot?.tier ?? 'basic',
          subscription_status: subscriptionSnapshot
            ? subscriptionSnapshot.status
            : historicalSubscription
              ? mapStripeStatusToDatabase(historicalSubscription.status)
              : 'pending',
          current_period_end: subscriptionSnapshot?.currentPeriodEnd
            ? new Date(subscriptionSnapshot.currentPeriodEnd * 1000).toISOString()
            : null,
          trial_ends_at: subscriptionSnapshot?.trialEnd
            ? new Date(subscriptionSnapshot.trialEnd * 1000).toISOString()
            : null,
          cancel_at_period_end: subscriptionSnapshot?.cancelAtPeriodEnd ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (persistCustomerError) {
        console.error('checkout: failed to persist stripe_customer_id', persistCustomerError);
        return {
          status: 500,
          body: { error: 'Failed to save billing customer for this account' },
        };
      }
    }
  }

  const blockingSubscription = customerActivity
    ? findBlockingSubscription(customerActivity.subscriptions)
    : null;
  if (blockingSubscription) {
    return {
      status: 409,
      body: {
        error:
          'An active or trialing subscription already exists for this account. Use the billing portal to manage it.',
      },
    };
  }

  // A permanently free plan has nothing to trial, so the trial is dropped.
  const includeTrial =
    !fullyDiscounted &&
    !(customerActivity && customerHasConsumedTrial(customerActivity.subscriptions));

  // Never hand back an earlier session when a coupon was supplied: that session
  // carries different discounts and a different payment-collection rule.
  const reusableSession =
    customerActivity && !promotion
      ? findReusableCheckoutSession(customerActivity.openCheckoutSessions, priceId, includeTrial)
      : null;
  if (reusableSession?.url) {
    return { status: 200, body: { url: reusableSession.url } };
  }

  const createSession = async (withTrial: boolean) =>
    stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        priceId,
        userId: user.id,
        email: user.email,
        customerId,
        origin,
        includeTrial: withTrial,
        plan,
        promotionCodeId: promotion?.id ?? null,
        collectPaymentMethod,
      }),
      {
        idempotencyKey: buildCheckoutIdempotencyKey({
          customerId,
          userId: user.id,
          plan,
          includeTrial: withTrial,
          promotionCodeId: promotion?.id ?? null,
        }),
      },
    );

  try {
    let session;
    try {
      session = await createSession(includeTrial);
    } catch (err) {
      if (includeTrial && isStripeTrialIneligibleError(err)) {
        console.warn('checkout: customer is not eligible for another trial; retrying without trial_period_days');
        session = await createSession(false);
      } else {
        throw err;
      }
    }

    if (!session.url) {
      return {
        status: 500,
        body: { error: 'Stripe did not return a checkout URL' },
      };
    }

    return { status: 200, body: { url: session.url } };
  } catch (err) {
    console.error('Error creating checkout session:', err);
    const raw = err instanceof Error ? err.message : 'Failed to create checkout session';
    const friendly = /no such price/i.test(raw)
      ? 'Checkout is misconfigured (unknown Stripe price). Please contact support.'
      : /idempotency/i.test(raw)
        ? 'A previous checkout attempt is still settling. Wait a moment and try again.'
        : raw;
    return {
      status: 500,
      body: { error: friendly },
    };
  }
}

export async function POST(request: NextRequest) {
  // ── 1. Auth ────────────────────────────────
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  // ── 2. Parse & validate body ─────────────────────────
  let plan: Plan;
  let promotionCode: string | null = null;
  try {
    const body = await request.json() as { plan?: unknown; promotionCode?: unknown };
    if (!isPlan(body.plan)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${Object.keys(PLAN_ENV_MAP).join(', ')}` },
        { status: 400 },
      );
    }
    plan = body.plan;

    if (body.promotionCode !== undefined && body.promotionCode !== null) {
      if (typeof body.promotionCode !== 'string' || body.promotionCode.length > 64) {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
      }
      promotionCode = body.promotionCode.trim() || null;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── 3. Stripe init ───────────────────────────────
  let stripe: ReturnType<typeof getStripeInstance>;
  try {
    stripe = getStripeInstance();
  } catch {
    return NextResponse.json(
      { error: 'Payment service is not configured' },
      { status: 503 },
    );
  }

  // ── 4. Load billing state / create session ───────────────────────
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Checkout database service is not configured' },
      { status: 503 },
    );
  }
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    request.headers.get('origin') ||
    'https://www.savr.cam';

  const result = await createCheckoutSessionResponse({
    user: { id: user.id, email: user.email },
    plan,
    origin,
    stripe,
    supabaseAdmin,
    promotionCode,
  });

  return NextResponse.json(result.body, { status: result.status });
}
