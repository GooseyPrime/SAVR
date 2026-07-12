# Production Reference — `SAVR-old/`

This document records the active production architecture discovered in `SAVR-old/` and distinguishes it from stale and historical material.

## Verification status

- Imported folder present: yes
- Expected upstream repository: `GooseyPrime/SAVR-old`
- Expected source SHA: `645c870ad23e76e9fdd8a0e8c554120f70644d48`
- Verified SHA: not verifiable from the imported folder
- Verification limitation: `SAVR-old/` does not include nested `.git` metadata and no committed source-head manifest matching the expected SHA was found in the imported contents.

## Active production architecture

### Web stack

- Next.js 16 App Router application under `SAVR-old/web/`
- React 19, TypeScript, Tailwind 4, ESLint, npm lockfile present
- Active page routes include landing, auth, dashboard, inventory, recipes, cooking, meal plans, grocery lists, chat, pricing, transfer, upload, labeling, dataset export, settings, legal pages
- Active API routes under `web/app/api/` cover AI, inventory deduction, labeling, Stripe, and transfer sessions

### Mobile stack

- Expo SDK 54 React Native app under `SAVR-old/mobile/`
- React Navigation bottom tabs plus native stack flows
- Active screens cover auth, home, inventory, recipes, recipe detail, meal plans, grocery list, chat, labeling, and profile
- Mobile config enables camera and image picker permissions and exposes Supabase plus Google OAuth public values through Expo config

### Backend and database

- Supabase is the active backend
- Current checked-in migration set is the single active migration `supabase/migrations/20260220000000_initial_schema.sql`
- The migration establishes core tables for users, inventory, recipes, meal plans, grocery lists, chat history, shared recipes, transfer sessions, and consent tracking
- Row-level security policies are enabled across user-owned data tables

### Authentication

- Supabase Auth is the production identity system
- Web auth context manages session load, Google OAuth, password reset, and realtime user record refresh
- Mobile auth context uses Supabase session state, but its Google OAuth path is explicitly marked as needing Expo-specific work instead of being treated as fully complete

### Storage

- Supabase storage is the active storage contract
- Production references indicate user-scoped recipe images, inventory images, and labeling-image flows
- Transfer sessions support temporary sharing and cross-device transfer patterns

### Payments

- Stripe is the active billing integration
- Server-side Stripe routes handle portal access and webhook processing
- Webhook logic updates user subscription fields through Supabase admin access and verifies `stripe-signature`

### AI providers and image analysis

- Active AI routes live under `web/app/api/ai/`
- Production routes cover image analysis, recipe generation, meal planning, grocery list generation, substitutions, recipe import, receipt scanning, and chat
- Repository docs and package dependencies indicate OpenAI as the primary AI provider with Google Cloud Vision as an image-analysis fallback

### Deployment

- Active deployment target is Vercel for the web app and API routes
- Mobile deployment references Expo/EAS
- `cloudbuild-android.yaml` remains as an Android build/deploy artifact and should be treated carefully because parts of it still reference older Firebase-era assumptions

### CI and testing

- `e2e-tests/` contains Playwright configuration and tests
- No imported `SAVR-old/.github/workflows/` directory was present, so GitHub Actions cannot be treated as an active imported production CI contract from this source tree
- This means deployment and validation guidance exists mostly as code, config, and prose rather than imported CI definitions

## Major data flows

- Authenticated users are created in `auth.users`, mirrored into `public.users`, and then read by web/mobile clients
- Inventory, recipes, meal plans, and grocery lists are stored in Supabase with user ownership enforced by RLS
- AI-assisted routes accept authenticated requests, generate outputs server-side, and persist user-owned records when appropriate
- Stripe checkout and webhook events reconcile subscription state back into `public.users`
- Transfer sessions create time-limited records for cross-device or sharing flows

## Major security boundaries

- Public clients use anon Supabase credentials; admin operations require server-side service-role access
- Stripe webhook verification is server-side only
- AI provider keys and service secrets are intended to remain server-side
- RLS policies enforce data ownership boundaries at the database level
- Production code explicitly distinguishes client-safe env vars from server-only secrets

## Working production behavior to preserve

- Supabase-backed auth and user profile creation
- Inventory, pantry, recipes, meal plans, grocery lists, and chat data ownership via Supabase
- Stripe webhook-based subscription reconciliation
- Server-side AI and image-analysis routes
- Transfer-session support
- Web and mobile clients backed by the same production data model

## Partially working or cautionary behavior

- Root `package.json` still contains Firebase deploy scripts even though active web/backend architecture is Supabase plus Vercel
- Web Supabase client includes build-time dummy-config allowances; treat these as deployment safeguards, not proof that missing env vars are acceptable in production runtime
- Mobile Google OAuth is commented as requiring different setup; do not assume that path is fully production-ready without validation
- Legacy subscription tier names (`free`, `plus`, `premium`) still appear in parts of the auth typing alongside newer `basic` and `pro` values

## Historical material

- `SAVR-old/archive/` contains Firebase-era, incident, and obsolete material
- Historical docs may explain why migrations happened, but they are not the active architecture contract

## Known stale or conflicting configuration

- `SAVR-old/package.json` deploy scripts still target Firebase even though active code and docs point to Vercel plus Supabase
- `SAVR-old/README.md` references `.github/workflows/`, but the imported folder did not include that directory
- `SAVR-old/.cursor/theme.config.ts` uses unrelated branding and should be treated as stale guidance, not architecture truth
- Some docs describe migrated architecture accurately, but any claim that cannot be tied back to active code or present config should be treated as supporting context only

## Known technical debt and migration cautions

- Reconcile legacy billing tier names before downstream migration work relies on them
- Resolve stale Firebase references before future agents treat root scripts as active deployment truth
- Establish an explicit validation strategy for mobile auth and any flows that currently rely on comments or manual docs rather than imported CI
- Preserve security boundaries while adapting premium UI; do not move server responsibilities into client code
