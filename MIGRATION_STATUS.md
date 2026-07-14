# Migration Status

Tracks the current phase of the SAVR consolidation project.

---

## Current Phase

**Post-Phase-6 Corrective Track — in progress**

Consolidation phases 1–6 are complete. A corrective build path is underway to address governance gaps, billing contract normalization, webhook reliability, mobile platform formalization, AI rate limiting, landing-page productionization, mobile auth completeness, and final release-candidate verification.

---

## Post-Phase-6 Corrective Track

| Corrective PR | Title | Status |
|---|---|---|
| Corrective PR 1 | Restore repository governance | ✅ Complete |
| Corrective PR 2 | Normalize Basic and Pro billing | ✅ Complete |
| Corrective PR 3 | Make Stripe webhook processing reliable | ✅ Complete |
| Corrective PR 4 | Formalize and validate the mobile platform version | ⏳ Pending |
| Corrective PR 5 | Implement durable AI rate limiting | ⏳ Pending |
| Corrective PR 6 | Productionize the public landing page | ⏳ Pending |
| Corrective PR 7 | Complete mobile authentication readiness | ⏳ Pending |
| Corrective PR 8 | Final release-candidate verification | ⏳ Pending |

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
| Feature migration started | ✅ Yes — Phase 5 (all slices complete) |
| Hardening and release readiness complete | ✅ Yes — Phase 6 evidence recorded |

---

## Phase 6 Completion Summary

Phase 6 added the missing hardening gates needed to prove the consolidated platform is production-safe without reopening application contracts.

### What was added

- `.github/workflows/phase-06-hardening.yml` — CI jobs for web/mobile unit tests, dependency audits, Playwright smoke coverage, and Supabase migration reset
- `.github/workflows/codeql.yml` — repository SAST scanning for JavaScript/TypeScript
- `savr-platform/web/tests/units.test.ts` — non-E2E coverage for ingredient normalization and pet-safety filtering
- `savr-platform/mobile/tests/subscription.test.ts` — non-E2E coverage for mobile billing-tier semantics
- `savr-platform/e2e-tests/smoke.spec.ts` — local CI-safe smoke coverage for landing, pricing, and sign-in flows across desktop/mobile viewports
- `savr-platform/supabase/config.toml` — committed Supabase CLI config so migration reset is reproducible

### What changed

- `savr-platform/web/package.json` — added `test:unit`, `tsx`, and security overrides that eliminate current high-severity web audit findings
- `savr-platform/mobile/package.json` — added `test:unit` and `tsx`
- `savr-platform/e2e-tests/package.json` / `playwright.config.ts` — added smoke script and CI-controlled local web server startup
- `savr-platform/package.json` — added root shortcuts for unit tests and Supabase reset
- `docs/validation/required-gates.md` — updated Phase 6 gate inventory and remaining deferred limits
- `savr-platform/README.md` — Phase 5 and Phase 6 marked complete

### Validation added

- `cd savr-platform/web && npm run test:unit`
- `cd savr-platform/mobile && npm run test:unit`
- `cd savr-platform/e2e-tests && PLAYWRIGHT_USE_WEBSERVER=true CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run test:e2e:smoke`
- `cd savr-platform && npx supabase@latest db reset`
- `cd savr-platform/web && npm audit --audit-level=high`
- `cd savr-platform/mobile && npm audit --audit-level=high`

### Remaining deferred items

- Live Stripe checkout E2E still needs repository secrets and a live target
- Mobile native runtime validation still depends on external device/emulator execution
- ADR-001 and ADR-002 remain open until production audits are available


---

## Corrective PR 3 Completion Summary

**Title:** fix: add idempotent Stripe webhook reconciliation  
**Branch:** `copilot/proceed-with-corrective-action-pr-3`

### What was added

- `savr-platform/supabase/migrations/20260714020000_stripe_webhook_events.sql` — forward-only migration creating `public.stripe_webhook_events` table (event_id PK, event_type, processing_status, attempt_count, last_error, timestamps) with a `('pending','processed','failed')` check constraint, RLS enabled with no client policies, and the `public.claim_stripe_webhook_event(event_id, event_type)` security-definer SQL function for atomic idempotent event claiming
- `savr-platform/web/lib/stripe-webhook.ts` — extracted webhook business logic (handleWebhook, claimWebhookEvent, markEventProcessed, markEventFailed, dispatchWebhookEvent, all event-specific handlers) with injectable `StripeClient` and `SupabaseAdmin` interfaces for testability
- `savr-platform/web/tests/webhook.test.ts` — 21 unit tests covering all required scenarios (invalid/missing signature, first delivery, duplicate processed, already-pending concurrent delivery, retry after failure, Basic monthly/yearly, Pro monthly/yearly, unknown price ID, subscription update, subscription deletion, payment failed, payment recovered, checkout session, claimWebhookEvent unit tests)

### What changed

- `savr-platform/web/app/api/stripe/webhook/route.ts` — simplified to a thin Next.js adapter that initialises real Stripe/Supabase instances and delegates to `handleWebhook()` from `stripe-webhook.ts`
- `MIGRATION_STATUS.md` — corrective PR 3 marked complete

### Validation (exact commands, exact results)

- `cd savr-platform/web && npm run lint` → exit 0, 43 warnings (pre-existing pattern; 0 errors)
- `cd savr-platform/web && npx tsc --noEmit` → exit 0
- `cd savr-platform/web && CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run build` → exit 0
- `cd savr-platform/web && npm run test:unit` → 45 passed (24 original + 21 new webhook tests), 0 failed

### Remaining limitations

- `supabase db reset` against a live project: deferred (requires Supabase CLI and Docker environment); migration SQL validated by inspection and constraint logic review
- Live Stripe signature verification of `claim_stripe_webhook_event` RPC round-trip: deferred (requires live Supabase project)
- Mobile webhook handling is not applicable (mobile is a client-only consumer of subscription state)

### Reference folder confirmation

- `SAVR-old/` — not modified
- `savr-premium-mobile-app/` — not modified

---

## Corrective PR 2 Completion Summary

**Title:** fix: establish Basic and Pro as the only SAVR billing tiers  
**Branch:** `copilot/complete-corrective-action-pr-2`

### What was added

- `savr-platform/supabase/migrations/20260714000000_normalize_billing_tiers.sql` — forward-only migration that normalizes `free`→`basic`, `plus`→`pro`, `premium`→`pro`, then narrows the check constraint to `('basic', 'pro')` only
- `savr-platform/web/lib/billing.ts` — canonical billing helpers: `isKnownTier`, `isSubscriptionActive`, `hasBasicAccess`, `hasProAccess`, `resolveTierFromPriceId`
- `savr-platform/mobile/src/lib/billing.ts` — equivalent mobile billing helpers (camelCase UserData fields)
- `savr-platform/web/.env.example` — documents all env vars including the four new `STRIPE_PRICE_*` server-only variables

### What changed

- `docs/decisions/ADR-001-billing-tier-names.md` — status updated to Accepted; pricing contract, access rules, and implementation recorded
- `savr-platform/web/contexts/AuthContext.tsx` — removed legacy tier values from `UserData` type; `isProTier` simplified to `tier === 'pro'`; `isPaidTier` removed; imports from `billing.ts`
- `savr-platform/web/lib/middleware.ts` — `checkSubscriptionTier` uses `=== 'pro'` only (no legacy values)
- `savr-platform/web/types/index.ts` — `SubscriptionTierName` corrected from `'free' | 'pro'` to `'basic' | 'pro'`
- `savr-platform/web/app/settings/page.tsx` — `tierLabel` uses `tier === 'pro'` only
- `savr-platform/web/app/pricing/page.tsx` — static plan comparison grid added (Basic $4.99/mo + $49.99/yr, Pro $9.99/mo + $99.99/yr); `isPro` uses `hasProAccess` from `billing.ts`
- `savr-platform/web/app/api/stripe/webhook/route.ts` — `getTierFromPrice` replaced with `resolveTierFromPriceId` imported from `billing.ts`; unknown price IDs abort the update (no silent defaults)
- `savr-platform/mobile/src/types/index.ts` — legacy tier union and `isPaidTier` function removed
- `savr-platform/mobile/src/contexts/AuthContext.tsx` — `as any` removed; explicit normalization of legacy DB values to canonical tiers
- `savr-platform/mobile/src/screens/main/ProfileScreen.tsx` — uses `hasProAccess` from `billing.ts` instead of `isPaidTier`
- `savr-platform/mobile/tests/subscription.test.ts` — rewritten to test `billing.ts` helpers with full coverage of canonical and legacy tier cases
- `savr-platform/web/tests/units.test.ts` — billing helper tests added (24 total, including `resolveTierFromPriceId` coverage)
- `savr-platform/e2e-tests/smoke.spec.ts` — new smoke test verifying all four plan prices visible on the pricing page
- `MIGRATION_STATUS.md` — corrective PR 2 marked complete

### Validation (exact commands, exact results)

- `cd savr-platform/web && npm run lint` → exit 0, 35 warnings (pre-existing; 0 errors)
- `cd savr-platform/web && npx tsc --noEmit` → exit 0
- `cd savr-platform/web && CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run build` → exit 0
- `cd savr-platform/web && npm run test:unit` → 24 passed, 0 failed
- `cd savr-platform/mobile && npm run lint` → exit 0, 50 warnings (pre-existing; 0 errors)
- `cd savr-platform/mobile && npm run typecheck` → exit 0
- `cd savr-platform/mobile && npm run test:unit` → 17 passed, 0 failed
- `cd savr-platform/e2e-tests && PLAYWRIGHT_USE_WEBSERVER=true CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npx playwright test smoke.spec.ts` → 4 passed (includes new pricing price display test)
- Supabase db reset: deferred — requires local Supabase CLI with active Docker; migration SQL validated by inspection and constraint logic review

### Remaining limitations

- `supabase db reset` against a live project: deferred (requires Supabase CLI and Docker environment)
- Mobile ChatScreen.tsx uses `subscriptionTier !== 'pro'` without checking subscription status — this is an incomplete guard pre-existing before this PR and is unchanged
- Stripe price ID validation against actual amounts/intervals requires live Stripe API access

### Reference folder confirmation

- `SAVR-old/` — not modified
- `savr-premium-mobile-app/` — not modified

---

## Phase 5 Progress (complete)

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

### Slices 2–10 — All remaining slices (complete)

**Slices covered:** Pantry, Scanner and review flow, Recipes and recipe detail, Cooking mode, Meal plans, Grocery lists, Profile and settings, Authentication pages, Subscription page.

**Production behavior preserved across all slices:**
- All Supabase data contracts unchanged (getInventory, addInventoryItem, deleteInventoryItem, getRecipes, generateRecipes, getMealPlans, generateMealPlan, getGroceryLists, updateGroceryList, getDataConsent, upsertDataConsent, callApi for stripe portal)
- All auth guards and `ProtectedRoute` wrappers unchanged
- All navigation routes and stack params unchanged
- All Stripe billing server-side interactions (manage subscription, portal) unchanged
- AI recipe generation, meal plan generation, image analysis API calls unchanged
- Mobile: Pull-to-refresh, AI scan, delete confirmation preserved
- Web: Edit modal, barcode lookup, recipe sharing, deduction modal preserved

**Premium UX adapted per slice:**
- Pantry: search bar + category filter chips (All/Pantry/Fridge/Freezer) + location grouping + expiry warning badges + stats row; web: same token classes
- Recipes (mobile): search bar + filter chips (All/AI Generated/Quick) + results count; web: token classes
- Recipe Detail (mobile): meta chips row, dietary tags row, ingredients as bordered cards, lime step circles for instructions
- Meal Plans (mobile): date card with meal-type icons + grouped meals display; web: token classes
- Grocery Lists (mobile): category grouping + check/uncheck with progress indicator + done badge; web: token classes
- Profile: lime avatar, tier badge, section cards with icons, sign-out button in error/danger style; web settings: lime primary, mint secondary replacing old cyan/purple
- Scanner/Upload: token classes applied; cooking mode timer/chat/progress gradient updated
- Auth pages (sign-in, sign-up, forgot-password): token classes
- Pricing: token classes + SVG stroke fix

**Production architecture NOT copied from prototype:**
- No `useAppStore`, no `motion/react`, no prototype UI kit components
- No prototype auth, router, or sessionStorage patterns
- No new dependencies added

**Files changed:**
- `savr-platform/mobile/src/screens/main/InventoryScreen.tsx`
- `savr-platform/mobile/src/screens/main/RecipesScreen.tsx`
- `savr-platform/mobile/src/screens/main/RecipeDetailScreen.tsx`
- `savr-platform/mobile/src/screens/main/MealPlansScreen.tsx`
- `savr-platform/mobile/src/screens/main/GroceryListScreen.tsx`
- `savr-platform/mobile/src/screens/main/ProfileScreen.tsx`
- `savr-platform/mobile/src/screens/main/LabelingScreen.tsx`
- `savr-platform/web/app/inventory/page.tsx`
- `savr-platform/web/app/recipes/page.tsx`
- `savr-platform/web/app/meal-plans/page.tsx`
- `savr-platform/web/app/grocery-lists/page.tsx`
- `savr-platform/web/app/settings/page.tsx`
- `savr-platform/web/app/upload/page.tsx`
- `savr-platform/web/app/cook/[recipeId]/CookContent.tsx`
- `savr-platform/web/app/sign-in/page.tsx`
- `savr-platform/web/app/sign-up/page.tsx`
- `savr-platform/web/app/forgot-password/page.tsx`
- `savr-platform/web/app/pricing/page.tsx`
- `savr-platform/web/app/chat/page.tsx`
- `savr-platform/web/app/recipe/page.tsx`
- `savr-platform/web/app/page.tsx`
- `MIGRATION_STATUS.md`

**Web/mobile effects:** presentation updated across all feature screens; no API routes, data contracts, auth flows, navigation structure, or RLS policies changed. Rollback path: revert the changed files.

**Validation (exact commands, exact results):**
- `cd savr-platform/web && npm run lint` → exit 0, 34 warnings (same as baseline)
- `cd savr-platform/web && npx tsc --noEmit` → exit 0
- `cd savr-platform/web && CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run build` → exit 0
- `cd savr-platform/mobile && npm run typecheck` → exit 0 (same pre-existing errors as baseline)

### Remaining Phase 5 slices

- [x] Pantry
- [x] Scanner and review flow
- [x] Recipes and recipe detail
- [x] Cooking mode
- [x] Meal plans
- [x] Grocery lists
- [x] Profile and settings
- [x] Authentication and guest conversion validation
- [x] Subscription and entitlement validation

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

**Project phases 1–6 complete**

Recommended outcome:

1. Use the Phase 6 gate set as the release-readiness baseline for future feature work.
2. Resolve ADR-001 and ADR-002 only when production audit evidence is available.
3. Keep future PRs bounded to post-consolidation product changes, not migration backlog catch-up.

---

## Guardrails

- `SAVR-old/` was not modified.
- `savr-premium-mobile-app/` was not modified.
- All production code is in `savr-platform/`.
