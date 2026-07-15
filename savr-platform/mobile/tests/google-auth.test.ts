/**
 * Unit tests for the Google OAuth callback parser and session-exchange
 * decision logic in savr-platform/mobile/src/lib/google-auth-utils.ts.
 *
 * These tests do not require a device, emulator, or live Supabase connection.
 * They cover the pure-logic surface that can be validated in a Node.js runner.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { parseOAuthCallback, shouldExchangeSession, type AuthSessionResult } from '../src/lib/google-auth-utils';

// ---------------------------------------------------------------------------
// parseOAuthCallback
// ---------------------------------------------------------------------------

test('parseOAuthCallback: returns tokens from a valid hash fragment', () => {
  const url =
    'savr://auth/callback#access_token=acc123&refresh_token=ref456&token_type=bearer&expires_in=3600';
  const result = parseOAuthCallback(url);
  assert.ok(result !== null, 'expected non-null result');
  assert.equal(result.access_token, 'acc123');
  assert.equal(result.refresh_token, 'ref456');
});

test('parseOAuthCallback: returns null when URL has no hash fragment', () => {
  const url = 'savr://auth/callback';
  assert.equal(parseOAuthCallback(url), null);
});

test('parseOAuthCallback: returns null when access_token is missing', () => {
  const url = 'savr://auth/callback#refresh_token=ref456&token_type=bearer';
  assert.equal(parseOAuthCallback(url), null);
});

test('parseOAuthCallback: returns null when refresh_token is missing', () => {
  const url = 'savr://auth/callback#access_token=acc123&token_type=bearer';
  assert.equal(parseOAuthCallback(url), null);
});

test('parseOAuthCallback: returns null when both tokens are missing', () => {
  const url = 'savr://auth/callback#token_type=bearer&expires_in=3600';
  assert.equal(parseOAuthCallback(url), null);
});

test('parseOAuthCallback: returns null for an empty string', () => {
  assert.equal(parseOAuthCallback(''), null);
});

test('parseOAuthCallback: returns null for a hash-only URL with no params', () => {
  assert.equal(parseOAuthCallback('savr://auth/callback#'), null);
});

test('parseOAuthCallback: handles URL with query params before the hash', () => {
  const url =
    'savr://auth/callback?code=ignored#access_token=acc789&refresh_token=ref012';
  const result = parseOAuthCallback(url);
  assert.ok(result !== null);
  assert.equal(result.access_token, 'acc789');
  assert.equal(result.refresh_token, 'ref012');
});

test('parseOAuthCallback: handles URL-encoded token values', () => {
  const url =
    'savr://auth/callback#access_token=a%2Bb%3Dc&refresh_token=x%2Fy%3Dz';
  const result = parseOAuthCallback(url);
  assert.ok(result !== null);
  assert.equal(result.access_token, 'a+b=c');
  assert.equal(result.refresh_token, 'x/y=z');
});

// ---------------------------------------------------------------------------
// shouldExchangeSession
// ---------------------------------------------------------------------------

test('shouldExchangeSession: returns true for a success result with a URL', () => {
  const result: AuthSessionResult = { type: 'success', url: 'savr://auth/callback#access_token=a&refresh_token=r' };
  assert.equal(shouldExchangeSession(result), true);
});

test('shouldExchangeSession: returns false for a cancel result', () => {
  const result: AuthSessionResult = { type: 'cancel' };
  assert.equal(shouldExchangeSession(result), false);
});

test('shouldExchangeSession: returns false for a dismiss result', () => {
  const result: AuthSessionResult = { type: 'dismiss' };
  assert.equal(shouldExchangeSession(result), false);
});

test('shouldExchangeSession: returns false for a locked result', () => {
  const result: AuthSessionResult = { type: 'locked' };
  assert.equal(shouldExchangeSession(result), false);
});

test('shouldExchangeSession: returns false for a success result with an empty URL', () => {
  const result: AuthSessionResult = { type: 'success', url: '' };
  assert.equal(shouldExchangeSession(result), false);
});
