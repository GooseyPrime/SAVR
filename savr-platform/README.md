# savr-platform

This is the canonical SAVR production application.

It was initialized in Phase 1 of the consolidation project by importing the validated production baseline from `SAVR-old/` without visual migration and without changing product behavior.

---

## Directory structure

```
savr-platform/
├── web/             Next.js App Router — production web application
├── mobile/          Expo SDK 57 — production React Native mobile application
├── supabase/        Database migrations and RLS policies
├── e2e-tests/       Playwright end-to-end test suite
├── design-system/   Shared design tokens (tokens.ts, web/theme.css)
├── package.json     Workspace root shortcuts
└── .gitignore
```

---

## Getting started

### Web application

```bash
cd web
npm ci
npm run dev
```

### Mobile application

```bash
cd mobile
npm ci
npx expo start
```

### Environment variables

Copy `SAVR-old/.env.example` as a reference. Required variables:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side only; never expose to client
- `STRIPE_SECRET_KEY` — Server-side only
- `STRIPE_WEBHOOK_SECRET` — Server-side only
- `OPENAI_API_KEY` — Server-side only

---

## Validation commands

| Command | Expected result |
|---|---|
| `cd web && npm ci` | exit 0 |
| `cd web && npm run lint` | exit 0, warnings only |
| `cd web && npx tsc --noEmit` | exit 0 |
| `cd web && npm run test:unit` | exit 0, all tests pass |
| `cd web && npm audit --audit-level=high` | exit 0, 0 high/critical |
| `cd web && CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run build` | exit 0 |
| `cd mobile && npm ci` | exit 0 |
| `cd mobile && npm run lint` | exit 0, warnings only |
| `cd mobile && npm run typecheck` | exit 0 |
| `cd mobile && npm run test:unit` | exit 0, all tests pass |
| `cd mobile && npm audit --audit-level=high` | exit 0, 0 high/critical |
| `cd mobile && npx expo-doctor` | 20/20 checks pass |
| `cd mobile && npx expo export --platform android` | exit 0 |
| `cd mobile && npx expo export --platform ios` | exit 0 |
| `cd e2e-tests && PLAYWRIGHT_USE_WEBSERVER=true CI=true NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key_for_build npm run test:e2e:smoke` | exit 0 |
| `npx supabase@latest db reset` (from savr-platform/) | exit 0 |

See `docs/validation/required-gates.md` for the full gate inventory and known gaps.

---

## Corrective track

After phases 1–6 completed, eight corrective PRs addressed governance, billing, webhooks, mobile platform, AI rate limiting, landing-page, mobile auth, and release verification. All are complete as of corrective PR 8.

See `MIGRATION_STATUS.md` for the current platform state.

---

## Architecture decisions

| ADR | Status | Topic |
|---|---|---|
| ADR-001 | Accepted | Billing tier names (`basic` / `pro`) |
| ADR-002 | Documented | Firebase Storage backward compat (pending production audit) |
| ADR-003 | Accepted | Canonical Expo version (SDK 57) |
| ADR-004 | Accepted | Mobile Google OAuth with Expo Auth Session |

---

## Source references

- Production baseline: `SAVR-old/`
- UI/UX reference: `savr-premium-mobile-app/`
- Architecture decisions: `docs/decisions/`
- Migration guidance: `docs/migration/`
- Architecture docs: `docs/architecture/`
- Release candidate report: `docs/validation/RELEASE_CANDIDATE_REPORT.md`
