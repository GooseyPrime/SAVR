import test from 'node:test';
import assert from 'node:assert/strict';
import { runSentinel, type SentinelDeps } from '../lib/sentinel/run';
import { isAuthorised, readSentinelEnv } from '../lib/sentinel/env';
import type { CapacitySnapshot } from '../lib/sentinel/thresholds';

const NOW = new Date('2026-09-15T12:00:00.000Z');

const HEALTHY: CapacitySnapshot = {
  databaseBytes: 20 * 1024 * 1024,
  storageBytes: 50 * 1024 * 1024,
  monthlyActiveUsers: 40,
  lastPingAt: '2026-09-15T11:00:00.000Z',
};

interface Harness {
  readonly deps: SentinelDeps;
  readonly calls: string[];
  readonly alerts: Array<{ subject: string; body: string }>;
}

function harness(overrides: Partial<SentinelDeps> = {}, snapshot: CapacitySnapshot = HEALTHY): Harness {
  const calls: string[] = [];
  const alerts: Array<{ subject: string; body: string }> = [];

  const deps: SentinelDeps = {
    readStatus: async () => {
      calls.push('status');
      return snapshot;
    },
    touch: async () => {
      calls.push('touch');
      return NOW.toISOString();
    },
    publicRead: async () => {
      calls.push('read');
    },
    sendAlert: async (subject, body) => {
      calls.push('alert');
      alerts.push({ subject, body });
    },
    sleep: async () => {
      calls.push('sleep');
    },
    now: () => NOW,
    pings: 2,
    pingGapMs: 0,
    label: 'SAVR',
    ...overrides,
  };

  return { deps, calls, alerts };
}

test('the capacity snapshot is read before any keep-alive touch', async () => {
  const { deps, calls } = harness();
  await runSentinel(deps);
  assert.equal(calls[0], 'status');
  assert.ok(calls.indexOf('status') < calls.indexOf('touch'));
});

test('a heartbeat gap is still detected on the run that repairs it', async () => {
  // The previous run stopped five days ago. Touching first would refresh the
  // timestamp and hide the outage; reading first must still report it.
  const { deps, alerts } = harness({}, { ...HEALTHY, lastPingAt: '2026-09-10T12:00:00.000Z' });
  const result = await runSentinel(deps);
  assert.equal(result.severity, 'critical');
  assert.ok(result.findings.some((finding) => finding.metric === 'Keep-alive'));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0]!.subject, /ACTION REQUIRED/);
  // The keep-alive still ran, so the project is repaired in the same pass.
  assert.equal(result.writes, 2);
});

test('a healthy run pings, sends nothing and reports ok', async () => {
  const { deps, alerts } = harness();
  const result = await runSentinel(deps);
  assert.equal(result.severity, 'ok');
  assert.equal(result.writes, 2);
  assert.equal(result.reads, 2);
  assert.deepEqual(result.errors, []);
  assert.equal(alerts.length, 0);
});

test('a failing touch is recorded without aborting the run', async () => {
  const { deps } = harness({
    touch: async () => {
      throw new Error('rpc denied');
    },
  });
  const result = await runSentinel(deps);
  assert.equal(result.writes, 0);
  assert.equal(result.errors.filter((error) => error.includes('rpc denied')).length, 2);
  assert.equal(result.reads, 2);
});

test('a failing capacity probe leaves the snapshot unknown and still keeps the project alive', async () => {
  const { deps } = harness({
    readStatus: async () => {
      throw new Error('permission denied for function sentinel_status');
    },
  });
  const result = await runSentinel(deps);
  assert.equal(result.snapshot.databaseBytes, null);
  assert.equal(result.writes, 2);
  assert.ok(result.errors.some((error) => error.includes('capacity probe failed')));
  // An unknown snapshot has never-pinged semantics, which is itself critical.
  assert.equal(result.severity, 'critical');
});

test('a project with no public key skips the REST ping', async () => {
  const { deps, calls } = harness({ publicRead: null });
  const result = await runSentinel(deps);
  assert.equal(result.reads, 0);
  assert.equal(calls.includes('read'), false);
});

test('an alert that cannot be delivered is reported, not swallowed', async () => {
  const { deps } = harness(
    {
      sendAlert: async () => {
        throw new Error('Mailjet responded 401');
      },
    },
    { ...HEALTHY, lastPingAt: null },
  );
  const result = await runSentinel(deps);
  assert.ok(result.errors.some((error) => error.includes('alert delivery failed')));
});

test('a missing alert channel is reported when there is something to report', async () => {
  const { deps } = harness({ sendAlert: null }, { ...HEALTHY, lastPingAt: null });
  const result = await runSentinel(deps);
  assert.ok(result.errors.some((error) => error.includes('no alert channel')));
});

test('authorisation requires an exact bearer match and fails closed', () => {
  assert.equal(isAuthorised('Bearer abc', 'abc'), true);
  assert.equal(isAuthorised('Bearer abc', 'other'), false);
  assert.equal(isAuthorised('abc', 'abc'), false);
  assert.equal(isAuthorised(null, 'abc'), false);
  assert.equal(isAuthorised('Bearer abc', null), false);
  assert.equal(isAuthorised('Bearer ', ''), false);
});

test('environment reading names every missing variable', () => {
  const result = readSentinelEnv({});
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    [...result.missing],
    ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'],
  );
});

test('environment reading treats a blank anon key as absent', () => {
  const result = readSentinelEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    CRON_SECRET: 'secret',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '   ',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.env.anonKey, null);
  assert.equal(result.env.label, 'SAVR');
});
