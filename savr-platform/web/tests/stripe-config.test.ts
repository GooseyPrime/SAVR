import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStripeConfigDiagnostics,
  getStripeInstance,
  isStripeConfigured,
} from '../lib/stripe';

// Short, obviously fake placeholder: the tests assert key-mode detection and
// character hygiene, never key format, so no realistic key belongs here.
const VALID_KEY = 'sk_test_not_a_real_key';

function withSecretKey<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.STRIPE_SECRET_KEY;
  if (value === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous;
  }
}

test('getStripeInstance accepts a key pasted with a trailing CRLF', () => {
  withSecretKey(`${VALID_KEY}\r\n`, () => {
    assert.doesNotThrow(() => getStripeInstance());
  });
});

test('isStripeConfigured is false when the key carries an embedded break', () => {
  withSecretKey('sk_test_aaa\nbbb', () => {
    assert.equal(isStripeConfigured(), false);
  });
});

test('getStripeInstance rejects an unusable key with an actionable message', () => {
  withSecretKey('sk_test_aaa\nbbb', () => {
    assert.throws(() => getStripeInstance(), /STRIPE_SECRET_KEY is misconfigured/);
  });
});

test('getStripeInstance rebuilds the client when the key changes', () => {
  const first = withSecretKey(VALID_KEY, () => getStripeInstance());
  const second = withSecretKey(`${VALID_KEY}zz`, () => getStripeInstance());
  assert.notEqual(first, second);
});

test('diagnostics report the key mode and never leak the value', () => {
  withSecretKey(`${VALID_KEY}\r\n`, () => {
    const diagnostics = getStripeConfigDiagnostics();
    assert.equal(diagnostics.keyMode, 'test');
    assert.equal(diagnostics.secretKey.usable, true);
    assert.equal(diagnostics.secretKey.hadSurroundingWhitespace, true);
    assert.equal(JSON.stringify(diagnostics).includes(VALID_KEY), false);
  });
});

test('diagnostics flag a live key that cannot be used', () => {
  withSecretKey('sk_live_aaa bbb', () => {
    const diagnostics = getStripeConfigDiagnostics();
    assert.equal(diagnostics.keyMode, 'live');
    assert.equal(diagnostics.secretKey.present, true);
    assert.equal(diagnostics.secretKey.usable, false);
  });
});
