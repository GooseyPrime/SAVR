/**
 * SAVR Preferences Integration Hook
 * Wires user preferences to application behavior
 */

import { useMemo } from 'react';
import { useAppStore, type UserPreferences, type RecipeMode } from '@/store/app-store';
import { validatePetSafety, type PetSafetyResult } from '@/lib/pet-safety';

// Default preferences for safe fallback
const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: '',
  diets: [],
  allergies: [],
  cuisinePreferences: [],
  recipeMode: 'human',
  onboardingCompleted: false,
  mealTimes: {
    breakfast: '07:00',
    lunch: '12:00',
    dinner: '18:00',
    snack: '15:00',
  },
  defaultServings: 4,
  cookingSkillLevel: 'intermediate',
  budgetLevel: 'moderate',
  measurementSystem: 'imperial',
};

// Merge preferences with defaults
function mergeWithDefaults(prefs: Partial<UserPreferences>): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...prefs,
    mealTimes: {
      ...DEFAULT_PREFERENCES.mealTimes,
      ...prefs.mealTimes,
    },
  };
}

// Time utilities
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

function formatTime(hours: number, minutes: number, format: '12h' | '24h' = '12h'): string {
  if (format === '24h') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Measurement conversion utilities
const CONVERSIONS = {
  cups_to_ml: 236.588,
  oz_to_g: 28.3495,
  lbs_to_kg: 0.453592,
  tsp_to_ml: 4.929,
  tbsp_to_ml: 14.787,
  fl_oz_to_ml: 29.5735,
};

export function usePreferences() {
  const storePrefs = useAppStore((s) => s.preferences);
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  
  // Merged preferences with safe defaults
  const preferences = useMemo(() => mergeWithDefaults(storePrefs), [storePrefs]);
  
  // Formatted meal times for display
  const formattedMealTimes = useMemo(() => {
    const times = preferences.mealTimes;
    return {
      breakfast: formatTime(...Object.values(parseTime(times.breakfast)) as [number, number]),
      lunch: formatTime(...Object.values(parseTime(times.lunch)) as [number, number]),
      dinner: formatTime(...Object.values(parseTime(times.dinner)) as [number, number]),
      snack: formatTime(...Object.values(parseTime(times.snack)) as [number, number]),
    };
  }, [preferences.mealTimes]);
  
  // Get current meal based on time
  const getCurrentMeal = useMemo(() => {
    return (): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const times = preferences.mealTimes;
      const breakfastMinutes = parseTime(times.breakfast).hours * 60 + parseTime(times.breakfast).minutes;
      const lunchMinutes = parseTime(times.lunch).hours * 60 + parseTime(times.lunch).minutes;
      const dinnerMinutes = parseTime(times.dinner).hours * 60 + parseTime(times.dinner).minutes;
      const snackMinutes = parseTime(times.snack).hours * 60 + parseTime(times.snack).minutes;
      
      // Find the current or next meal
      if (currentMinutes < breakfastMinutes) return 'breakfast';
      if (currentMinutes < lunchMinutes) return 'lunch';
      if (currentMinutes < snackMinutes) return 'snack';
      if (currentMinutes < dinnerMinutes) return 'dinner';
      return 'breakfast'; // After dinner, next meal is breakfast
    };
  }, [preferences.mealTimes]);
  
  // Pet safety validation
  const validateForPetSafety = useMemo(() => {
    return (ingredients: string[]): PetSafetyResult | null => {
      const mode = preferences.recipeMode;
      if (mode === 'human') return null;
      return validatePetSafety(ingredients, mode);
    };
  }, [preferences.recipeMode]);
  
  // Skill level context for AI prompts
  const skillLevelContext = useMemo(() => {
    const level = preferences.cookingSkillLevel;
    switch (level) {
      case 'beginner':
        return {
          instructions: 'simple and detailed',
          techniques: 'basic cooking techniques only',
          equipment: 'common kitchen equipment',
          complexity: 'straightforward recipes with few steps',
        };
      case 'intermediate':
        return {
          instructions: 'clear with some assumed knowledge',
          techniques: 'various cooking methods',
          equipment: 'standard kitchen equipment',
          complexity: 'moderate complexity with reasonable prep',
        };
      case 'advanced':
        return {
          instructions: 'concise, professional style',
          techniques: 'advanced techniques welcome',
          equipment: 'specialized equipment acceptable',
          complexity: 'complex recipes with multiple components',
        };
      default:
        return {
          instructions: 'clear with some assumed knowledge',
          techniques: 'various cooking methods',
          equipment: 'standard kitchen equipment',
          complexity: 'moderate complexity',
        };
    }
  }, [preferences.cookingSkillLevel]);
  
  // Budget context for recommendations
  const budgetContext = useMemo(() => {
    const level = preferences.budgetLevel;
    switch (level) {
      case 'budget':
        return {
          ingredients: 'affordable, commonly available ingredients',
          substitutions: 'cheaper alternatives preferred',
          portions: 'economical serving sizes',
        };
      case 'moderate':
        return {
          ingredients: 'quality ingredients at reasonable prices',
          substitutions: 'balance of quality and cost',
          portions: 'standard serving sizes',
        };
      case 'premium':
        return {
          ingredients: 'premium, specialty ingredients welcome',
          substitutions: 'quality over cost',
          portions: 'generous serving sizes',
        };
      default:
        return {
          ingredients: 'quality ingredients at reasonable prices',
          substitutions: 'balance of quality and cost',
          portions: 'standard serving sizes',
        };
    }
  }, [preferences.budgetLevel]);
  
  // Measurement conversion helpers
  const convertMeasurement = useMemo(() => {
    return (
      value: number,
      fromUnit: string,
      toSystem?: 'metric' | 'imperial'
    ): { value: number; unit: string } => {
      const targetSystem = toSystem || preferences.measurementSystem;
      const fromLower = fromUnit.toLowerCase();
      
      // If already in target system, return as-is
      if (targetSystem === 'imperial') {
        if (['cups', 'cup', 'oz', 'lbs', 'lb', 'tsp', 'tbsp', 'fl oz'].includes(fromLower)) {
          return { value, unit: fromUnit };
        }
        // Convert from metric to imperial
        if (fromLower === 'ml') return { value: value / CONVERSIONS.fl_oz_to_ml, unit: 'fl oz' };
        if (fromLower === 'g') return { value: value / CONVERSIONS.oz_to_g, unit: 'oz' };
        if (fromLower === 'kg') return { value: value / CONVERSIONS.lbs_to_kg, unit: 'lbs' };
      } else {
        if (['ml', 'g', 'kg', 'l'].includes(fromLower)) {
          return { value, unit: fromUnit };
        }
        // Convert from imperial to metric
        if (['cups', 'cup'].includes(fromLower)) return { value: value * CONVERSIONS.cups_to_ml, unit: 'ml' };
        if (fromLower === 'oz') return { value: value * CONVERSIONS.oz_to_g, unit: 'g' };
        if (['lbs', 'lb'].includes(fromLower)) return { value: value * CONVERSIONS.lbs_to_kg, unit: 'kg' };
        if (fromLower === 'tsp') return { value: value * CONVERSIONS.tsp_to_ml, unit: 'ml' };
        if (fromLower === 'tbsp') return { value: value * CONVERSIONS.tbsp_to_ml, unit: 'ml' };
        if (fromLower === 'fl oz') return { value: value * CONVERSIONS.fl_oz_to_ml, unit: 'ml' };
      }
      
      return { value, unit: fromUnit };
    };
  }, [preferences.measurementSystem]);
  
  // Format measurement for display
  const formatMeasurement = useMemo(() => {
    return (value: number, unit: string): string => {
      const converted = convertMeasurement(value, unit);
      const rounded = Math.round(converted.value * 100) / 100;
      return `${rounded} ${converted.unit}`;
    };
  }, [convertMeasurement]);
  
  // Get dietary context for AI prompts
  const dietaryContext = useMemo(() => {
    const diets = preferences.diets.filter(d => d !== 'none');
    const allergies = preferences.allergies;
    
    return {
      restrictions: diets.length > 0 ? diets.join(', ') : 'none',
      allergies: allergies.length > 0 ? allergies.join(', ') : 'none',
      avoidIngredients: allergies,
      promptContext: [
        diets.length > 0 ? `Dietary restrictions: ${diets.join(', ')}` : '',
        allergies.length > 0 ? `Food allergies (MUST AVOID): ${allergies.join(', ')}` : '',
      ].filter(Boolean).join('. '),
    };
  }, [preferences.diets, preferences.allergies]);
  
  // Get cuisine preferences for ranking
  const cuisineContext = useMemo(() => {
    const cuisines = preferences.cuisinePreferences;
    return {
      preferred: cuisines,
      hasPreferences: cuisines.length > 0,
      promptContext: cuisines.length > 0 
        ? `Preferred cuisines: ${cuisines.join(', ')}` 
        : 'No specific cuisine preferences',
    };
  }, [preferences.cuisinePreferences]);
  
  // Pet profile for pet mode
  const petProfile = useMemo(() => {
    const mode = preferences.recipeMode;
    if (mode === 'human') return null;
    
    return {
      type: mode,
      name: preferences.petName || `Your ${mode}`,
      weight: preferences.petWeight,
      weightUnit: preferences.petWeightUnit || 'lbs',
      // Rough portion guidance based on weight
      portionGuidance: preferences.petWeight ? getPortionGuidance(mode, preferences.petWeight, preferences.petWeightUnit || 'lbs') : null,
    };
  }, [preferences.recipeMode, preferences.petName, preferences.petWeight, preferences.petWeightUnit]);
  
  return {
    preferences,
    updatePreferences,
    formattedMealTimes,
    getCurrentMeal,
    validateForPetSafety,
    skillLevelContext,
    budgetContext,
    convertMeasurement,
    formatMeasurement,
    dietaryContext,
    cuisineContext,
    petProfile,
    isPetMode: preferences.recipeMode !== 'human',
    isHumanMode: preferences.recipeMode === 'human',
  };
}

// Helper for pet portion guidance
function getPortionGuidance(petType: 'dog' | 'cat', weight: number, unit: 'kg' | 'lbs'): string {
  const weightInLbs = unit === 'kg' ? weight * 2.205 : weight;
  
  if (petType === 'dog') {
    // Rough guideline: 2-3% of body weight in food per day
    const minOz = (weightInLbs * 0.02 * 16).toFixed(1);
    const maxOz = (weightInLbs * 0.03 * 16).toFixed(1);
    return `${minOz}-${maxOz} oz per day (adjust based on activity level)`;
  } else {
    // Cats: roughly 24-35 calories per pound of body weight
    const minCal = Math.round(weightInLbs * 24);
    const maxCal = Math.round(weightInLbs * 35);
    return `${minCal}-${maxCal} calories per day`;
  }
}

// Export type for components
export type UsePreferencesReturn = ReturnType<typeof usePreferences>;
