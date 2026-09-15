import {
  evaluateSnapshot,
  renderReport,
  summarise,
  worstSeverity,
  type CapacitySnapshot,
  type Finding,
  type Severity,
} from './thresholds';

/**
 * Everything the run touches, injected so the whole orchestration can be
 * exercised in tests without a database, a network or a mail provider.
 */
export interface SentinelDeps {
  /** Records one keep-alive touch. Resolves to the new timestamp, or throws. */
  readonly touch: () => Promise<string | null>;
  /** Reads the capacity snapshot, including the heartbeat written by the PREVIOUS run. */
  readonly readStatus: () => Promise<CapacitySnapshot>;
  /** Optional public REST read, exercising the same path a deployed client uses. */
  readonly publicRead: (() => Promise<void>) | null;
  /** Delivers an alert. Null when no alert channel is configured. */
  readonly sendAlert: ((subject: string, body: string) => Promise<void>) | null;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => Date;
  readonly pings: number;
  readonly pingGapMs: number;
  readonly label: string;
}

export interface SentinelResult {
  readonly severity: Severity;
  readonly writes: number;
  readonly reads: number;
  readonly snapshot: CapacitySnapshot;
  readonly findings: readonly Finding[];
  readonly errors: readonly string[];
  readonly report: string;
  readonly checkedAt: string;
}

/**
 * One sentinel run.
 *
 * Order matters. The capacity snapshot is read BEFORE the keep-alive touches,
 * so the heartbeat it carries is the one written by the previous run. Touching
 * first would refresh the timestamp and hide exactly the outage the staleness
 * rule exists to catch.
 */
export async function runSentinel(deps: SentinelDeps): Promise<SentinelResult> {
  const errors: string[] = [];

  let snapshot: CapacitySnapshot = {
    databaseBytes: null,
    storageBytes: null,
    monthlyActiveUsers: null,
    lastPingAt: null,
  };

  try {
    snapshot = await deps.readStatus();
  } catch (error) {
    errors.push(`capacity probe failed: ${(error as Error).message}`);
  }

  const findings = evaluateSnapshot(snapshot, deps.now());
  const severity = worstSeverity(findings.map((finding) => finding.severity));
  const report = renderReport(deps.label, snapshot, findings);

  let writes = 0;
  let reads = 0;

  for (let index = 0; index < deps.pings; index += 1) {
    try {
      await deps.touch();
      writes += 1;
    } catch (error) {
      errors.push(`write ping failed: ${(error as Error).message}`);
    }

    if (deps.publicRead !== null) {
      try {
        await deps.publicRead();
        reads += 1;
      } catch (error) {
        errors.push(`public read ping failed: ${(error as Error).message}`);
      }
    }

    if (index < deps.pings - 1) await deps.sleep(deps.pingGapMs);
  }

  if (severity !== 'ok') {
    if (deps.sendAlert === null) {
      errors.push('alert not sent: no alert channel is configured');
    } else {
      try {
        await deps.sendAlert(summarise(deps.label, findings), report);
      } catch (error) {
        errors.push(`alert delivery failed: ${(error as Error).message}`);
      }
    }
  }

  return {
    severity,
    writes,
    reads,
    snapshot,
    findings,
    errors,
    report,
    checkedAt: deps.now().toISOString(),
  };
}
