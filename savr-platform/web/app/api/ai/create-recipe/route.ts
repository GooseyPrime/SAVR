import { NextRequest, NextResponse } from 'next/server';
import { getRecipeQuotaRule } from '@/lib/ai-rate-limit';
import { authenticateRequest, enforceAiUsageLimit, getUserBillingSnapshot } from '@/lib/middleware';
import { generateRecipe } from '@/lib/services/ai';
import {
  decodePantryNutritionNote,
  dietGuidanceForPrompt,
  scaleRecipeNutrition,
} from '@/lib/services/recipeNutrition';

function parseIngredients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry: unknown): entry is string => typeof entry === 'string' && entry.trim().length > 0
  );
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const { user, supabase } = auth;
  const body = await request.json();
  const ingredients = parseIngredients(body.ingredients);
  const preferences = body.preferences || {};
  const recipeType = body.recipeType === 'pet' ? 'pet' : 'human';
  const species = body.species === 'cat' ? 'cat' : 'dog';

  if (ingredients.length === 0) {
    return NextResponse.json({ error: 'At least one ingredient is required' }, { status: 400 });
  }

  try {
    const billing = await getUserBillingSnapshot(user.id);
    const quotaRule = getRecipeQuotaRule(billing, recipeType);

    if (quotaRule) {
      const rateCheck = await enforceAiUsageLimit(user.id, quotaRule);
      if (!rateCheck.allowed) {
        return rateCheck.error;
      }
    }

    const { data: pantryRows } = await supabase
      .from('inventory')
      .select('name, quantity, unit, notes')
      .eq('user_id', user.id);

    const pantry = (pantryRows || []).map((row) => ({
      name: row.name as string,
      quantity: Number(row.quantity) || undefined,
      unit: (row.unit as string) || undefined,
      notes: (row.notes as string) || null,
    }));

    const dietLine = dietGuidanceForPrompt(preferences.dietary);
    const pantryContext = ingredients.map((name) => {
      const hit = pantry.find((item) =>
        item.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(item.name.toLowerCase())
      );
      const payload = decodePantryNutritionNote(hit?.notes);
      if (!payload?.nutrition) return name;
      const n = payload.nutrition;
      return `${name} [pantry ${payload.nutritionSource || 'catalog'} per 100g: ${n.calories} kcal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fat}g fat, ${n.fiber}g fiber, ${n.sugar}g sugar, ${n.sodium}mg sodium]`;
    });

    const result = await generateRecipe(
      dietLine ? [...pantryContext, dietLine] : pantryContext,
      preferences,
      recipeType === 'pet' ? { mode: 'pet', species } : { mode: 'human' }
    );

    const scaled = scaleRecipeNutrition({
      ingredients: (result.recipe.ingredients || []).map((ing) => ({
        name: ing.name,
        quantity: typeof ing.quantity === 'number' ? ing.quantity : Number(ing.quantity) || 1,
        unit: String(ing.unit || 'piece'),
      })),
      servings: result.recipe.servings,
      dietary: preferences.dietary,
      pantry,
    });

    const nutrition = scaled.coverage > 0 ? scaled.perServing : result.recipe.nutrition;
    if (nutrition) result.recipe.nutrition = nutrition;

    const { data, error } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: result.recipe.title,
        description: result.recipe.description,
        ingredients: (result.recipe.ingredients || []).map((ing, idx) => ({
          ...ing,
          nutrition: scaled.lines[idx]?.nutrition,
          nutritionSource: scaled.lines[idx]?.source,
          gramsEstimated: scaled.lines[idx]?.gramsEstimated,
        })),
        instructions: result.recipe.instructions,
        is_ai_generated: true,
        cuisine: result.recipe.cuisine,
        dietary_tags: result.recipe.dietaryTags,
        prep_time_minutes: result.recipe.prepTime,
        cook_time_minutes: result.recipe.cookTime,
        servings: result.recipe.servings,
        nutritional_info: {
          perServing: nutrition,
          recipeTotal: scaled.recipeTotal,
          coverage: scaled.coverage,
          diets: scaled.diets,
          compliant: scaled.compliant,
          violations: scaled.violations,
          suggestedServingFraction: scaled.suggestedServingFraction,
          compliantPerServing: scaled.compliantPerServing,
          source: scaled.coverage > 0 ? 'pantry_scaled' : 'llm_estimate',
        },
        notes: scaled.compliant
          ? null
          : `Diet caps exceeded for a full serving. Suggested portion: ${Math.round(scaled.suggestedServingFraction * 100)}% of one serving to stay within ${scaled.diets.join(', ')}.`,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      recipeId: data.id,
      recipe: data,
      recipeType,
      species: recipeType === 'pet' ? species : undefined,
      removedForSafety: result.removedForSafety,
      nutritionScale: scaled,
    });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  }
}
