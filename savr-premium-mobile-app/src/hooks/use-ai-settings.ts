/**
 * SAVR AI Settings Hook
 * Manages user AI preferences and provider configuration
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/helpers';

export type AIProvider = 'openrouter' | 'anthropic' | 'openai' | 'google';

export type UserAISettings = Tables<'user_ai_settings'>;
export type UserAISettingsInsert = TablesInsert<'user_ai_settings'>;

export interface AISettingsState {
  settings: UserAISettings | null;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
}

export const AI_PROVIDERS: { id: AIProvider; name: string; description: string }[] = [
  { 
    id: 'openrouter', 
    name: 'OpenRouter (Default)', 
    description: 'Access to multiple AI models including Claude, GPT-4, and more' 
  },
  { 
    id: 'anthropic', 
    name: 'Anthropic (Claude)', 
    description: 'Direct access to Claude models for best quality' 
  },
  { 
    id: 'openai', 
    name: 'OpenAI (GPT)', 
    description: 'Access to GPT-4 and other OpenAI models' 
  },
  { 
    id: 'google', 
    name: 'Google (Gemini)', 
    description: 'Access to Google\'s Gemini models' 
  },
];

export const AI_MODELS: Record<AIProvider, { id: string; name: string }[]> = {
  openrouter: [
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (Default)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Fast)' },
  ],
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
  ],
};

export function useAISettings() {
  const [state, setState] = useState<AISettingsState>({
    settings: null,
    isLoading: true,
    error: null,
    isSaving: false,
  });

  // Fetch user's AI settings
  const fetchSettings = useCallback(async () => {
    if (!supabase) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Database not connected' }));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false, settings: null }));
        return;
      }

      const { data, error } = await supabase
        .from('user_ai_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        settings: data || null,
        error: null 
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load AI settings',
      }));
    }
  }, []);

  // Update AI settings
  const updateSettings = useCallback(async (updates: Partial<Omit<UserAISettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!supabase) {
      setState(prev => ({ ...prev, error: 'Database not connected' }));
      return false;
    }

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Upsert - insert or update
      const { data, error } = await supabase
        .from('user_ai_settings')
        .upsert(
          {
            user_id: user.id,
            ...updates,
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        isSaving: false,
        settings: data,
        error: null,
      }));

      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: err instanceof Error ? err.message : 'Failed to save AI settings',
      }));
      return false;
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    ...state,
    fetchSettings,
    updateSettings,
    clearError: () => setState(prev => ({ ...prev, error: null })),
  };
}
