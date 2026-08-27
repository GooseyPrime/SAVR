import type { NutritionalInfo } from '../types/functions';
import {
  addNutrition,
  emptyNutrition,
  matchDietProfiles,
  scaleNutrition,
  type DietProfile,
} from './dietTargets';

export const PANTRY_NUTRITION_NOTE_PREFIX = 'SAVR_NUTRI:';

export interface PantryNutritionPayload {
  nutrition?: NutritionalInfo;
  nutritionSource?: string;
  barcode?: string;
  fdcId?: string;
  packageSize?: string;
  quantitySource?: string;
  basis?: 'per_100g' | 'per_serving' | 'per_package';
}

export interface IngredientNutritionLine {
  name: string;
  quantity: number;
  unit: string;
  gramsEstimated: number;
  nutrition: NutritionalInfo;
  source: 'pantry' | 'catalog' | 'missing';
  matchedPantryName?: string;
}

export interface DietViolation {
  diet: string;
  nutrient: string;
  value: number;
  min?: number;
  max?: number;
}

export interface ScaledRecipeNutrition {
  recipeTotal: NutritionalInfo;
  perServing: NutritionalInfo;
  servings: number;
  lines: IngredientNutritionLine[];
  diets: DietProfile['label'][];
  violations: DietViolation[];
  compliant: boolean;
  suggestedServingFraction: number;
  compliantPerServing: NutritionalInfo;
  coverage: number;
}

function gramsFromUnit(quantity: number, unit: string): number {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const u = (unit || '').toLowerCase().trim();
  const map: Record<string, number> = {
    g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000,
    oz: 28.35, ounce: 28.35, ounces: 28.35,
    lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6,
    ml: 1, milliliter: 1, l: 1000, liter: 1000,
    cup: 240, cups: 240, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5,
    can: 411, jar: 454, bottle: 355, carton: 473, bag: 340, box: 340,
    tub: 227, package: 300, piece: 100, count: 100, item: 100, container: 200,
  };
  return q * (map[u] ?? 100);
}

export function encodePantryNutritionNote(payload: PantryNutritionPayload): string {
  return `${PANTRY_NUTRITION_NOTE_PREFIX}${JSON.stringify(payload)}`;
}

export function decodePantryNutritionNote(
  notes?: string | null
): PantryNutritionPayload | null {
  if (!notes) return null;
  const idx = notes.indexOf(PANTRY_NUTRITION_NOTE_PREFIX);
  if (idx === -1) return null;
  const raw = notes.slice(idx + PANTRY_NUTRITION_NOTE_PREFIX.length).trim();
  try {
    return JSON.parse(raw) as PantryNutritionPayload;
  } catch {
    return null;
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nutritionFromPayload(
  payload: PantryNutritionPayload | null,
  grams: number
): NutritionalInfo | null {
  if (!payload?.nutrition) return null;
  const basis = payload.basis || 'per_100g';
  if (basis === 'per_100g') return scaleNutrition(payload.nutrition, grams / 100);
  if (basis === 'per_package') return scaleNutrition(payload.nutrition, Math.max(grams / 400, 0.25));
  return payload.nutrition;
}

export function matchPantryItem<T extends { name: string }>(
  ingredientName: string,
  pantry: T[]
): T | undefined {
  const target = normalizeName(ingredientName);
  if (!target) return undefined;
  const exact = pantry.find((item) => normalizeName(item.name) === target);
  if (exact) return exact;
  return pantry.find((item) => {
    const n = normalizeName(item.name);
    return n.includes(target) || target.includes(n);
  });
}

export function scaleRecipeNutrition(input: {
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  servings?: number;
  dietary?: string[];
  pantry: Array<{ name: string; notes?: string | null; quantity?: number; unit?: string }>;
}): ScaledRecipeNutrition {
  const servings = Math.max(1, Number(input.servings) || 4);
  const diets = matchDietProfiles(input.dietary);
  const lines: IngredientNutritionLine[] = input.ingredients.map((ing) => {
    const quantity = typeof ing.quantity === 'number' ? ing.quantity : 1;
    const unit = ing.unit || 'piece';
    const gramsEstimated = gramsFromUnit(quantity, unit);
    const pantryItem = matchPantryItem(ing.name, input.pantry);
    const payload = decodePantryNutritionNote(pantryItem?.notes);
    const nutrition = nutritionFromPayload(payload, gramsEstimated);
    if (nutrition) {
      return {
        name: ing.name,
        quantity,
        unit,
        gramsEstimated: Math.round(gramsEstimated),
        nutrition,
        source: 'pantry' as const,
        matchedPantryName: pantryItem?.name,
      };
    }
    return {
      name: ing.name,
      quantity,
      unit,
      gramsEstimated: Math.round(gramsEstimated),
      nutrition: emptyNutrition(),
      source: 'missing' as const,
    };
  });

  const recipeTotal = lines.reduce((acc, line) => addNutrition(acc, line.nutrition), emptyNutrition());
  const perServing = scaleNutrition(recipeTotal, 1 / servings);
  const known = lines.filter((l) => l.source !== 'missing').length;
  const coverage = lines.length ? Number((known / lines.length).toFixed(2)) : 0;

  const violations: DietViolation[] = [];
  for (const diet of diets) {
    for (const bound of diet.perServing) {
      const value = perServing[bound.nutrient];
      if (bound.max != null && value > bound.max) {
        violations.push({ diet: diet.label, nutrient: bound.label, value, max: bound.max });
      }
      if (bound.min != null && value < bound.min) {
        violations.push({ diet: diet.label, nutrient: bound.label, value, min: bound.min });
      }
    }
  }

  let suggestedServingFraction = 1;
  for (const v of violations) {
    if (v.max != null && v.value > 0) {
      suggestedServingFraction = Math.min(suggestedServingFraction, v.max / v.value);
    }
  }
  suggestedServingFraction = Number(Math.max(0.35, suggestedServingFraction).toFixed(2));

  return {
    recipeTotal,
    perServing,
    servings,
    lines,
    diets: diets.map((d) => d.label),
    violations,
    compliant: violations.length === 0,
    suggestedServingFraction,
    compliantPerServing: scaleNutrition(perServing, suggestedServingFraction),
    coverage,
  };
}

export function dietGuidanceForPrompt(dietary?: string[]): string {
  const diets = matchDietProfiles(dietary);
  if (!diets.length) return '';
  const lines = diets.flatMap((diet) =>
    diet.perServing.map((b) => {
      if (b.max != null && b.min != null) return `${diet.label}: ${b.label} between ${b.min} and ${b.max} per serving`;
      if (b.max != null) return `${diet.label}: ${b.label} <= ${b.max} per serving`;
      if (b.min != null) return `${diet.label}: ${b.label} >= ${b.min} per serving`;
      return '';
    })
  );
  return `HARD PORTION LIMITS (per serving, not the whole recipe):\n${lines.filter(Boolean).join('\n')}`;
}
