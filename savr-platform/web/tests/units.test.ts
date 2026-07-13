import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aiIngredientsToExtracted,
  normalizeAiIngredients,
  normalizeQuantity,
  normalizeUnit,
} from '../lib/utils/units';
import { filterIngredientsForPet, PET_RECIPE_DISCLAIMER } from '../lib/config/forbiddenFoods';

test('normalizeUnit maps known aliases and preserves unknown values', () => {
  assert.equal(normalizeUnit(' Cups '), 'cup');
  assert.equal(normalizeUnit('pcs'), 'piece');
  assert.equal(normalizeUnit('pinch'), 'pinch');
  assert.equal(normalizeUnit('   '), '');
});

test('normalizeQuantity handles approximate text, ranges, and fallbacks', () => {
  assert.deepEqual(normalizeQuantity('about 2'), { quantity: 2 });
  assert.deepEqual(normalizeQuantity('1 to 3'), { quantity: 2, approximate: true });
  assert.deepEqual(normalizeQuantity(undefined), { quantity: 1, approximate: true });
  assert.deepEqual(normalizeQuantity('handful'), { quantity: 1, approximate: true });
});

test('normalizeAiIngredients validates inputs and keeps production-safe defaults', () => {
  assert.deepEqual(normalizeAiIngredients([
    { name: 'Carrots', quantity: '1-2', unit: 'cups' },
    { name: 'Olive oil' },
  ]), [
    {
      name: 'Carrots',
      quantity: 1.5,
      unit: 'cup',
      approximate: true,
      confidence: undefined,
    },
    {
      name: 'Olive oil',
      quantity: 1,
      unit: 'piece',
      approximate: undefined,
      confidence: undefined,
    },
  ]);

  assert.throws(
    () => normalizeAiIngredients([{ quantity: 1 }]),
    /Ingredient name is required/
  );
});

test('aiIngredientsToExtracted assigns the production default confidence', () => {
  assert.deepEqual(aiIngredientsToExtracted([
    { name: 'Rice', quantity: 2, unit: 'cup', confidence: undefined, approximate: false },
  ]), [
    { name: 'Rice', quantity: 2, unit: 'cup', confidence: 0.5 },
  ]);
});

test('filterIngredientsForPet removes toxic ingredients for each species', () => {
  assert.deepEqual(filterIngredientsForPet(
    ['Chicken breast', 'dark chocolate chips', 'Blueberries'],
    'dog'
  ), {
    safe: ['Chicken breast', 'Blueberries'],
    removed: ['dark chocolate chips'],
  });

  assert.deepEqual(filterIngredientsForPet(
    ['Salmon', 'Garlic powder', 'Pumpkin'],
    'cat'
  ), {
    safe: ['Salmon', 'Pumpkin'],
    removed: ['Garlic powder'],
  });

  assert.match(PET_RECIPE_DISCLAIMER, /consult your veterinarian/i);
});
