#!/usr/bin/env node
/**
 * Validates that every .github/instructions/*.instructions.md file has:
 * - a YAML frontmatter block
 * - an applyTo field that is a single quoted string
 * - an applyTo value that does not contain ../
 * - an applyTo value that is not empty
 *
 * Exits non-zero if any violation is found.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const instructionsDir = join(repoRoot, '.github', 'instructions');

let files;
try {
  files = readdirSync(instructionsDir).filter((f) => f.endsWith('.instructions.md'));
} catch {
  console.error(`ERROR: Cannot read instructions directory: ${instructionsDir}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error('ERROR: No .instructions.md files found in .github/instructions/');
  process.exit(1);
}

let errors = 0;

for (const file of files) {
  const fullPath = join(instructionsDir, file);
  const content = readFileSync(fullPath, 'utf8');

  // Must end in .instructions.md — already enforced by the filter above.
  if (!file.endsWith('.instructions.md')) {
    console.error(`FAIL [${file}]: filename does not end in .instructions.md`);
    errors++;
    continue;
  }

  // Must have frontmatter delimited by ---
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    console.error(`FAIL [${file}]: missing YAML frontmatter`);
    errors++;
    continue;
  }

  const frontmatter = fmMatch[1];

  // applyTo must be present
  if (!/^applyTo:/m.test(frontmatter)) {
    console.error(`FAIL [${file}]: applyTo field is missing from frontmatter`);
    errors++;
    continue;
  }

  // applyTo must be a single quoted string on the same line (not a YAML list)
  const applyToMatch = frontmatter.match(/^applyTo:\s*"(.+)"$/m);
  if (!applyToMatch) {
    console.error(
      `FAIL [${file}]: applyTo is not a single quoted string — found: ${frontmatter.match(/^applyTo:.*/m)?.[0] ?? '(not found)'}`
    );
    errors++;
    continue;
  }

  const applyToValue = applyToMatch[1].trim();

  // Must not be empty
  if (!applyToValue) {
    console.error(`FAIL [${file}]: applyTo value is empty`);
    errors++;
    continue;
  }

  // Must not contain ../
  if (applyToValue.includes('../')) {
    console.error(`FAIL [${file}]: applyTo value contains ../ (must use repository-root paths)`);
    errors++;
    continue;
  }

  console.log(`OK   [${file}]: applyTo = "${applyToValue}"`);
}

if (errors > 0) {
  console.error(`\n${errors} instruction file(s) failed validation.`);
  process.exit(1);
} else {
  console.log(`\nAll ${files.length} instruction file(s) passed validation.`);
}
