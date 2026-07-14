import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { handleWebhook } from '@/lib/stripe-webhook';

export async function POST(request: NextRequest) {
  let stripe: ReturnType<typeof getStripeInstance>;
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;

  try {
    stripe = getStripeInstance();
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    console.error('Configuration error:', error);
    return NextResponse.json(
      { error: 'Service configuration error' },
      { status: 500 },
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  const { status, body: responseBody } = await handleWebhook(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
    stripe,
    supabaseAdmin,
  );

  return NextResponse.json(responseBody, { status });
}
