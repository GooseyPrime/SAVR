/**
 * Free plan allowances and the rules that turn a measurement into an alert.
 *
 * Pure and dependency-free so it can be unit tested without a database or a
 * network call. Figures are Supabase's published Free plan quotas; Database
 * size is per project, Storage and monthly active users are per organization.
 */

export const MIB = 1024 * 1024;

export const FREE_PLAN_LIMITS = {
  databaseBytes: 500 * MIB,
  storageBytes: 1024 * MIB,
  monthlyActiveUsers: 50_000,
} as const;

export const WARN_AT_PERCENT = 70;
export const CRITICAL_AT_PERCENT = 85;

/** A keep-alive older than this means the cron stopped firing. */
export const STALE_HEARTBEAT_HOURS = 72;

export type Severity = 'ok' | 'warn' | 'critical';

export interface CapacitySnapshot {
  readonly databaseBytes: number | null;
  readonly storageBytes: number | null;
  readonly monthlyActiveUsers: number | null;
  readonly lastPingAt: string | null;
}

export interface Finding {
  readonly severity: Exclude<Severity, 'ok'>;
  readonly metric: string;
  readonly message: string;
  readonly recommendation: string;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function severityForPercent(usedPercent: number): Severity {
  if (usedPercent >= CRITICAL_AT_PERCENT) return 'critical';
  if (usedPercent >= WARN_AT_PERCENT) return 'warn';
  return 'ok';
}

export function worstSeverity(severities: readonly Severity[]): Severity {
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('warn')) return 'warn';
  return 'ok';
}

function quota(args: {
  metric: string;
  used: number;
  limit: number;
  unit: 'bytes' | 'count';
  recommendation: string;
}): Finding | null {
  const usedPercent = (args.used / args.limit) * 100;
  const severity = severityForPercent(usedPercent);
  if (severity === 'ok') return null;
  const render = (value: number): string =>
    args.unit === 'bytes' ? formatBytes(value) : value.toLocaleString('en-US');
  return {
    severity,
    metric: args.metric,
    message: `${args.metric} is at ${usedPercent.toFixed(1)}% of the Free plan allowance (${render(args.used)} of ${render(args.limit)}).`,
    recommendation: args.recommendation,
  };
}

/**
 * Compares a snapshot against the Free plan allowances.
 * `now` is injectable so the staleness rule is testable.
 */
export function evaluateSnapshot(snapshot: CapacitySnapshot, now: Date = new Date()): Finding[] {
  const findings: Finding[] = [];

  if (snapshot.databaseBytes !== null) {
    const finding = quota({
      metric: 'Database size',
      used: snapshot.databaseBytes,
      limit: FREE_PLAN_LIMITS.databaseBytes,
      unit: 'bytes',
      recommendation:
        'Reclaim space (vacuum, drop unused tables, move blobs into Storage) or move this project to a Pro organization, which includes 8 GB of disk.',
    });
    if (finding !== null) findings.push(finding);
  }

  if (snapshot.storageBytes !== null) {
    const finding = quota({
      metric: 'Storage size',
      used: snapshot.storageBytes,
      limit: FREE_PLAN_LIMITS.storageBytes,
      unit: 'bytes',
      recommendation:
        'Delete unused objects, or upgrade to Pro, which includes 100 GB of Storage.',
    });
    if (finding !== null) findings.push(finding);
  }

  if (snapshot.monthlyActiveUsers !== null) {
    const finding = quota({
      metric: 'Monthly active users',
      used: snapshot.monthlyActiveUsers,
      limit: FREE_PLAN_LIMITS.monthlyActiveUsers,
      unit: 'count',
      recommendation:
        'Pro includes 100,000 monthly active users. Exceeding the Free allowance puts the organization into a grace period.',
    });
    if (finding !== null) findings.push(finding);
  }

  if (snapshot.lastPingAt === null) {
    findings.push({
      severity: 'critical',
      metric: 'Keep-alive',
      message: 'No heartbeat has ever been recorded for this project.',
      recommendation: 'Confirm the migration ran and the cron route is deployed.',
    });
  } else {
    const ageHours = (now.getTime() - new Date(snapshot.lastPingAt).getTime()) / 3_600_000;
    if (Number.isNaN(ageHours)) {
      findings.push({
        severity: 'warn',
        metric: 'Keep-alive',
        message: `Heartbeat timestamp could not be read: ${snapshot.lastPingAt}`,
        recommendation: 'Check the sentinel_heartbeat row.',
      });
    } else if (ageHours > STALE_HEARTBEAT_HOURS) {
      findings.push({
        severity: 'critical',
        metric: 'Keep-alive',
        message: `Last heartbeat was ${Math.round(ageHours)} hours ago.`,
        recommendation:
          'The scheduled job has not been firing. Supabase pauses a Free project after roughly 7 days without database activity.',
      });
    }
  }

  return findings;
}

export function summarise(projectLabel: string, findings: readonly Finding[]): string {
  const severity = worstSeverity(findings.map((finding) => finding.severity));
  if (severity === 'ok') return `${projectLabel}: Supabase capacity healthy.`;
  const prefix = severity === 'critical' ? 'ACTION REQUIRED' : 'ATTENTION';
  return `${prefix} — ${projectLabel}: ${findings.map((finding) => finding.metric).join(', ')}`;
}

export function renderReport(
  projectLabel: string,
  snapshot: CapacitySnapshot,
  findings: readonly Finding[],
): string {
  const lines = [
    summarise(projectLabel, findings),
    '',
    `Database size: ${snapshot.databaseBytes === null ? 'unknown' : formatBytes(snapshot.databaseBytes)} of ${formatBytes(FREE_PLAN_LIMITS.databaseBytes)}`,
    `Storage size: ${snapshot.storageBytes === null ? 'unknown' : formatBytes(snapshot.storageBytes)} of ${formatBytes(FREE_PLAN_LIMITS.storageBytes)}`,
    `Monthly active users: ${snapshot.monthlyActiveUsers ?? 'unknown'} of ${FREE_PLAN_LIMITS.monthlyActiveUsers.toLocaleString('en-US')}`,
    `Last keep-alive: ${snapshot.lastPingAt ?? 'never'}`,
    '',
  ];

  if (findings.length === 0) {
    lines.push('No allowance is close to its limit.');
  } else {
    for (const finding of findings) {
      lines.push(`- [${finding.severity.toUpperCase()}] ${finding.message} ${finding.recommendation}`);
    }
  }

  lines.push(
    '',
    'Egress (5 GB uncached + 5 GB cached per Free organization each month) is not exposed by the Supabase API. Check it at https://supabase.com/dashboard/org/_/usage',
  );

  return lines.join('\n');
}
