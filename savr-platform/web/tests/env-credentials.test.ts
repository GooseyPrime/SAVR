import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CredentialFormatError,
  CredentialMissingError,
  inspectCredentialEnv,
  normalizeCredential,
  readCredentialEnv,
} from '../lib/env-credentials';

// Deliberately not shaped like a real provider key: these fixtures exercise
// character hygiene, not key format, and must not trip secret scanning.
const VALID_KEY = 'credential-value-0123456789';

test('normalizeCredential returns a clean value unchanged', () => {
  assert.equal(normalizeCredential('STRIPE_SECRET_KEY', VALID_KEY), VALID_KEY);
});

test('normalizeCredential strips a trailing CRLF from a pasted secret', () => {
  // Regression: a Windows line break on the Vercel value made every Stripe
  // request fail with ERR_INVALID_CHAR on the Authorization header.
  assert.equal(normalizeCredential('STRIPE_SECRET_KEY', `${VALID_KEY}\r\n`), VALID_KEY);
  assert.equal(normalizeCredential('STRIPE_SECRET_KEY', `${VALID_KEY}\n`), VALID_KEY);
  assert.equal(normalizeCredential('STRIPE_SECRET_KEY', `  ${VALID_KEY}\t `), VALID_KEY);
});

test('normalizeCredential strips a byte-order mark', () => {
  assert.equal(normalizeCredential('STRIPE_SECRET_KEY', `﻿${VALID_KEY}`), VALID_KEY);
});

test('normalizeCredential rejects an embedded line break with position detail', () => {
  const broken = `${VALID_KEY.slice(0, 10)}\n${VALID_KEY.slice(10)}`;
  assert.throws(
    () => normalizeCredential('STRIPE_SECRET_KEY', broken),
    (error: unknown) => {
      assert.ok(error instanceof CredentialFormatError);
      assert.equal(error.variableName, 'STRIPE_SECRET_KEY');
      assert.match(error.message, /line feed/);
      assert.match(error.message, /position 11/);
      return true;
    },
  );
});

test('normalizeCredential never echoes the credential value', () => {
  const broken = `${VALID_KEY} extra`;
  try {
    normalizeCredential('STRIPE_SECRET_KEY', broken);
    assert.fail('expected a CredentialFormatError');
  } catch (error) {
    assert.ok(error instanceof CredentialFormatError);
    assert.equal(error.message.includes(VALID_KEY), false);
  }
});

test('normalizeCredential rejects a quoted value instead of unwrapping it', () => {
  assert.throws(
    () => normalizeCredential('STRIPE_SECRET_KEY', `"${VALID_KEY}"`),
    /wrapped in quotation marks/,
  );
});

test('normalizeCredential treats missing and blank values as unconfigured', () => {
  assert.throws(
    () => normalizeCredential('STRIPE_SECRET_KEY', undefined),
    CredentialMissingError,
  );
  assert.throws(
    () => normalizeCredential('STRIPE_SECRET_KEY', '   \r\n'),
    CredentialMissingError,
  );
});

test('readCredentialEnv reads and cleans from the process environment', () => {
  const previous = process.env.TEST_CREDENTIAL_ENV;
  process.env.TEST_CREDENTIAL_ENV = `${VALID_KEY}\r\n`;
  try {
    assert.equal(readCredentialEnv('TEST_CREDENTIAL_ENV'), VALID_KEY);
  } finally {
    if (previous === undefined) delete process.env.TEST_CREDENTIAL_ENV;
    else process.env.TEST_CREDENTIAL_ENV = previous;
  }
});

test('inspectCredentialEnv reports hygiene without exposing the value', () => {
  const previous = process.env.TEST_CREDENTIAL_ENV;
  process.env.TEST_CREDENTIAL_ENV = `${VALID_KEY}\r\n`;
  try {
    const report = inspectCredentialEnv('TEST_CREDENTIAL_ENV');
    assert.equal(report.present, true);
    assert.equal(report.usable, true);
    assert.equal(report.hadSurroundingWhitespace, true);
    assert.equal(report.length, VALID_KEY.length);
    assert.equal(JSON.stringify(report).includes(VALID_KEY), false);
  } finally {
    if (previous === undefined) delete process.env.TEST_CREDENTIAL_ENV;
    else process.env.TEST_CREDENTIAL_ENV = previous;
  }
});

test('inspectCredentialEnv flags an unusable value as not usable', () => {
  const previous = process.env.TEST_CREDENTIAL_ENV;
  process.env.TEST_CREDENTIAL_ENV = `sk_live_broken key`;
  try {
    const report = inspectCredentialEnv('TEST_CREDENTIAL_ENV');
    assert.equal(report.present, true);
    assert.equal(report.usable, false);
    assert.equal(report.length, 0);
    assert.match(report.problem ?? '', /position 15/);
  } finally {
    if (previous === undefined) delete process.env.TEST_CREDENTIAL_ENV;
    else process.env.TEST_CREDENTIAL_ENV = previous;
  }
});

test('inspectCredentialEnv reports an absent variable', () => {
  const previous = process.env.TEST_CREDENTIAL_ENV;
  delete process.env.TEST_CREDENTIAL_ENV;
  try {
    const report = inspectCredentialEnv('TEST_CREDENTIAL_ENV');
    assert.equal(report.present, false);
    assert.equal(report.usable, false);
  } finally {
    if (previous !== undefined) process.env.TEST_CREDENTIAL_ENV = previous;
  }
});
