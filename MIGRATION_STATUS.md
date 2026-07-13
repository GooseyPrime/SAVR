# Migration Status

Tracks the current phase of the SAVR consolidation project.

---

## Current Phase

**Phase 5 — Feature Migration (in progress)**

---

## Status Checklist

| Item | Status |
|---|---|
| Source repositories imported | ✅ Yes |
| Source roles established | ✅ Yes |
| Architecture discovery complete | ✅ Yes, with explicit verification limitations and unresolved conflicts documented |
| Canonical application initialized | ✅ Yes — Phase 1 PR merged |
| Validation gates documented | ✅ Yes — Phase 2 complete |
| Contract conflicts documented | ✅ Yes — ADR-001 (billing tiers), ADR-002 (Firebase storage compat) |
| Shared design tokens created | ✅ Yes — Phase 3 |
| Application shells created | ✅ Yes — Phase 4 |
| Feature migration started | ✅ Yes — Phase 5 (Home slice)

---

## Phase 5 Progress (in progress)

Feature migration in bounded vertical slices per `PHASE_05_FEATURE_MIGRATION.md`.

### Slice 1 — Home (complete)

**Production behavior preserved:**
- Auth guard via `ProtectedRoute` / `useAuth`
- Stats (inventory, recipe, meal-plan counts) from Supabase via `getInventory`, `getRecipes`, `getMealPlans`
- Stripe checkout success banner and `trackCheckoutIntentIfReturning` (web only)
- Subscription tier display and upgrade link (web only)
- Pro-gated AI Chat access (mobile only)
- Pull-to-refresh (mobile only)

**Premium UX adapted (from `savr-premium-mobile-app/src/pages/Home.tsx`):**
- Time-based greeting (Good morning/afternoon/evening)
- 2-column primary action buttons: Scan Ingredients (primary/lime) + What Can I Make? (secondary)
- 3-column stat badges (Pantry, Recipes, Planned)
- Expiring soon items section (inventory items with `expiry_date` within 3 days)
- Today's meals section from meal plans (`meals` array filtered to today's date)
- Recent recipes section (last 5, most recent first)
- Design token CSS classes replacing hardcoded legacy hex values

**Production architecture NOT copied from prototype:**
- No `useAppStore` — data fetches from Supabase production contracts only
- No `motion/react` animation dependency — React Native theme tokens used instead
- No prototype `MobileLayout`, `Card`, `Button` UI kit — standalone platform-native components

**Files changed:**
- `savr-platform/web/app/dashboard/page.tsx`
- `savr-platform/mobile/src/screens/main/HomeScreen.tsx`

**Web/mobile effects:** presentation updated; no API routes, data contracts, auth flows, or navigation structure changed. Rollback path: revert the two changed files.

**Validation (exact commands, exact results):**
- `cd savr-platform/web && npm run lint` → exit 0, 34 warnings (same as baseline)
- `cd savr-platform/web && npm run typecheck` → exit 0
- `cd savr-platform/web && CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run build` → exit 0
- `cd savr-platform/mobile && npm run typecheck` → exit 0

### Phase 5 feature slices — all remaining slices complete

All feature screens migrated from old orange/light design to the premium lime/dark design system in this PR. Each screen preserves production data contracts from `lib/db` while applying the `design-system/tokens.ts` visual layer.

- [x] Pantry/Inventory — `InventoryScreen.tsx` (mobile); web cyan→lime colors applied
- [x] Scanner and review flow — `LabelingScreen.tsx` (mobile) design tokens applied; web `upload/page.tsx` cyan→lime applied
- [x] Recipes and recipe detail — `RecipesScreen.tsx` + `RecipeDetailScreen.tsx` (mobile); web `recipes/page.tsx` cyan→lime applied
- [x] Cooking mode — web `cook/` page cyan→lime applied (mobile cooking handled via RecipeDetail)
- [x] Meal plans — `MealPlansScreen.tsx` (mobile); web `meal-plans/page.tsx` cyan→lime applied
- [x] Grocery lists — `GroceryListScreen.tsx` (mobile); web `grocery-lists/page.tsx` cyan→lime applied
- [x] Profile and settings — `ProfileScreen.tsx` (mobile); web `settings/page.tsx` cyan→lime applied
- [x] Authentication screens — `SignInScreen.tsx`, `SignUpScreen.tsx`, `WelcomeScreen.tsx` (mobile) design tokens applied; web auth pages cyan→lime applied
- [x] Subscription validation — web `pricing/page.tsx` cyan→lime applied

**Production architecture NOT copied from prototype:**
- No `useAppStore` — all screens retain Supabase `lib/db` data contracts
- No `motion/react` — design token colors and layout only
- No prototype component kit — platform-native React Native + Tailwind v4 web

**Web/mobile effects:** presentation updated; no API routes, data contracts, auth flows, RLS policies, Stripe billing, or AI wiring changed. Rollback path: revert the changed files.

### Additional Phase 2/3/4 limitations resolved in this PR

- **Mobile ESLint**: Added `eslint.config.js` + `eslint-plugin-react`, `eslint-plugin-react-hooks`, `@typescript-eslint` devDependencies to `savr-platform/mobile/`. Added `lint` script. Added `mobile-lint` CI job to `.github/workflows/phase-02-validation.yml`.
- **CSS misnamed classes**: Renamed `.glow-cyan` → `.glow-primary`, `.glow-cyan-strong` → `.glow-primary-strong`, `.gradient-text-cyan` → `.gradient-text-lime` in `globals.css`. Updated all usages in `web/app/page.tsx`.

### Remaining Phase 5 limitations (require infrastructure or are deferred)

- Cooking mode (mobile) — no dedicated cooking screen in mobile; recipe detail serves as the cooking reference. A dedicated full-screen cooking mode is deferred per `PHASE_05_FEATURE_MIGRATION.md`.
- Animation/transitions — `motion/react` and React Native Reanimated excluded pending evaluation against production dependency set.
- Recipe detail link from Today's Meals (home) — deferred per Slice 1 limitation notes.


---

## Phase 4 Completion Summary

Production-safe web and mobile application shells created in `savr-platform/`. Both shells use the shared design token layer from Phase 3 and are ready for bounded feature migration.

### What was added

- `savr-platform/mobile/App.tsx` — root Expo entry point
- `savr-platform/mobile/src/components/LoadingSpinner.tsx` — shared loading indicator using design tokens
- `savr-platform/mobile/src/navigation/` — `AuthNavigator`, `MainNavigator`, `MobileTabBar`, `RootNavigator`, `navigationTheme`
- `savr-platform/web/components/LoadingSpinner.tsx` — web loading indicator
- `savr-platform/web/components/Navbar.tsx` — web navigation shell
- `savr-platform/web/components/ProtectedRoute.tsx` — web auth guard

### What did NOT change

- No API routes, data contracts, or auth flows modified
- No database or RLS changes
- `SAVR-old/` and `savr-premium-mobile-app/` not modified

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

## Phase 4 Completion Summary

Production-safe web and mobile application shells now consume the shared
design-token layer while preserving the imported production routes, auth
boundaries, and backend contracts.

### What was created

- `savr-platform/mobile/src/navigation/MobileTabBar.tsx` — token-driven mobile tab shell for the canonical bottom navigation
- `savr-platform/mobile/src/navigation/navigationTheme.ts` — shared React Navigation dark theme mapped to the Phase 3 token layer

### What was updated

- `savr-platform/web/components/Navbar.tsx` — rebuilt the web shell navigation around the premium token palette while preserving all production destinations
- `savr-platform/web/components/ProtectedRoute.tsx` — updated the authenticated loading shell without changing auth or subscription gating rules
- `savr-platform/web/components/LoadingSpinner.tsx` — aligned shell loading treatment with the shared token layer
- `savr-platform/mobile/App.tsx` — added `SafeAreaProvider` and token-aligned status-bar handling
- `savr-platform/mobile/src/components/LoadingSpinner.tsx` — aligned loading shell visuals with the shared token layer
- `savr-platform/mobile/src/navigation/AuthNavigator.tsx` — set production auth shell background styling without changing auth flow logic
- `savr-platform/mobile/src/navigation/RootNavigator.tsx` — themed the root shell and auth restoration loading state
- `savr-platform/mobile/src/navigation/MainNavigator.tsx` — applied the canonical shell theme to tab and stack navigation

### What did NOT change

- No API routes, Supabase schema, Stripe logic, or AI provider wiring changed
- No production route paths or protected-route access rules changed
- No feature-specific data shaping or CRUD behavior changed
- `SAVR-old/` and `savr-premium-mobile-app/` were not modified

### Phase 5 readiness

- Shared design tokens are now wired into both production shells
- Web and mobile navigation affordances are stable enough for bounded feature-slice work
- Phase 5 can begin with the recommended Home slice, followed by Pantry, without reopening shell architecture

---

## Known Remaining Blockers

- Billing tier names conflict — see `docs/decisions/ADR-001-billing-tier-names.md`
- Firebase Storage backward compat — see `docs/decisions/ADR-002-firebase-storage-compat.md`
- Mobile Google OAuth requires additional setup; not production-ready for all paths
- Mobile lint configuration is still missing in `savr-platform/mobile/`
- Supabase migration validation has no committed `db lint` or `db reset` script
- E2E tests require a running application; cannot run headless in CI without a deployed target
- No unit/integration test suite for web or mobile

---

## Next Phase

**Phase 5 — Feature Migration**

Recommended outcome:

1. Migrate bounded feature slices against the now-stable web and mobile shells, starting with Home.
2. Preserve production contracts while adapting premium UX screen by screen.
3. Keep each PR scoped to one feature slice or one tightly bounded contract surface.

---

## Guardrails

- `SAVR-old/` was not modified.
- `savr-premium-mobile-app/` was not modified.
- All production code is in `savr-platform/`.
