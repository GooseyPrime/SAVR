import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, checkRateLimit } from '@/lib/middleware';
import {
  lookupOpenFoodFactsByBarcode,
  resolveCatalogNutrition,
} from '@/lib/services/nutrition';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth.error) return auth.error;

  const rateCheck = await checkRateLimit(auth.user.id, 'nutrition-lookup', 60, 60000);
  if (!rateCheck.allowed) {
    return rateCheck.error;
  }

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name : '';
  const brand = typeof body.brand === 'string' ? body.brand : undefined;
  const barcode = typeof body.barcode === 'string' ? body.barcode : undefined;

  if (!name && !barcode) {
    return NextResponse.json({ error: 'name or barcode required' }, { status: 400 });
  }

  try {
    const hit = barcode && !name
      ? await lookupOpenFoodFactsByBarcode(barcode)
      : await resolveCatalogNutrition({ name, brand, barcode });

    return NextResponse.json({ success: true, hit });
  } catch (error) {
    console.error('Nutrition lookup failed:', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
