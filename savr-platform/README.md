# savr-platform

This is the canonical SAVR production application.

It was initialized in Phase 1 of the consolidation project by importing the validated production baseline from `SAVR-old/` without visual migration and without changing product behavior.

---

## Directory structure

```
savr-platform/
├── web/             Next.js 16 App Router — production web application
├── mobile/          Expo SDK 54 — production React Native mobile application
├── supabase/        Database migrations and RLS policies
├── e2e-tests/       Playwright end-to-end test suite
├── package.json     Workspace root (web shortcuts, no Firebase scripts)
└── .gitignore
```

---

## Getting started

### Web application

```bash
cd web
npm install
npm run dev
```

### Mobile application

```bash
cd mobile
npm install --legacy-peer-deps
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

## Phase history

| Phase | Status | Description |
|---|---|---|
| 1 — Baseline import | ✅ Complete | Production baseline copied from `SAVR-old/` unchanged |
| 2 — Validation and contracts | ✅ Complete | Reproducible validation gates and stale-config cleanup |
| 3 — Design system | ✅ Complete | Shared design tokens adapted from premium reference |
| 4 — Application shells | ✅ Complete | Production-safe web and mobile shells |
| 5 — Feature migration | ⏳ Pending | Screen-by-screen adaptation against production contracts |
| 6 — Hardening and release | ⏳ Pending | Security, accessibility, and release-candidate hardening |

---

## Source references

- Production baseline: `SAVR-old/`
- UI/UX reference: `savr-premium-mobile-app/`
- Architecture decisions: `docs/decisions/`
- Migration guidance: `docs/migration/`
- Architecture docs: `docs/architecture/`
