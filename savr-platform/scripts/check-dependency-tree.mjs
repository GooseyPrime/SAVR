#!/usr/bin/env node
/**
 * Dependency-tree integrity gate.
 *
 * Runs `npm ls --all --json` in the current workspace and fails if npm reports
 * an installed package that does not satisfy a declared range (`invalid`,
 * including a peer that resolves to the wrong hoisted copy) or a required
 * package that is absent (`missing`). Unmet *optional* peers are not problems
 * to npm and are not reported here either.
 *
 * `extraneous` entries (installed but referenced by nothing installed) are
 * printed but do not fail: npm produces them for transitive dependencies of
 * platform-specific optional packages it skipped on this OS, and they violate
 * no declared range.
 *
 * Nothing is allow-listed: the check is the package manager's own resolution
 * of every edge in the lockfile-installed tree, so it applies to any package
 * and version without naming either.
 *
 * Usage (from a workspace directory, after `npm ci`):
 *   node ../scripts/check-dependency-tree.mjs
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {unknown} tree parsed `npm ls --all --json` output
 * @returns {{ blocking: string[], informational: string[] }} npm's problems, split
 */
export function classifyTreeProblems(tree) {
  if (typeof tree !== 'object' || tree === null || Array.isArray(tree)) {
    throw new Error('npm ls did not return a JSON object');
  }
  if (tree.problems !== undefined && !Array.isArray(tree.problems)) {
    throw new Error('npm ls returned an unexpected problems field');
  }
  const blocking = [];
  const informational = [];
  for (const problem of new Set((tree.problems ?? []).map(String))) {
    if (problem.startsWith('extraneous:')) informational.push(problem);
    else blocking.push(problem);
  }
  return { blocking, informational };
}

function main() {
  const result = spawnSync('npm', ['ls', '--all', '--json'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  let tree;
  try {
    tree = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm ls --all --json returned no JSON (exit ${result.status}): ${(result.stderr || '').trim()}`);
  }
  const { blocking: problems, informational } = classifyTreeProblems(tree);
  if (result.status !== 0 && problems.length === 0 && informational.length === 0) {
    throw new Error(`npm ls exited ${result.status} without a parsable problem: ${(result.stderr || '').trim()}`);
  }
  for (const note of informational) console.log(`note: ${note}`);
  for (const problem of problems) console.log(`FAIL: ${problem}`);
  console.log(`dependency-tree: ${tree.name ?? 'workspace'} ${problems.length === 0 ? 'PASS' : 'FAIL'}`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`dependency-tree: error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
