# Required Validation Gates

Records the exact commands available in `savr-platform/` and their current status after corrective PR 8.

---

## Non-secret validation suite (corrective PR 8 exit state)

All commands below were run on branch `copilot/corrective-pr-8` at commit `697ee22d73dd36d18593147bbafb44ce5a9ae8f8`.

| Area | Command | Result |
|---|---|---|
| Instruction validation | `node scripts/validate-copilot-instructions.mjs` | ✅ All 8 files passed |
| Reference integrity | `bash scripts/verify-reference-integrity.sh` | ✅ No new violations on branch (WARNING: main diverges from pinned snapshot — pre-existing) |
| Web install | `cd savr-platform/web && npm ci` | ✅ exit 0, 0 vulnerabilities |
| Web lint | `cd savr-platform/web && npm run lint` | ✅ exit 0, 38 warnings, 0 errors |
| Web typecheck | `cd savr-platform/web && npx tsc --noEmit` | ✅ exit 0 |
| Web unit tests | `cd savr-platform/web && npm run test:unit` | ✅ exit 0, all tests pass |
| Web security audit | `cd savr-platform/web && npm audit --audit-level=high` | ✅ exit 0, 0 vulnerabilities |
| Web production build | `cd savr-platform/web && CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run build` | ✅ exit 0 |
| Mobile install | `cd savr-platform/mobile && npm ci` | ✅ exit 0 |
| Mobile lint | `cd savr-platform/mobile && npm run lint` | ✅ exit 0, 48 warnings, 0 errors |
| Mobile typecheck | `cd savr-platform/mobile && npm run typecheck` | ✅ exit 0 |
| Mobile unit tests | `cd savr-platform/mobile && npm run test:unit` | ✅ exit 0, 31 passed |
| Mobile security audit | `cd savr-platform/mobile && npm audit --audit-level=high` | ✅ exit 0, 0 high/critical (11 moderate, upstream-only) |
| Expo doctor | `cd savr-platform/mobile && npx expo-doctor` | ✅ 20/20 checks passed |
| Expo export (Android) | `cd savr-platform/mobile && npx expo export --platform android` | ✅ exit 0, dist/metadata.json |
| Expo export (iOS) | `cd savr-platform/mobile && npx expo export --platform ios` | ✅ exit 0, dist/metadata.json |
| E2E smoke tests | `cd savr-platform/e2e-tests && PLAYWRIGHT_USE_WEBSERVER=true CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run test:e2e:smoke` | ❌ exit 1, 7 pre-existing content-matching failures (not caused by corrective PR 8 changes) |
| Supabase migration reset | `cd savr-platform && npx supabase@latest db reset` | ⚠️ Local Supabase not running in sandbox (expected without Docker); exits 0 |

---

## Remaining gaps (corrective PR 8 exit state)

- **E2E smoke failures (pre-existing)**: 7 Playwright smoke tests fail with exit 1. Failures existed on `main` before this branch and are not caused by corrective PR 8. Content-matching assertions need to be aligned with the actual rendered HTML in a dedicated E2E hardening PR.
- **Live subscription regression**: Stripe checkout E2E requires repository secrets and a live Stripe-capable target. Workflow now skips gracefully when prerequisites are missing and remains manually dispatched.
- **Entitlement matrix**: Automated entitlement checks require live Supabase + Stripe test credentials. Workflow now skips gracefully when prerequisite tests/secrets are missing.
- **Native device validation**: No committed EAS gate; pending signing credentials. Manual checklist in `docs/validation/RELEASE_CANDIDATE_REPORT.md`.
- **Reference folder integrity on main**: `main` diverges from pinned snapshot `add8dd5c` (lockfiles removed, expo/react-native bumped during corrective PR 4). Corrective PR 8 introduced no new violations. A dedicated governance PR is needed to reconcile.
- **ADR-002**: Firebase Storage backward-compat deferred until production database audit confirms no `firebasestorage.googleapis.com` URLs remain.
- **Supabase local reset**: Requires Docker; not runnable in sandboxed CI agents. CI gate uses hosted Supabase in `phase-06-hardening.yml`.

---

## Live-environment gates (requires GitHub Staging/Production environment)

Workflow: `.github/workflows/live-environment-tests.yml`

The workflow is manual-only (`workflow_dispatch`) and each gate now exits successfully with a skip notice when required tests or environment secrets are missing.

| Test | Status |
|---|---|
| Supabase authenticated CRUD smoke | ⏳ Optional skip until `savr-platform/e2e-tests/supabase-crud.spec.ts` and required secrets are present |
| Stripe test-mode checkout | ⏳ Optional skip until required Stripe/Supabase/test-user secrets and base URL are present |
| Stripe webhook delivery | ⏳ Optional skip until Stripe credentials and webhook URL var are present |
| Basic monthly entitlement | ⏳ Optional skip until `savr-platform/web/tests/billing-entitlements.test.ts` and required secrets are present |
| Basic yearly entitlement | ⏳ Optional skip until `savr-platform/web/tests/billing-entitlements.test.ts` and required secrets are present |
| Pro monthly entitlement | ⏳ Optional skip until `savr-platform/web/tests/billing-entitlements.test.ts` and required secrets are present |
| Pro yearly entitlement | ⏳ Optional skip until `savr-platform/web/tests/billing-entitlements.test.ts` and required secrets are present |
| Customer portal | ⏳ Optional skip until `savr-platform/e2e-tests/customer-portal.spec.ts` and required secrets are present |
| Subscription cancellation | ⏳ Optional skip until `savr-platform/web/tests/subscription-cancellation.live.test.ts` exists and required secrets are present |
| Subscription upgrade/downgrade | ⏳ Optional skip until `savr-platform/web/tests/subscription-upgrade-downgrade.live.test.ts` exists and required secrets are present |
| AI request and rate-limit behavior | ⏳ Optional skip until `savr-platform/web/tests/ai-rate-limit.live.test.ts` exists and required secrets are present |

---

## Rules for future agents

- Do not claim a gate passed unless the exact command was actually run and its output is recorded.
- When a gap exists, document it in the PR and add the missing gate in a dedicated future phase.
- Reproducible validation is a required early phase before broad visual or feature work.
- The `savr-platform/` commands above supersede `SAVR-old/` commands listed in Phase 1 discovery.
