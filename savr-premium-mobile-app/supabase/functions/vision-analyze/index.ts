/**
 * SAVR Vision Analysis
 * Google Cloud Vision for image analysis, OCR, and product recognition
 * Falls back to OpenRouter vision models if Google Vision unavailable
 */

import { corsHeaders, handleCors } from '../_shared/cors.ts';

interface VisionRequest {
  imageBase64: string;
  analysisTypes: ('labels' | 'text' | 'objects' | 'products' | 'food')[];
  mode?: 'human' | 'dog' | 'cat';
}

interface DetectedItem {
  name: string;
  confidence: number;
  category?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface ExtractedText {
  text: string;
  confidence: number;
  blocks?: { text: string; boundingBox?: object }[];
}

interface VisionResponse {
  items: DetectedItem[];
  text?: ExtractedText;
  labels: string[];
  rawText?: string;
  provider: 'google_vision' | 'openrouter';
}

// Google Cloud Vision API
async function analyzeWithGoogleVision(
  imageBase64: string,
  features: string[]
): Promise<{
  labels: { description: string; score: number }[];
  text?: { text: string; confidence: number };
  objects: { name: string; score: number; boundingPoly?: object }[];
  products: { productCategory?: string; name?: string; score?: number }[];
} | null> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
  if (!apiKey) return null;
  
  // Map our feature types to Google Vision feature types
  const googleFeatures = features.map(f => {
    switch (f) {
      case 'labels': return { type: 'LABEL_DETECTION', maxResults: 20 };
      case 'text': return { type: 'TEXT_DETECTION' };
      case 'objects': return { type: 'OBJECT_LOCALIZATION', maxResults: 20 };
      case 'products': return { type: 'PRODUCT_SEARCH' };
      case 'food': return { type: 'LABEL_DETECTION', maxResults: 30 };
      default: return { type: 'LABEL_DETECTION' };
    }
  });
  
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: googleFeatures,
          }],
        }),
      }
    );
    
    if (!response.ok) {
      console.error('Google Vision API error:', await response.text());
      return null;
    }
    
    const data = await response.json();
    const result = data.responses?.[0];
    
    if (!result) return null;
    
    return {
      labels: (result.labelAnnotations ?? []).map((l: { description: string; score: number }) => ({
        description: l.description,
        score: l.score,
      })),
      text: result.fullTextAnnotation ? {
        text: result.fullTextAnnotation.text,
        confidence: result.fullTextAnnotation.pages?.[0]?.confidence ?? 0.9,
      } : undefined,
      objects: (result.localizedObjectAnnotations ?? []).map((o: { name: string; score: number; boundingPoly?: object }) => ({
        name: o.name,
        score: o.score,
        boundingPoly: o.boundingPoly,
      })),
      products: result.productSearchResults?.results ?? [],
    };
  } catch (error) {
    console.error('Google Vision error:', error);
    return null;
  }
}

// OpenRouter Vision fallback
async function analyzeWithOpenRouter(
  imageBase64: string,
  mode: 'human' | 'dog' | 'cat'
): Promise<VisionResponse | null> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) return null;
  
  const systemPrompt = `You are an expert food and grocery item analyzer for the SAVR culinary app.
Analyze the image and identify all food items, ingredients, and grocery products visible.

For each item detected, provide:
1. The item name (specific and accurate)
2. A confidence score (0.0 to 1.0)
3. A category (produce, dairy, meat, pantry, beverage, frozen, etc.)

Also extract any visible text from labels, packaging, or nutrition information.

${mode !== 'human' ? `IMPORTANT: This analysis is for ${mode} food. Flag any items that may be toxic or harmful to ${mode}s.` : ''}

Respond in JSON format:
{
  "items": [{ "name": "string", "confidence": number, "category": "string" }],
  "labels": ["string"],
  "extractedText": "string or null",
  "warnings": ["string"] // only for pet mode
}`;
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://savr.app',
        'X-Title': 'SAVR Vision Analysis',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image and identify all food items and text:' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });
    
    if (!response.ok) {
      console.error('OpenRouter Vision error:', await response.text());
      return null;
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content ?? '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      items: parsed.items ?? [],
      labels: parsed.labels ?? [],
      rawText: parsed.extractedText,
      text: parsed.extractedText ? { text: parsed.extractedText, confidence: 0.8 } : undefined,
      provider: 'openrouter',
    };
  } catch (error) {
    console.error('OpenRouter Vision error:', error);
    return null;
  }
}

// Food categorization
function categorizeItem(labels: string[]): string {
  const labelSet = new Set(labels.map(l => l.toLowerCase()));
  
  if (labelSet.has('fruit') || labelSet.has('vegetable') || labelSet.has('produce')) return 'produce';
  if (labelSet.has('meat') || labelSet.has('poultry') || labelSet.has('beef') || labelSet.has('chicken')) return 'meat';
  if (labelSet.has('dairy') || labelSet.has('milk') || labelSet.has('cheese') || labelSet.has('yogurt')) return 'dairy';
  if (labelSet.has('bread') || labelSet.has('bakery') || labelSet.has('pastry')) return 'bakery';
  if (labelSet.has('beverage') || labelSet.has('drink') || labelSet.has('juice') || labelSet.has('soda')) return 'beverage';
  if (labelSet.has('frozen') || labelSet.has('ice cream')) return 'frozen';
  if (labelSet.has('snack') || labelSet.has('chips') || labelSet.has('candy')) return 'snacks';
  if (labelSet.has('canned') || labelSet.has('can')) return 'canned';
  if (labelSet.has('spice') || labelSet.has('seasoning') || labelSet.has('herb')) return 'spices';
  if (labelSet.has('sauce') || labelSet.has('condiment')) return 'condiments';
  if (labelSet.has('grain') || labelSet.has('rice') || labelSet.has('pasta') || labelSet.has('cereal')) return 'grains';
  
  return 'pantry';
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    const body: VisionRequest = await req.json();
    
    // Validate request
    if (!body.imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate image size (max 10MB base64 ~ 7.5MB raw)
    if (body.imageBase64.length > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Maximum size is 10MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const analysisTypes = body.analysisTypes ?? ['labels', 'text', 'objects'];
    const mode = body.mode ?? 'human';
    
    // Try Google Vision first
    const googleResult = await analyzeWithGoogleVision(body.imageBase64, analysisTypes);
    
    if (googleResult) {
      // Process Google Vision results
      const items: DetectedItem[] = [];
      
      // Add labeled items
      for (const label of googleResult.labels) {
        if (label.score > 0.6) {
          items.push({
            name: label.description,
            confidence: label.score,
            category: categorizeItem([label.description]),
          });
        }
      }
      
      // Add detected objects
      for (const obj of googleResult.objects) {
        if (obj.score > 0.5) {
          items.push({
            name: obj.name,
            confidence: obj.score,
            category: categorizeItem([obj.name]),
          });
        }
      }
      
      // Deduplicate by name
      const uniqueItems = items.reduce((acc, item) => {
        const existing = acc.find(i => i.name.toLowerCase() === item.name.toLowerCase());
        if (!existing || item.confidence > existing.confidence) {
          return [...acc.filter(i => i.name.toLowerCase() !== item.name.toLowerCase()), item];
        }
        return acc;
      }, [] as DetectedItem[]);
      
      const response: VisionResponse = {
        items: uniqueItems,
        text: googleResult.text,
        labels: googleResult.labels.map(l => l.description),
        rawText: googleResult.text?.text,
        provider: 'google_vision',
      };
      
      console.log(JSON.stringify({
        type: 'vision_analysis',
        provider: 'google_vision',
        itemCount: uniqueItems.length,
        hasText: !!googleResult.text,
        mode,
      }));
      
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fallback to OpenRouter Vision
    const openRouterResult = await analyzeWithOpenRouter(body.imageBase64, mode);
    
    if (openRouterResult) {
      console.log(JSON.stringify({
        type: 'vision_analysis',
        provider: 'openrouter',
        itemCount: openRouterResult.items.length,
        hasText: !!openRouterResult.text,
        mode,
      }));
      
      return new Response(
        JSON.stringify(openRouterResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No providers available
    return new Response(
      JSON.stringify({ error: 'No vision analysis providers available' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Vision analysis error:', message);
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
