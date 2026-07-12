/**
 * SAVR API Hooks
 * Complete hooks for interacting with all SAVR AI Edge Functions
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RecipeMode } from '@/store/app-store';

// ============================================================================
// Types
// ============================================================================

export interface AnalyzedItem {
  name: string;
  quantity?: number;
  unit?: string;
  category: string;
  confidence: number;
  expiryEstimate?: string;
}

export interface AnalysisResult {
  items: AnalyzedItem[];
  summary: string;
  suggestions: string[];
}

export interface GeneratedRecipe {
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

export interface ChatResponse {
  message: string;
  sessionId: string;
  mode: RecipeMode;
}

export interface ProductInfo {
  barcode: string;
  name: string;
  brand?: string;
  category: string;
  quantity?: string;
  servingSize?: string;
  nutrition?: {
    calories?: number;
    protein?: string;
    carbs?: string;
    fat?: string;
    fiber?: string;
    sugar?: string;
    sodium?: string;
  };
  ingredients?: string;
  allergens?: string[];
  imageUrl?: string;
  nutriscore?: string;
  isOrganic?: boolean;
  isVegan?: boolean;
  isVegetarian?: boolean;
}

export interface PlannedMeal {
  title: string;
  description: string;
  prepTime: number;
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  ingredients: string[];
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface DayPlan {
  date: string;
  meals: {
    breakfast?: PlannedMeal;
    lunch?: PlannedMeal;
    dinner?: PlannedMeal;
    snack?: PlannedMeal;
  };
  groceryNeeds: string[];
}

export interface MealPlanResponse {
  days: DayPlan[];
  shoppingList: { item: string; quantity: string; category: string }[];
  estimatedCost?: string;
  nutritionSummary?: string;
  tips: string[];
}

export interface Substitution {
  substitute: string;
  amount: string;
  ratio: string;
  notes: string;
  inPantry: boolean;
  effectiveness: 'excellent' | 'good' | 'acceptable';
}

export interface SubstitutionResult {
  substitutions: Substitution[];
  tips: string[];
  warnings: string[];
  originalIngredient: string;
  mode: RecipeMode;
}

export interface NutritionItem {
  name: string;
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  benefits: string[];
  concerns: string[];
}

export interface NutritionAnalysis {
  totalNutrition: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
    fiber?: string;
  };
  items: NutritionItem[];
  insights: string[];
  recommendations: string[];
  safetyAssessment?: {
    rating: 'safe' | 'caution' | 'toxic';
    warnings: string[];
    safeItems: string[];
    unsafeItems: string[];
  };
}

// ============================================================================
// Image Analysis Hook
// ============================================================================

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeImage = useCallback(async (
    imageBase64: string,
    location: 'refrigerator' | 'freezer' | 'pantry' | 'spices' | 'other' = 'pantry'
  ): Promise<AnalysisResult | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to use this feature');
        return null;
      }

      const response = await supabase.functions.invoke('analyze-image', {
        body: { imageBase64, location },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as AnalysisResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze image';
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { analyzeImage, isAnalyzing, error, clearError: () => setError(null) };
}

// ============================================================================
// Recipe Generation Hook
// ============================================================================

export function useRecipeGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecipe = useCallback(async (options: {
    mode?: RecipeMode;
    ingredients?: string[];
    preferences?: {
      diets?: string[];
      allergies?: string[];
      cuisinePreferences?: string[];
      maxTime?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
    };
    prompt?: string;
  }): Promise<{ recipe: GeneratedRecipe; mode: string } | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to use this feature');
        return null;
      }

      const response = await supabase.functions.invoke('generate-recipe', {
        body: options,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate recipe';
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generateRecipe, isGenerating, error, clearError: () => setError(null) };
}

// ============================================================================
// Chat Hook
// ============================================================================

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sendMessage = useCallback(async (options: {
    message: string;
    mode?: RecipeMode;
    context?: {
      inventory?: string[];
      currentRecipe?: string;
    };
  }): Promise<ChatResponse | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to use this feature');
        return null;
      }

      const response = await supabase.functions.invoke('chat', {
        body: {
          ...options,
          sessionId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data as ChatResponse;
      setSessionId(data.sessionId);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const resetSession = useCallback(() => {
    setSessionId(null);
  }, []);

  return { sendMessage, isLoading, error, sessionId, resetSession, clearError: () => setError(null) };
}

// ============================================================================
// Barcode Lookup Hook
// ============================================================================

export function useBarcodeLookup() {
  const [isLooking, setIsLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupBarcode = useCallback(async (barcode: string): Promise<{
    found: boolean;
    product?: ProductInfo;
    suggestion?: string;
  } | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    setIsLooking(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('barcode-lookup', {
        body: { barcode },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to lookup barcode';
      setError(message);
      return null;
    } finally {
      setIsLooking(false);
    }
  }, []);

  return { lookupBarcode, isLooking, error, clearError: () => setError(null) };
}

// ============================================================================
// Meal Plan Generation Hook
// ============================================================================

export function useMealPlanGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMealPlan = useCallback(async (options: {
    mode?: RecipeMode;
    daysToGenerate?: number;
    preferences?: {
      diets?: string[];
      allergies?: string[];
      cuisinePreferences?: string[];
      mealTypes?: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
      budgetLevel?: 'budget' | 'moderate' | 'premium';
      cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
    };
  }): Promise<{ mealPlan: MealPlanResponse; mode: string } | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to use this feature');
        return null;
      }

      const response = await supabase.functions.invoke('meal-plan', {
        body: options,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate meal plan';
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generateMealPlan, isGenerating, error, clearError: () => setError(null) };
}

// ============================================================================
// Ingredient Substitutions Hook
// ============================================================================

export function useSubstitutions() {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findSubstitutions = useCallback(async (options: {
    ingredient: string;
    amount?: string;
    unit?: string;
    recipeContext?: string;
    mode?: RecipeMode;
  }): Promise<SubstitutionResult | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    setIsSearching(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to use this feature');
        return null;
      }

      const response = await supabase.functions.invoke('substitutions', {
        body: options,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as SubstitutionResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to find substitutions';
      setError(message);
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  return { findSubstitutions, isSearching, error, clearError: () => setError(null) };
}

// ============================================================================
// Nutrition Analysis Hook
// ============================================================================

export function useNutritionAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeNutrition = useCallback(async (options: {
    foods: { name: string; amount: string; unit?: string }[];
    mode?: RecipeMode;
    analysisType?: 'single_meal' | 'daily' | 'weekly';
  }): Promise<{ analysis: NutritionAnalysis; mode: string } | null> => {
    if (!supabase) {
      setError('Database not connected');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to use this feature');
        return null;
      }

      const response = await supabase.functions.invoke('nutrition-analysis', {
        body: options,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze nutrition';
      setError(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { analyzeNutrition, isAnalyzing, error, clearError: () => setError(null) };
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Convert file/blob to base64 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just the base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Format cooking time for display */
export function formatCookingTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/** Get difficulty color class */
export function getDifficultyColor(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy': return 'text-mint bg-mint/10';
    case 'medium': return 'text-citrus bg-citrus/10';
    case 'hard': return 'text-peach bg-peach/10';
    default: return 'text-foreground-muted bg-muted';
  }
}
