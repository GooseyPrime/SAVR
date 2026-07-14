import assert from 'node:assert/strict';
import test from 'node:test';

import { isPaidTier } from '../src/types';

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
