# Migration Status

Tracks the current phase of the SAVR consolidation project.

---

## Current Phase

**Phase 2 — Validation and Contract Reconciliation (complete)**

---

## Status Checklist

| Item | Status |
|---|---|
| Source repositories imported | ✅ Yes |
| Source roles established | ✅ Yes |
| Architecture discovery complete | ✅ Yes, with explicit verification limitations and unresolved conflicts documented |
| Canonical application initialized | ✅ Yes — Phase 1 PR merged |
| Validation gates established | ✅ Yes — Phase 2 complete |
| Contract conflicts documented | ✅ Yes — ADR-001 (billing tiers), ADR-002 (Firebase storage compat) |
| Feature migration started | ❌ No |

---

## Phase 2 Completion Summary

Validation gates and contract conflicts were established and documented. The baseline is now reproducible before broad UI adaptation begins.

### What was added

- `savr-platform/web/package.json` — `typecheck` script (`tsc --noEmit`)
- `savr-platform/mobile/package.json` — `typecheck` script (`tsc --noEmit`)
- `savr-platform/package.json` — `web:typecheck` and `mobile:typecheck` root shortcuts
- `.github/workflows/phase-02-validation.yml` — CI job for mobile TypeScript check
- `docs/decisions/ADR-001-billing-tier-names.md` — billing tier naming conflict documented
- `docs/decisions/ADR-002-firebase-storage-compat.md` — Firebase Storage backward-compat status documented
- `docs/validation/required-gates.md` — updated to reflect Phase 2 additions and remaining gaps

### Validation gates now active

| Gate | Command | CI job |
|---|---|---|
| Web lint | `npm run lint` (in `savr-platform/web`) | `phase-01-baseline.yml: web-lint` |
| Web typecheck | `npm run typecheck` (in `savr-platform/web`) | `phase-01-baseline.yml: web-typecheck` |
| Web build | `npm run build` (in `savr-platform/web`) | `phase-01-baseline.yml: web-build` |
| Mobile typecheck | `npm run typecheck` (in `savr-platform/mobile`) | `phase-02-validation.yml: mobile-typecheck` |

### Remaining validation gaps (explicit)

- Mobile lint — no ESLint config in `savr-platform/mobile/`
- Unit/integration tests — no non-E2E test suite
- Supabase migration CI gate — requires Supabase CLI or project access
- E2E CI gate — requires a deployed application target
- Security scanning — no automated dependency or SAST scan

---

## Phase 1 Completion Summary

The production baseline from `SAVR-old/` was copied into `savr-platform/` without visual migration and without changing product behavior.

### What was imported

- `savr-platform/web/` — Next.js 16 App Router web application (full source)
- `savr-platform/mobile/` — Expo SDK 54 React Native mobile application (full source)
- `savr-platform/supabase/` — Active migration `20260220000000_initial_schema.sql` and RLS policies
- `savr-platform/e2e-tests/` — Playwright E2E test suite

### What was explicitly excluded

- Firebase deploy scripts from the SAVR-old root `package.json` (replaced with clean `savr-platform/package.json`)
- `SAVR-old/archive/` — historical/obsolete material
- `SAVR-old/.cursor/` — IDE config with stale branding
- No secrets or `.env.local` files copied

### Stale references documented (not fixed yet)

- Legacy billing tier names (`free`, `plus`, `premium`) coexist with newer values (`basic`, `pro`) in the `subscription_tier` check constraint
- Mobile Google OAuth is marked in source as requiring additional setup; not production-ready for all paths
- `SAVR-old/cloudbuild-android.yaml` still contains Firebase Android build references; not imported

---

## Known Remaining Blockers

- Billing tier names conflict — see `docs/decisions/ADR-001-billing-tier-names.md`
- Firebase Storage backward compat — see `docs/decisions/ADR-002-firebase-storage-compat.md`
- Mobile Google OAuth requires additional setup; not production-ready for all paths
- Supabase migration validation has no committed `db lint` or `db reset` script
- E2E tests require a running application; cannot run headless in CI without a deployed target
- No unit/integration test suite for web or mobile

---

## Next Phase

**Phase 3 — Design System**

Required outcome:

1. Adapt design tokens, typography, color, and component primitives from `savr-premium-mobile-app/` into `savr-platform/`.
2. Preserve production data contracts; change only presentation.
3. Do not introduce a second auth state, local-only persistence, or prototype architecture.

---

## Guardrails

- `SAVR-old/` was not modified.
- `savr-premium-mobile-app/` was not modified.
- All production code is in `savr-platform/`.
