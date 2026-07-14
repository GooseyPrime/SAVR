import { NextRequest, NextResponse } from 'next/server';
import { getMealPlanQuotaRule } from '@/lib/ai-rate-limit';
import { authenticateRequest, enforceAiUsageLimit, getUserBillingSnapshot } from '@/lib/middleware';
import { generateMealPlan } from '@/lib/services/ai';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;
  
  const { user, supabase } = auth;
  const body = await request.json();
  const days = Number(body.days);
  const preferences = body.preferences;
  const inventory = Array.isArray(body.inventory)
    ? body.inventory
    : Array.isArray(body.ingredients)
      ? body.ingredients
      : [];
  
  if (!days || days < 1 || days > 30) {
    return NextResponse.json({ error: 'Days must be between 1 and 30' }, { status: 400 });
  }
  
  try {
    const billing = await getUserBillingSnapshot(user.id);
    const quotaRule = getMealPlanQuotaRule(billing);

    if (quotaRule) {
      const rateCheck = await enforceAiUsageLimit(user.id, quotaRule);
      if (!rateCheck.allowed) {
        return rateCheck.error;
      }
    }

    const mealPlan = await generateMealPlan(days, preferences, inventory);
    
    // Calculate date range
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + (days - 1) * MS_PER_DAY).toISOString().slice(0, 10);
    
    // Save to database
    const { data, error } = await supabase
      .from('meal_plans')
      .insert({
        user_id: user.id,
        title: mealPlan.name || `${days}-Day Meal Plan`,
        start_date: startDate,
        end_date: endDate,
        meals: mealPlan.meals,
        dietary_preferences: preferences?.dietary ?? [],
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, mealPlanId: data.id, mealPlan: data });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    return NextResponse.json({ error: 'Failed to create meal plan' }, { status: 500 });
  }
}
