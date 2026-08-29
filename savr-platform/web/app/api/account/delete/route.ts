import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/middleware';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripeInstance } from '@/lib/stripe';

/**
 * POST /api/account/delete
 *
 * Permanently deletes the authenticated user's account and all associated data.
 * Sequence:
 *   1. Cancel any active Stripe subscription (suppress errors — the account
 *      must still be deleted even if Stripe is unreachable).
 *   2. Delete the auth.users row via the admin client.  The schema cascades
 *      this to public.users and every child table (inventory, recipes, meal
 *      plans, grocery lists, transfer sessions, data_consent, …).
 *
 * The caller is responsible for signing the user out after a 200 response.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const { user, supabase } = auth;

  // 1. Cancel any active Stripe subscription at period end so the customer
  //    is not charged again.  Failure here is non-fatal.
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (profile?.stripe_subscription_id) {
      const stripe = getStripeInstance();
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    }
  } catch (stripeErr) {
    // Log but do not block deletion.
    console.error('[account/delete] Stripe cancellation failed:', stripeErr);
  }

  // 2. Delete the auth.users row.  The ON DELETE CASCADE on public.users and
  //    all child tables removes every row owned by this user automatically.
  const admin = getSupabaseAdmin();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error('[account/delete] auth.admin.deleteUser failed:', deleteError);
    return NextResponse.json(
      { error: 'Account deletion failed. Please contact support@savr.cam.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
