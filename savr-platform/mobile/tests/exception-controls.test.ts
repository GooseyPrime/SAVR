/**
 * ADR-005 compensating control: expo-updates code signing stays unset.
 *
 * The control reads Expo's resolved configuration (`expo config --json`), so
 * signing enabled through an imported module, a spread, a computed key or a
 * config plugin is caught even when `codeSigningCertificate` never appears in
 * app.config.ts.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  checkMobileUpdateSigning,
  resolveExpoConfig,
} from '../../security/exception-controls.mjs';

const PROJECT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'exception-controls');

test('the resolved SAVR app config does not enable update code signing', () => {
  const exp = resolveExpoConfig(PROJECT);
  assert.equal(exp.slug, 'savr');
  assert.deepEqual(checkMobileUpdateSigning(PROJECT), []);
});

test('signing from an imported module with a computed key is detected', () => {
  const dir = path.join(FIXTURES, 'imported-computed-key');
  assert.doesNotMatch(readFileSync(path.join(dir, 'app.config.ts'), 'utf8'), /codeSigning/);
  assert.doesNotMatch(readFileSync(path.join(dir, 'signing.js'), 'utf8'), /codeSigningCertificate/);
  const updates = resolveExpoConfig(dir).updates as Record<string, unknown>;
  assert.equal(updates.codeSigningCertificate, './certs/certificate.pem');
  const problems = checkMobileUpdateSigning(dir);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /updates\.codeSigningCertificate/);
});

test('signing applied by a config plugin is detected', () => {
  const dir = path.join(FIXTURES, 'config-plugin');
  assert.doesNotMatch(readFileSync(path.join(dir, 'app.config.ts'), 'utf8'), /codeSigning/);
  const problems = checkMobileUpdateSigning(dir);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /updates\.codeSigningMetadata/);
});

test('signing in a static app.json is detected', () => {
  const problems = checkMobileUpdateSigning(path.join(FIXTURES, 'static-json'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /updates\.codeSigningCertificate/);
});

test('a spread updates block without signing passes', () => {
  assert.deepEqual(checkMobileUpdateSigning(path.join(FIXTURES, 'unsigned')), []);
});

test('an unresolvable project fails closed', () => {
  assert.throws(() => checkMobileUpdateSigning(path.join(FIXTURES, 'does-not-exist')), /expo config failed/);
});
