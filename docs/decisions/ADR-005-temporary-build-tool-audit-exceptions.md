# ADR-005 — Temporary Build-Tool Advisory Exceptions

**Status:** Proposed — awaiting Brandon's approval. **Not active.**  
**Date:** 2026-10-13  
**Deciders:** Brandon (approval), Echo (review and merge)  
**Expires:** 2026-11-12T00:00:00Z (every record)

---

## Decision requested

Approve three temporary, advisory-specific exceptions to the `npm audit --audit-level=high` gate for build-tool packages that have **no patched release**. Each one is matched exactly by advisory ID, package, version, workspace and dependency path.

| # | Advisory | Package@version | Workspace | Exact dependency path(s) |
|---|---|---|---|---|
| 1 | GHSA-vfj7-8cjw-p6xm (CVE-2026-93687) | braces@3.0.3 | web | `eslint-config-next@16.3.8 > @next/eslint-plugin-next@16.3.8 > fast-glob@3.3.1 > micromatch@4.0.8 > braces@3.0.3` |
| 2 | GHSA-vfj7-8cjw-p6xm (CVE-2026-93687) | braces@3.0.3 | mobile | `expo@57.0.28 > @expo/metro@56.0.2 > metro-file-map@0.84.5 > micromatch@4.0.8 > braces@3.0.3` |
| 3 | GHSA-86w9-cpqp-85rv (CVE-2026-85393) | node-forge@1.4.0 | mobile | `expo@57.0.28 > @expo/cli@57.0.29 > @expo/code-signing-certificates@0.0.6 > node-forge@1.4.0` and `expo@57.0.28 > @expo/cli@57.0.29 > node-forge@1.4.0` |

The records live in `savr-platform/security/audit-exceptions.json` with `approval.status: "pending"`. While the status is pending the gate exempts nothing.

## Context

- GooseyPrime/SAVR#181 regenerates the web and mobile lockfiles and fixes every patchable high or critical advisory (`next` 16.3.8 critical, `shell-quote` critical, and others).
- After that, `npm audit --audit-level=high` still fails, only on the two advisories above. Main's mobile audit is already red, and main's web audit turned red once the braces advisory was published (2026-09-18 per OSV).
- The thresholds stay at `high`. No blanket ignore, `--omit=dev`, version spoofing, fork or npm alias is proposed.

### Upstream proof (checked 2026-10-13)

| Package | Registry | Upstream source | Supported replacement |
|---|---|---|---|
| braces | latest is 3.0.3; affected range is "last_affected 3.0.3" (all versions) | `micromatch/braces` `master` was last changed 2025-01-19 (`e53730e`), with no branch or release after 3.0.3. Issue #70 has about 12 competing **unmerged** community PRs (#71, #75, #77–#79, #81–#83, #86–#88, dated 2026-09-21 to 2026-10-10). | None. `@next/eslint-plugin-next` 16.3.8, 16.4.0 and 16.5.0-canary.9 pin `fast-glob` 3.3.1, which uses micromatch and so braces. `metro-file-map` 0.84.5 through 0.87.1 (the SDK 58 line) depends on `micromatch ^4.0.4`. |
| node-forge | latest is 1.4.0; affected range is "last_affected 1.4.0" | `digitalbazaar/forge` `main` (`7232404`) has only "Fix tests" and "Update security policy" since 1.4.0, plus a "Start 1.4.1-0" version bump. The fix is **unmerged** external PR #1152 (`ceba344`, 2026-09-09), which adds a DigestAlgorithm element-count check in `lib/rsa.js`. | None. Every published `@expo/cli` (SDK 57 and 58) depends on `node-forge ^1.3.3`, and `@expo/code-signing-certificates` 0.0.7 needs `^1.4.0`. |

Applying an unmerged community patch was rejected for three reasons. The code has not been reviewed by the maintainers. An alias or fork would hide the package from `npm audit`. A patch keeps the version number unchanged, so the audit result would not change anyway.

### Reachability evidence

1. **braces (web), dev-only.** `@next/eslint-plugin-next/dist/utils/get-root-dirs.js` is the only caller of `fast-glob`, from the rule `no-html-link-for-pages`. It globs only when `settings.next.rootDir` is set; otherwise it returns `[context.cwd]`. `savr-platform/web/eslint.config.mjs` does not set it. `npm audit --omit=dev` reports 0 for web; that is shown for information only and is not proposed as a gate. The production build contains no braces or micromatch source: Next.js ships only compiled `glob` and `picomatch`. **Not reachable.**
2. **braces (mobile), build tooling.** `metro-file-map/src/watchers/common.js` `includedByGlob()` passes Metro's own configured glob patterns to micromatch. File paths are only matched, never expanded as patterns. No external input supplies patterns. The worst case is a stack-overflow crash of a local or EAS build process. **Not reachable by external input.**
3. **node-forge (mobile), Expo CLI tooling.** Only two files load it: `@expo/cli/build/src/run/ios/codeSigning/Security.js` (`certificateFromPem` only) and `@expo/code-signing-certificates/build/main.js`. The vulnerable PKCS#1 v1.5 `verify` runs in three places:
   - `signBufferRSASHA256AndVerify`: verifies a signature the CLI has just produced.
   - `validateSelfSignedCertificate`: runs only when `updates.codeSigningCertificate` is configured and `--private-key-path` is given. SAVR configures neither.
   - `csr.verify`: never called by the CLI.

   The Expo development certificate chain is only checked for validity dates. Forging a signature needs an attacker-made signature against a low-exponent RSA key, and SAVR verifies no signature it did not create. **Not reachable.**
4. **App bundles.** The `expo export --source-maps` output for Android and iOS (2,292 sources) contains no `node-forge`, `braces`, `micromatch` or `metro-file-map` source.

## Proposed mechanism

- **`savr-platform/security/audit-gate.mjs`** (Node built-ins only). It runs a full `npm audit --json` with devDependencies included, traces every high or critical entry to its root advisories, and fails closed on any unexpected report shape. A finding is excepted only if an approved record matches its ID, package, installed version, workspace and **exact set** of `npm ls` paths. The full table of IDs, versions and paths is always printed.
- **The gate fails when:**
  - any other high or critical advisory appears, including a second advisory on an excepted package;
  - a new dependency path or a different installed version appears;
  - a recorded path disappears;
  - a record matches nothing (unused);
  - the current time is at or after `expiresAt` (2026-11-12T00:00:00Z);
  - `npm view <pkg> versions` lists a stable release above `lastAffected` (an upstream fix exists: upgrade and delete the record);
  - `approval` is not `approved` with `approvedBy` and `approvedAt` set.
- **`savr-platform/security/exception-controls.mjs`** keeps each reachability argument true:
  - `web-lint-root-dir`: fails if the lint config sets `rootDir`;
  - `mobile-update-signing`: fails if the app config sets `codeSigningCertificate`;
  - `bundle-sources`: fails if an excepted package appears in an exported bundle's source maps.
- **`savr-platform/security/proposed-workflow-integration.patch`** is the CI change, kept as a patch so this PR changes no workflow. It:
  - keeps a full informational `npm audit` step;
  - replaces the enforcing step with the gate;
  - adds the controls;
  - exports bundles with source maps to scan them.
- **Regression tests:** `savr-platform/web/tests/audit-gate.test.ts` runs under the existing web unit-test job. It is deterministic: fixtures are real `npm audit`/`npm ls` output from the #181 lockfiles, and the clock and registry version lists are injected.

## Security tradeoff

**Accepted if approved:** until 2026-11-12 at the latest, CI passes with three known high-severity advisories present in **build tooling only**. The remaining risk is a denial-of-service crash of a developer or CI build through braces, and no reachable signature-forgery path through node-forge. Production web and the shipped mobile apps contain neither package.

**Avoided:** blocking every PR's security job on advisories no dependency change can fix, while keeping every other high or critical finding blocking.

**Not accepted:** broader suppression. Any drift in path, version, advisory or date fails the gate.

## Activation (only after Brandon approves)

1. In a reviewed commit, set `approval` to `{ "status": "approved", "approvedBy": "<name>", "approvedAt": "<ISO date>" }`.
2. Apply `proposed-workflow-integration.patch` (`git apply`) and update the "inactive" regression test that pins the current workflow.
3. Merge only after GooseyPrime/SAVR#181, because the records match its lockfiles.

## Expiry and exit

- The exceptions end when a fix is published (the gate fails and forces an upgrade and record removal), when 2026-11-12T00:00:00Z passes (the gate fails), or when Brandon withdraws approval.
- Renewing requires a new reviewed commit with a new date and fresh upstream and reachability evidence.
- To roll back, revert the workflow patch: CI returns to plain `npm audit --audit-level=high`.

## Alternative

Do not approve. GooseyPrime/SAVR#181 and GooseyPrime/SAVR#182 stay unmerged, or merge with red security jobs, until upstream releases `braces` > 3.0.3 and `node-forge` > 1.4.0.
