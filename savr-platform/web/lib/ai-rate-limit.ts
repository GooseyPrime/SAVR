import { hasProAccess } from './billing';

export type AiRecipeType = 'human' | 'pet';

export interface AiBillingSnapshot {
  subscription_tier?: string | null;
  subscription_status?: string | null;
}

export interface AiUsageLimitRule {
  feature: string;
  limit: number;
  windowStart: Date;
  windowMs: number;
  code: string;
  message: string;
}

export const AI_USAGE_EXHAUSTED_CODE = 'resource-exhausted';
export const AI_RATE_LIMIT_EXCEEDED_CODE = 'rate-limit-exceeded';

export function getUtcMonthWindow(now: Date = new Date()) {
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextWindowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    windowStart,
    nextWindowStart,
    windowMs: nextWindowStart.getTime() - windowStart.getTime(),
  };
}

export function getFixedWindow(now: Date, windowMs: number) {
  const bucketStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(bucketStartMs);
  const nextWindowStart = new Date(bucketStartMs + windowMs);

  return {
    windowStart,
    nextWindowStart,
    windowMs,
  };
}

export function getRecipeQuotaRule(
  billing: AiBillingSnapshot | null | undefined,
  recipeType: AiRecipeType,
  now: Date = new Date()
): AiUsageLimitRule | null {
  if (hasProAccess(billing)) {
    return null;
  }

  const { windowStart, windowMs } = getUtcMonthWindow(now);

  if (recipeType === 'pet') {
    return {
      feature: 'create-pet-recipe',
      limit: 5,
      windowStart,
      windowMs,
      code: AI_USAGE_EXHAUSTED_CODE,
      message: 'Monthly pet recipe limit reached. Upgrade to Pro for unlimited pet recipes.',
    };
  }

  return {
    feature: 'create-recipe',
    limit: 10,
    windowStart,
    windowMs,
    code: AI_USAGE_EXHAUSTED_CODE,
    message: 'Monthly recipe limit reached. Upgrade to Pro for unlimited recipes.',
  };
}

export function getMealPlanQuotaRule(
  billing: AiBillingSnapshot | null | undefined,
  now: Date = new Date()
): AiUsageLimitRule | null {
  if (hasProAccess(billing)) {
    return null;
  }

  const { windowStart, windowMs } = getUtcMonthWindow(now);

  return {
    feature: 'create-meal-plan',
    limit: 2,
    windowStart,
    windowMs,
    code: AI_USAGE_EXHAUSTED_CODE,
    message: 'Monthly meal plan limit reached. Upgrade to Pro for unlimited meal plans.',
  };
}

export function getBurstLimitRule(
  feature: string,
  limit: number,
  windowMs: number,
  message: string,
  now: Date = new Date()
): AiUsageLimitRule {
  const { windowStart } = getFixedWindow(now, windowMs);

  return {
    feature,
    limit,
    windowStart,
    windowMs,
    code: AI_RATE_LIMIT_EXCEEDED_CODE,
    message,
  };
}
