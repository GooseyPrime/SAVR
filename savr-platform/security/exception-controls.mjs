#!/usr/bin/env node
/**
 * Compensating controls for the ADR-005 audit exceptions.
 *
 * Enforced in CI (phase-06-hardening.yml, corrective-04-mobile-compatibility.yml).
 * Each check keeps one exception's "not reachable" argument true; if a
 * check fails, the matching exception no longer holds.
 *
 *   web-lint-root-dir      braces (web) is only reached through
 *                          @next/eslint-plugin-next's getRootDirs(), which
 *                          globs only when `settings.next.rootDir` is set.
 *   mobile-update-signing  node-forge's PKCS#1 v1.5 verify runs on
 *                          developer-supplied certificates only when expo-updates
 *                          code signing (`codeSigningCertificate`) is configured.
 *   bundle-sources         neither package may ship inside an exported app
 *                          bundle (checked against `expo export --source-maps`).
 *
 * Usage:
 *   node security/exception-controls.mjs web-lint-root-dir <eslint config file>
 *   node security/exception-controls.mjs mobile-update-signing <app config file>...
 *   node security/exception-controls.mjs bundle-sources <export dir>...
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_BUNDLE_PACKAGES = ['node-forge', 'braces', 'micromatch', 'metro-file-map'];

/** @returns {string[]} problems */
export function checkLintRootDir(configSource, file = 'eslint config') {
  return /\brootDir\b/.test(configSource)
    ? [`${file} sets a Next.js rootDir; braces becomes reachable through @next/eslint-plugin-next`]
    : [];
}

/** @returns {string[]} problems */
export function checkUpdateSigning(configSource, file = 'app config') {
  return /\bcodeSigningCertificate\b/.test(configSource)
    ? [`${file} configures expo-updates codeSigningCertificate; node-forge verify becomes reachable`]
    : [];
}

/**
 * @param {string[]} sources source paths from bundle source maps
 * @returns {string[]} problems
 */
export function checkBundleSources(sources) {
  const problems = [];
  for (const source of sources) {
    for (const pkg of FORBIDDEN_BUNDLE_PACKAGES) {
      if (source.includes(`node_modules/${pkg}/`)) {
        problems.push(`app bundle includes ${pkg}: ${source}`);
      }
    }
  }
  return problems;
}

function listMapFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listMapFiles(full);
    return name.endsWith('.map') ? [full] : [];
  });
}

function main() {
  const [check, ...targets] = process.argv.slice(2);
  if (!check || targets.length === 0) throw new Error('usage: exception-controls.mjs <check> <path>...');

  let problems;
  if (check === 'web-lint-root-dir') {
    problems = targets.flatMap((f) => checkLintRootDir(readFileSync(f, 'utf8'), f));
  } else if (check === 'mobile-update-signing') {
    problems = targets.flatMap((f) => checkUpdateSigning(readFileSync(f, 'utf8'), f));
  } else if (check === 'bundle-sources') {
    const maps = targets.flatMap(listMapFiles);
    if (maps.length === 0) throw new Error(`no source maps found under ${targets.join(', ')}`);
    const sources = maps.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).sources ?? []);
    console.log(`exception-controls: scanned ${sources.length} sources in ${maps.length} source maps`);
    problems = checkBundleSources(sources);
  } else {
    throw new Error(`unknown check ${check}`);
  }

  for (const p of problems) console.log(`FAIL: ${p}`);
  console.log(`exception-controls: ${check} ${problems.length === 0 ? 'PASS' : 'FAIL'}`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`exception-controls: error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
