/**
 * Dependency-tree integrity gate (savr-platform/scripts/check-dependency-tree.mjs).
 *
 * The gate defers to npm's own range resolution (`npm ls --all --json`), so
 * these tests cover how it reads that report and that CI runs it for every
 * workspace. The problem strings are npm's exact wording for the React
 * Navigation and ws peer mismatches found on GooseyPrime/SAVR#181.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { classifyTreeProblems } from '../../scripts/check-dependency-tree.mjs';

const ROOT = path.join(__dirname, '..', '..');

test('dependency tree: invalid peer resolutions block', () => {
  const { blocking: problems } = classifyTreeProblems({
    name: 'mobile',
    problems: [
      'invalid: @react-navigation/native@7.3.18 /app/node_modules/@react-navigation/native',
      'invalid: ws@7.5.11 /app/node_modules/ws',
      'invalid: ws@7.5.11 /app/node_modules/ws',
    ],
    dependencies: {},
  });
  assert.deepEqual(problems, [
    'invalid: @react-navigation/native@7.3.18 /app/node_modules/@react-navigation/native',
    'invalid: ws@7.5.11 /app/node_modules/ws',
  ]);
});

test('dependency tree: missing packages block; extraneous ones are only reported', () => {
  const result = classifyTreeProblems({
    problems: [
      'missing: react@19.2.3, required by mobile@1.0.0',
      'extraneous: @img/sharp-wasm32@0.35.5 /app/node_modules/@img/sharp-wasm32',
    ],
  });
  assert.deepEqual(result.blocking, ['missing: react@19.2.3, required by mobile@1.0.0']);
  assert.deepEqual(result.informational, ['extraneous: @img/sharp-wasm32@0.35.5 /app/node_modules/@img/sharp-wasm32']);
});

test('dependency tree: a consistent tree passes', () => {
  assert.deepEqual(classifyTreeProblems({ name: 'web', version: '0.1.0', dependencies: { next: { version: '16.3.8' } } }), { blocking: [], informational: [] });
});

test('dependency tree: an unreadable report fails closed', () => {
  assert.throws(() => classifyTreeProblems(null), /JSON object/);
  assert.throws(() => classifyTreeProblems([]), /JSON object/);
  assert.throws(() => classifyTreeProblems({ problems: 'invalid: ws' }), /unexpected problems field/);
});

test('dependency tree: CI runs the gate after a clean install for every workspace', () => {
  const workflow = readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'phase-06-hardening.yml'), 'utf8');
  const job = workflow.slice(workflow.indexOf('\n  dependency-tree:\n'), workflow.indexOf('\n  security-audit:\n'));
  assert.ok(job.length > 0, 'dependency-tree job exists');
  for (const pkg of ['web', 'mobile', 'e2e-tests']) {
    assert.match(job, new RegExp(`- package: ${pkg}\\n\\s+working-directory: savr-platform/${pkg}\\n`));
  }
  assert.match(job, /run: npm ci\n[\s\S]*run: node \.\.\/scripts\/check-dependency-tree\.mjs\n/);
  assert.doesNotMatch(job, /continue-on-error|legacy-peer-deps|--force|\|\| true/);
  assert.match(workflow, /- 'savr-platform\/scripts\/\*\*'/);
});
