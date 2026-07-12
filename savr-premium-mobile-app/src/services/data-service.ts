/**
 * SAVR Data Service Layer
 * Typed service for Supabase data operations
 * Handles authenticated user data with local storage fallback for guests
 */

import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/helpers';
import type { Json } from '@/integrations/supabase/types';

// Type exports for convenience
export type Profile = Tables<'profiles'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

export type Inventory = Tables<'user_inventory'>;
export type InventoryInsert = TablesInsert<'user_inventory'>;
export type InventoryUpdate = TablesUpdate<'user_inventory'>;

export type Recipe = Tables<'recipes'>;
export type RecipeInsert = TablesInsert<'recipes'>;
export type RecipeUpdate = TablesUpdate<'recipes'>;

export type MealPlan = Tables<'meal_plans'>;
export type MealPlanInsert = TablesInsert<'meal_plans'>;
export type MealPlanUpdate = TablesUpdate<'meal_plans'>;

export type GroceryList = Tables<'grocery_lists'>;
export type GroceryListInsert = TablesInsert<'grocery_lists'>;
export type GroceryListUpdate = TablesUpdate<'grocery_lists'>;

export type ChatHistory = Tables<'chat_history'>;
export type ChatHistoryInsert = TablesInsert<'chat_history'>;

export type AISettings = Tables<'user_ai_settings'>;
export type AISettingsInsert = TablesInsert<'user_ai_settings'>;
export type AISettingsUpdate = TablesUpdate<'user_ai_settings'>;

// Local storage keys for guest data
const GUEST_STORAGE_KEYS = {
  inventory: 'savr_guest_inventory',
  recipes: 'savr_guest_recipes',
  mealPlans: 'savr_guest_meal_plans',
  groceryLists: 'savr_guest_grocery_lists',
  preferences: 'savr_guest_preferences',
} as const;

// Generic result type
export interface DataResult<T> {
  data: T | null;
  error: string | null;
}

// Helper to get user ID
async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ============= PROFILES SERVICE =============
export const profileService = {
  async get(): Promise<DataResult<Profile>> {
    if (!supabase) return { data: null, error: 'No database connection' };
    
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async update(updates: ProfileUpdate): Promise<DataResult<Profile>> {
    if (!supabase) return { data: null, error: 'No database connection' };
    
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async updatePreferences(preferences: Json): Promise<DataResult<Profile>> {
    return this.update({ preferences });
  },
};

// ============= INVENTORY SERVICE =============
export const inventoryService = {
  async getAll(): Promise<DataResult<Inventory[]>> {
    if (!supabase) {
      // Guest mode: read from local storage
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.inventory);
      return { data: stored ? JSON.parse(stored) : [], error: null };
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.inventory);
      return { data: stored ? JSON.parse(stored) : [], error: null };
    }
    
    const { data, error } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    return { data: data ?? [], error: error?.message ?? null };
  },

  async add(item: Omit<InventoryInsert, 'user_id'>): Promise<DataResult<Inventory>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      // Guest mode: save to local storage
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.inventory);
      const items: Inventory[] = stored ? JSON.parse(stored) : [];
      const newItem = {
        ...item,
        id: crypto.randomUUID(),
        user_id: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Inventory;
      items.unshift(newItem);
      localStorage.setItem(GUEST_STORAGE_KEYS.inventory, JSON.stringify(items));
      return { data: newItem, error: null };
    }
    
    const { data, error } = await supabase
      .from('user_inventory')
      .insert({ ...item, user_id: userId })
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async update(id: string, updates: InventoryUpdate): Promise<DataResult<Inventory>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.inventory);
      const items: Inventory[] = stored ? JSON.parse(stored) : [];
      const index = items.findIndex(i => i.id === id);
      if (index >= 0) {
        items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() };
        localStorage.setItem(GUEST_STORAGE_KEYS.inventory, JSON.stringify(items));
        return { data: items[index], error: null };
      }
      return { data: null, error: 'Item not found' };
    }
    
    const { data, error } = await supabase
      .from('user_inventory')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async delete(id: string): Promise<DataResult<boolean>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.inventory);
      const items: Inventory[] = stored ? JSON.parse(stored) : [];
      const filtered = items.filter(i => i.id !== id);
      localStorage.setItem(GUEST_STORAGE_KEYS.inventory, JSON.stringify(filtered));
      return { data: true, error: null };
    }
    
    const { error } = await supabase
      .from('user_inventory')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    return { data: !error, error: error?.message ?? null };
  },
};

// ============= RECIPES SERVICE =============
export const recipeService = {
  async getAll(): Promise<DataResult<Recipe[]>> {
    if (!supabase) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.recipes);
      return { data: stored ? JSON.parse(stored) : [], error: null };
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.recipes);
      return { data: stored ? JSON.parse(stored) : [], error: null };
    }
    
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    return { data: data ?? [], error: error?.message ?? null };
  },

  async add(recipe: Omit<RecipeInsert, 'user_id'>): Promise<DataResult<Recipe>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.recipes);
      const recipes: Recipe[] = stored ? JSON.parse(stored) : [];
      const newRecipe = {
        ...recipe,
        id: crypto.randomUUID(),
        user_id: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Recipe;
      recipes.unshift(newRecipe);
      localStorage.setItem(GUEST_STORAGE_KEYS.recipes, JSON.stringify(recipes));
      return { data: newRecipe, error: null };
    }
    
    const { data, error } = await supabase
      .from('recipes')
      .insert({ ...recipe, user_id: userId })
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async update(id: string, updates: RecipeUpdate): Promise<DataResult<Recipe>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.recipes);
      const recipes: Recipe[] = stored ? JSON.parse(stored) : [];
      const index = recipes.findIndex(r => r.id === id);
      if (index >= 0) {
        recipes[index] = { ...recipes[index], ...updates, updated_at: new Date().toISOString() };
        localStorage.setItem(GUEST_STORAGE_KEYS.recipes, JSON.stringify(recipes));
        return { data: recipes[index], error: null };
      }
      return { data: null, error: 'Recipe not found' };
    }
    
    const { data, error } = await supabase
      .from('recipes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async delete(id: string): Promise<DataResult<boolean>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.recipes);
      const recipes: Recipe[] = stored ? JSON.parse(stored) : [];
      const filtered = recipes.filter(r => r.id !== id);
      localStorage.setItem(GUEST_STORAGE_KEYS.recipes, JSON.stringify(filtered));
      return { data: true, error: null };
    }
    
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    return { data: !error, error: error?.message ?? null };
  },

  async toggleFavorite(id: string): Promise<DataResult<Recipe>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.recipes);
      const recipes: Recipe[] = stored ? JSON.parse(stored) : [];
      const index = recipes.findIndex(r => r.id === id);
      if (index >= 0) {
        recipes[index].is_favorite = !recipes[index].is_favorite;
        localStorage.setItem(GUEST_STORAGE_KEYS.recipes, JSON.stringify(recipes));
        return { data: recipes[index], error: null };
      }
      return { data: null, error: 'Recipe not found' };
    }
    
    // First get current state
    const { data: current } = await supabase
      .from('recipes')
      .select('is_favorite')
      .eq('id', id)
      .single();
    
    const { data, error } = await supabase
      .from('recipes')
      .update({ is_favorite: !current?.is_favorite })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },
};

// ============= GROCERY LISTS SERVICE =============
export const groceryListService = {
  async getAll(): Promise<DataResult<GroceryList[]>> {
    if (!supabase) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      return { data: stored ? JSON.parse(stored) : [], error: null };
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      return { data: stored ? JSON.parse(stored) : [], error: null };
    }
    
    const { data, error } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    return { data: data ?? [], error: error?.message ?? null };
  },

  async getActive(): Promise<DataResult<GroceryList | null>> {
    if (!supabase) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      const lists: GroceryList[] = stored ? JSON.parse(stored) : [];
      return { data: lists.find(l => l.is_active) ?? null, error: null };
    }
    
    const userId = await getCurrentUserId();
    if (!userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      const lists: GroceryList[] = stored ? JSON.parse(stored) : [];
      return { data: lists.find(l => l.is_active) ?? null, error: null };
    }
    
    const { data, error } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    return { data: data ?? null, error: error?.message ?? null };
  },

  async create(name: string, items: Json = []): Promise<DataResult<GroceryList>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      const lists: GroceryList[] = stored ? JSON.parse(stored) : [];
      // Deactivate other lists
      lists.forEach(l => l.is_active = false);
      const newList: GroceryList = {
        id: crypto.randomUUID(),
        user_id: 'guest',
        name,
        items,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      lists.unshift(newList);
      localStorage.setItem(GUEST_STORAGE_KEYS.groceryLists, JSON.stringify(lists));
      return { data: newList, error: null };
    }
    
    // Deactivate other lists first
    await supabase
      .from('grocery_lists')
      .update({ is_active: false })
      .eq('user_id', userId);
    
    const { data, error } = await supabase
      .from('grocery_lists')
      .insert({ user_id: userId, name, items, is_active: true })
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async update(id: string, updates: GroceryListUpdate): Promise<DataResult<GroceryList>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      const lists: GroceryList[] = stored ? JSON.parse(stored) : [];
      const index = lists.findIndex(l => l.id === id);
      if (index >= 0) {
        lists[index] = { ...lists[index], ...updates, updated_at: new Date().toISOString() };
        localStorage.setItem(GUEST_STORAGE_KEYS.groceryLists, JSON.stringify(lists));
        return { data: lists[index], error: null };
      }
      return { data: null, error: 'List not found' };
    }
    
    const { data, error } = await supabase
      .from('grocery_lists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async setActive(id: string): Promise<DataResult<GroceryList>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      const lists: GroceryList[] = stored ? JSON.parse(stored) : [];
      lists.forEach(l => l.is_active = l.id === id);
      localStorage.setItem(GUEST_STORAGE_KEYS.groceryLists, JSON.stringify(lists));
      const active = lists.find(l => l.id === id);
      return { data: active ?? null, error: active ? null : 'List not found' };
    }
    
    // Deactivate all others
    await supabase
      .from('grocery_lists')
      .update({ is_active: false })
      .eq('user_id', userId);
    
    const { data, error } = await supabase
      .from('grocery_lists')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },

  async delete(id: string): Promise<DataResult<boolean>> {
    const userId = await getCurrentUserId();
    
    if (!supabase || !userId) {
      const stored = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
      const lists: GroceryList[] = stored ? JSON.parse(stored) : [];
      const filtered = lists.filter(l => l.id !== id);
      localStorage.setItem(GUEST_STORAGE_KEYS.groceryLists, JSON.stringify(filtered));
      return { data: true, error: null };
    }
    
    const { error } = await supabase
      .from('grocery_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    return { data: !error, error: error?.message ?? null };
  },
};

// ============= AI SETTINGS SERVICE =============
export const aiSettingsService = {
  async get(): Promise<DataResult<AISettings | null>> {
    if (!supabase) return { data: null, error: null };
    
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: null };
    
    const { data, error } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    return { data: data ?? null, error: error?.code === 'PGRST116' ? null : error?.message ?? null };
  },

  async upsert(settings: Partial<AISettingsInsert>): Promise<DataResult<AISettings>> {
    if (!supabase) return { data: null, error: 'No database connection' };
    
    const userId = await getCurrentUserId();
    if (!userId) return { data: null, error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('user_ai_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();
    
    return { data, error: error?.message ?? null };
  },
};

// ============= GUEST TO ACCOUNT MIGRATION =============
export async function migrateGuestDataToAccount(): Promise<{ success: boolean; migrated: { inventory: number; recipes: number; groceryLists: number } }> {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) {
    return { success: false, migrated: { inventory: 0, recipes: 0, groceryLists: 0 } };
  }
  
  const migrated = { inventory: 0, recipes: 0, groceryLists: 0 };
  
  try {
    // Migrate inventory
    const guestInventory = localStorage.getItem(GUEST_STORAGE_KEYS.inventory);
    if (guestInventory) {
      const items: Inventory[] = JSON.parse(guestInventory);
      for (const item of items) {
        const { id: _id, user_id: _userId, ...rest } = item;
        await supabase.from('user_inventory').insert({ ...rest, user_id: userId });
        migrated.inventory++;
      }
      localStorage.removeItem(GUEST_STORAGE_KEYS.inventory);
    }
    
    // Migrate recipes
    const guestRecipes = localStorage.getItem(GUEST_STORAGE_KEYS.recipes);
    if (guestRecipes) {
      const recipes: Recipe[] = JSON.parse(guestRecipes);
      for (const recipe of recipes) {
        const { id: _id, user_id: _userId, ...rest } = recipe;
        await supabase.from('recipes').insert({ ...rest, user_id: userId });
        migrated.recipes++;
      }
      localStorage.removeItem(GUEST_STORAGE_KEYS.recipes);
    }
    
    // Migrate grocery lists
    const guestLists = localStorage.getItem(GUEST_STORAGE_KEYS.groceryLists);
    if (guestLists) {
      const lists: GroceryList[] = JSON.parse(guestLists);
      for (const list of lists) {
        const { id: _id, user_id: _userId, ...rest } = list;
        await supabase.from('grocery_lists').insert({ ...rest, user_id: userId });
        migrated.groceryLists++;
      }
      localStorage.removeItem(GUEST_STORAGE_KEYS.groceryLists);
    }
    
    return { success: true, migrated };
  } catch {
    return { success: false, migrated };
  }
}
