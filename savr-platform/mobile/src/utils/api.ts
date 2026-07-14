import { supabase } from '../config/supabase';

const API_BASE = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000';

export interface ApiError extends Error {
  code?: string;
  status?: number;
  resetAt?: string;
}

async function parseApiError(response: Response): Promise<ApiError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(
    typeof payload?.error === 'string' ? payload.error : 'API request failed'
  ) as ApiError;

  error.name = 'ApiError';
  error.code = typeof payload?.code === 'string' ? payload.code : undefined;
  error.status = response.status;
  error.resetAt = typeof payload?.resetAt === 'string' ? payload.resetAt : undefined;

  return error;
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

export async function callApi(endpoint: string, data: any) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json();
}

export async function callApiGet(endpoint: string) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api${endpoint}`, {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json();
}

export interface GenerateRecipesParams {
  ingredients?: string[];
  preferences?: Record<string, any>;
  maxRecipes?: number;
}

export interface GenerateMealPlanParams {
  days: number;
}

export interface ChatWithAIParams {
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  context?: Record<string, any>;
}

export const generateRecipes = async (params?: GenerateRecipesParams) => {
  return await callApi('/ai/create-recipe', params || {});
};

export const generateMealPlan = async (params: GenerateMealPlanParams) => {
  return await callApi('/ai/create-meal-plan', params);
};

export const chatWithAI = async (params: ChatWithAIParams) => {
  return await callApi('/ai/chat', params);
};

export const analyzeImage = async (imageUrl: string) => {
  return await callApi('/ai/analyze-image', { imageUrl });
};
