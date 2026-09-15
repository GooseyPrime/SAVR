import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSnapshot,
  formatBytes,
  FREE_PLAN_LIMITS,
  renderReport,
  severityForPercent,
  summarise,
  worstSeverity,
  type CapacitySnapshot,
} from '../lib/sentinel/thresholds';

const NOW = new Date('2026-09-15T12:00:00.000Z');

function snapshot(overrides: Partial<CapacitySnapshot> = {}): CapacitySnapshot {
  return {
    databaseBytes: 20 * 1024 * 1024,
    storageBytes: 50 * 1024 * 1024,
    monthlyActiveUsers: 40,
    lastPingAt: '2026-09-15T11:00:00.000Z',
    ...overrides,
  };
}

test('formatBytes renders readable units', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(500 * 1024 * 1024), '500 MB');
});

test('severity bands follow the 70 and 85 percent thresholds', () => {
  assert.equal(severityForPercent(69.9), 'ok');
  assert.equal(severityForPercent(70), 'warn');
  assert.equal(severityForPercent(85), 'critical');
  assert.equal(worstSeverity(['ok', 'warn', 'critical']), 'critical');
});

test('a healthy project produces no findings', () => {
  assert.deepEqual(evaluateSnapshot(snapshot(), NOW), []);
});

test('database size past 85 percent of the free allowance is critical', () => {
  const findings = evaluateSnapshot(
    snapshot({ databaseBytes: Math.round(FREE_PLAN_LIMITS.databaseBytes * 0.9) }),
    NOW,
  );
  const finding = findings.find((item) => item.metric === 'Database size');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
  assert.match(finding.recommendation, /Pro organization/);
});

test('storage between 70 and 85 percent is a warning, labelled project scoped', () => {
  const findings = evaluateSnapshot(
    snapshot({ storageBytes: Math.round(FREE_PLAN_LIMITS.storageBytes * 0.75) }),
    NOW,
  );
  const finding = findings.find((item) => item.metric === 'Storage size (this project)');
  assert.ok(finding);
  assert.equal(finding.severity, 'warn');
  assert.match(finding.recommendation, /shared across every project in the organization/);
});

test('monthly active users are labelled project scoped', () => {
  const findings = evaluateSnapshot(
    snapshot({ monthlyActiveUsers: Math.round(FREE_PLAN_LIMITS.monthlyActiveUsers * 0.9) }),
    NOW,
  );
  const finding = findings.find((item) => item.metric === 'Monthly active users (this project)');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
  assert.match(finding.recommendation, /shared across every project in the organization/);
});

test('a heartbeat older than three days is critical', () => {
  const findings = evaluateSnapshot(
    snapshot({ lastPingAt: '2026-09-10T12:00:00.000Z' }),
    NOW,
  );
  const finding = findings.find((item) => item.metric === 'Keep-alive');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
});

test('a project that has never been pinged is critical', () => {
  const findings = evaluateSnapshot(snapshot({ lastPingAt: null }), NOW);
  const finding = findings.find((item) => item.metric === 'Keep-alive');
  assert.ok(finding);
  assert.equal(finding.severity, 'critical');
});

test('unknown measurements are skipped rather than treated as zero', () => {
  const findings = evaluateSnapshot(
    snapshot({ databaseBytes: null, storageBytes: null, monthlyActiveUsers: null }),
    NOW,
  );
  assert.deepEqual(findings, []);
});

test('the report names the project, every finding and the scope caveat', () => {
  const findings = evaluateSnapshot(
    snapshot({ databaseBytes: Math.round(FREE_PLAN_LIMITS.databaseBytes * 0.95) }),
    NOW,
  );
  const report = renderReport('SAVR', snapshot(), findings);
  assert.match(report, /SAVR/);
  assert.match(report, /Database size/);
  assert.match(report, /shared across the organization/);
  assert.match(summarise('SAVR', findings), /ACTION REQUIRED/);
});
