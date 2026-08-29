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

type Plan = 'basic_monthly' | 'basic_yearly' | 'pro_monthly' | 'pro_yearly';

const PLAN_ENV_MAP: Record<Plan, string> = {
  basic_monthly: 'STRIPE_PRICE_BASIC_MONTHLY',
  basic_yearly: 'STRIPE_PRICE_BASIC_YEARLY',
  pro_monthly: 'STRIPE_PRICE_PRO_MONTHLY',
  pro_yearly: 'STRIPE_PRICE_PRO_YEARLY',
};

function resolvePriceId(plan: Plan): string {
  const envKey = PLAN_ENV_MAP[plan];
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new Error(
      `Environment variable ${envKey} is not set — cannot create checkout session`,
    );
  }
  return priceId;
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
    if (!body.plan || !Object.keys(PLAN_ENV_MAP).includes(body.plan as string)) {
      return NextResponse.json(
        {
          error: `Invalid plan. Must be one of: ${Object.keys(PLAN_ENV_MAP).join(', ')}`,
        },
        { status: 400 },
      );
    }
    plan = body.plan as Plan;
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

  // ── 4. Resolve price ID ──────────────────────────────────────────────────
  let priceId: string;
  try {
    priceId = resolvePriceId(plan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // ── 5. Look up existing Stripe customer (avoid creating duplicates) ───────
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const existingCustomerId =
    (userRow as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id ?? undefined;

  // ── 6. Determine origin for redirect URLs ────────────────────────────────
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    request.headers.get('origin') ??
    'https://savr.app';

  // ── 7. Create Checkout Session ───────────────────────────────────────────
  try {
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],

      // Skip payment form entirely when a promotion code zeroes the total.
      payment_method_collection: 'if_required',

      // Allow users to enter promotion / coupon codes at checkout.
      allow_promotion_codes: true,

      // Link session back to our user without relying on email matching.
      client_reference_id: user.id,

      // Pre-fill email to reduce friction and match Stripe customer records.
      customer_email: existingCustomerId ? undefined : (user.email ?? undefined),

      // Re-use existing Stripe customer when available.
      ...(existingCustomerId ? { customer: existingCustomerId } : {}),

      subscription_data: {
        metadata: { userId: user.id },
      },

      success_url: `${origin}/dashboard?stripeSuccess=true`,
      cancel_url: `${origin}/pricing`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    const msg =
      err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
