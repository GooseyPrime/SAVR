import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

import {
  buildCheckoutIdempotencyKey,
  buildCheckoutSessionParams,
  discountRemovesAllCharges,
  findActivePromotionCode,
} from '../lib/stripe-billing';

process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';

const BASE = {
  priceId: 'price_pro_yearly',
  userId: 'user_1',
  email: 'chef@example.com',
  origin: 'https://www.savr.cam',
  plan: 'pro_yearly' as const,
};

function promo(coupon: Partial<Stripe.Coupon>): Stripe.PromotionCode {
  return {
    id: 'promo_1',
    promotion: {
      type: 'coupon',
      coupon: { valid: true, ...coupon } as Stripe.Coupon,
    },
  } as unknown as Stripe.PromotionCode;
}

/** A promotion code whose coupon came back as an id instead of an object. */
function unexpandedPromo(): Stripe.PromotionCode {
  return {
    id: 'promo_1',
    promotion: { type: 'coupon', coupon: 'coupon_abc' },
  } as unknown as Stripe.PromotionCode;
}

test('a trial checkout still requires a payment method', () => {
  // Regression: payment_method_collection was 'if_required', which is exactly
  // how Stripe starts a trial WITHOUT collecting a card.
  const params = buildCheckoutSessionParams({ ...BASE, includeTrial: true });
  assert.equal(params.payment_method_collection, 'always');
  assert.equal(
    (params.subscription_data as { trial_period_days?: number }).trial_period_days,
    5,
  );
});

test('a checkout without a trial still requires a payment method', () => {
  const params = buildCheckoutSessionParams({ ...BASE, includeTrial: false });
  assert.equal(params.payment_method_collection, 'always');
});

test('the in-Checkout coupon field is offered when no code was pre-applied', () => {
  const params = buildCheckoutSessionParams({ ...BASE });
  assert.equal(params.allow_promotion_codes, true);
  assert.equal(params.discounts, undefined);
});

test('a pre-applied code replaces the in-Checkout coupon field', () => {
  // Stripe rejects allow_promotion_codes together with discounts.
  const params = buildCheckoutSessionParams({ ...BASE, promotionCodeId: 'promo_1' });
  assert.deepEqual(params.discounts, [{ promotion_code: 'promo_1' }]);
  assert.equal(params.allow_promotion_codes, undefined);
});

test('a permanently free plan skips payment collection and cancels if unpaid', () => {
  const params = buildCheckoutSessionParams({
    ...BASE,
    promotionCodeId: 'promo_1',
    collectPaymentMethod: false,
    includeTrial: false,
  });
  assert.equal(params.payment_method_collection, 'if_required');
  assert.deepEqual(
    (params.subscription_data as { trial_settings?: unknown }).trial_settings,
    { end_behavior: { missing_payment_method: 'cancel' } },
  );
});

test('only a permanent 100% discount removes every charge', () => {
  assert.equal(discountRemovesAllCharges(promo({ percent_off: 100, duration: 'forever' })), true);
  // A one-off or repeating 100% code still bills later, so a card is required.
  assert.equal(discountRemovesAllCharges(promo({ percent_off: 100, duration: 'once' })), false);
  assert.equal(discountRemovesAllCharges(promo({ percent_off: 100, duration: 'repeating' })), false);
  assert.equal(discountRemovesAllCharges(promo({ percent_off: 50, duration: 'forever' })), false);
  assert.equal(discountRemovesAllCharges(promo({ amount_off: 9999, duration: 'forever' })), false);
  assert.equal(
    discountRemovesAllCharges(promo({ percent_off: 100, duration: 'forever', valid: false })),
    false,
  );
  assert.equal(discountRemovesAllCharges(null), false);
  assert.equal(discountRemovesAllCharges(undefined), false);
});

test('an unexpanded coupon fails closed and still requires a card', () => {
  // Never infer "free" from an id we did not resolve.
  assert.equal(discountRemovesAllCharges(unexpandedPromo()), false);
});

test('the idempotency key separates coupon attempts from plain ones', () => {
  const plain = buildCheckoutIdempotencyKey({ userId: 'user_1', plan: 'pro_yearly' });
  const withCode = buildCheckoutIdempotencyKey({
    userId: 'user_1',
    plan: 'pro_yearly',
    promotionCodeId: 'promo_1',
  });
  const otherCode = buildCheckoutIdempotencyKey({
    userId: 'user_1',
    plan: 'pro_yearly',
    promotionCodeId: 'promo_2',
  });
  assert.notEqual(plain, withCode);
  assert.notEqual(withCode, otherCode);
});

test('promotion code lookup only accepts active codes and ignores blank input', async () => {
  const calls: unknown[] = [];
  const stripe = {
    promotionCodes: {
      list: async (params: unknown) => {
        calls.push(params);
        return { data: [promo({ percent_off: 100, duration: 'forever' })] };
      },
    },
  } as unknown as Parameters<typeof findActivePromotionCode>[0];

  const found = await findActivePromotionCode(stripe, '  LAUNCH100  ');
  assert.equal(found?.id, 'promo_1');
  assert.deepEqual(calls[0], {
    code: 'LAUNCH100',
    active: true,
    limit: 1,
    expand: ['data.promotion.coupon'],
  });

  assert.equal(await findActivePromotionCode(stripe, '   '), null);
  assert.equal(calls.length, 1, 'a blank code must not reach Stripe');
});

test('an unknown code resolves to null rather than silently continuing', async () => {
  const stripe = {
    promotionCodes: { list: async () => ({ data: [] }) },
  } as unknown as Parameters<typeof findActivePromotionCode>[0];
  assert.equal(await findActivePromotionCode(stripe, 'NOPE'), null);
});
