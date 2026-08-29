import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSubscriptionPlanLabel,
  getSubscriptionStatusLabel,
  hasBasicAccess,
  hasProAccess,
  isKnownTier,
  isSubscriptionActive,
} from '../src/lib/billing';

// isKnownTier
test('isKnownTier accepts canonical tier values', () => {
  assert.equal(isKnownTier('basic'), true);
  assert.equal(isKnownTier('pro'), true);
});

test('isKnownTier rejects legacy and unknown tier values', () => {
  assert.equal(isKnownTier('free'), false);
  assert.equal(isKnownTier('plus'), false);
  assert.equal(isKnownTier('premium'), false);
  assert.equal(isKnownTier('legacy'), false);
  assert.equal(isKnownTier(undefined), false);
  assert.equal(isKnownTier(null), false);
  assert.equal(isKnownTier(''), false);
});

// isSubscriptionActive
test('isSubscriptionActive returns true for active and trialing', () => {
  assert.equal(isSubscriptionActive('active'), true);
  assert.equal(isSubscriptionActive('trialing'), true);
});

test('isSubscriptionActive returns false for non-entitling statuses', () => {
  assert.equal(isSubscriptionActive('pending'), false);
  assert.equal(isSubscriptionActive('canceled'), false);
  assert.equal(isSubscriptionActive('past_due'), false);
  assert.equal(isSubscriptionActive('incomplete'), false);
  assert.equal(isSubscriptionActive('incomplete_expired'), false);
  assert.equal(isSubscriptionActive('unpaid'), false);
  assert.equal(isSubscriptionActive(null), false);
  assert.equal(isSubscriptionActive(undefined), false);
});

test('getSubscriptionPlanLabel returns canonical plan names from tier', () => {
  assert.equal(getSubscriptionPlanLabel('basic'), 'Basic');
  assert.equal(getSubscriptionPlanLabel('pro'), 'Pro');
});

test('getSubscriptionPlanLabel surfaces unavailable or unknown plan state explicitly', () => {
  assert.equal(getSubscriptionPlanLabel(null), 'Unavailable');
  assert.equal(getSubscriptionPlanLabel(undefined), 'Unavailable');
  assert.equal(getSubscriptionPlanLabel('legacy'), 'Unavailable');
});

test('getSubscriptionStatusLabel returns readable labels for known statuses', () => {
  assert.equal(getSubscriptionStatusLabel('active'), 'Active');
  assert.equal(getSubscriptionStatusLabel('trialing'), 'Trialing');
  assert.equal(getSubscriptionStatusLabel('pending'), 'Pending');
  assert.equal(getSubscriptionStatusLabel('past_due'), 'Past due');
  assert.equal(getSubscriptionStatusLabel('canceled'), 'Canceled');
  assert.equal(getSubscriptionStatusLabel('incomplete'), 'Incomplete');
  assert.equal(getSubscriptionStatusLabel('incomplete_expired'), 'Expired');
  assert.equal(getSubscriptionStatusLabel('unpaid'), 'Unpaid');
});

test('getSubscriptionStatusLabel surfaces unavailable state explicitly', () => {
  assert.equal(getSubscriptionStatusLabel(null), 'Unavailable');
  assert.equal(getSubscriptionStatusLabel(undefined), 'Unavailable');
  assert.equal(getSubscriptionStatusLabel('legacy'), 'Unavailable');
});

// hasBasicAccess
test('hasBasicAccess: Basic active user has access', () => {
  assert.equal(hasBasicAccess({ subscriptionTier: 'basic', subscriptionStatus: 'active' }), true);
});

test('hasBasicAccess: Basic trialing user has access', () => {
  assert.equal(hasBasicAccess({ subscriptionTier: 'basic', subscriptionStatus: 'trialing' }), true);
});

test('hasBasicAccess: Pro active user has Basic access (Pro is superset)', () => {
  assert.equal(hasBasicAccess({ subscriptionTier: 'pro', subscriptionStatus: 'active' }), true);
});

test('hasBasicAccess: Basic pending user has no access (status not active)', () => {
  assert.equal(hasBasicAccess({ subscriptionTier: 'basic', subscriptionStatus: 'pending' }), false);
});

test('hasBasicAccess: Basic canceled user has no access', () => {
  assert.equal(hasBasicAccess({ subscriptionTier: 'basic', subscriptionStatus: 'canceled' }), false);
});

test('hasBasicAccess: null userData has no access', () => {
  assert.equal(hasBasicAccess(null), false);
  assert.equal(hasBasicAccess(undefined), false);
});

test('hasBasicAccess: legacy tier values grant no access', () => {
  assert.equal(hasBasicAccess({ subscriptionTier: 'free' as never, subscriptionStatus: 'active' }), false);
  assert.equal(hasBasicAccess({ subscriptionTier: 'plus' as never, subscriptionStatus: 'active' }), false);
  assert.equal(hasBasicAccess({ subscriptionTier: 'premium' as never, subscriptionStatus: 'active' }), false);
});

// hasProAccess
test('hasProAccess: Pro active user has Pro access', () => {
  assert.equal(hasProAccess({ subscriptionTier: 'pro', subscriptionStatus: 'active' }), true);
});

test('hasProAccess: Pro trialing user has Pro access', () => {
  assert.equal(hasProAccess({ subscriptionTier: 'pro', subscriptionStatus: 'trialing' }), true);
});

test('hasProAccess: Basic active user has no Pro access', () => {
  assert.equal(hasProAccess({ subscriptionTier: 'basic', subscriptionStatus: 'active' }), false);
});

test('hasProAccess: Pro past_due user has no access', () => {
  assert.equal(hasProAccess({ subscriptionTier: 'pro', subscriptionStatus: 'past_due' }), false);
});

test('hasProAccess: null userData has no access', () => {
  assert.equal(hasProAccess(null), false);
  assert.equal(hasProAccess(undefined), false);
});

test('hasProAccess: legacy tier values grant no Pro access', () => {
  assert.equal(hasProAccess({ subscriptionTier: 'premium' as never, subscriptionStatus: 'active' }), false);
  assert.equal(hasProAccess({ subscriptionTier: 'plus' as never, subscriptionStatus: 'active' }), false);
});
