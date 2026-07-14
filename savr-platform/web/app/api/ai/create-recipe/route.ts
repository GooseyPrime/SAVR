import { NextRequest, NextResponse } from 'next/server';
import { getRecipeQuotaRule } from '@/lib/ai-rate-limit';
import { authenticateRequest, enforceAiUsageLimit, getUserBillingSnapshot } from '@/lib/middleware';
import { generateRecipe } from '@/lib/services/ai';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;
  
  const { user, supabase } = auth;
  const body = await request.json();
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
  const preferences = body.preferences;
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

    const result = await generateRecipe(
      ingredients,
      preferences,
      recipeType === 'pet' ? { mode: 'pet', species } : { mode: 'human' }
    );
    
    // Optionally save to database
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: result.recipe.title,
        description: result.recipe.description,
        ingredients: result.recipe.ingredients,
        instructions: result.recipe.instructions,
        is_ai_generated: true,
        cuisine: result.recipe.cuisine,
        dietary_tags: result.recipe.dietaryTags,
        prep_time_minutes: result.recipe.prepTime,
        cook_time_minutes: result.recipe.cookTime,
        servings: result.recipe.servings,
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
    });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  }
}
