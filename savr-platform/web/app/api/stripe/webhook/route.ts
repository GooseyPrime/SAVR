import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance, getStripeWebhookSecret } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';
import { handleWebhook } from '@/lib/stripe-webhook';

export async function POST(request: NextRequest) {
  let stripe: ReturnType<typeof getStripeInstance>;
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  let webhookSecret: string;

  try {
    stripe = getStripeInstance();
    supabaseAdmin = getSupabaseAdmin();
    webhookSecret = getStripeWebhookSecret();
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
    webhookSecret,
    stripe,
    supabaseAdmin,
  );

  return NextResponse.json(responseBody, { status });
}
