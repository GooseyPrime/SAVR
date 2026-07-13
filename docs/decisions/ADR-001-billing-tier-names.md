# ADR-001 — Billing Tier Name Conflict

**Date:** 2026-07-12  
**Status:** Open — conflict documented, no resolution yet  
**Phase:** Phase 2 — Validation and Contract Reconciliation

---

## Context

The active Supabase migration (`savr-platform/supabase/migrations/20260220000000_initial_schema.sql`) contains a `subscription_tier` column with a check constraint that allows both legacy and current tier names:

- **Legacy values** (older billing flow): `free`, `plus`, `premium`
- **Current values** (active Stripe integration): `basic`, `pro`

The production `SAVR-old/web/` code and the `SAVR-old/mobile/` code reference both sets of values in different areas. The Stripe webhook reconciliation code uses `basic` and `pro`, while some display and conditional logic references `free`, `plus`, and `premium`.

---

## Conflict

| Source | Tier values used |
|---|---|
| `subscription_tier` check constraint | `free`, `plus`, `premium`, `basic`, `pro` |
| Stripe webhook handler | `basic`, `pro` |
| Some UI/conditional checks | `free`, `plus`, `premium` |

This creates ambiguity: it is not clear from the imported code whether `free`/`plus`/`premium` represent active user states or historical states that may still exist in the production database.

---

## Decision

**Not yet resolved.** This conflict is documented here so future agents know:

1. **Do not drop any tier name from the check constraint** until the full production database state is audited and confirmed empty of legacy tier values.
2. **Do not introduce a third tier naming scheme** without a new ADR.
3. **Treat `basic` and `pro` as the active billing tiers** for new Stripe integration work, based on the active webhook handler.
4. **Treat `free`, `plus`, `premium` as potentially live legacy states** that must remain readable until migration is verified.

---

## Resolution criteria

- [ ] Audit production database row counts by `subscription_tier` value (requires production access)
- [ ] Confirm whether any user row has `free`, `plus`, or `premium` as their current tier
- [ ] If legacy values exist: write a data migration and a new ADR authorizing the transition
- [ ] If no legacy values exist: write an ADR authorizing the constraint narrowing
- [ ] Update all display and conditional logic to use only the confirmed active tier names

---

## Impact on downstream phases

- Phase 3 (design system) and Phase 4 (application shells): must not hard-code tier names; use constants referencing this ADR
- Phase 5 (feature migration): subscription gate logic must be reviewed against this conflict before landing
