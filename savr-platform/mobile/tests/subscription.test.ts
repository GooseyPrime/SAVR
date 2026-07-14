import assert from 'node:assert/strict';
import test from 'node:test';

import { isPaidTier, isProTier } from '../src/types';

test('isPaidTier keeps every recognized billing tier truthy for entitlement reconciliation', () => {
  assert.equal(isPaidTier('basic'), true);
  assert.equal(isPaidTier('pro'), true);
  assert.equal(isPaidTier('free'), true);
  assert.equal(isPaidTier('plus'), true);
  assert.equal(isPaidTier('premium'), true);
});

test('isPaidTier rejects missing or unknown tier values', () => {
  assert.equal(isPaidTier(undefined), false);
  assert.equal(isPaidTier('legacy' as never), false);
});

test('isProTier returns true only for pro and premium tiers', () => {
  assert.equal(isProTier('pro'), true);
  assert.equal(isProTier('premium'), true);
});

test('isProTier returns false for non-Pro tiers and missing values', () => {
  assert.equal(isProTier('basic'), false);
  assert.equal(isProTier('free'), false);
  assert.equal(isProTier('plus'), false);
  assert.equal(isProTier(undefined), false);
  assert.equal(isProTier('legacy' as never), false);
});
