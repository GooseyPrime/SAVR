import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aiIngredientsToExtracted,
  normalizeAiIngredients,
  normalizeQuantity,
  normalizeUnit,
} from '../lib/utils/units';
import { filterIngredientsForPet, PET_RECIPE_DISCLAIMER } from '../lib/config/forbiddenFoods';
import {
  isKnownTier,
  isSubscriptionActive,
  hasBasicAccess,
  hasProAccess,
  resolveTierFromPriceId,
} from '../lib/billing';
import {
  AI_RATE_LIMIT_EXCEEDED_CODE,
  AI_USAGE_EXHAUSTED_CODE,
  getBurstLimitRule,
  getMealPlanQuotaRule,
  getRecipeQuotaRule,
  getUtcMonthWindow,
} from '../lib/ai-rate-limit';
import { getSafeRelativeRedirect } from '../lib/utils/authRedirect';

test('normalizeUnit maps known aliases and preserves unknown values', () => {
  assert.equal(normalizeUnit(' Cups '), 'cup');
  assert.equal(normalizeUnit('pcs'), 'piece');
  assert.equal(normalizeUnit('pinch'), 'pinch');
  assert.equal(normalizeUnit('   '), '');
});

test('normalizeQuantity handles approximate text, ranges, and fallbacks', () => {
  assert.deepEqual(normalizeQuantity('about 2'), { quantity: 2 });
  assert.deepEqual(normalizeQuantity('1 to 3'), { quantity: 2, approximate: true });
  assert.deepEqual(normalizeQuantity(undefined), { quantity: 1, approximate: true });
  assert.deepEqual(normalizeQuantity('handful'), { quantity: 1, approximate: true });
});

test('normalizeAiIngredients validates inputs and keeps production-safe defaults', () => {
  assert.deepEqual(normalizeAiIngredients([
    { name: 'Carrots', quantity: '1-2', unit: 'cups' },
    { name: 'Olive oil' },
  ]), [
    {
      name: 'Carrots',
      quantity: 1.5,
      unit: 'cup',
      approximate: true,
      confidence: undefined,
    },
    {
      name: 'Olive oil',
      quantity: 1,
      unit: 'piece',
      approximate: undefined,
      confidence: undefined,
    },
  ]);

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.throws(
      () => normalizeAiIngredients([{ quantity: 1 }]),
      /Ingredient name is required/
    );
  } finally {
    console.warn = originalWarn;
  }
});

test('aiIngredientsToExtracted assigns the production default confidence', () => {
  assert.deepEqual(aiIngredientsToExtracted([
    { name: 'Rice', quantity: 2, unit: 'cup', confidence: undefined, approximate: false },
  ]), [
    { name: 'Rice', quantity: 2, unit: 'cup', confidence: 0.5 },
  ]);
});

test('filterIngredientsForPet removes toxic ingredients for each species', () => {
  assert.deepEqual(filterIngredientsForPet(
    ['Chicken breast', 'dark chocolate chips', 'Blueberries'],
    'dog'
  ), {
    safe: ['Chicken breast', 'Blueberries'],
    removed: ['dark chocolate chips'],
  });

  assert.deepEqual(filterIngredientsForPet(
    ['Salmon', 'Garlic powder', 'Pumpkin'],
    'cat'
  ), {
    safe: ['Salmon', 'Pumpkin'],
    removed: ['Garlic powder'],
  });

  assert.match(PET_RECIPE_DISCLAIMER, /consult your veterinarian/i);
});

// ──────────────────────────────────────────
// Billing helpers (ADR-001)
// ──────────────────────────────────────────

test('isKnownTier accepts canonical tier values', () => {
  assert.equal(isKnownTier('basic'), true);
  assert.equal(isKnownTier('pro'), true);
});

test('isKnownTier rejects legacy and unknown tier values', () => {
  assert.equal(isKnownTier('free'), false);
  assert.equal(isKnownTier('plus'), false);
  assert.equal(isKnownTier('premium'), false);
  assert.equal(isKnownTier(undefined), false);
  assert.equal(isKnownTier(null), false);
  assert.equal(isKnownTier(''), false);
  assert.equal(isKnownTier('legacy'), false);
});

test('isSubscriptionActive returns true only for active and trialing', () => {
  assert.equal(isSubscriptionActive('active'), true);
  assert.equal(isSubscriptionActive('trialing'), true);
  assert.equal(isSubscriptionActive('pending'), false);
  assert.equal(isSubscriptionActive('canceled'), false);
  assert.equal(isSubscriptionActive('past_due'), false);
  assert.equal(isSubscriptionActive('incomplete'), false);
  assert.equal(isSubscriptionActive('incomplete_expired'), false);
  assert.equal(isSubscriptionActive('unpaid'), false);
  assert.equal(isSubscriptionActive(null), false);
  assert.equal(isSubscriptionActive(undefined), false);
});

test('hasBasicAccess: Basic active', () => {
  assert.equal(hasBasicAccess({ subscription_tier: 'basic', subscription_status: 'active' }), true);
});

test('hasBasicAccess: Basic trialing', () => {
  assert.equal(hasBasicAccess({ subscription_tier: 'basic', subscription_status: 'trialing' }), true);
});

test('hasBasicAccess: Pro active (superset)', () => {
  assert.equal(hasBasicAccess({ subscription_tier: 'pro', subscription_status: 'active' }), true);
});

test('hasBasicAccess: Basic pending — no access', () => {
  assert.equal(hasBasicAccess({ subscription_tier: 'basic', subscription_status: 'pending' }), false);
});

test('hasBasicAccess: Basic canceled — no access', () => {
  assert.equal(hasBasicAccess({ subscription_tier: 'basic', subscription_status: 'canceled' }), false);
});

test('hasBasicAccess: null — no access', () => {
  assert.equal(hasBasicAccess(null), false);
  assert.equal(hasBasicAccess(undefined), false);
});

test('hasBasicAccess: legacy tier values grant no access', () => {
  assert.equal(hasBasicAccess({ subscription_tier: 'free', subscription_status: 'active' }), false);
  assert.equal(hasBasicAccess({ subscription_tier: 'plus', subscription_status: 'active' }), false);
  assert.equal(hasBasicAccess({ subscription_tier: 'premium', subscription_status: 'active' }), false);
});

test('hasProAccess: Pro active', () => {
  assert.equal(hasProAccess({ subscription_tier: 'pro', subscription_status: 'active' }), true);
});

test('hasProAccess: Pro trialing', () => {
  assert.equal(hasProAccess({ subscription_tier: 'pro', subscription_status: 'trialing' }), true);
});

test('hasProAccess: Basic active — no Pro access', () => {
  assert.equal(hasProAccess({ subscription_tier: 'basic', subscription_status: 'active' }), false);
});

test('hasProAccess: Pro past_due — no access', () => {
  assert.equal(hasProAccess({ subscription_tier: 'pro', subscription_status: 'past_due' }), false);
});

test('hasProAccess: null — no access', () => {
  assert.equal(hasProAccess(null), false);
  assert.equal(hasProAccess(undefined), false);
});

test('hasProAccess: legacy tier values grant no Pro access', () => {
  assert.equal(hasProAccess({ subscription_tier: 'premium', subscription_status: 'active' }), false);
  assert.equal(hasProAccess({ subscription_tier: 'plus', subscription_status: 'active' }), false);
});

// Stripe price ID to tier resolution
test('resolveTierFromPriceId maps configured price IDs correctly', () => {
  process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly_test';
  process.env.STRIPE_PRICE_BASIC_YEARLY  = 'price_basic_yearly_test';
  process.env.STRIPE_PRICE_PRO_MONTHLY   = 'price_pro_monthly_test';
  process.env.STRIPE_PRICE_PRO_YEARLY    = 'price_pro_yearly_test';

  assert.equal(resolveTierFromPriceId('price_basic_monthly_test'), 'basic');
  assert.equal(resolveTierFromPriceId('price_basic_yearly_test'),  'basic');
  assert.equal(resolveTierFromPriceId('price_pro_monthly_test'),   'pro');
  assert.equal(resolveTierFromPriceId('price_pro_yearly_test'),    'pro');
});

test('resolveTierFromPriceId maps legacy STRIPE_PRICE_ID_* values', () => {
  delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
  delete process.env.STRIPE_PRICE_BASIC_YEARLY;
  delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  delete process.env.STRIPE_PRICE_PRO_YEARLY;
  process.env.STRIPE_PRICE_ID_BASIC_MONTHLY = 'price_basic_monthly_legacy';
  process.env.STRIPE_PRICE_ID_BASIC_YEARLY  = 'price_basic_yearly_legacy';
  process.env.STRIPE_PRICE_ID_PRO_MONTHLY   = 'price_pro_monthly_legacy';
  process.env.STRIPE_PRICE_ID_PRO_YEARLY    = 'price_pro_yearly_legacy';

  assert.equal(resolveTierFromPriceId('price_basic_monthly_legacy'), 'basic');
  assert.equal(resolveTierFromPriceId('price_basic_yearly_legacy'),  'basic');
  assert.equal(resolveTierFromPriceId('price_pro_monthly_legacy'),   'pro');
  assert.equal(resolveTierFromPriceId('price_pro_yearly_legacy'),    'pro');
});

test('resolveTierFromPriceId throws on unknown price ID', () => {
  process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly_test';
  process.env.STRIPE_PRICE_BASIC_YEARLY  = 'price_basic_yearly_test';
  process.env.STRIPE_PRICE_PRO_MONTHLY   = 'price_pro_monthly_test';
  process.env.STRIPE_PRICE_PRO_YEARLY    = 'price_pro_yearly_test';

  assert.throws(
    () => resolveTierFromPriceId('price_unknown_xyz'),
    /Unknown Stripe price ID/
  );
});

test('resolveTierFromPriceId throws when env vars are missing', () => {
  delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
  delete process.env.STRIPE_PRICE_BASIC_YEARLY;
  delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  delete process.env.STRIPE_PRICE_PRO_YEARLY;
  delete process.env.STRIPE_PRICE_ID_BASIC_MONTHLY;
  delete process.env.STRIPE_PRICE_ID_BASIC_YEARLY;
  delete process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
  delete process.env.STRIPE_PRICE_ID_PRO_YEARLY;

  assert.throws(
    () => resolveTierFromPriceId('price_basic_monthly_test'),
    /environment variables are not configured/
  );

  // Restore for subsequent tests
  process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly_test';
  process.env.STRIPE_PRICE_BASIC_YEARLY  = 'price_basic_yearly_test';
  process.env.STRIPE_PRICE_PRO_MONTHLY   = 'price_pro_monthly_test';
  process.env.STRIPE_PRICE_PRO_YEARLY    = 'price_pro_yearly_test';
});

// ──────────────────────────────────────────
// AI usage limits (corrective PR 5)
// ──────────────────────────────────────────

test('getUtcMonthWindow returns a UTC month-aligned window', () => {
  const { windowStart, nextWindowStart, windowMs } = getUtcMonthWindow(
    new Date('2026-07-14T16:14:36.558Z')
  );

  assert.equal(windowStart.toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(nextWindowStart.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(windowMs, 31 * 24 * 60 * 60 * 1000);
});

test('getRecipeQuotaRule skips limits for active Pro users', () => {
  assert.equal(
    getRecipeQuotaRule({ subscription_tier: 'pro', subscription_status: 'active' }, 'human'),
    null
  );
});

test('getRecipeQuotaRule returns the Basic human monthly recipe quota', () => {
  const rule = getRecipeQuotaRule(
    { subscription_tier: 'basic', subscription_status: 'active' },
    'human',
    new Date('2026-07-14T16:14:36.558Z')
  );

  assert.ok(rule);
  assert.equal(rule.feature, 'create-recipe');
  assert.equal(rule.limit, 10);
  assert.equal(rule.code, AI_USAGE_EXHAUSTED_CODE);
  assert.match(rule.message, /unlimited recipes/i);
  assert.equal(rule.windowStart.toISOString(), '2026-07-01T00:00:00.000Z');
});

test('getRecipeQuotaRule returns the Basic pet monthly recipe quota', () => {
  const rule = getRecipeQuotaRule(
    { subscription_tier: 'basic', subscription_status: 'trialing' },
    'pet',
    new Date('2026-07-14T16:14:36.558Z')
  );

  assert.ok(rule);
  assert.equal(rule.feature, 'create-pet-recipe');
  assert.equal(rule.limit, 5);
  assert.equal(rule.code, AI_USAGE_EXHAUSTED_CODE);
  assert.match(rule.message, /pet recipes/i);
});

test('getMealPlanQuotaRule returns the Basic monthly meal plan quota', () => {
  const rule = getMealPlanQuotaRule(
    { subscription_tier: 'basic', subscription_status: 'active' },
    new Date('2026-07-14T16:14:36.558Z')
  );

  assert.ok(rule);
  assert.equal(rule.feature, 'create-meal-plan');
  assert.equal(rule.limit, 2);
  assert.equal(rule.code, AI_USAGE_EXHAUSTED_CODE);
  assert.match(rule.message, /unlimited meal plans/i);
});

test('getBurstLimitRule aligns rate-limit buckets to the requested window', () => {
  const rule = getBurstLimitRule(
    'analyze-image',
    100,
    60_000,
    'Rate limit exceeded. Please wait and try again.',
    new Date('2026-07-14T16:14:36.558Z')
  );

  assert.equal(rule.feature, 'analyze-image');
  assert.equal(rule.limit, 100);
  assert.equal(rule.code, AI_RATE_LIMIT_EXCEEDED_CODE);
  assert.equal(rule.windowStart.toISOString(), '2026-07-14T16:14:00.000Z');
});

test('getSafeRelativeRedirect prefers redirect and accepts safe app-relative paths', () => {
  assert.equal(getSafeRelativeRedirect('/chat', '/pricing'), '/chat');
  assert.equal(getSafeRelativeRedirect('/pricing?from=trial', null), '/pricing?from=trial');
});

test('getSafeRelativeRedirect falls back to next and rejects unsafe values', () => {
  assert.equal(getSafeRelativeRedirect(null, '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('https://example.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('//evil.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('/\\evil.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('/%2F%2Fevil.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('/%252F%252Fevil.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('/%5Cevil.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('chat', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('javascript:alert(1)', null), null);
  // Whitespace-character bypass: tab/CR/LF are stripped by browsers before navigation,
  // so /%09/evil.com decodes to /\t/evil.com which parses as //evil.com.
  assert.equal(getSafeRelativeRedirect('/%09/evil.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('/%0D%0A/evil.com', '/dashboard'), '/dashboard');
  assert.equal(getSafeRelativeRedirect('/path\t/../evil.com', '/dashboard'), '/dashboard');
  // Doubly-encoded whitespace: %2509 → %09 → \t — must be caught on second decode pass.
  assert.equal(getSafeRelativeRedirect('/%2509/evil.com', '/dashboard'), '/dashboard');
});
