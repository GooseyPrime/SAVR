import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RecipeMode = 'human' | 'dog' | 'cat';

export type Diet = 
  | 'none'
  | 'vegan'
  | 'vegetarian'
  | 'keto'
  | 'paleo'
  | 'mediterranean'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'low-sodium'
  | 'diabetic'
  | 'low-fodmap';

export interface MealTimeSettings {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}

export interface UserPreferences {
  displayName: string;
  diets: Diet[];
  allergies: string[];
  cuisinePreferences: string[];
  recipeMode: RecipeMode;
  onboardingCompleted: boolean;
  // Meal planning settings
  mealTimes: MealTimeSettings;
  defaultServings: number;
  cookingSkillLevel: 'beginner' | 'intermediate' | 'advanced';
  budgetLevel: 'budget' | 'moderate' | 'premium';
  // Measurement preferences
  measurementSystem: 'metric' | 'imperial';
  // Pet profile (for dog/cat modes)
  petName?: string;
  petWeight?: number;
  petWeightUnit?: 'kg' | 'lbs';
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: string;
  location?: 'refrigerator' | 'freezer' | 'pantry';
  expirationDate?: string;
  addedAt: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: { name: string; amount: string; unit: string }[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  dietaryTags: string[];
  imageUrl?: string;
  isFavorite: boolean;
  isAiGenerated: boolean;
  createdAt: string;
  mode: RecipeMode;
}

export interface MealPlan {
  id: string;
  date: string;
  meals: {
    breakfast?: Recipe;
    lunch?: Recipe;
    dinner?: Recipe;
    snack?: Recipe;
  };
}

interface AppState {
  // User
  isAuthenticated: boolean;
  preferences: UserPreferences;
  
  // Inventory
  inventory: InventoryItem[];
  
  // Recipes
  recipes: Recipe[];
  
  // Meal Plans
  mealPlans: MealPlan[];
  
  // UI State
  activeTab: string;
  isLoading: boolean;
  
  // Actions
  setAuthenticated: (value: boolean) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  setRecipeMode: (mode: RecipeMode) => void;
  completeOnboarding: () => void;
  
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'addedAt'>) => void;
  removeInventoryItem: (id: string) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => void;
  removeRecipe: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearRecipes: () => void;
  clearInventory: () => void;
  
  // Meal Plan actions
  addMealPlan: (plan: Omit<MealPlan, 'id'>) => void;
  updateMealPlan: (id: string, updates: Partial<MealPlan>) => void;
  removeMealPlan: (id: string) => void;
  setMealForDate: (date: string, mealType: keyof MealPlan['meals'], recipe: Recipe | undefined) => void;
  clearMealPlans: () => void;
  
  // Reset
  resetStore: () => void;
  
  setActiveTab: (tab: string) => void;
  setLoading: (value: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist<AppState>(
    (set) => ({
      // Initial state
      isAuthenticated: false,
      preferences: {
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
      },
      inventory: [],
      recipes: [],
      mealPlans: [],
      activeTab: 'home',
      isLoading: false,
      
      // Actions
      setAuthenticated: (value) => set({ isAuthenticated: value }),
      
      updatePreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),
      
      setRecipeMode: (mode) =>
        set((state) => ({
          preferences: { ...state.preferences, recipeMode: mode },
        })),
      
      completeOnboarding: () =>
        set((state) => ({
          preferences: { ...state.preferences, onboardingCompleted: true },
        })),
      
      addInventoryItem: (item) =>
        set((state) => ({
          inventory: [
            ...state.inventory,
            {
              ...item,
              id: crypto.randomUUID(),
              addedAt: new Date().toISOString(),
            },
          ],
        })),
      
      removeInventoryItem: (id) =>
        set((state) => ({
          inventory: state.inventory.filter((item) => item.id !== id),
        })),
      
      updateInventoryItem: (id, updates) =>
        set((state) => ({
          inventory: state.inventory.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      
      addRecipe: (recipe) =>
        set((state) => ({
          recipes: [
            {
              ...recipe,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
            ...state.recipes,
          ],
        })),
      
      removeRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== id),
        })),
      
      toggleFavorite: (id) =>
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
          ),
        })),
      
      clearRecipes: () => set({ recipes: [] }),
      clearInventory: () => set({ inventory: [] }),
      
      // Meal Plan actions
      addMealPlan: (plan) =>
        set((state) => ({
          mealPlans: [
            ...state.mealPlans,
            { ...plan, id: crypto.randomUUID() },
          ],
        })),
      
      updateMealPlan: (id, updates) =>
        set((state) => ({
          mealPlans: state.mealPlans.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      
      removeMealPlan: (id) =>
        set((state) => ({
          mealPlans: state.mealPlans.filter((p) => p.id !== id),
        })),
      
      setMealForDate: (date, mealType, recipe) =>
        set((state) => {
          const existingPlan = state.mealPlans.find((p) => p.date === date);
          if (existingPlan) {
            return {
              mealPlans: state.mealPlans.map((p) =>
                p.date === date
                  ? { ...p, meals: { ...p.meals, [mealType]: recipe } }
                  : p
              ),
            };
          } else {
            return {
              mealPlans: [
                ...state.mealPlans,
                {
                  id: crypto.randomUUID(),
                  date,
                  meals: { [mealType]: recipe },
                },
              ],
            };
          }
        }),
      
      clearMealPlans: () => set({ mealPlans: [] }),
      
      resetStore: () =>
        set({
          isAuthenticated: false,
          preferences: {
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
          },
          inventory: [],
          recipes: [],
          mealPlans: [],
          activeTab: 'home',
          isLoading: false,
        }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      setLoading: (value) => set({ isLoading: value }),
    }),
    {
      name: 'savr-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        inventory: state.inventory,
        recipes: state.recipes,
        mealPlans: state.mealPlans,
      }),
    }
  )
);
