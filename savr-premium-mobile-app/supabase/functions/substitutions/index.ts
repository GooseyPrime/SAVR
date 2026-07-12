/**
 * SAVR Ingredient Substitutions Edge Function
 * Suggests ingredient substitutions based on what's available in pantry
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubstitutionRequest {
  ingredient: string;
  amount?: string;
  unit?: string;
  recipeContext?: string;
  mode?: 'human' | 'dog' | 'cat';
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

    const body: SubstitutionRequest = await req.json();
    const { ingredient, amount, unit, recipeContext, mode = 'human' } = body;

    if (!ingredient) {
      return new Response(
        JSON.stringify({ error: 'Ingredient is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's inventory to suggest available substitutes
    const { data: inventory } = await supabase
      .from('inventory')
      .select('name, quantity, unit')
      .eq('user_id', user.id);

    const pantryItems = (inventory || []).map(i => i.name).join(', ');

    let systemPrompt = '';
    if (mode === 'human') {
      systemPrompt = `You are SAVR's culinary substitution expert. Suggest practical ingredient substitutions.

Consider:
- Flavor profile similarity
- Texture requirements  
- Cooking behavior (binding, leavening, etc.)
- Dietary restrictions
- What's available in the user's pantry

Provide multiple options ranked by effectiveness. Return valid JSON.`;
    } else if (mode === 'dog') {
      systemPrompt = `You are SAVR's canine nutrition expert. Suggest SAFE ingredient substitutions for dog food.

CRITICAL: Never suggest toxic ingredients (chocolate, onions, grapes, xylitol, etc.)

Focus on dog-safe alternatives that maintain nutritional value. Return valid JSON.`;
    } else if (mode === 'cat') {
      systemPrompt = `You are SAVR's feline nutrition expert. Suggest SAFE ingredient substitutions for cat food.

CRITICAL: Cats are obligate carnivores. Never suggest toxic ingredients.

Focus on high-protein, cat-safe alternatives. Return valid JSON.`;
    }

    const userMessage = `I need a substitute for: ${amount ? `${amount} ${unit || ''} ` : ''}${ingredient}
${recipeContext ? `\nRecipe context: ${recipeContext}` : ''}
${pantryItems ? `\nAvailable in my pantry: ${pantryItems}` : ''}

Return JSON with:
- substitutions: array of {
    substitute: string,
    amount: string,
    ratio: string (e.g., "1:1"),
    notes: string (how it affects the dish),
    inPantry: boolean,
    effectiveness: "excellent" | "good" | "acceptable"
  }
- tips: array of substitution tips
- warnings: array of things to be aware of`;

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
        max_tokens: 1500,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to find substitutions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1].trim());
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse substitution suggestions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ...result, mode, originalIngredient: ingredient }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in substitutions:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
