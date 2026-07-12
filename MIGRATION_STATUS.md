# Migration Status

Tracks the current phase of the SAVR consolidation project.

---

## Current Phase

**Phase 3 — Shared Design System Foundation (in progress)**

---

## Status Checklist

| Item | Status |
|---|---|
| Source repositories imported | ✅ Yes |
| Source roles established | ✅ Yes |
| Architecture discovery complete | ✅ Yes, with explicit verification limitations and unresolved conflicts documented |
| Canonical application initialized | ✅ Yes — Phase 1 PR merged |
| Validation gates documented | ✅ Yes — Phase 2 complete |
| Shared design tokens created | ✅ Yes — Phase 3 |
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

## Phase 2 Completion Summary

Phase 2 (Validation and Contract Reconciliation) exit criteria were met through
documentation established across Phase 1 and subsequent cleanup. No dedicated
Phase 2 PR was needed because all required artifacts already existed.

### Exit criteria met

- Validation gates documented in `docs/validation/required-gates.md`
- Source-of-truth conflicts documented in `docs/architecture/source-of-truth.md`
- Production architecture reference documented in `docs/architecture/production-reference.md`
- Stale Firebase-era root scripts removed from `savr-platform/package.json`
- CI workflow established for web lint, typecheck, and production build (`phase-01-baseline.yml`)
- `typecheck` npm script added to `savr-platform/web/package.json` (closes Phase 1 gap)

### Remaining validation gaps (documented, not blocking Phase 3)

- Mobile validation limited to `expo start` — no automated CI gate for mobile type-check
- Supabase migration validation has no committed `db lint` or `db reset` script
- E2E tests require a running application; cannot run headless in CI without a deployed target
- No non-E2E unit/integration test commands

---

## Phase 3 Completion Summary

Shared design tokens ported from `savr-premium-mobile-app/src/theme.css` into
production-safe shared primitives available to both web and mobile platforms.

### What was created

- `savr-platform/design-system/tokens.ts` — canonical TypeScript source of all token values
- `savr-platform/design-system/web/theme.css` — Tailwind v4 `@theme` CSS block (mirrors tokens.ts)
- `savr-platform/design-system/README.md` — per-platform usage documentation
- `savr-platform/mobile/src/theme/index.ts` — React Native–compatible token constants

### What was updated

- `savr-platform/web/app/globals.css` — replaced old cyan/purple theme with premium lime/dark-green design system tokens via Tailwind v4 `@theme` block; updated utility classes and global styles to use CSS variables
- `savr-platform/web/package.json` — added `typecheck` npm script
- `.github/workflows/phase-01-baseline.yml` — updated typecheck job to use `npm run typecheck`

### What did NOT change

- No API routes, data contracts, or auth flows modified
- No navigation structure or routing changed
- No database or RLS changes
- `SAVR-old/` and `savr-premium-mobile-app/` not modified

---

## Known Remaining Blockers

- Mobile validation limited to `expo start` — no automated CI gate for mobile type-check
- Supabase migration validation has no committed `db lint` or `db reset` script
- E2E tests require a running application; cannot run headless in CI without a deployed target

---

## Next Phase

**Phase 4 — Application Shells**

Required outcome:

1. Production-safe web and mobile application shells in `savr-platform/` that preserve routing, auth boundaries, safe areas, and navigation affordances.
2. Shells consume the shared design token layer established in Phase 3.
3. No feature behavior changes beyond presentation and navigation structure.

---

## Guardrails

- `SAVR-old/` was not modified.
- `savr-premium-mobile-app/` was not modified.
- All production code is in `savr-platform/`.
