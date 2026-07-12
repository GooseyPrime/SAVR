/**
 * SAVR Pet Safety Validation
 * Deterministic validation of ingredients for pet safety
 * Does NOT rely on AI prompts alone - provides hard validation layer
 */

// Toxic ingredients for dogs - normalized lowercase
const DOG_TOXIC_INGREDIENTS: Set<string> = new Set([
  // Severely toxic
  'chocolate', 'cocoa', 'cacao', 'dark chocolate', 'milk chocolate', 'white chocolate',
  'theobromine', 'caffeine', 'coffee', 'espresso', 'tea',
  'xylitol', 'birch sugar', 'sugar alcohol',
  'grapes', 'raisins', 'currants', 'sultanas',
  'macadamia', 'macadamia nuts', 'macadamia nut',
  'onion', 'onions', 'green onion', 'green onions', 'scallion', 'scallions',
  'garlic', 'garlic powder', 'garlic salt', 'minced garlic',
  'chives', 'leeks', 'shallots', 'shallot',
  'alcohol', 'beer', 'wine', 'liquor', 'ethanol',
  'avocado', 'avocado pit', 'avocado skin', 'persin',
  'nutmeg', 'mace',
  // Moderately toxic
  'salt', 'excessive salt', 'soy sauce', 'fish sauce',
  'raw yeast', 'yeast dough', 'bread dough',
  'hops', 'hop',
  'persimmon', 'persimmons',
  'rhubarb', 'rhubarb leaves',
  'tomato leaves', 'tomato stem', 'green tomato',
  'potato leaves', 'potato stem', 'green potato', 'raw potato',
  'mushroom', 'wild mushroom', 'wild mushrooms',
  // Common additives to avoid
  'artificial sweetener', 'sweetener', 'erythritol', 'sorbitol',
  'preservative', 'bht', 'bha', 'ethoxyquin',
]);

// Toxic ingredients for cats - normalized lowercase
const CAT_TOXIC_INGREDIENTS: Set<string> = new Set([
  // All dog toxins plus cat-specific
  ...DOG_TOXIC_INGREDIENTS,
  // Cat-specific toxins
  'lily', 'lilies', 'lily flower', 'lily pollen',
  'raw fish', 'raw salmon', 'raw trout', 'raw tuna',
  'raw eggs', 'raw egg', 'raw egg white',
  'raw meat', 'raw pork', 'raw chicken', 'raw beef',
  'citrus', 'lemon', 'lime', 'orange', 'grapefruit', 'citrus oil',
  'essential oil', 'essential oils', 'tea tree oil', 'eucalyptus oil',
  'dairy', 'milk', 'cream', 'cheese', 'ice cream', 'yogurt',
  'bones', 'cooked bones', 'chicken bones', 'fish bones',
]);

// Get the appropriate toxic set for the mode
function getToxicSet(mode: 'dog' | 'cat'): Set<string> {
  return mode === 'dog' ? DOG_TOXIC_INGREDIENTS : CAT_TOXIC_INGREDIENTS;
}

// Normalize ingredient text for comparison
function normalizeIngredient(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Check if an ingredient matches any toxic item
function matchesToxicIngredient(ingredient: string, toxicSet: Set<string>): string | null {
  const normalized = normalizeIngredient(ingredient);
  
  // Direct match
  if (toxicSet.has(normalized)) {
    return normalized;
  }
  
  // Partial match - check if any toxic ingredient is contained in the ingredient
  for (const toxic of toxicSet) {
    if (normalized.includes(toxic) || toxic.includes(normalized)) {
      return toxic;
    }
  }
  
  return null;
}

export interface PetSafetyResult {
  safe: boolean;
  toxicIngredients: { ingredient: string; toxicMatch: string }[];
  warnings: string[];
}

/**
 * Validate a list of ingredients for pet safety
 * @param ingredients - Array of ingredient names or full ingredient strings
 * @param mode - 'dog' or 'cat'
 * @returns Safety result with any toxic matches
 */
export function validatePetSafety(
  ingredients: string[],
  mode: 'dog' | 'cat'
): PetSafetyResult {
  const toxicSet = getToxicSet(mode);
  const toxicIngredients: { ingredient: string; toxicMatch: string }[] = [];
  const warnings: string[] = [];
  
  for (const ingredient of ingredients) {
    const match = matchesToxicIngredient(ingredient, toxicSet);
    if (match) {
      toxicIngredients.push({ ingredient, toxicMatch: match });
    }
  }
  
  // Add general warnings
  if (mode === 'dog') {
    warnings.push('Always verify ingredients are safe for your specific dog breed.');
    warnings.push('Consult your veterinarian before making dietary changes.');
  } else {
    warnings.push('Always verify ingredients are safe for your specific cat.');
    warnings.push('Consult your veterinarian before making dietary changes.');
  }
  
  return {
    safe: toxicIngredients.length === 0,
    toxicIngredients,
    warnings,
  };
}

/**
 * Validate a recipe for pet safety
 * @param recipe - Recipe with ingredients array
 * @param mode - 'dog' or 'cat'
 * @returns Safety result
 */
export function validateRecipeSafety(
  recipe: { ingredients: { name: string }[] | string[] },
  mode: 'dog' | 'cat'
): PetSafetyResult {
  const ingredientNames = recipe.ingredients.map((ing) =>
    typeof ing === 'string' ? ing : ing.name
  );
  return validatePetSafety(ingredientNames, mode);
}

/**
 * Get list of all toxic ingredients for a pet type
 * Useful for UI display or documentation
 */
export function getToxicIngredientsList(mode: 'dog' | 'cat'): string[] {
  return Array.from(getToxicSet(mode)).sort();
}

/**
 * Check if a single ingredient is safe for a pet
 */
export function isIngredientSafe(ingredient: string, mode: 'dog' | 'cat'): boolean {
  const toxicSet = getToxicSet(mode);
  return matchesToxicIngredient(ingredient, toxicSet) === null;
}
