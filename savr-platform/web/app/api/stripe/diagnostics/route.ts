/**
 * GET /api/stripe/diagnostics
 *
 * Authenticated, non-sensitive report on whether Stripe billing is correctly
 * configured for this deployment. It never returns a credential value — only
 * presence, usability, length, and a human-readable problem description.
 *
 * This exists because a malformed credential (for example one pasted with a
 * trailing newline) previously surfaced only as an opaque Stripe connection
 * error, which is indistinguishable from a Stripe outage at the call site.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware';
import { getStripeConfigDiagnostics } from '@/lib/stripe';
import { PLAN_ENV_MAP, resolvePriceId, type Plan } from '@/lib/stripe-billing';

interface PriceEnvReport {
  plan: Plan;
  variable: string;
  configured: boolean;
  looksLikePriceId: boolean;
}

export function reportPriceEnvs(): PriceEnvReport[] {
  return (Object.keys(PLAN_ENV_MAP) as Plan[]).map((plan) => {
    let priceId: string | null = null;
    try {
      priceId = resolvePriceId(plan);
    } catch {
      priceId = null;
    }

    return {
      plan,
      variable: PLAN_ENV_MAP[plan],
      configured: priceId !== null,
      looksLikePriceId: priceId?.startsWith('price_') ?? false,
    };
  });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const { secretKey, webhookSecret, keyMode } = getStripeConfigDiagnostics();
  const prices = reportPriceEnvs();

  const billingReady =
    secretKey.usable && webhookSecret.usable && prices.every((price) => price.configured);

  return NextResponse.json({
    billingReady,
    keyMode,
    appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
    credentials: [secretKey, webhookSecret],
    prices,
  });
}
