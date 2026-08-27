import type { NutritionalInfo } from '../types/functions';

export type NutritionSource =
  | 'gtin'
  | 'open_food_facts'
  | 'usda_fdc'
  | 'label_ocr'
  | 'llm_estimate';

export interface CatalogNutritionHit {
  name?: string;
  brand?: string;
  barcode?: string;
  fdcId?: string;
  offId?: string;
  packageSize?: string;
  nutrition?: NutritionalInfo;
  source: NutritionSource;
  per100g?: NutritionalInfo;
}

const OFF_UA = 'SAVR/1.0 (https://savr.cam; pantry-snapshot)';

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function packNutrition(n: {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}): NutritionalInfo | undefined {
  if (
    n.calories == null &&
    n.protein == null &&
    n.carbs == null &&
    n.fat == null
  ) {
    return undefined;
  }
  return {
    calories: n.calories ?? 0,
    protein: n.protein ?? 0,
    carbs: n.carbs ?? 0,
    fat: n.fat ?? 0,
    fiber: n.fiber ?? 0,
    sugar: n.sugar ?? 0,
    sodium: n.sodium ?? 0,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupOpenFoodFactsByBarcode(
  barcode: string
): Promise<CatalogNutritionHit | null> {
  const code = barcode.replace(/\D/g, '');
  if (code.length < 8 || !/^\d+$/.test(code)) return null;

  const data = (await fetchJson(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json`,
    { headers: { 'User-Agent': OFF_UA } }
  )) as {
    status?: number;
    product?: Record<string, unknown>;
  } | null;

  if (!data || data.status !== 1 || !data.product) return null;
  return mapOffProduct(data.product, 'gtin');
}

export async function searchOpenFoodFacts(
  query: string
): Promise<CatalogNutritionHit | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=5`;
  const data = (await fetchJson(url, {
    headers: { 'User-Agent': OFF_UA },
  })) as { products?: Array<Record<string, unknown>> } | null;

  const product = data?.products?.[0];
  if (!product) return null;
  return mapOffProduct(product, 'open_food_facts');
}

function mapOffProduct(
  p: Record<string, unknown>,
  source: NutritionSource
): CatalogNutritionHit {
  const nutriments = (p.nutriments || {}) as Record<string, unknown>;
  const nutrition = packNutrition({
    calories: num(nutriments['energy-kcal_100g']) ?? num(nutriments['energy-kcal']),
    protein: num(nutriments.proteins_100g) ?? num(nutriments.proteins),
    carbs: num(nutriments.carbohydrates_100g) ?? num(nutriments.carbohydrates),
    fat: num(nutriments.fat_100g) ?? num(nutriments.fat),
    fiber: num(nutriments.fiber_100g) ?? num(nutriments.fiber),
    sugar: num(nutriments.sugars_100g) ?? num(nutriments.sugars),
    sodium:
      num(nutriments.sodium_100g) != null
        ? Math.round((num(nutriments.sodium_100g) as number) * 1000)
        : num(nutriments.sodium),
  });

  const name =
    String(p.product_name_en || p.product_name || p.generic_name || '').trim() ||
    undefined;
  const brand = String(p.brands || '').split(',')[0]?.trim() || undefined;
  const barcode = String(p.code || p._id || '').trim() || undefined;
  const packageSize = String(p.quantity || p.serving_size || '').trim() || undefined;

  return {
    name,
    brand,
    barcode,
    offId: barcode,
    packageSize,
    nutrition,
    source,
  };
}

export async function searchUsdaFdc(
  query: string
): Promise<CatalogNutritionHit | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const apiKey = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}` +
    `&query=${encodeURIComponent(q)}&pageSize=5&dataType=Foundation,SR%20Legacy,Branded`;

  const data = (await fetchJson(url)) as {
    foods?: Array<{
      fdcId?: number;
      description?: string;
      brandOwner?: string;
      brandName?: string;
      gtinUpc?: string;
      servingSize?: number;
      servingSizeUnit?: string;
      householdServingFullText?: string;
      foodNutrients?: Array<{
        nutrientName?: string;
        nutrientNumber?: string;
        value?: number;
        unitName?: string;
      }>;
    }>;
  } | null;

  const food = data?.foods?.[0];
  if (!food) return null;

  const byName = (names: string[]) => {
    const row = food.foodNutrients?.find((n) =>
      names.some((name) =>
        (n.nutrientName || '').toLowerCase().includes(name.toLowerCase())
      )
    );
    return num(row?.value);
  };

  const sodiumMg = (() => {
    const row = food.foodNutrients?.find((n) =>
      (n.nutrientName || '').toLowerCase().includes('sodium')
    );
    if (!row) return undefined;
    const value = num(row.value);
    if (value == null) return undefined;
    return (row.unitName || '').toLowerCase() === 'g' ? value * 1000 : value;
  })();

  const nutrition = packNutrition({
    calories: byName(['Energy']),
    protein: byName(['Protein']),
    carbs: byName(['Carbohydrate']),
    fat: byName(['Total lipid', 'Total fat']),
    fiber: byName(['Fiber']),
    sugar: byName(['Sugars, total', 'Total sugars']),
    sodium: sodiumMg,
  });

  const packageSize =
    food.householdServingFullText ||
    (food.servingSize
      ? `${food.servingSize} ${food.servingSizeUnit || ''}`.trim()
      : undefined);

  return {
    name: food.description,
    brand: food.brandName || food.brandOwner,
    barcode: food.gtinUpc,
    fdcId: food.fdcId ? String(food.fdcId) : undefined,
    packageSize,
    nutrition,
    source: 'usda_fdc',
  };
}

export async function resolveCatalogNutrition(input: {
  name: string;
  brand?: string;
  barcode?: string;
}): Promise<CatalogNutritionHit | null> {
  if (input.barcode) {
    const byCode = await lookupOpenFoodFactsByBarcode(input.barcode);
    if (byCode?.nutrition) return byCode;
  }

  const query = [input.brand, input.name].filter(Boolean).join(' ').trim();
  const off = await searchOpenFoodFacts(query);
  if (off?.nutrition && input.brand) return off;

  const usda = await searchUsdaFdc(input.name);
  if (usda?.nutrition) return usda;

  return off;
}
