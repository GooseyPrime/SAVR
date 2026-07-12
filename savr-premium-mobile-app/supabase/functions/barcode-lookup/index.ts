/**
 * SAVR Barcode Lookup Edge Function
 * Looks up product information from barcodes using Open Food Facts API (free, no API key needed)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductInfo {
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

function categorizeProduct(categories: string | undefined, productName: string): string {
  const catLower = (categories || '').toLowerCase();
  const nameLower = productName.toLowerCase();
  
  // Map Open Food Facts categories to SAVR categories
  if (catLower.includes('dairy') || catLower.includes('milk') || catLower.includes('cheese') || catLower.includes('yogurt')) {
    return 'dairy';
  }
  if (catLower.includes('meat') || catLower.includes('poultry') || catLower.includes('fish') || catLower.includes('seafood')) {
    return 'protein';
  }
  if (catLower.includes('fruit') || catLower.includes('vegetable') || nameLower.includes('apple') || nameLower.includes('banana')) {
    return 'produce';
  }
  if (catLower.includes('beverage') || catLower.includes('drink') || catLower.includes('juice') || catLower.includes('water')) {
    return 'beverages';
  }
  if (catLower.includes('cereal') || catLower.includes('bread') || catLower.includes('pasta') || catLower.includes('rice')) {
    return 'grains';
  }
  if (catLower.includes('snack') || catLower.includes('chip') || catLower.includes('cookie') || catLower.includes('candy')) {
    return 'snacks';
  }
  if (catLower.includes('frozen')) {
    return 'frozen';
  }
  if (catLower.includes('canned') || catLower.includes('preserved')) {
    return 'canned';
  }
  if (catLower.includes('sauce') || catLower.includes('condiment') || catLower.includes('spice') || catLower.includes('seasoning')) {
    return 'condiments';
  }
  
  return 'other';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean barcode - remove any non-numeric characters
    const cleanBarcode = barcode.replace(/\D/g, '');

    // Query Open Food Facts API (free, no API key needed)
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`,
      {
        headers: {
          'User-Agent': 'SAVR Food Assistant/1.0 - https://savr.app',
        },
      }
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to lookup barcode', found: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return new Response(
        JSON.stringify({ 
          error: 'Product not found', 
          found: false,
          barcode: cleanBarcode,
          suggestion: 'You can add this product manually or scan another item'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    const productInfo: ProductInfo = {
      barcode: cleanBarcode,
      name: product.product_name || product.product_name_en || 'Unknown Product',
      brand: product.brands,
      category: categorizeProduct(product.categories, product.product_name || ''),
      quantity: product.quantity,
      servingSize: product.serving_size,
      nutrition: {
        calories: nutriments['energy-kcal_100g'] || nutriments['energy-kcal'],
        protein: nutriments.proteins_100g ? `${nutriments.proteins_100g}g` : undefined,
        carbs: nutriments.carbohydrates_100g ? `${nutriments.carbohydrates_100g}g` : undefined,
        fat: nutriments.fat_100g ? `${nutriments.fat_100g}g` : undefined,
        fiber: nutriments.fiber_100g ? `${nutriments.fiber_100g}g` : undefined,
        sugar: nutriments.sugars_100g ? `${nutriments.sugars_100g}g` : undefined,
        sodium: nutriments.sodium_100g ? `${Math.round(nutriments.sodium_100g * 1000)}mg` : undefined,
      },
      ingredients: product.ingredients_text || product.ingredients_text_en,
      allergens: product.allergens_tags?.map((a: string) => a.replace('en:', '').replace(/-/g, ' ')),
      imageUrl: product.image_front_url || product.image_url,
      nutriscore: product.nutriscore_grade?.toUpperCase(),
      isOrganic: product.labels_tags?.some((l: string) => l.includes('organic')),
      isVegan: product.labels_tags?.some((l: string) => l.includes('vegan')),
      isVegetarian: product.labels_tags?.some((l: string) => l.includes('vegetarian')),
    };

    return new Response(
      JSON.stringify({ found: true, product: productInfo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in barcode-lookup:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
