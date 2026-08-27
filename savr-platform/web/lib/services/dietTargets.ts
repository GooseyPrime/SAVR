import type { NutritionalInfo } from '../types/functions';

export type DietKey =
  | 'keto'
  | 'diabetic-friendly'
  | 'low-sodium'
  | 'low-fat'
  | 'low-calorie'
  | 'high-protein'
  | 'paleo'
  | 'vegan'
  | 'vegetarian';

export interface NutrientBound {
  nutrient: keyof NutritionalInfo;
  min?: number;
  max?: number;
  label: string;
}

export interface DietProfile {
  key: DietKey;
  label: string;
  aliases: string[];
  perServing: NutrientBound[];
  notes: string;
}

export const DIET_PROFILES: DietProfile[] = [
  {
    key: 'keto',
    label: 'Keto',
    aliases: ['keto', 'ketogenic', 'low carb', 'low-carb'],
    perServing: [
      { nutrient: 'carbs', max: 12, label: 'net-style carbs' },
      { nutrient: 'sugar', max: 5, label: 'sugar' },
    ],
    notes: 'Keep carbs very low per serving. Not medical advice.',
  },
  {
    key: 'diabetic-friendly',
    label: 'Diabetic-friendly',
    aliases: ['diabetic', 'diabetes', 'diabetic-friendly', 'blood sugar'],
    perServing: [
      { nutrient: 'sugar', max: 8, label: 'sugar' },
      { nutrient: 'carbs', max: 45, label: 'carbs' },
      { nutrient: 'fiber', min: 4, label: 'fiber' },
    ],
    notes: 'Lower added sugar, moderate carbs, some fiber. Not medical advice.',
  },
  {
    key: 'low-sodium',
    label: 'Low-sodium',
    aliases: ['low-sodium', 'low sodium', 'low salt'],
    perServing: [{ nutrient: 'sodium', max: 500, label: 'sodium' }],
    notes: 'Cap sodium around 500mg per serving.',
  },
  {
    key: 'low-fat',
    label: 'Low-fat',
    aliases: ['low-fat', 'low fat', 'lean'],
    perServing: [{ nutrient: 'fat', max: 12, label: 'fat' }],
    notes: 'Keep fat modest per serving.',
  },
  {
    key: 'low-calorie',
    label: 'Low-calorie',
    aliases: ['low-calorie', 'low calorie', 'calorie deficit', 'weight loss'],
    perServing: [{ nutrient: 'calories', max: 450, label: 'calories' }],
    notes: 'Target under 450 kcal per serving unless the user sets another goal.',
  },
  {
    key: 'high-protein',
    label: 'High-protein',
    aliases: ['high-protein', 'high protein', 'protein'],
    perServing: [{ nutrient: 'protein', min: 25, label: 'protein' }],
    notes: 'Aim for at least 25g protein per serving.',
  },
  {
    key: 'paleo',
    label: 'Paleo',
    aliases: ['paleo'],
    perServing: [],
    notes: 'Ingredient pattern (no grains/legumes/dairy) is enforced in generation, not macros.',
  },
  {
    key: 'vegan',
    label: 'Vegan',
    aliases: ['vegan'],
    perServing: [],
    notes: 'Ingredient pattern only.',
  },
  {
    key: 'vegetarian',
    label: 'Vegetarian',
    aliases: ['vegetarian'],
    perServing: [],
    notes: 'Ingredient pattern only.',
  },
];

export function matchDietProfiles(dietary?: string[]): DietProfile[] {
  if (!dietary?.length) return [];
  const tokens = dietary.map((d) => d.toLowerCase().trim());
  return DIET_PROFILES.filter((profile) =>
    tokens.some((token) =>
      profile.aliases.some((alias) => token.includes(alias) || alias.includes(token))
    )
  );
}

export function emptyNutrition(): NutritionalInfo {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };
}

export function addNutrition(a: NutritionalInfo, b: NutritionalInfo): NutritionalInfo {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    sodium: a.sodium + b.sodium,
  };
}

export function scaleNutrition(n: NutritionalInfo, factor: number): NutritionalInfo {
  const s = (v: number) => Number((v * factor).toFixed(1));
  return {
    calories: Math.round(n.calories * factor),
    protein: s(n.protein),
    carbs: s(n.carbs),
    fat: s(n.fat),
    fiber: s(n.fiber),
    sugar: s(n.sugar),
    sodium: Math.round(n.sodium * factor),
  };
}
