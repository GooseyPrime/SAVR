# Required Validation Gates

This file records the exact commands that are available in `savr-platform/` and the gaps that future work must close.

## Phase 1 + Phase 2 available commands

| Area | Exact command | Status | Evidence |
|---|---|---|---|
| Web dependency installation | `cd savr-platform/web && npm ci` | ✅ Available | `savr-platform/web/package-lock.json` |
| Mobile dependency installation | `cd savr-platform/mobile && npm ci` | ✅ Available | `savr-platform/mobile/package-lock.json` (lockfileVersion 3) |
| Web lint | `cd savr-platform/web && npm run lint` | ✅ Available | `savr-platform/web/package.json`; CI job `web-lint` in `phase-01-baseline.yml` |
| Web TypeScript check | `cd savr-platform/web && npm run typecheck` | ✅ Available | `savr-platform/web/package.json` (`tsc --noEmit`); CI job `web-typecheck` in `phase-01-baseline.yml` |
| Web production build | `cd savr-platform/web && npm run build` | ✅ Available | `savr-platform/web/package.json`; CI job `web-build` in `phase-01-baseline.yml` |
| Mobile TypeScript check | `cd savr-platform/mobile && npm run typecheck` | ✅ Available | `savr-platform/mobile/package.json` (`tsc --noEmit`); CI job `mobile-typecheck` in `phase-02-validation.yml` |
| Playwright E2E | `cd savr-platform/e2e-tests && npm run test:e2e` | ⚠️ Available locally; blocked in CI | `savr-platform/e2e-tests/package.json`; requires a running application target |
| Mobile lint | `cd savr-platform/mobile && npm run lint` | ✅ Available | `savr-platform/mobile/eslint.config.js`; CI job `mobile-lint` in `phase-02-validation.yml` |
| Mobile Expo validation | No committed validation script beyond `expo start` and `tsc --noEmit` | ⚠️ Partial | `savr-platform/mobile/package.json` |
| Existing unit/integration tests | No committed non-E2E test command found | ❌ Gap | no test script in root/web/mobile packages |
| Supabase migration validation | No committed `db lint`, `db reset`, or migration CI gate | ❌ Gap | migration SQL present; Supabase CLI not wired into CI |
| Security scanning | No committed dependency or code security scanning script | ❌ Gap | no script or workflow present |

## Remaining gaps (Phase 2 exit state — updated)

The mobile lint gap was closed in the Phase 5 limitations PR. The following gaps remain explicitly documented and deferred:

- **Mobile lint**: ~~No ESLint config exists in `savr-platform/mobile/`.~~ **Closed** — `eslint.config.js` added; `mobile-lint` CI job active.
- **Unit/integration tests**: No non-E2E test suite. Add in Phase 6 (hardening and release).
- **Supabase migration CI gate**: Requires either a Supabase project with service key or Supabase CLI Docker-based reset. Defer to Phase 5 or Phase 6.
- **E2E CI gate**: Requires a deployed application target. Defer to Phase 6 (hardening and release).
- **Security scanning**: No automated dependency vulnerability or SAST scan. Add in Phase 6.

## Rules for future agents

- Do not claim a gate passed unless the exact command was actually run and its output is recorded.
- When a gap exists, document it in the PR and, if appropriate, add the missing gate in a dedicated future phase rather than hiding the gap.
- Reproducible validation is a required early migration phase before broad visual adaptation.
- The `savr-platform/` commands above supersede the `SAVR-old/` commands listed in Phase 1 discovery.

