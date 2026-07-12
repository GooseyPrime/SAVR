/**
 * SAVR AI Gateway
 * Unified AI routing with real provider adapters
 * Supports: OpenRouter, Anthropic, OpenAI, Google Gemini
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';

// Provider types
type AIProvider = 'openrouter' | 'anthropic' | 'openai' | 'google';

interface AIRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: AIProvider;
  userId?: string;
  feature?: string; // For logging/rate limiting
}

interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

// Get provider configuration from environment
function getProviderConfig(provider: AIProvider): ProviderConfig | null {
  switch (provider) {
    case 'openrouter':
      const orKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!orKey) return null;
      return {
        apiKey: orKey,
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'anthropic/claude-sonnet-4-20250514',
        models: [
          'anthropic/claude-sonnet-4-20250514',
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
          'openai/gpt-4o-mini',
          'google/gemini-pro-1.5',
        ],
      };
    
    case 'anthropic':
      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (!anthropicKey) return null;
      return {
        apiKey: anthropicKey,
        baseUrl: 'https://api.anthropic.com/v1',
        defaultModel: 'claude-sonnet-4-20250514',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
      };
    
    case 'openai':
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) return null;
      return {
        apiKey: openaiKey,
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
      };
    
    case 'google':
      const googleKey = Deno.env.get('GOOGLE_AI_API_KEY');
      if (!googleKey) return null;
      return {
        apiKey: googleKey,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        defaultModel: 'gemini-1.5-pro',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
      };
    
    default:
      return null;
  }
}

// Provider adapters
async function callOpenRouter(
  config: ProviderConfig,
  request: AIRequest
): Promise<AIResponse> {
  const startTime = Date.now();
  const model = request.model || config.defaultModel;
  
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://savr.app',
      'X-Title': 'SAVR Culinary Assistant',
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${error}`);
  }
  
  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  
  return {
    content: data.choices[0]?.message?.content ?? '',
    model,
    provider: 'openrouter',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
    latencyMs,
  };
}

async function callAnthropic(
  config: ProviderConfig,
  request: AIRequest
): Promise<AIResponse> {
  const startTime = Date.now();
  const model = request.model || config.defaultModel;
  
  // Extract system message
  const systemMessage = request.messages.find(m => m.role === 'system');
  const otherMessages = request.messages.filter(m => m.role !== 'system');
  
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemMessage?.content,
      messages: otherMessages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${error}`);
  }
  
  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  
  return {
    content: data.content[0]?.text ?? '',
    model,
    provider: 'anthropic',
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    } : undefined,
    latencyMs,
  };
}

async function callOpenAI(
  config: ProviderConfig,
  request: AIRequest
): Promise<AIResponse> {
  const startTime = Date.now();
  const model = request.model || config.defaultModel;
  
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }
  
  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  
  return {
    content: data.choices[0]?.message?.content ?? '',
    model,
    provider: 'openai',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
    latencyMs,
  };
}

async function callGoogle(
  config: ProviderConfig,
  request: AIRequest
): Promise<AIResponse> {
  const startTime = Date.now();
  const model = request.model || config.defaultModel;
  
  // Convert messages to Google format
  const contents = request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  
  const systemInstruction = request.messages.find(m => m.role === 'system')?.content;
  
  const response = await fetch(
    `${config.baseUrl}/models/${model}:generateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 4096,
        },
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google AI error: ${error}`);
  }
  
  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    model,
    provider: 'google',
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata.totalTokenCount ?? 0,
    } : undefined,
    latencyMs,
  };
}

// Main gateway function
async function processAIRequest(request: AIRequest): Promise<AIResponse> {
  // Determine provider priority
  const preferredProvider = request.provider || 'openrouter';
  const fallbackOrder: AIProvider[] = ['openrouter', 'anthropic', 'openai', 'google'];
  
  // Try preferred provider first, then fallbacks
  const providers = [preferredProvider, ...fallbackOrder.filter(p => p !== preferredProvider)];
  
  let lastError: Error | null = null;
  
  for (const provider of providers) {
    const config = getProviderConfig(provider);
    if (!config) continue;
    
    try {
      switch (provider) {
        case 'openrouter':
          return await callOpenRouter(config, request);
        case 'anthropic':
          return await callAnthropic(config, request);
        case 'openai':
          return await callOpenAI(config, request);
        case 'google':
          return await callGoogle(config, request);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Provider ${provider} failed:`, lastError.message);
      // Continue to next provider
    }
  }
  
  throw lastError || new Error('No AI providers available');
}

// Rate limiting (simple in-memory for now)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, feature: string): boolean {
  const key = `${userId}:${feature}`;
  const now = Date.now();
  const limit = rateLimits.get(key);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 30) { // 30 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    const body: AIRequest = await req.json();
    
    // Validate request
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check rate limit
    if (body.userId && body.feature) {
      if (!checkRateLimit(body.userId, body.feature)) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please wait before trying again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Process request
    const response = await processAIRequest(body);
    
    // Log usage (structured for observability)
    console.log(JSON.stringify({
      type: 'ai_request',
      feature: body.feature || 'unknown',
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      tokens: response.usage?.totalTokens,
      userId: body.userId || 'anonymous',
    }));
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI Gateway error:', message);
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
