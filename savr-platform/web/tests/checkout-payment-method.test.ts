import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

import {
  buildCheckoutIdempotencyKey,
  buildCheckoutSessionParams,
  discountRemovesAllCharges,
  findActivePromotionCode,
  promotionCodeAppliesToPrice,
} from '../lib/stripe-billing';
import { makePrice, makePromotionCode } from './stripe-billing-kit';

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

const PRO_YEARLY_PRICE = makePrice({
  id: 'price_pro_yearly',
  productId: 'prod_pro',
  currency: 'usd',
  unitAmount: 9999,
});

function promo(coupon: Partial<Stripe.Coupon>): Stripe.PromotionCode {
  return makePromotionCode({
    id: 'promo_1',
    coupon: coupon as Partial<Stripe.Coupon>,
  });
}

function unexpandedPromo(): Stripe.PromotionCode {
  return {
    id: 'promo_1',
    promotion: { type: 'coupon', coupon: 'coupon_abc' },
  } as unknown as Stripe.PromotionCode;
}

test('checkout uses Stripe if_required so $0 totals skip the card form', () => {
  const params = buildCheckoutSessionParams({ ...BASE, includeTrial: true });
  assert.equal(params.payment_method_collection, 'if_required');
  assert.equal(
    (params.subscription_data as { trial_period_days?: number }).trial_period_days,
    5,
  );
});

test('a checkout without a trial still uses if_required', () => {
  const params = buildCheckoutSessionParams({ ...BASE, includeTrial: false });
  assert.equal(params.payment_method_collection, 'if_required');
});

test('the in-Checkout coupon field is offered when no code was pre-applied', () => {
  const params = buildCheckoutSessionParams({ ...BASE });
  assert.equal(params.allow_promotion_codes, true);
  assert.equal(params.discounts, undefined);
});

test('a pre-applied code replaces the in-Checkout coupon field', () => {
  const params = buildCheckoutSessionParams({ ...BASE, promotionCodeId: 'promo_1' });
  assert.deepEqual(params.discounts, [{ promotion_code: 'promo_1' }]);
  assert.equal(params.allow_promotion_codes, undefined);
});

test('a pre-applied free coupon still uses if_required', () => {
  const params = buildCheckoutSessionParams({
    ...BASE,
    promotionCodeId: 'promo_1',
    includeTrial: false,
  });
  assert.equal(params.payment_method_collection, 'if_required');
});

test('only a permanent 100% discount removes every charge', () => {
  assert.equal(
   discountRemovesAllCharges(promo({ percent_off: 100, duration: 'forever' }), PRO_YEARLY_PRICE),
   true,
  );
  assert.equal(
   discountRemovesAllCharges(promo({ percent_off: 100, duration: 'once' }), PRO_YEARLY_PRICE),
   false,
  );
  assert.equal(
   discountRemovesAllCharges(
     promo({ percent_off: 100, duration: 'repeating' }),
     PRO_YEARLY_PRICE,
   ),
   false,
  );
  assert.equal(
   discountRemovesAllCharges(promo({ percent_off: 50, duration: 'forever' }), PRO_YEARLY_PRICE),
   false,
  );
  assert.equal(
   discountRemovesAllCharges(
     promo({ amount_off: 9999, currency: 'usd', duration: 'forever' }),
     PRO_YEARLY_PRICE,
   ),
   true,
  );
  assert.equal(
   discountRemovesAllCharges(
     promo({
       duration: 'forever',
       currency_options: { usd: { amount_off: 10000 } } as Stripe.Coupon['currency_options'],
     }),
     PRO_YEARLY_PRICE,
   ),
   true,
  );
  assert.equal(
   discountRemovesAllCharges(
     promo({ percent_off: 100, duration: 'forever', valid: false }),
     PRO_YEARLY_PRICE,
   ),
   false,
  );
  assert.equal(
   discountRemovesAllCharges(
     promo({ amount_off: 9999, currency: 'cad', duration: 'forever' }),
     PRO_YEARLY_PRICE,
   ),
   false,
  );
  assert.equal(
   discountRemovesAllCharges(
     makePromotionCode({
       id: 'promo_other_product',
       coupon: {
         percent_off: 100,
         duration: 'forever',
         applies_to: { products: ['prod_basic'] },
       },
     }),
     PRO_YEARLY_PRICE,
   ),
   false,
  );
  assert.equal(discountRemovesAllCharges(null, PRO_YEARLY_PRICE), false);
  assert.equal(discountRemovesAllCharges(undefined, PRO_YEARLY_PRICE), false);
});

test('an unexpanded coupon fails closed', () => {
  assert.equal(discountRemovesAllCharges(unexpandedPromo(), PRO_YEARLY_PRICE), false);
});

test('promotionCodeAppliesToPrice rejects plan/product/currency mismatches', () => {
  assert.equal(
   promotionCodeAppliesToPrice(
     makePromotionCode({
       id: 'promo_applies',
       coupon: {
         amount_off: 2000,
         currency: 'usd',
         duration: 'forever',
         applies_to: { products: ['prod_pro'] },
       },
     }),
     PRO_YEARLY_PRICE,
   ),
   true,
  );
  assert.equal(
   promotionCodeAppliesToPrice(
     makePromotionCode({
       id: 'promo_wrong_product',
       coupon: {
         percent_off: 100,
         duration: 'forever',
         applies_to: { products: ['prod_basic'] },
       },
     }),
     PRO_YEARLY_PRICE,
   ),
   false,
  );
  assert.equal(
   promotionCodeAppliesToPrice(
     makePromotionCode({
       id: 'promo_wrong_currency',
       coupon: { amount_off: 2000, currency: 'cad', duration: 'forever' },
     }),
     PRO_YEARLY_PRICE,
   ),
   false,
  );
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
    limit: 100,
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

test('promotion code lookup ignores other customers and prefers the matching customer', async () => {
  const restrictedOther = makePromotionCode({
    id: 'promo_other',
    customerId: 'cus_other',
    code: 'LAUNCH100',
  });
  const unrestricted = makePromotionCode({
    id: 'promo_public',
    customerId: null,
    code: 'LAUNCH100',
  });
  const restrictedMatch = makePromotionCode({
    id: 'promo_match',
    customerId: 'cus_match',
    code: 'LAUNCH100',
  });
  const stripe = {
    promotionCodes: {
      list: async () => ({ data: [restrictedOther, unrestricted, restrictedMatch] }),
    },
  } as unknown as Parameters<typeof findActivePromotionCode>[0];

  assert.equal((await findActivePromotionCode(stripe, 'LAUNCH100', 'cus_match'))?.id, 'promo_match');
  assert.equal((await findActivePromotionCode(stripe, 'LAUNCH100', 'cus_new'))?.id, 'promo_public');
  assert.equal((await findActivePromotionCode(stripe, 'LAUNCH100'))?.id, 'promo_public');
});
