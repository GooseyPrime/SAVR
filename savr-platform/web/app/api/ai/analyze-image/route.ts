import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, checkRateLimit } from '@/lib/middleware';
import { analyzePantrySnapshot } from '@/lib/services/pantrySnapshot';
import { extractIngredientsFromImage } from '@/lib/services/ai';
import { encodePantryNutritionNote } from '@/lib/services/recipeNutrition';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const { user } = auth;
  const rateCheck = await checkRateLimit(user.id, 'analyze-image', 100, 60000);
  if (!rateCheck.allowed) return rateCheck.error;

  const { imageUrl } = await request.json();
  if (!imageUrl) {
    return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
  }

  try {
    const proposals = await analyzePantrySnapshot(imageUrl);
    const mappedProposals = proposals.map((p) => ({
      ...p,
      notes: encodePantryNutritionNote({
        nutrition: p.nutrition,
        nutritionSource: p.nutritionSource,
        barcode: p.barcode,
        fdcId: p.fdcId,
        packageSize: p.packageSize,
        quantitySource: p.quantitySource,
        basis: 'per_100g',
      }),
    }));
    const ingredients = mappedProposals.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      confidence: p.confidence.overall,
      category: p.location,
      brand: p.brand,
      packageSize: p.packageSize,
      nutrition: p.nutrition,
      nutritionSource: p.nutritionSource,
      quantitySource: p.quantitySource,
      needsReview: p.needsReview,
      warnings: p.warnings,
      barcode: p.barcode,
      fdcId: p.fdcId,
      expiryDate: p.expiryDate,
      container: p.container,
      notes: p.notes,
    }));
    return NextResponse.json({ success: true, ingredients, proposals: mappedProposals });
  } catch (error) {
    console.error('Pantry snapshot failed, falling back to basic vision:', error);
    try {
      const rawIngredients = await extractIngredientsFromImage(imageUrl);
      const ingredients = rawIngredients.map((ing) => ({
        ...ing,
        category: 'pantry' as const,
        notes: encodePantryNutritionNote({
          nutritionSource: 'llm_estimate',
          quantitySource: 'container_default',
          basis: 'per_100g',
        }),
      }));
      return NextResponse.json({
        success: true,
        ingredients,
        proposals: ingredients.map((ing, index) => ({
          clientId: `fallback_${index}`,
          name: ing.name,
          genericName: ing.name,
          container: 'unknown',
          quantity: ing.quantity,
          unit: ing.unit,
          location: 'pantry',
          nutritionSource: 'llm_estimate',
          quantitySource: 'container_default',
          confidence: { identity: ing.confidence, quantity: 0.5, overall: ing.confidence },
          needsReview: true,
          warnings: ['Size estimated from the photo.', 'Estimated nutrition — not from the label.'],
          notes: encodePantryNutritionNote({
            nutritionSource: 'llm_estimate',
            quantitySource: 'container_default',
            basis: 'per_100g',
          }),
        })),
      });
    } catch (fallbackError) {
      console.error('Error analyzing image:', fallbackError);
      return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
    }
  }
}
