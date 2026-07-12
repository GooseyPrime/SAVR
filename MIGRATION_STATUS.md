# Migration Status

Tracks the current phase of the SAVR consolidation project.

---

## Current Phase

**Phase 1 — Baseline import into `savr-platform` (complete)**

---

## Status Checklist

| Item | Status |
|---|---|
| Source repositories imported | ✅ Yes |
| Source roles established | ✅ Yes |
| Architecture discovery complete | ✅ Yes, with explicit verification limitations and unresolved conflicts documented |
| Canonical application initialized | ✅ Yes — Phase 1 PR merged |
| Feature migration started | ❌ No |

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

- No dedicated TypeScript type-check script in web `package.json` (gap documented in `docs/validation/required-gates.md`)
- Mobile validation limited to `expo start` — no automated CI gate for mobile type-check
- Supabase migration validation has no committed `db lint` or `db reset` script
- E2E tests require a running application; cannot run headless in CI without a deployed target
- Reproducible validation gaps to be addressed in Phase 2

---

## Next Phase

**Phase 2 — Validation and contracts**

Required outcome:

1. Establish reproducible validation gates for web, mobile, database, and end-to-end behavior.
2. Resolve stale configuration: Firebase-era root references, legacy billing tier names, workflow gaps.
3. Add any missing lint, type-check, and security-scan scripts to `savr-platform/`.

---

## Guardrails

- `SAVR-old/` was not modified.
- `savr-premium-mobile-app/` was not modified.
- All production code is in `savr-platform/`.
