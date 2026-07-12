/**
 * SAVR Nutrition Analysis Edge Function
 * Analyzes nutritional content and provides health insights
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NutritionRequest {
  foods: { name: string; amount: string; unit?: string }[];
  mode?: 'human' | 'dog' | 'cat';
  analysisType?: 'single_meal' | 'daily' | 'weekly';
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

    const body: NutritionRequest = await req.json();
    const { foods, mode = 'human', analysisType = 'single_meal' } = body;

    if (!foods || foods.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Foods list is required' }),
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

    // Build system prompt based on mode
    let systemPrompt = '';
    if (mode === 'human') {
      systemPrompt = `You are SAVR's nutrition expert. Analyze the nutritional content of foods and provide health insights.

Provide:
- Estimated macronutrients (calories, protein, carbs, fat)
- Key micronutrients
- Health benefits and concerns
- Suggestions for balanced nutrition

Base estimates on standard portion sizes. Be accurate but note these are estimates. Return valid JSON.`;
    } else if (mode === 'dog') {
      systemPrompt = `You are SAVR's canine nutrition expert. Analyze foods for dog safety and nutrition.

CRITICAL: Flag any toxic ingredients (chocolate, grapes, onions, xylitol, etc.)

Provide:
- Safety assessment
- Appropriate portion based on dog size
- Nutritional benefits for dogs
- Any cautions

Return valid JSON with safetyRating (safe/caution/toxic).`;
    } else if (mode === 'cat') {
      systemPrompt = `You are SAVR's feline nutrition expert. Analyze foods for cat safety and nutrition.

CRITICAL: Cats are obligate carnivores. Flag toxic ingredients and unsuitable foods.

Provide:
- Safety assessment  
- Taurine content consideration
- Appropriate portion guidance
- Nutritional benefits for cats

Return valid JSON with safetyRating (safe/caution/toxic).`;
    }

    const foodsList = foods.map(f => `${f.amount} ${f.unit || ''} ${f.name}`.trim()).join('\n');

    const userMessage = `Analyze the nutritional content of these foods (${analysisType}):

${foodsList}

Return JSON with:
- totalNutrition: {calories, protein, carbs, fat, fiber}
- items: [{name, calories, protein, carbs, fat, benefits, concerns}]
- insights: array of health insights
- recommendations: array of suggestions
${mode !== 'human' ? '- safetyAssessment: {rating, warnings, safeItems, unsafeItems}' : ''}`;

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
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze nutrition' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let analysis;
    try {
      const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/) || [null, content];
      analysis = JSON.parse(jsonMatch[1].trim());
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse nutrition analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ analysis, mode }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in nutrition-analysis:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
