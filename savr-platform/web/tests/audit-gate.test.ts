/**
 * Regression tests for the PROPOSED advisory exception gate (ADR-005).
 *
 * Fixtures are real `npm audit --json` and `npm ls braces node-forge --all --json`
 * output captured from the GooseyPrime/SAVR#181 lockfiles, so every case is
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
  checkLintRootDir,
  checkUpdateSigning,
} from '../../security/exception-controls.mjs';

const ROOT = path.join(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, 'fixtures', 'audit-gate');

function readJson(file: string) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const COMMITTED = readJson(path.join(ROOT, 'security', 'audit-exceptions.json'));
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

/** The committed records with approval simulated in memory only. */
function approved() {
  return {
    ...structuredClone(COMMITTED),
    approval: { status: 'approved', approvedBy: 'test-approver', approvedAt: '2026-10-14T00:00:00Z' },
  };
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

test('committed proposal is inactive: approval pending, three records, all expiring 2026-11-12', () => {
  assert.equal(COMMITTED.approval.status, 'pending');
  assert.equal(isApproved(COMMITTED), false);
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
  test(`${workspace}: pending approval blocks exactly like npm audit --audit-level=high`, () => {
    const result = run(workspace, { exceptions: COMMITTED });
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
  assert.match(report, /path: expo@57\.0\.28 > @expo\/cli@57\.0\.29 > node-forge@1\.4\.0/);
  assert.match(report, /path: expo@57\.0\.28 > @expo\/metro@56\.0\.2 > metro-file-map@0\.84\.5 > micromatch@4\.0\.8 > braces@3\.0\.3/);
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

// ── Inactive until approved ─────────────────────────────────────

test('live CI still enforces plain npm audit --audit-level=high; integration exists only as a patch', () => {
  const workflow = readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'phase-06-hardening.yml'), 'utf8');
  assert.match(workflow, /run: npm audit --audit-level=high\n/);
  assert.doesNotMatch(workflow, /audit-gate|exception-controls/);

  const patch = readFileSync(path.join(ROOT, 'security', 'proposed-workflow-integration.patch'), 'utf8');
  assert.match(patch, /^-\s+run: npm audit --audit-level=high$/m);
  assert.match(patch, /^\+\s+run: node \.\.\/security\/audit-gate\.mjs --workspace \$\{\{ matrix\.package \}\}$/m);
  assert.match(patch, /bundle-sources dist\/android dist\/ios/);
});

// ── Compensating controls ───────────────────────────────────────

test('control: the repository lint config does not set a Next.js rootDir', () => {
  const file = path.join(ROOT, 'web', 'eslint.config.mjs');
  assert.deepEqual(checkLintRootDir(readFileSync(file, 'utf8'), file), []);
  assert.equal(checkLintRootDir('settings: { next: { rootDir: "apps/*" } }').length, 1);
});

test('control: the mobile app config does not enable expo-updates code signing', () => {
  for (const name of ['app.config.ts', 'app.json']) {
    const file = path.join(ROOT, 'mobile', name);
    assert.deepEqual(checkUpdateSigning(readFileSync(file, 'utf8'), file), []);
  }
  assert.equal(checkUpdateSigning('updates: { codeSigningCertificate: "./cert.pem" }').length, 1);
});

test('control: bundle source scan flags only the excepted packages', () => {
  assert.deepEqual(
    checkBundleSources(['../node_modules/react-native/index.js', '../src/App.tsx', '../node_modules/bracesish/index.js']),
    [],
  );
  assert.equal(checkBundleSources(['../../node_modules/node-forge/lib/rsa.js']).length, 1);
  assert.equal(checkBundleSources(['/x/node_modules/micromatch/index.js', '/x/node_modules/braces/index.js']).length, 2);
});
