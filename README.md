# SAVR — Consolidated Platform Repository

Canonical release-candidate application now lives in `savr-platform/`.

## Current phase

- **Post-Phase-6 Corrective Track — complete**
- `savr-platform/` is the active production RC.
- `SAVR-old/` and `savr-premium-mobile-app/` are imported, read-only references.

## Repository layout

| Folder | Role | State |
|---|---|---|
| `SAVR-old/` | Production architecture and feature baseline (read-only) | Imported reference |
| `savr-premium-mobile-app/` | Approved UI/UX direction (read-only) | Imported reference |
| `savr-platform/` | Canonical production application | Active RC |

## Platform status highlights

- Web app (Next.js App Router): lint/typecheck/build/unit-test validated
- Mobile app (Expo SDK 57): lint/typecheck/unit-test/export validated
- Billing contract: `basic` / `pro` only
- Stripe webhook reconciliation: implemented server-side
- AI rate limiting: implemented server-side

## Remaining launch blockers

1. Provision GitHub `Production` and `Staging` environments with required secrets
2. Complete live-environment test stubs in `.github/workflows/live-environment-tests.yml`
3. Configure EAS Build signing credentials and run the native release checklist
4. Audit the production database for Firebase Storage URLs (ADR-002)
5. Restore reference-folder integrity on `main` in a dedicated governance PR

## Source of truth

- Status tracker: [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md)
- Validation gates: [`docs/validation/required-gates.md`](./docs/validation/required-gates.md)
- Source registry: [`SOURCE_ORIGINS.md`](./SOURCE_ORIGINS.md)
- Consolidation policy: [`AGENTS.md`](./AGENTS.md)