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
 * The lint and app-config checks inspect the configuration the tools actually
 * resolve (ESLint's evaluated flat config, `expo config --json`), never source
 * text, so imported, spread, computed or plugin-applied settings are caught.
 * Any failure to resolve a configuration fails the check.
 *
 * Usage:
 *   node security/exception-controls.mjs web-lint-root-dir <web project dir>
 *   node security/exception-controls.mjs mobile-update-signing <expo project dir>
 *   node security/exception-controls.mjs bundle-sources <export dir>...
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FORBIDDEN_BUNDLE_PACKAGES = ['node-forge', 'braces', 'micromatch', 'metro-file-map'];

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Flattens an evaluated ESLint flat config export (nested arrays and
 * `extends` entries included) into its config objects.
 * @returns {object[]}
 */
export function flattenFlatConfig(exported) {
  const configs = [];
  const visit = (entry, where) => {
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, `${where}[${index}]`));
    } else if (isPlainObject(entry)) {
      configs.push({ where, config: entry });
      if (entry.extends !== undefined) visit(entry.extends, `${where}.extends`);
    } else {
      throw new Error(`unsupported flat config entry at ${where} (${typeof entry}); cannot prove rootDir is unset`);
    }
  };
  visit(exported, 'config');
  return configs;
}

/**
 * Every config object is inspected regardless of its `files` scope, so the
 * result covers whatever ESLint would compute for any linted file.
 * @returns {string[]} problems
 */
export function findLintRootDir(exported, file = 'eslint config') {
  return flattenFlatConfig(exported)
    .filter(({ config }) => isPlainObject(config.settings) && isPlainObject(config.settings.next)
      && config.settings.next.rootDir !== undefined)
    .map(({ where }) =>
      `${file} ${where} sets settings.next.rootDir; braces becomes reachable through @next/eslint-plugin-next`);
}

/**
 * Walks a resolved Expo config for any expo-updates code-signing setting
 * (`updates.codeSigningCertificate`, `updates.codeSigningMetadata`, or the
 * same keys passed to a config plugin).
 * @returns {string[]} problems
 */
export function findUpdateSigning(exp, label = 'resolved app config') {
  const problems = [];
  const seen = new Set();
  const visit = (value, where) => {
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const at = Array.isArray(value) ? `${where}[${key}]` : `${where}.${key}`;
      if (/codesigning/i.test(key) && child !== undefined && child !== null) {
        problems.push(`${label} sets ${at.replace(/^exp\./, '')}; expo-updates code signing makes node-forge verify reachable`);
      }
      visit(child, at);
    }
  };
  if (!isPlainObject(exp)) throw new Error(`${label} is not an object`);
  visit(exp, 'exp');
  return problems;
}

/** Loads the flat config file ESLint itself selects for `projectDir`. */
export async function loadFlatConfig(projectDir) {
  const require = createRequire(path.join(path.resolve(projectDir), 'noop.js'));
  const { loadESLint } = require('eslint');
  const ESLint = await loadESLint({ useFlatConfig: true });
  const eslint = new ESLint({ cwd: path.resolve(projectDir) });
  const file = await eslint.findConfigFile();
  if (!file) throw new Error(`no ESLint flat config found for ${projectDir}`);
  const mod = await import(pathToFileURL(file).href);
  return { file, exported: await mod.default };
}

/** Returns Expo's resolved project config (`expo config --json`). */
export function resolveExpoConfig(projectDir) {
  const root = path.resolve(projectDir);
  const require = createRequire(path.join(root, 'noop.js'));
  const cli = require.resolve('expo/bin/cli');
  const result = spawnSync(process.execPath, [cli, 'config', root, '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`expo config failed for ${projectDir} (exit ${result.status}): ${(result.stderr || '').trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`expo config for ${projectDir} did not return JSON`);
  }
}

export async function checkWebLintRootDir(projectDir) {
  const { file, exported } = await loadFlatConfig(projectDir);
  return { file, problems: findLintRootDir(exported, path.relative(process.cwd(), file) || file) };
}

export function checkMobileUpdateSigning(projectDir) {
  return findUpdateSigning(resolveExpoConfig(projectDir), `resolved Expo config for ${projectDir}`);
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

async function main() {
  const [check, ...targets] = process.argv.slice(2);
  if (!check || targets.length === 0) throw new Error('usage: exception-controls.mjs <check> <path>...');

  let problems;
  if (check === 'web-lint-root-dir') {
    problems = [];
    for (const dir of targets) {
      const result = await checkWebLintRootDir(dir);
      console.log(`exception-controls: evaluated ${result.file}`);
      problems.push(...result.problems);
    }
  } else if (check === 'mobile-update-signing') {
    problems = targets.flatMap((dir) => {
      console.log(`exception-controls: resolved Expo config for ${path.resolve(dir)}`);
      return checkMobileUpdateSigning(dir);
    });
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
  main().catch((error) => {
    console.error(`exception-controls: error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
