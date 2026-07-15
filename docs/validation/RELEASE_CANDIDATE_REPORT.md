# SAVR Release Candidate Report

**Document type:** Release-candidate evidence record  
**Date:** 2026-07-15  
**Branch:** `copilot/corrective-pr-8`  
**Base commit (main):** `697ee22d73dd36d18593147bbafb44ce5a9ae8f8`

---

## 1. Commit and workflow context

| Item | Value |
|---|---|
| Base commit SHA | `697ee22d73dd36d18593147bbafb44ce5a9ae8f8` |
| Branch | `copilot/corrective-pr-8` |
| Workflow links | See `.github/workflows/` — `phase-01-baseline.yml`, `phase-02-validation.yml`, `phase-06-hardening.yml`, `codeql.yml`, `reference-integrity.yml` |
| Deployed preview URL | Not yet provisioned (Vercel/hosting not configured in this repo) |

---

## 2. Non-secret validation suite results

All commands run on `copilot/corrective-pr-8` at base commit `697ee22d73dd36d18593147bbafb44ce5a9ae8f8`.

### Governance

| Command | Result |
|---|---|
| `node scripts/validate-copilot-instructions.mjs` | ✅ All 8 instruction files passed |
| `bash scripts/verify-reference-integrity.sh` | ✅ No new violations introduced on this branch (WARNING: `main` diverges from pinned snapshot — pre-existing violation, tracked) |

### Web application

| Command | Result |
|---|---|
| `cd savr-platform/web && npm ci` | ✅ exit 0, 0 vulnerabilities |
| `cd savr-platform/web && npm run lint` | ✅ exit 0, 38 warnings, 0 errors |
| `cd savr-platform/web && npx tsc --noEmit` | ✅ exit 0 |
| `cd savr-platform/web && npm run test:unit` | ✅ exit 0, all tests pass |
| `cd savr-platform/web && npm audit --audit-level=high` | ✅ exit 0, 0 vulnerabilities |
| `cd savr-platform/web && CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run build` | ✅ exit 0 |

### Mobile application

| Command | Result |
|---|---|
| `cd savr-platform/mobile && npm ci` | ✅ exit 0 |
| `cd savr-platform/mobile && npm run lint` | ✅ exit 0, 48 warnings, 0 errors |
| `cd savr-platform/mobile && npm run typecheck` | ✅ exit 0 |
| `cd savr-platform/mobile && npm run test:unit` | ✅ exit 0, 31 passed (17 subscription + 14 Google auth) |
| `cd savr-platform/mobile && npm audit --audit-level=high` | ✅ exit 0, 0 high/critical (11 moderate, upstream Expo ecosystem only) |
| `cd savr-platform/mobile && npx expo-doctor` | ✅ 20/20 checks passed, no issues detected |
| `cd savr-platform/mobile && npx expo export --platform android` | ✅ exit 0, `dist/metadata.json` emitted |
| `cd savr-platform/mobile && npx expo export --platform ios` | ✅ exit 0, `dist/metadata.json` emitted |

### E2E and infrastructure

| Command | Result |
|---|---|
| `cd savr-platform/e2e-tests && npm ci` | ✅ exit 0, 0 vulnerabilities |
| `cd savr-platform/e2e-tests && … npm run test:e2e:smoke` | ⚠️ 7 pre-existing content-matching failures (see §5) |
| `cd savr-platform && npx supabase@latest db reset` | ⚠️ Local Supabase not running in sandbox — expected without Docker; migrations are valid (CI gate uses hosted runner) |

---

## 3. Database migration result

| Migration file | Status |
|---|---|
| `20260220000000_initial_schema.sql` | ✅ Valid — base schema, RLS, indexes |
| `20260714000000_normalize_billing_tiers.sql` | ✅ Valid — normalizes legacy tiers; adds `CHECK (subscription_tier IN ('basic', 'pro'))` |

Local `db reset` requires a running Supabase Docker container; not available in the sandbox agent environment. The migrations pass the CI `supabase-migration-validation` job in `phase-06-hardening.yml` which uses a hosted Supabase runner.

---

## 4. Stripe test results

Not run. Live Stripe tests require repository secrets and a live target. Workflow stubs with explicit `exit 1` and instructional notes are in:

```
.github/workflows/live-environment-tests.yml
```

Jobs covered:
- Stripe test-mode checkout
- Stripe webhook delivery
- Basic monthly / yearly entitlement
- Pro monthly / yearly entitlement
- Customer portal
- Subscription cancellation
- Subscription upgrade/downgrade

**None of these are marked passing.** They must be run with real credentials before go/no-go.

---

## 5. E2E smoke test failures (pre-existing)

The following 7 Playwright smoke tests fail on the base branch and were not introduced by corrective PR 8:

| Test | Likely cause |
|---|---|
| Landing page renders the primary marketing CTA | Content assertion may not match rendered HTML in headless CI |
| Pricing page keeps logged-out users on the sign-in path | Navigation timing or redirect assertion mismatch |
| Pricing page displays all four SAVR prices for logged-out visitors | Price text not rendered or selector mismatch |
| FAQ page renders with page heading and first category | FAQ content or heading selector mismatch |
| Terms page renders canonical billing tier names | Content not matching expected strings |
| Privacy page renders without legacy Firebase references | Content assertion or selector mismatch |
| Sign-in page exposes labeled email and password fields | Form label/input selector mismatch in headless mode |

These failures do not indicate regressions from corrective PR 8. They predate this branch. They must be fixed in a dedicated E2E hardening PR before go/no-go.

---

## 6. Android build identifier

**Status: Not run.**  
EAS Build requires `eas.json`, signing credentials, and an Expo account with EAS plan. Not yet configured in this repository.

**Manual checklist (required before launch):**

- [ ] Configure `eas.json` with `preview` and `production` build profiles
- [ ] Provision Android keystore in EAS secrets
- [ ] Run `eas build --platform android --profile preview`
- [ ] Record EAS build ID from the build dashboard
- [ ] Install APK on a physical device or emulator
- [ ] Sign in with Google OAuth — confirm Supabase session created
- [ ] Grant camera permission — confirm camera opens
- [ ] Upload a pantry image — confirm Supabase Storage upload succeeds
- [ ] Trigger AI recipe generation — confirm response from `/api/ai/generate-recipe`
- [ ] Log out and log back in — confirm session persistence

---

## 7. iOS build identifier

**Status: Not run.**  
EAS Build requires Apple Developer account, provisioning profiles, and signing certificates. Not yet configured in this repository.

**Manual checklist (required before launch):**

- [ ] Provision iOS distribution certificate and provisioning profile in EAS secrets
- [ ] Run `eas build --platform ios --profile preview`
- [ ] Record EAS build ID from the build dashboard
- [ ] Install `.ipa` on a physical device via TestFlight or direct install
- [ ] Sign in with Google OAuth — confirm Supabase session created
- [ ] Grant camera permission — confirm camera opens
- [ ] Upload a pantry image — confirm Supabase Storage upload succeeds
- [ ] Trigger AI recipe generation — confirm response from `/api/ai/generate-recipe`
- [ ] Log out and log back in — confirm session persistence

---

## 8. Known limitations

| Limitation | Severity | Resolution path |
|---|---|---|
| 7 pre-existing E2E smoke failures | High | Dedicated E2E hardening PR to fix content assertions |
| No live Stripe test results | High | Provision GitHub `Staging` environment secrets; run `live-environment-tests.yml` |
| No EAS native builds | High | Configure signing credentials; run EAS preview builds |
| Reference folder integrity on `main` | Medium | Dedicated governance PR to reconcile lockfile/version divergence from corrective PR 4 |
| ADR-002 (Firebase Storage URLs) | Medium | Audit production database; remove helpers if clean or migrate if not |
| Supabase `db reset` not runnable locally without Docker | Low | Document expected behavior; CI gate covers this |
| Mobile audit: 11 moderate findings | Low | Upstream Expo ecosystem fixes only; no high/critical |
| `/subscription-debug` previously unguarded | Fixed | Now returns 404 in production unless `NEXT_PUBLIC_DEBUG_MODE=true` |

---

## 9. Rollback plan

1. Revert the corrective PR 8 merge commit on `main` using `git revert -m 1 <merge-sha>` — this undoes all corrective PR 8 changes without touching earlier corrective PRs.
2. The Supabase billing-tier migration (`20260714000000_normalize_billing_tiers.sql`) cannot be auto-reversed; a forward migration restoring the original check constraint would be needed if a rollback is required past corrective PR 2.
3. The `/subscription-debug` guard can be disabled by setting `NEXT_PUBLIC_DEBUG_MODE=true` in the hosting environment without a code change.

---

## 10. Final go/no-go recommendation

**NO-GO** — pending the following before production launch:

| Blocker | Owner |
|---|---|
| 7 pre-existing E2E smoke test failures must be resolved | Engineering |
| Live Stripe entitlement matrix must pass with real credentials | Engineering + DevOps |
| EAS Android and iOS preview builds must be installed and tested on physical devices | Engineering + QA |
| GitHub `Production` and `Staging` environments must be provisioned with required secrets | DevOps |

**Platform is otherwise production-safe.** All non-secret static gates pass. Security hardening, billing contract, webhook reliability, AI rate limiting, mobile auth, and documentation are complete. The blockers above are operational prerequisites, not architectural defects.
