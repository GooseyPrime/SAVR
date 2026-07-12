/**
 * SAVR Chat Edge Function
 * Conversational AI assistant for cooking help, meal planning, and food questions
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  message: string;
  sessionId?: string;
  mode?: 'human' | 'dog' | 'cat';
  context?: {
    inventory?: string[];
    currentRecipe?: string;
  };
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

    const body: ChatRequest = await req.json();
    const { message, sessionId, mode = 'human', context } = body;

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
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

    // Build conversation history
    const messages: ChatMessage[] = [];

    // System prompt based on mode
    let systemContent = `You are SAVR, a friendly and knowledgeable AI cooking assistant. `;
    
    if (mode === 'human') {
      systemContent += `Help users with:
- Recipe suggestions and cooking tips
- Meal planning and prep strategies
- Ingredient substitutions
- Nutritional information
- Food storage and safety
- Kitchen techniques

Be conversational, helpful, and encouraging. If asked about pet food, remind users to switch to pet mode for safety-verified recipes.`;
    } else if (mode === 'dog') {
      systemContent += `You are in DOG MODE. Help users prepare safe, nutritious food for their dogs.

CRITICAL: Always verify ingredient safety. TOXIC to dogs:
- Chocolate, caffeine, alcohol, xylitol
- Grapes, raisins, onions, garlic
- Macadamia nuts, avocado

Provide portion guidance based on dog size. Recommend consulting a vet for specific dietary needs.`;
    } else if (mode === 'cat') {
      systemContent += `You are in CAT MODE. Help users prepare safe, nutritious food for their cats.

CRITICAL: Cats are obligate carnivores. TOXIC to cats:
- Onions, garlic, chocolate, caffeine
- Grapes, raisins, alcohol
- Most dairy (lactose intolerance)

Focus on high-protein options. Recommend consulting a vet for specific dietary needs.`;
    }

    // Add context about user's inventory if available
    if (context?.inventory?.length) {
      systemContent += `\n\nUser's current pantry includes: ${context.inventory.join(', ')}`;
    }
    if (context?.currentRecipe) {
      systemContent += `\n\nUser is currently viewing recipe: ${context.currentRecipe}`;
    }

    messages.push({ role: 'system', content: systemContent });

    // Fetch recent chat history for context
    if (sessionId) {
      const { data: history } = await supabase
        .from('chat_history')
        .select('role, content')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(10);

      if (history?.length) {
        history.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content });
          }
        });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

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
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || '';

    // Store messages in chat history
    const currentSessionId = sessionId || crypto.randomUUID();
    
    await supabase.from('chat_history').insert([
      { user_id: user.id, session_id: currentSessionId, role: 'user', content: message },
      { user_id: user.id, session_id: currentSessionId, role: 'assistant', content: assistantMessage }
    ]);

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        sessionId: currentSessionId,
        mode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
