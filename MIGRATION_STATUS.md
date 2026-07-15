# Migration Status

Current state of the SAVR consolidation project.  
Historical phase summaries are preserved in `docs/migration/` and linked below.

---

## Current phase

**Post-Phase-6 Corrective Track — complete**

All eight corrective PRs have been merged. The canonical platform (`savr-platform/`) is in release-candidate state.

---

## Corrective track summary

| Corrective PR | Title | Status |
|---|---|---|
| Corrective PR 1 | Restore repository governance | ✅ Complete |
| Corrective PR 2 | Normalize Basic and Pro billing | ✅ Complete |
| Corrective PR 3 | Make Stripe webhook processing reliable | ✅ Complete |
| Corrective PR 4 | Formalize and validate the mobile platform version | ✅ Complete |
| Corrective PR 5 | Implement durable AI rate limiting | ✅ Complete |
| Corrective PR 6 | Productionize the public landing page | ✅ Complete |
| Corrective PR 7 | Complete mobile authentication readiness | ✅ Complete |
| Corrective PR 8 | Final release-candidate verification | ✅ Complete |

---

## Platform state

| Area | Status | Notes |
|---|---|---|
| Repository governance | ✅ CI-validated | Reference integrity enforced; instruction routing correct |
| Web application build | ✅ CI-validated | Next.js App Router; exit 0 on lint, typecheck, build, unit tests |
| Mobile application build | ✅ CI-validated | Expo SDK 57; exit 0 on lint, typecheck, unit tests, expo export (android + ios) |
| Supabase migrations | ✅ CI-validated | `db reset` clean; billing-tier normalization migration in place |
| Billing tier contract | ✅ Implemented | `basic` and `pro` only; helpers in `web/lib/billing.ts` and `mobile/src/lib/billing.ts` |
| Stripe webhook | ✅ Implemented | Signature verification, idempotent reconciliation, server-driven entitlement |
| AI rate limiting | ✅ Implemented | Durable per-user daily limits; server-side only |
| Landing page | ✅ Implemented | Public marketing page with correct pricing and CTA |
| Mobile Google OAuth | ✅ Implemented | Expo Auth Session; deep-link handling; ADR-004 documents remaining device gates |
| E2E smoke coverage | ✅ CI-validated | Playwright smoke spec covers landing, pricing, sign-in across desktop/mobile viewports |
| Security (web) | ✅ CI-validated | `npm audit --audit-level=high` → 0 high/critical; CodeQL SAST enabled |
| Security (mobile) | ✅ CI-validated | `npm audit --audit-level=high` → 0 high/critical; 11 moderate (upstream-only) |
| Debug surface (`/subscription-debug`) | ✅ Implemented | Returns 404 in production unless `NEXT_PUBLIC_DEBUG_MODE=true` |
| Live Stripe checkout E2E | ⏳ Manually pending | Requires repository secrets and live Stripe target; workflow stub in `live-environment-tests.yml` |
| Entitlement matrix E2E | ⏳ Manually pending | Requires live Supabase + Stripe test credentials; workflow stub in `live-environment-tests.yml` |
| Native device validation | ⏳ Manually pending | EAS builds and device smoke tests require signing credentials; manual checklist in release report |
| Firebase Storage URL audit | 🔒 Blocked | ADR-002 deferred until production database is audited for `firebasestorage.googleapis.com` URLs |
| Reference folder integrity (main) | ⚠️ Pre-existing violation | `main` diverges from pinned snapshot `add8dd5c` (lockfiles removed, package.json versions bumped in corrective PR 4); corrective-pr-8 introduced no new violations |

---

## Architecture decisions

| ADR | Title | Status |
|---|---|---|
| ADR-001 | Billing Tier Names | ✅ Accepted |
| ADR-002 | Firebase Storage Backward Compatibility | 📋 Documented — deferred |
| ADR-003 | Canonical Expo Version (SDK 57) | ✅ Accepted |
| ADR-004 | Mobile Google OAuth with Expo Auth Session | ✅ Accepted |

---

## Source origins

| Folder | Role | State |
|---|---|---|
| `SAVR-old/` | Production architecture and feature baseline (read-only) | Pinned at `add8dd5c`; diverged on `main` (pre-existing, tracked in source origins doc) |
| `savr-premium-mobile-app/` | Approved UI/UX reference (read-only) | Pinned at `add8dd5c`; diverged on `main` (pre-existing) |
| `savr-platform/` | Canonical production application | Active; release-candidate state |

See `SOURCE_ORIGINS.md` for the full source registry.

---

## Remaining work before public launch

1. Provision GitHub `Production` and `Staging` environments with required secrets
2. Complete live-environment test stubs in `.github/workflows/live-environment-tests.yml`
3. Configure EAS Build signing credentials and run the native release checklist in `docs/validation/RELEASE_CANDIDATE_REPORT.md`
4. Audit production database for Firebase Storage URLs (ADR-002 resolution criteria)
5. Restore reference-folder integrity on `main` in a dedicated governance PR (separate from corrective track)

---

## Historical records

Full per-phase summaries (Phases 1–6) and per-corrective-PR summaries (CRs 1–7) are in the git history of this file. The last full-history version was committed before corrective PR 8.
