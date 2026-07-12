/**
 * SAVR Meal Planning AI Edge Function
 * Generates weekly meal plans based on inventory, preferences, and dietary needs
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MealPlanRequest {
  mode: 'human' | 'dog' | 'cat';
  daysToGenerate?: number;
  preferences?: {
    diets?: string[];
    allergies?: string[];
    cuisinePreferences?: string[];
    mealTypes?: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
    budgetLevel?: 'budget' | 'moderate' | 'premium';
    cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
  };
  existingMealPlan?: Record<string, unknown>;
}

interface PlannedMeal {
  title: string;
  description: string;
  prepTime: number;
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  ingredients: string[];
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

interface DayPlan {
  date: string;
  meals: {
    breakfast?: PlannedMeal;
    lunch?: PlannedMeal;
    dinner?: PlannedMeal;
    snack?: PlannedMeal;
  };
  groceryNeeds: string[];
}

interface MealPlanResponse {
  days: DayPlan[];
  shoppingList: { item: string; quantity: string; category: string }[];
  estimatedCost?: string;
  nutritionSummary?: string;
  tips: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: MealPlanRequest = await req.json();
    const { mode = 'human', daysToGenerate = 7, preferences = {} } = body;

    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's inventory for context
    const { data: inventory } = await supabase
      .from('inventory')
      .select('name, quantity, unit, expiry_date')
      .eq('user_id', user.id);

    const inventoryContext = (inventory || []).map(i => {
      let item = i.name;
      if (i.quantity) item = `${i.quantity} ${i.unit || ''} ${item}`.trim();
      if (i.expiry_date) {
        const expiry = new Date(i.expiry_date);
        const today = new Date();
        const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 3) item += ' (USE SOON!)';
        else if (daysUntil <= 7) item += ' (expires this week)';
      }
      return item;
    });

    // Build system prompt based on mode
    let systemPrompt = '';
    if (mode === 'human') {
      systemPrompt = `You are SAVR's meal planning expert. Create practical, balanced ${daysToGenerate}-day meal plans.

Consider:
- Ingredient reuse across meals to minimize waste
- Variety in cuisines and cooking methods
- Batch cooking opportunities
- Realistic prep times for busy schedules
- Seasonal availability

Always prioritize using items that expire soon. Return valid JSON only.`;
    } else if (mode === 'dog') {
      systemPrompt = `You are SAVR's canine nutrition expert. Create safe, balanced ${daysToGenerate}-day meal plans for dogs.

CRITICAL SAFETY - NEVER include:
- Chocolate, caffeine, alcohol, xylitol
- Grapes, raisins, onions, garlic
- Macadamia nuts, avocado, cooked bones

Focus on: Lean proteins, dog-safe vegetables, appropriate portions based on dog size.
Include safety notes about portion sizes. Return valid JSON only.`;
    } else if (mode === 'cat') {
      systemPrompt = `You are SAVR's feline nutrition expert. Create safe, balanced ${daysToGenerate}-day meal plans for cats.

CRITICAL SAFETY - NEVER include:
- Onions, garlic, chocolate, caffeine
- Grapes, raisins, alcohol, xylitol
- Most dairy (lactose intolerance), raw eggs

Cats are OBLIGATE CARNIVORES - focus on high-protein meals.
Include taurine-rich options. Return valid JSON only.`;
    }

    const mealTypes = preferences.mealTypes || ['breakfast', 'lunch', 'dinner'];
    
    const userMessage = `Create a ${daysToGenerate}-day meal plan.

Current Pantry (prioritize items expiring soon):
${inventoryContext.length > 0 ? inventoryContext.join('\n') : 'No inventory data available'}

Preferences:
- Dietary restrictions: ${preferences.diets?.join(', ') || 'none'}
- Allergies: ${preferences.allergies?.join(', ') || 'none'}
- Cuisine preferences: ${preferences.cuisinePreferences?.join(', ') || 'any'}
- Meals to plan: ${mealTypes.join(', ')}
- Budget: ${preferences.budgetLevel || 'moderate'}
- Cooking skill: ${preferences.cookingSkill || 'intermediate'}

Return JSON with:
- days: array of {date (YYYY-MM-DD starting tomorrow), meals: {breakfast?, lunch?, dinner?, snack?}, groceryNeeds}
- Each meal: {title, description, prepTime, cookTime, difficulty, ingredients, mealType}
- shoppingList: [{item, quantity, category}] for items not in pantry
- estimatedCost: weekly estimate
- nutritionSummary: brief overview
- tips: array of meal prep and storage tips`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || 'https://savr.app',
        'X-Title': 'SAVR Food Assistant',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate meal plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let mealPlan: MealPlanResponse;
    try {
      const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/) || [null, content];
      mealPlan = JSON.parse(jsonMatch[1].trim());
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse meal plan response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ mealPlan, mode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meal-plan:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
