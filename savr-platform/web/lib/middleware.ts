import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasBasicAccess, hasProAccess } from './billing';
import { getBurstLimitRule, type AiBillingSnapshot, type AiUsageLimitRule } from './ai-rate-limit';
import { getSupabaseAdmin } from './supabase';

export async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  
  return { user, supabase };
}

export async function getUserBillingSnapshot(userId: string): Promise<AiBillingSnapshot | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user billing snapshot: ${error.message}`);
  }

  return data;
}

export async function checkRateLimit(userId: string, endpoint: string, limit: number, windowMs: number) {
  return await enforceAiUsageLimit(
    userId,
    getBurstLimitRule(
      endpoint,
      limit,
      windowMs,
      'Rate limit exceeded. Please wait and try again.'
    )
  );
}

export async function enforceAiUsageLimit(userId: string, rule: AiUsageLimitRule) {
  if (rule.windowMs < 1000) {
    throw new Error('AI usage windows must be at least 1000ms');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const windowSeconds = Math.max(1, Math.ceil(rule.windowMs / 1000));
  const resetAt = new Date(rule.windowStart.getTime() + rule.windowMs).toISOString();
  const { data, error } = await supabaseAdmin.rpc('consume_ai_usage_limit', {
    p_user_id: userId,
    p_feature: rule.feature,
    p_window_start: rule.windowStart.toISOString(),
    p_window_seconds: windowSeconds,
    p_limit: rule.limit,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  const allowed = Boolean(result?.allowed);
  const remaining = Number(result?.remaining ?? 0);
  const requestCount = Number(result?.request_count ?? rule.limit);

  if (allowed) {
    return {
      allowed,
      remaining,
      requestCount,
      resetAt: result?.reset_at ?? resetAt,
    };
  }

  return {
    allowed: false,
    remaining,
    requestCount,
    resetAt: result?.reset_at ?? resetAt,
    error: NextResponse.json(
      {
        error: rule.message,
        code: rule.code,
        feature: rule.feature,
        limit: rule.limit,
        remaining,
        resetAt: result?.reset_at ?? resetAt,
      },
      { status: 429 }
    ),
  };
}

export async function checkSubscriptionTier(userId: string, requiredTier: 'basic' | 'pro') {
  const user = await getUserBillingSnapshot(userId);

  if (!user) return false;

  if (requiredTier === 'pro') {
    return hasProAccess(user);
  }

  return hasBasicAccess(user);
}
