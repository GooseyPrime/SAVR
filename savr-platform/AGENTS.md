# AGENTS — savr-platform

Rules specific to the `savr-platform/` directory.

---

## Phase 1 — Baseline import complete

The production baseline from `SAVR-old/` has been copied into this directory as the starting point for the canonical SAVR production application.

### What was imported

| Directory | Source | Contents |
|---|---|---|
| `web/` | `SAVR-old/web/` | Next.js 16 App Router application — all pages, API routes, components, contexts, lib |
| `mobile/` | `SAVR-old/mobile/` | Expo SDK 54 React Native application — all screens, components, navigation, contexts |
| `supabase/` | `SAVR-old/supabase/` | Single active migration `20260220000000_initial_schema.sql` establishing all production tables and RLS |
| `e2e-tests/` | `SAVR-old/e2e-tests/` | Playwright E2E test suite |

### What was NOT imported

- `SAVR-old/archive/` — historical/obsolete material
- `SAVR-old/.cursor/` — IDE-specific config with stale branding
- `SAVR-old/package.json` root scripts — replaced with clean `savr-platform/package.json` (Firebase deploy scripts removed)
- `SAVR-old/docs/` — SAVR-old-specific documentation; canonical docs live under the repository root `docs/`
- No `.env.local` or secrets files were copied

### Known stale references carried from production baseline

- `SAVR-old/package.json` Firebase deploy scripts are NOT present in `savr-platform/package.json`; only active Supabase/Vercel paths are preserved
- Legacy billing tier names (`free`, `plus`, `premium`) coexist with newer values (`basic`, `pro`) in the schema `subscription_tier` check constraint — this is a documented conflict, not fixed yet
- `cloudbuild-android.yaml` from the root `SAVR-old/` is not imported; it referenced Firebase-era Android deployment

---

## Active rules for this directory going forward

- `savr-platform/` is the only canonical production implementation tree
- Preserve production capabilities from the imported baseline before changing presentation
- Use `savr-premium-mobile-app/` as visual direction, not as architecture authority
- No hidden feature removal, no placeholder callbacks, and no mock data in production paths
- No local-only authenticated persistence, no duplicate backend contracts, and no second auth state system
- Validate the impact of every change on both web and mobile behavior
- If a migration needs a contract change, document it first in `docs/decisions/`
- Use npm as the package manager (matches the imported production baseline)
