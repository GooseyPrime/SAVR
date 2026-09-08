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

1. Run live Stripe and entitlement workflow gates with production/staging secrets
2. Complete EAS native build + device validation checklist
3. Resolve pre-existing E2E smoke assertion failures
4. Finish ADR-002 Firebase storage URL audit

## Source of truth

- Status tracker: [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md)
- Validation gates: [`docs/validation/required-gates.md`](./docs/validation/required-gates.md)
- Source registry: [`SOURCE_ORIGINS.md`](./SOURCE_ORIGINS.md)
- Consolidation policy: [`AGENTS.md`](./AGENTS.md)