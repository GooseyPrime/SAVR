#!/usr/bin/env node
/**
 * Advisory-specific gate around `npm audit --audit-level=high`.
 *
 * PROPOSAL ONLY (ADR-005). Not wired into CI. Records in
 * audit-exceptions.json exempt nothing until `approval.status` is
 * "approved" with an approver and date recorded in a reviewed commit.
 *
 * Semantics: every high/critical advisory reported by a full `npm audit`
 * (devDependencies included) fails the gate, exactly like
 * `npm audit --audit-level=high`, unless one approved record matches its
 * advisory ID, package, installed version, workspace and the exact set of
 * dependency paths. The gate also fails when a record is expired, unused,
 * has a path that no longer exists, or when the registry has published a
 * version above the record's `lastAffected` (an upstream fix exists).
 *
 * The full finding table is always printed: names, versions and paths are
 * never hidden.
 *
 * Usage (from a workspace directory such as savr-platform/web):
 *   node ../security/audit-gate.mjs --workspace web [--exceptions <file>] [--now <ISO date>]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

/** @typedef {{ id: string, package: string, version: string, workspace: string, lastAffected: string, paths: string[][], expiresAt: string, reason?: string }} ExceptionRecord */
/** @typedef {{ approval: { status: string, approvedBy: string | null, approvedAt: string | null }, records: ExceptionRecord[] }} ExceptionsFile */
/** @typedef {{ id: string, package: string, severity: string, title: string, url: string, versions: string[], paths: string[][] }} Finding */
/** @typedef {{ ok: boolean, approved: boolean, findings: Array<Finding & { decision: string }>, failures: string[] }} GateResult */

/** Advisory ID from an npm audit `via` entry (GHSA ID when available). */
export function advisoryId(via) {
  const match = typeof via.url === 'string' ? via.url.match(/GHSA-[a-z0-9-]+/i) : null;
  return match ? match[0] : `npm-advisory-${via.source}`;
}

/**
 * Root advisories behind every high/critical vulnerability entry.
 * Throws if a blocking entry cannot be traced to an advisory, so an
 * unexpected report shape fails closed.
 */
export function collectBlockingAdvisories(auditJson) {
  const vulnerabilities = auditJson?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object') {
    throw new Error('npm audit JSON has no "vulnerabilities" object');
  }

  /** @type {Map<string, { id: string, package: string, severity: string, title: string, url: string }>} */
  const advisories = new Map();

  const rootsOf = (name, seen) => {
    const entry = vulnerabilities[name];
    if (!entry || seen.has(name)) return [];
    seen.add(name);
    return entry.via.flatMap((via) =>
      typeof via === 'string' ? rootsOf(via, seen) : [via],
    );
  };

  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (!BLOCKING_SEVERITIES.has(entry.severity)) continue;
    const roots = rootsOf(name, new Set()).filter((via) => BLOCKING_SEVERITIES.has(via.severity));
    if (roots.length === 0) {
      throw new Error(`Blocking audit entry "${name}" has no high/critical root advisory`);
    }
    for (const via of roots) {
      const id = advisoryId(via);
      const key = `${id}|${via.name}`;
      if (!advisories.has(key)) {
        advisories.set(key, {
          id,
          package: via.name,
          severity: via.severity,
          title: via.title ?? '',
          url: via.url ?? '',
        });
      }
    }
  }
  return [...advisories.values()];
}

/** Every installed copy of `pkg` in an `npm ls --all --json` tree, as name@version paths. */
export function findInstallPaths(lsJson, pkg) {
  /** @type {string[][]} */
  const paths = [];
  const walk = (node, trail) => {
    for (const [name, child] of Object.entries(node?.dependencies ?? {})) {
      const step = `${name}@${child.version}`;
      const next = [...trail, step];
      if (name === pkg) paths.push(next);
      walk(child, next);
    }
  };
  walk(lsJson, []);
  return paths;
}

const pathKey = (p) => p.join(' > ');

/** Numeric x.y.z comparison; prerelease versions are ignored by callers. */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** Published stable versions above `lastAffected` (an upstream fix). */
export function fixedVersionsAbove(publishedVersions, lastAffected) {
  return publishedVersions.filter(
    (v) => /^\d+\.\d+\.\d+$/.test(v) && compareVersions(v, lastAffected) > 0,
  );
}

export function isApproved(exceptions) {
  const approval = exceptions?.approval;
  return Boolean(
    approval &&
      approval.status === 'approved' &&
      typeof approval.approvedBy === 'string' &&
      approval.approvedBy.trim() &&
      typeof approval.approvedAt === 'string' &&
      !Number.isNaN(Date.parse(approval.approvedAt)),
  );
}

/**
 * Pure evaluation. All inputs are data, so tests are deterministic.
 *
 * @param {{ workspace: string, auditJson: any, lsJson: any, publishedVersions: Record<string, string[]>, exceptions: ExceptionsFile, now: Date }} input
 * @returns {GateResult}
 */
export function evaluate({ workspace, auditJson, lsJson, publishedVersions, exceptions, now }) {
  const failures = [];
  const approved = isApproved(exceptions);
  const records = (exceptions?.records ?? []).filter((r) => r.workspace === workspace);
  const usedRecords = new Set();

  const findings = collectBlockingAdvisories(auditJson).map((advisory) => {
    const paths = findInstallPaths(lsJson, advisory.package);
    const versions = [...new Set(paths.map((p) => p[p.length - 1].split('@').pop()))];
    /** @type {Finding & { decision: string }} */
    const finding = { ...advisory, versions, paths, decision: 'BLOCKING' };

    const record = records.find((r) => r.id === advisory.id && r.package === advisory.package);
    if (!record) {
      failures.push(`${advisory.id} (${advisory.package}): no exception record`);
      return finding;
    }
    usedRecords.add(record);

    const problems = [];
    if (paths.length === 0) problems.push('package not found in npm ls output');
    if (versions.some((v) => v !== record.version)) {
      problems.push(`installed version(s) ${versions.join(', ')} differ from recorded ${record.version}`);
    }
    const actual = new Set(paths.map(pathKey));
    const expected = new Set(record.paths.map(pathKey));
    for (const p of actual) if (!expected.has(p)) problems.push(`new dependency path: ${p}`);
    for (const p of expected) if (!actual.has(p)) problems.push(`recorded path no longer present: ${p}`);
    if (!(now < new Date(record.expiresAt))) problems.push(`record expired at ${record.expiresAt}`);
    const fixes = fixedVersionsAbove(publishedVersions[advisory.package] ?? [], record.lastAffected);
    if (fixes.length > 0) {
      problems.push(`upstream fix published (${fixes.join(', ')}); upgrade and remove this record`);
    }
    if (!approved) problems.push('exception is not approved (approval.status is not "approved")');

    if (problems.length > 0) {
      failures.push(...problems.map((p) => `${advisory.id} (${advisory.package}): ${p}`));
      return finding;
    }
    finding.decision = `EXCEPTED until ${record.expiresAt}`;
    return finding;
  });

  for (const record of records) {
    if (!usedRecords.has(record)) {
      failures.push(`${record.id} (${record.package}): unused record (no matching audit finding)`);
    }
  }

  return { ok: failures.length === 0, approved, findings, failures };
}

export function formatReport(workspace, result) {
  const lines = [`audit-gate: workspace=${workspace} approval=${result.approved ? 'approved' : 'NOT approved'}`];
  for (const f of result.findings) {
    lines.push(`- [${f.decision}] ${f.id} ${f.severity} ${f.package}@${f.versions.join(',') || '?'}: ${f.title}`);
    for (const p of f.paths) lines.push(`    path: ${pathKey(p)}`);
  }
  if (result.findings.length === 0) lines.push('- no high/critical advisories');
  for (const failure of result.failures) lines.push(`FAIL: ${failure}`);
  lines.push(result.ok ? 'audit-gate: PASS' : 'audit-gate: FAIL');
  return lines.join('\n');
}

function runNpmJson(args) {
  try {
    return JSON.parse(execFileSync('npm', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  } catch (error) {
    // `npm audit` and `npm ls` exit non-zero when they have findings; stdout is still JSON.
    if (error && typeof error.stdout === 'string' && error.stdout.trim()) return JSON.parse(error.stdout);
    throw error;
  }
}

function parseArgs(argv) {
  const args = { workspace: '', exceptions: '', now: '' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (!(key in args)) throw new Error(`Unknown argument ${argv[i]}`);
    args[key] = argv[i + 1] ?? '';
  }
  if (!args.workspace) throw new Error('--workspace is required');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const exceptionsPath = args.exceptions || path.join(here, 'audit-exceptions.json');
  const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8'));
  const now = args.now ? new Date(args.now) : new Date();

  const auditJson = runNpmJson(['audit', '--json']);
  const packages = [...new Set(collectBlockingAdvisories(auditJson).map((a) => a.package))];
  const lsJson = packages.length > 0 ? runNpmJson(['ls', ...packages, '--all', '--json']) : {};
  /** @type {Record<string, string[]>} */
  const publishedVersions = {};
  for (const pkg of packages) {
    const versions = runNpmJson(['view', pkg, 'versions', '--json']);
    publishedVersions[pkg] = Array.isArray(versions) ? versions : [versions];
  }

  const result = evaluate({ workspace: args.workspace, auditJson, lsJson, publishedVersions, exceptions, now });
  console.log(formatReport(args.workspace, result));
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`audit-gate: error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
