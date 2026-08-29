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
  findBlockingSubscription,
  findOpenSubscriptionCheckoutSession,
  isPlan,
  loadCustomerActivity,
  loadCustomerBillingSnapshotsByEmail,
  PLAN_ENV_MAP,
  resolvePriceId,
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
}): Promise<CheckoutRouteResult> {
  const { user, plan, origin, stripe, supabaseAdmin } = args;

  let priceId: string;
  try {
    priceId = resolvePriceId(plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 503, body: { error: msg } };
  }

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let customerId =
    (userRow as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id ?? null;
  let customerActivity = customerId
    ? await loadCustomerActivity(stripe, customerId)
    : null;

  if (!customerId && user.email) {
    const snapshots = await loadCustomerBillingSnapshotsByEmail(stripe, user.email);
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

      const { error: persistCustomerError } = await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
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

  const openSession = customerActivity
    ? findOpenSubscriptionCheckoutSession(customerActivity.openCheckoutSessions)
    : null;
  if (openSession?.url) {
    return { status: 200, body: { url: openSession.url } };
  }
  if (openSession) {
    return {
      status: 409,
      body: {
        error:
          'A subscription checkout is already in progress. Please complete it or wait for it to expire.',
      },
    };
  }

  try {
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        priceId,
        userId: user.id,
        email: user.email,
        customerId,
        origin,
      }),
      {
        idempotencyKey: buildCheckoutIdempotencyKey({
          customerId,
          userId: user.id,
          plan,
        }),
      },
    );

    if (!session.url) {
      return {
        status: 500,
        body: { error: 'Stripe did not return a checkout URL' },
      };
    }

    return { status: 200, body: { url: session.url } };
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return {
      status: 500,
      body: {
        error:
          err instanceof Error ? err.message : 'Failed to create checkout session',
      },
    };
  }
}

export async function POST(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  // ── 2. Parse & validate body ─────────────────────────────────────────────
  let plan: Plan;
  try {
    const body = await request.json() as { plan?: unknown };
    if (!isPlan(body.plan)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${Object.keys(PLAN_ENV_MAP).join(', ')}` },
        { status: 400 },
      );
    }
    plan = body.plan;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── 3. Stripe init ───────────────────────────────────────────────────────
  let stripe: ReturnType<typeof getStripeInstance>;
  try {
    stripe = getStripeInstance();
  } catch {
    return NextResponse.json(
      { error: 'Payment service is not configured' },
      { status: 503 },
    );
  }

  // ── 4. Load billing state / create session ───────────────────────────────
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
    process.env.NEXT_PUBLIC_APP_URL ??
    request.headers.get('origin') ??
    'https://savr.app';

  const result = await createCheckoutSessionResponse({
    user: { id: user.id, email: user.email },
    plan,
    origin,
    stripe,
    supabaseAdmin,
  });

  return NextResponse.json(result.body, { status: result.status });
}
