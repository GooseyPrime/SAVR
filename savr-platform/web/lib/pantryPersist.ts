import { encodePantryNutritionNote, type PantryNutritionPayload } from '@/lib/services/recipeNutrition';

export function pantryNotesFromScan(input: {
  nutrition?: PantryNutritionPayload['nutrition'];
  nutritionSource?: string;
  barcode?: string;
  fdcId?: string;
  packageSize?: string;
  quantitySource?: string;
  notes?: string;
}): string | undefined {
  if (typeof input.notes === 'string' && input.notes.includes('SAVR_NUTRI:')) {
    return input.notes;
  }
  if (!input.nutrition && !input.barcode && !input.fdcId) return input.notes;
  return encodePantryNutritionNote({
    nutrition: input.nutrition,
    nutritionSource: input.nutritionSource,
    barcode: input.barcode,
    fdcId: input.fdcId,
    packageSize: input.packageSize,
    quantitySource: input.quantitySource,
    basis: 'per_100g',
  });
}

export function pantryCategory(
  value: unknown
): 'pantry' | 'fridge' | 'freezer' {
  return value === 'fridge' || value === 'freezer' ? value : 'pantry';
}
