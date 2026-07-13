# Required Validation Gates

This file records the exact commands that are available in `savr-platform/` and the remaining gaps after Phase 6 hardening work.

## Available commands (Phase 6 exit state)

| Area | Exact command | Status | Evidence |
|---|---|---|---|
| Web dependency installation | `cd savr-platform/web && npm ci` | ✅ Available | `savr-platform/web/package-lock.json` |
| Mobile dependency installation | `cd savr-platform/mobile && npm ci` | ✅ Available | `savr-platform/mobile/package-lock.json` (lockfileVersion 3) |
| Web lint | `cd savr-platform/web && npm run lint` | ✅ Available | `savr-platform/web/package.json`; CI job `web-lint` in `phase-01-baseline.yml` |
| Web TypeScript check | `cd savr-platform/web && npm run typecheck` | ✅ Available | `savr-platform/web/package.json` (`tsc --noEmit`); CI job `web-typecheck` in `phase-01-baseline.yml` |
| Web production build | `cd savr-platform/web && npm run build` | ✅ Available | `savr-platform/web/package.json`; CI job `web-build` in `phase-01-baseline.yml` |
| Web unit tests | `cd savr-platform/web && npm run test:unit` | ✅ Available | `savr-platform/web/package.json`; CI job `web-unit-tests` in `phase-06-hardening.yml` |
| Mobile TypeScript check | `cd savr-platform/mobile && npm run typecheck` | ✅ Available | `savr-platform/mobile/package.json` (`tsc --noEmit`); CI job `mobile-typecheck` in `phase-02-validation.yml` |
| Mobile lint | `cd savr-platform/mobile && npm run lint` | ✅ Available | `savr-platform/mobile/eslint.config.js`; CI job `mobile-lint` in `phase-02-validation.yml` |
| Mobile unit tests | `cd savr-platform/mobile && npm run test:unit` | ✅ Available | `savr-platform/mobile/package.json`; CI job `mobile-unit-tests` in `phase-06-hardening.yml` |
| Playwright smoke E2E | `cd savr-platform/e2e-tests && PLAYWRIGHT_USE_WEBSERVER=true CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run test:e2e:smoke` | ✅ Available | `savr-platform/e2e-tests/package.json`; CI job `e2e-smoke` in `phase-06-hardening.yml` |
| Full Playwright Stripe checkout regression | `cd savr-platform/e2e-tests && npm run test:e2e` | ⚠️ Partial | `savr-platform/e2e-tests/stripe-checkout.spec.ts`; requires test credentials and live Stripe-capable target |
| Mobile Expo validation | No committed validation script beyond `expo start` and `tsc --noEmit` | ⚠️ Partial | `savr-platform/mobile/package.json` |
| Supabase migration validation | `cd savr-platform && npx supabase@latest db reset` | ✅ Available | `savr-platform/package.json`; `savr-platform/supabase/config.toml`; CI job `supabase-migration-validation` in `phase-06-hardening.yml` |
| Dependency security audit (web) | `cd savr-platform/web && npm audit --audit-level=high` | ✅ Available | `savr-platform/web/package.json`; CI job `security-audit` in `phase-06-hardening.yml` |
| Dependency security audit (mobile) | `cd savr-platform/mobile && npm audit --audit-level=high` | ✅ Available | `savr-platform/mobile/package.json`; CI job `security-audit` in `phase-06-hardening.yml` |
| CodeQL SAST scan | GitHub Actions `CodeQL` workflow | ✅ Available | `.github/workflows/codeql.yml` |

## Remaining gaps (Phase 6 exit state)

Phase 6 closed the missing non-E2E tests, Supabase migration CI gate, local E2E smoke coverage, and automated security scanning. The following limitations remain explicitly documented and deferred:

- **Live subscription regression**: The committed Stripe checkout Playwright spec still requires repository secrets plus a live Stripe-capable target; CI now covers smoke navigation only.
- **Mobile Expo runtime validation**: No committed native device/emulator gate exists beyond lint and typecheck.
- **Upstream mobile audit findings**: `npm audit --audit-level=high` passes, but moderate Expo ecosystem advisories remain until upstream-compatible package updates are scheduled.
- **Contract conflicts**: ADR-001 billing tier naming and ADR-002 Firebase storage compatibility remain documented and deferred until production audits are available.

## Rules for future agents

- Do not claim a gate passed unless the exact command was actually run and its output is recorded.
- When a gap exists, document it in the PR and, if appropriate, add the missing gate in a dedicated future phase rather than hiding the gap.
- Reproducible validation is a required early migration phase before broad visual adaptation.
- The `savr-platform/` commands above supersede the `SAVR-old/` commands listed in Phase 1 discovery.
