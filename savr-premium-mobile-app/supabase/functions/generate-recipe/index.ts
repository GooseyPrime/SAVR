/**
 * SAVR Recipe Generation Edge Function
 * Generates recipes based on available inventory using OpenRouter
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecipeRequest {
  mode: 'human' | 'dog' | 'cat';
  ingredients?: string[];
  preferences?: {
    diets?: string[];
    allergies?: string[];
    cuisinePreferences?: string[];
    maxTime?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  prompt?: string;
}

interface GeneratedRecipe {
  title: string;
  description: string;
  ingredients: { name: string; amount: string; unit: string; optional?: boolean }[];
  instructions: { step: number; text: string; time?: number; tip?: string }[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine: string;
  dietaryTags: string[];
  nutritionalInfo?: {
    calories?: number;
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  tips: string[];
  safetyNotes?: string[];
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

    const body: RecipeRequest = await req.json();
    const { mode = 'human', ingredients = [], preferences = {}, prompt } = body;

    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's inventory if no ingredients provided
    let availableIngredients = ingredients;
    if (availableIngredients.length === 0) {
      const { data: inventory } = await supabase
        .from('inventory')
        .select('name, quantity, unit')
        .eq('user_id', user.id);
      
      availableIngredients = (inventory || []).map(i => 
        i.quantity ? `${i.quantity} ${i.unit || ''} ${i.name}`.trim() : i.name
      );
    }

    // Build system prompt based on mode
    let systemPrompt = '';
    if (mode === 'human') {
      systemPrompt = `You are SAVR's expert chef AI. Create delicious, practical recipes for humans.
Consider dietary restrictions, allergies, and preferences carefully.
Provide detailed instructions that home cooks can follow.
Return valid JSON only.`;
    } else if (mode === 'dog') {
      systemPrompt = `You are SAVR's pet nutrition expert specializing in DOG food.
CRITICAL SAFETY: NEVER include toxic ingredients for dogs:
- Chocolate, caffeine, alcohol
- Grapes, raisins, currants
- Onions, garlic, chives, leeks
- Xylitol (artificial sweetener)
- Macadamia nuts
- Avocado
- Raw yeast dough
- Cooked bones (splintering hazard)

Focus on dog-safe proteins, vegetables, and grains.
Always include safety notes about portion sizes based on dog weight.
Return valid JSON only.`;
    } else if (mode === 'cat') {
      systemPrompt = `You are SAVR's pet nutrition expert specializing in CAT food.
CRITICAL SAFETY: NEVER include toxic ingredients for cats:
- Onions, garlic, chives
- Chocolate, caffeine
- Alcohol
- Grapes, raisins
- Raw eggs, raw meat (bacteria risk)
- Dog food (lacks taurine)
- Milk/dairy (most cats are lactose intolerant)
- Xylitol

Cats are obligate carnivores - focus on high-protein recipes.
Always include safety notes about portion sizes.
Return valid JSON only.`;
    }

    const userMessage = prompt || `Create a recipe using some of these available ingredients:
${availableIngredients.join(', ')}

Preferences:
- Diets: ${preferences.diets?.join(', ') || 'none specified'}
- Allergies to avoid: ${preferences.allergies?.join(', ') || 'none'}
- Cuisine preferences: ${preferences.cuisinePreferences?.join(', ') || 'any'}
- Max cooking time: ${preferences.maxTime || 'no limit'} minutes
- Difficulty: ${preferences.difficulty || 'any'}

Return a complete recipe in JSON format with: title, description, ingredients (array with name, amount, unit, optional), instructions (array with step, text, time, tip), prepTime, cookTime, servings, difficulty, cuisine, dietaryTags, nutritionalInfo, tips, and safetyNotes if applicable.`;

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
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate recipe' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let recipe: GeneratedRecipe;
    try {
      const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/) || [null, content];
      recipe = JSON.parse(jsonMatch[1].trim());
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse recipe response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ recipe, mode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-recipe:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
