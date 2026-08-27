import OpenAI from 'openai';
import { resolveCatalogNutrition, type NutritionSource } from './nutrition';
import type { NutritionalInfo } from '../types/functions';

export type QuantitySource =
  | 'label_net_weight'
  | 'counted_units'
  | 'fill_estimate'
  | 'container_default'
  | 'user';

export type ContainerType =
  | 'can' | 'jar' | 'bottle' | 'carton' | 'bag' | 'box' | 'tub' | 'produce' | 'leftover' | 'unknown';

export interface PantryProposal {
  clientId: string;
  name: string;
  genericName: string;
  brand?: string;
  container: ContainerType;
  quantity: number;
  unit: string;
  packageSize?: string;
  fillFraction?: number;
  location: 'fridge' | 'freezer' | 'pantry';
  expiryDate?: string;
  barcode?: string;
  fdcId?: string;
  offId?: string;
  nutrition?: NutritionalInfo;
  nutritionSource: NutritionSource;
  quantitySource: QuantitySource;
  confidence: { identity: number; quantity: number; overall: number };
  needsReview: boolean;
  warnings: string[];
}

const CONTAINER_DEFAULTS: Record<ContainerType, { quantity: number; unit: string; packageSize: string }> = {
  can: { quantity: 1, unit: 'can', packageSize: '14.5 oz' },
  jar: { quantity: 1, unit: 'jar', packageSize: '16 oz' },
  bottle: { quantity: 1, unit: 'bottle', packageSize: '16 oz' },
  carton: { quantity: 1, unit: 'carton', packageSize: '0.5 gal' },
  bag: { quantity: 1, unit: 'bag', packageSize: '12 oz' },
  box: { quantity: 1, unit: 'box', packageSize: '12 oz' },
  tub: { quantity: 1, unit: 'tub', packageSize: '16 oz' },
  produce: { quantity: 1, unit: 'count', packageSize: '1 count' },
  leftover: { quantity: 1, unit: 'container', packageSize: 'unknown' },
  unknown: { quantity: 1, unit: 'item', packageSize: 'unknown' },
};

let openaiInstance: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required.');
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

interface RawVisionItem {
  name?: string; genericName?: string; brand?: string; container?: string;
  quantity?: number; unit?: string; packageSize?: string; fillFraction?: number;
  location?: string; expiryDate?: string; barcode?: string; quantitySource?: string;
  identityConfidence?: number; quantityConfidence?: number;
}

function clamp01(n: number | undefined, fallback: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeContainer(raw?: string): ContainerType {
  const key = (raw || '').toLowerCase();
  if (key in CONTAINER_DEFAULTS) return key as ContainerType;
  if (key.includes('can')) return 'can';
  if (key.includes('jar')) return 'jar';
  if (key.includes('bottle')) return 'bottle';
  if (key.includes('carton')) return 'carton';
  if (key.includes('bag')) return 'bag';
  if (key.includes('box')) return 'box';
  if (key.includes('tub')) return 'tub';
  if (key.includes('produce') || key.includes('fruit') || key.includes('veg')) return 'produce';
  return 'unknown';
}

export async function analyzePantrySnapshot(imageUrl: string): Promise<PantryProposal[]> {
  const prompt = `Analyze this pantry, fridge, freezer, or counter photo.
Identify EACH distinct food item. Barcodes are often hidden — do not require them.
Return JSON {"items":[{name,genericName,brand,container,quantity,unit,packageSize,fillFraction,location,expiryDate,barcode,quantitySource,identityConfidence,quantityConfidence}]}
container must be one of can,jar,bottle,carton,bag,box,tub,produce,leftover,unknown.
location must be fridge, freezer, or pantry.
quantitySource must be label_net_weight, counted_units, fill_estimate, or container_default.`;

  const primary = process.env.OPENAI_MODEL_VISION_PRIMARY || 'gpt-4o';
  const fallback = process.env.OPENAI_MODEL_VISION_FALLBACK || 'gpt-4o-mini';
  const run = (model: string) => getOpenAI().chat.completions.create({
    model,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }] }],
    max_tokens: 2500,
    response_format: { type: 'json_object' },
  });

  let completion;
  try { completion = await run(primary); } catch { completion = await run(fallback); }

  let rawItems: RawVisionItem[] = [];
  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{"items":[]}');
    rawItems = Array.isArray(parsed) ? parsed : parsed.items || [];
  } catch { rawItems = []; }

  return Promise.all(rawItems.slice(0, 24).map(async (raw, index) => {
    const container = normalizeContainer(raw.container);
    const defaults = CONTAINER_DEFAULTS[container];
    const name = (raw.name || raw.genericName || 'Unknown item').trim();
    const genericName = (raw.genericName || name).trim();
    const quantity = typeof raw.quantity === 'number' && raw.quantity > 0 ? raw.quantity : defaults.quantity;
    const unit = (raw.unit || defaults.unit).trim();
    const quantitySource = (raw.packageSize ? 'label_net_weight' : raw.quantitySource) as QuantitySource;
    const allowed: QuantitySource[] = ['label_net_weight', 'counted_units', 'fill_estimate', 'container_default', 'user'];
    const safeQtySource: QuantitySource = allowed.includes(quantitySource) ? quantitySource : 'container_default';
    const identity = clamp01(raw.identityConfidence, 0.6);
    const qtyConf = clamp01(raw.quantityConfidence, safeQtySource === 'container_default' ? 0.45 : 0.7);
    const overall = Number((identity * 0.65 + qtyConf * 0.35).toFixed(2));
    const warnings: string[] = [];
    if (!raw.barcode) warnings.push('Barcode not visible — identified from the photo.');
    if (safeQtySource === 'container_default' || safeQtySource === 'fill_estimate') {
      warnings.push('Size estimated from the photo.');
    }
    let nutrition: NutritionalInfo | undefined;
    let nutritionSource: NutritionSource = 'llm_estimate';
    let fdcId: string | undefined;
    let offId: string | undefined;
    let packageSize = raw.packageSize;
    let barcode = raw.barcode?.replace(/\D/g, '') || undefined;
    const locRaw = (raw.location || '').toLowerCase();
    const location: PantryProposal['location'] = locRaw.includes('freeze') ? 'freezer' : locRaw.includes('fridge') || locRaw.includes('refriger') ? 'fridge' : 'pantry';
    try {
      const catalog = await resolveCatalogNutrition({ name: genericName || name, brand: raw.brand, barcode });
      if (catalog) {
        nutrition = catalog.nutrition;
        nutritionSource = catalog.source;
        fdcId = catalog.fdcId;
        offId = catalog.offId;
        packageSize = packageSize || catalog.packageSize;
        barcode = barcode || catalog.barcode;
      }
    } catch {
      warnings.push('Catalog lookup unavailable.');
    }
    if (!nutrition) {
      nutritionSource = 'llm_estimate';
      warnings.push('Estimated nutrition — not from the label.');
    } else if (nutritionSource !== 'llm_estimate') {
      warnings.push(`Nutrition from ${nutritionSource.replace(/_/g, ' ')} (per 100g unless noted).`);
    }
    return {
      clientId: `snap_${Date.now()}_${index}`,
      name, genericName, brand: raw.brand?.trim() || undefined, container, quantity, unit,
      packageSize: packageSize || defaults.packageSize, fillFraction: raw.fillFraction, location,
      expiryDate: raw.expiryDate, barcode, fdcId, offId, nutrition, nutritionSource,
      quantitySource: safeQtySource,
      confidence: { identity, quantity: qtyConf, overall },
      needsReview: overall < 0.72 || nutritionSource === 'llm_estimate' || safeQtySource === 'container_default',
      warnings: Array.from(new Set(warnings)),
    };
  }));
}
