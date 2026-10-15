/**
 * Regression tests for the advisory exception gate (ADR-005, approved 2026-10-13).
 *
 * Fixtures are real `npm audit --json` and `npm ls braces node-forge --all --json`
 * output captured from the supported lockfiles (mobile refreshed with #182), so every case is
 * deterministic and offline. The clock and the registry version lists are
 * injected, never read.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  collectBlockingAdvisories,
  evaluate,
  fixedVersionsAbove,
  formatReport,
  isApproved,
} from '../../security/audit-gate.mjs';
import {
  checkBundleSources,
  checkWebLintRootDir,
  findLintRootDir,
  findUpdateSigning,
  flattenFlatConfig,
} from '../../security/exception-controls.mjs';

const ROOT = path.join(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'audit-gate');

function readJson(file: string) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const COMMITTED = readJson(path.join(ROOT, 'security', 'audit-exceptions.json'));
/** The same records with approval withdrawn, held in memory only. */
const PENDING = { ...structuredClone(COMMITTED), approval: { status: 'pending', approvedBy: null, approvedAt: null } };
const BEFORE_EXPIRY = new Date('2026-10-13T12:00:00Z');
const PUBLISHED = {
  braces: ['2.3.2', '3.0.0', '3.0.1', '3.0.2', '3.0.3'],
  'node-forge': ['1.3.2', '1.3.3', '1.4.0'],
};

function fixture(workspace: 'web' | 'mobile') {
  return {
    auditJson: readJson(path.join(FIXTURES, `${workspace}-audit.json`)),
    lsJson: readJson(path.join(FIXTURES, `${workspace}-ls.json`)),
  };
}

/** A fresh copy of the committed (approved) records. */
function approved() {
  return structuredClone(COMMITTED);
}

function run(
  workspace: 'web' | 'mobile',
  overrides: Partial<Parameters<typeof evaluate>[0]> = {},
) {
  return evaluate({
    workspace,
    ...fixture(workspace),
    publishedVersions: PUBLISHED,
    exceptions: approved(),
    now: BEFORE_EXPIRY,
    ...overrides,
  });
}

// ── Committed proposal state ────────────────────────────────────

test('committed records: approved by Brandon on 2026-10-13, exactly three, all expiring 2026-11-12', () => {
  assert.deepEqual(
    { status: COMMITTED.approval.status, approvedBy: COMMITTED.approval.approvedBy, approvedAt: COMMITTED.approval.approvedAt },
    { status: 'approved', approvedBy: 'Brandon', approvedAt: '2026-10-13' },
  );
  assert.equal(isApproved(COMMITTED), true);
  assert.deepEqual(
    COMMITTED.records.map((r: { id: string; package: string; version: string; workspace: string }) =>
      `${r.workspace}:${r.id}:${r.package}@${r.version}`),
    [
      'web:GHSA-vfj7-8cjw-p6xm:braces@3.0.3',
      'mobile:GHSA-vfj7-8cjw-p6xm:braces@3.0.3',
      'mobile:GHSA-86w9-cpqp-85rv:node-forge@1.4.0',
    ],
  );
  for (const record of COMMITTED.records) assert.equal(record.expiresAt, '2026-11-12T00:00:00Z');
});

for (const workspace of ['web', 'mobile'] as const) {
  test(`${workspace}: without approval the gate blocks exactly like npm audit --audit-level=high`, () => {
    const result = run(workspace, { exceptions: PENDING });
    assert.equal(result.ok, false);
    assert.ok(result.findings.length > 0);
    assert.ok(result.findings.every((f: { decision: string }) => f.decision === 'BLOCKING'));
    // The only reason is the missing approval: paths, versions and dates all match.
    assert.ok(result.failures.every((f: string) => f.endsWith('exception is not approved (approval.status is not "approved")')));
  });

  test(`${workspace}: approved records pass only for the exact recorded findings`, () => {
    const result = run(workspace);
    assert.deepEqual(result.failures, []);
    assert.equal(result.ok, true);
    assert.ok(result.findings.every((f: { decision: string }) => f.decision === 'EXCEPTED until 2026-11-12T00:00:00Z'));
  });
}

test('blocking advisories in the real reports are exactly the two unpatched ones', () => {
  const ids = (w: 'web' | 'mobile') =>
    collectBlockingAdvisories(fixture(w).auditJson).map((a: { id: string; package: string }) => `${a.id}:${a.package}`).sort();
  assert.deepEqual(ids('web'), ['GHSA-vfj7-8cjw-p6xm:braces']);
  assert.deepEqual(ids('mobile'), ['GHSA-86w9-cpqp-85rv:node-forge', 'GHSA-vfj7-8cjw-p6xm:braces']);
});

test('moderate advisories stay non-blocking, matching --audit-level=high', () => {
  const mobile = fixture('mobile').auditJson;
  assert.ok(mobile.metadata.vulnerabilities.moderate > 0);
  assert.equal(run('mobile').ok, true);
});

test('report never hides names, versions or paths', () => {
  const report = formatReport('mobile', run('mobile'));
  assert.match(report, /GHSA-86w9-cpqp-85rv high node-forge@1\.4\.0/);
  assert.match(report, /path: expo@57\.0\.30 > @expo\/cli@57\.0\.31 > node-forge@1\.4\.0/);
  assert.match(report, /path: expo@57\.0\.30 > @expo\/metro@56\.0\.2 > metro-file-map@0\.84\.5 > micromatch@4\.0\.8 > braces@3\.0\.3/);
  assert.match(report, /audit-gate: PASS/);
});

// ── Failure modes ───────────────────────────────────────────────

test('expired record fails at and after 2026-11-12T00:00:00Z', () => {
  for (const now of ['2026-11-12T00:00:00Z', '2027-01-01T00:00:00Z']) {
    const result = run('web', { now: new Date(now) });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f: string) => f.includes('record expired at 2026-11-12T00:00:00Z')));
  }
  assert.equal(run('web', { now: new Date('2026-11-11T23:59:59Z') }).ok, true);
});

test('upstream fix published fails the gate (prereleases ignored)', () => {
  const withFix = run('mobile', {
    publishedVersions: { ...PUBLISHED, 'node-forge': [...PUBLISHED['node-forge'], '1.4.1'] },
  });
  assert.equal(withFix.ok, false);
  assert.ok(withFix.failures.some((f: string) => f.includes('upstream fix published (1.4.1)')));

  const prereleaseOnly = run('mobile', {
    publishedVersions: { ...PUBLISHED, braces: [...PUBLISHED.braces, '3.0.4-beta.1'] },
  });
  assert.equal(prereleaseOnly.ok, true);
  assert.deepEqual(fixedVersionsAbove(['3.0.3', '3.1.0', '4.0.0-rc.1'], '3.0.3'), ['3.1.0']);
});

test('unused record fails when its advisory disappears from the report', () => {
  const { auditJson, lsJson } = fixture('mobile');
  const audit = structuredClone(auditJson);
  delete audit.vulnerabilities['node-forge'];
  delete audit.vulnerabilities['@expo/code-signing-certificates'];
  for (const entry of Object.values(audit.vulnerabilities) as Array<{ via: unknown[] }>) {
    entry.via = entry.via.filter((v) => v !== 'node-forge' && v !== '@expo/code-signing-certificates');
  }
  const result = run('mobile', { auditJson: audit, lsJson });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('GHSA-86w9-cpqp-85rv (node-forge): unused record (no matching audit finding)'));
});

test('a new dependency path to an excepted package fails', () => {
  const ls = structuredClone(fixture('web').lsJson);
  ls.dependencies['some-new-tool'] = {
    version: '1.0.0',
    dependencies: { micromatch: { version: '4.0.8', dependencies: { braces: { version: '3.0.3' } } } },
  };
  const result = run('web', { lsJson: ls });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f: string) => f.includes('new dependency path: some-new-tool@1.0.0 > micromatch@4.0.8 > braces@3.0.3')));
});

test('a recorded path that disappears fails', () => {
  const ls = structuredClone(fixture('mobile').lsJson);
  delete ls.dependencies.expo.dependencies['@expo/cli'].dependencies['@expo/code-signing-certificates'];
  const result = run('mobile', { lsJson: ls });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f: string) => f.includes('recorded path no longer present')));
});

test('a changed installed version fails', () => {
  const ls = structuredClone(fixture('web').lsJson);
  const walk = (node: { dependencies?: Record<string, { version: string; dependencies?: unknown }> }) => {
    for (const [name, child] of Object.entries(node.dependencies ?? {})) {
      if (name === 'braces') child.version = '3.0.2';
      walk(child as never);
    }
  };
  walk(ls);
  const result = run('web', { lsJson: ls });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f: string) => f.includes('installed version(s) 3.0.2 differ from recorded 3.0.3')));
});

test('any unlisted high or critical advisory fails even when approved', () => {
  const audit = structuredClone(fixture('web').auditJson);
  audit.vulnerabilities['left-pad'] = {
    name: 'left-pad',
    severity: 'critical',
    via: [{ source: 1, name: 'left-pad', title: 'test advisory', url: 'https://github.com/advisories/GHSA-test-test-test', severity: 'critical', range: '*' }],
  };
  const result = run('web', { auditJson: audit });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('GHSA-test-test-test (left-pad): no exception record'));
});

test('a second advisory on an excepted package is not covered by the first record', () => {
  const audit = structuredClone(fixture('web').auditJson);
  audit.vulnerabilities.braces.via.push({
    source: 2, name: 'braces', title: 'another braces issue',
    url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high', range: '<=3.0.3',
  });
  const result = run('web', { auditJson: audit });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('GHSA-aaaa-bbbb-cccc (braces): no exception record'));
});

test('records only apply to their own workspace', () => {
  const exceptions = approved();
  exceptions.records = exceptions.records.filter((r: { workspace: string }) => r.workspace === 'mobile');
  const result = run('web', { exceptions });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('GHSA-vfj7-8cjw-p6xm (braces): no exception record'));
});

test('approval requires status, approver and a valid date', () => {
  for (const approval of [
    { status: 'approved', approvedBy: null, approvedAt: '2026-10-14T00:00:00Z' },
    { status: 'approved', approvedBy: 'x', approvedAt: null },
    { status: 'approved', approvedBy: ' ', approvedAt: '2026-10-14T00:00:00Z' },
    { status: 'pending', approvedBy: 'x', approvedAt: '2026-10-14T00:00:00Z' },
  ]) {
    assert.equal(isApproved({ approval, records: [] }), false, JSON.stringify(approval));
  }
});

test('an unexpected audit report shape fails closed', () => {
  assert.throws(() => collectBlockingAdvisories({}), /no "vulnerabilities" object/);
  assert.throws(
    () => collectBlockingAdvisories({ vulnerabilities: { x: { name: 'x', severity: 'high', via: [] } } }),
    /has no high\/critical root advisory/,
  );
});

// ── Active CI integration ───────────────────────────────────────

test('CI enforces the gate in place of plain npm audit, keeps the full report, and runs every control', () => {
  const workflows = path.join(ROOT, '..', '.github', 'workflows');
  const hardening = readFileSync(path.join(workflows, 'phase-06-hardening.yml'), 'utf8');
  const mobile = readFileSync(path.join(workflows, 'corrective-04-mobile-compatibility.yml'), 'utf8');

  // The enforcing step is the gate; the full unfiltered report is still printed.
  assert.match(hardening, /run: node \.\.\/security\/audit-gate\.mjs --workspace \$\{\{ matrix\.package \}\}\n/);
  assert.match(hardening, /run: npm audit \|\| true\n/);
  assert.doesNotMatch(hardening, /npm audit --audit-level=high/, 'no second, bypassable enforcement path');
  assert.doesNotMatch(hardening, /--omit=dev|--audit-level=(moderate|low|critical)|continue-on-error/);
  // Both workspaces stay in the audit matrix.
  assert.match(hardening, /- package: web\n/);
  assert.match(hardening, /- package: mobile\n/);
  // Compensating controls.
  // Lint and app-config controls take a project directory and inspect the
  // resolved configuration, never named source files.
  assert.match(hardening, /run: node \.\.\/security\/exception-controls\.mjs web-lint-root-dir \.\n/);
  assert.match(hardening, /run: node \.\.\/security\/exception-controls\.mjs mobile-update-signing \.\n/);
  assert.match(mobile, /expo export --platform android --source-maps --output-dir dist\/android/);
  assert.match(mobile, /expo export --platform ios --source-maps --output-dir dist\/ios/);
  assert.match(mobile, /exception-controls\.mjs bundle-sources dist\/android dist\/ios/);
  // Changes to the gate or records re-run the workflows that enforce them.
  assert.match(hardening, /- 'savr-platform\/security\/\*\*'/);
  assert.match(mobile, /- 'savr-platform\/security\/\*\*'/);
});

// ── Compensating controls ───────────────────────────────────────

const CONTROL_FIXTURES = path.join(__dirname, 'fixtures', 'exception-controls');

test('control: the resolved repository lint config does not set a Next.js rootDir', async () => {
  const { file, problems } = await checkWebLintRootDir(path.join(ROOT, 'web'));
  assert.equal(file, path.join(ROOT, 'web', 'eslint.config.mjs'));
  assert.deepEqual(problems, []);
});

// Regression: a raw-source search misses rootDir introduced through an import,
// a spread, a computed key, a nested or files-scoped entry, or `extends`.
for (const fixture of ['imported-computed-key', 'files-scoped', 'extends']) {
  test(`control: rootDir set through ${fixture} config is detected`, async () => {
    const dir = path.join(CONTROL_FIXTURES, fixture);
    const { file, problems } = await checkWebLintRootDir(dir);
    assert.equal(file, path.join(dir, 'eslint.config.mjs'));
    assert.equal(problems.length, 1, problems.join('\n'));
  });
}

test('control: the imported computed rootDir is what ESLint itself resolves', async () => {
  const dir = path.join(CONTROL_FIXTURES, 'imported-computed-key');
  assert.doesNotMatch(readFileSync(path.join(dir, 'eslint.config.mjs'), 'utf8'), /rootDir/);
  const { loadESLint } = await import('eslint');
  const ESLint = await loadESLint();
  const resolved = await new ESLint({ cwd: dir }).calculateConfigForFile('index.js');
  assert.deepEqual(resolved.settings?.next, { rootDir: 'apps/*' });
});

test('control: a config without rootDir passes, including an async export', async () => {
  const { problems } = await checkWebLintRootDir(path.join(CONTROL_FIXTURES, 'no-root-dir'));
  assert.deepEqual(problems, []);
});

test('control: lint rootDir check covers string, array and empty values and fails closed', () => {
  assert.equal(findLintRootDir([{ settings: { next: { rootDir: 'apps/*' } } }]).length, 1);
  assert.equal(findLintRootDir([{ settings: { next: { rootDir: ['a/*', 'b/*'] } } }]).length, 1);
  assert.equal(findLintRootDir([{ settings: { next: { rootDir: '' } } }]).length, 1);
  assert.deepEqual(findLintRootDir([{ settings: { next: {} } }, { rules: {} }]), []);
  assert.throws(() => flattenFlatConfig([() => ({})]), /unsupported flat config entry/);
  assert.throws(() => flattenFlatConfig('eslint.config.mjs'), /unsupported flat config entry/);
});

test('control: update signing is detected anywhere in a resolved Expo config', () => {
  assert.deepEqual(findUpdateSigning({ name: 'SAVR', updates: { enabled: false } }), []);
  assert.equal(findUpdateSigning({ updates: { codeSigningCertificate: './cert.pem' } }).length, 1);
  assert.equal(findUpdateSigning({ updates: { codeSigningMetadata: { keyid: 'main' } } }).length, 1);
  assert.equal(findUpdateSigning({ plugins: [['expo-updates', { codeSigningCertificate: './c.pem' }]] }).length, 1);
  assert.throws(() => findUpdateSigning(null), /not an object/);
});

test('control: bundle source scan flags only the excepted packages', () => {
  assert.deepEqual(
    checkBundleSources(['../node_modules/react-native/index.js', '../src/App.tsx', '../node_modules/bracesish/index.js']),
    [],
  );
  assert.equal(checkBundleSources(['../../node_modules/node-forge/lib/rsa.js']).length, 1);
  assert.equal(checkBundleSources(['/x/node_modules/micromatch/index.js', '/x/node_modules/braces/index.js']).length, 2);
});
