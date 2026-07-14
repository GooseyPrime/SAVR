import { supabase } from './supabase';

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

export async function callApi(endpoint: string, data: any) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(`/api${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  
  return response.json();
}
