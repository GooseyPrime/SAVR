# ADR-001 — Billing Tier Names

**Date:** 2026-07-12  
**Updated:** 2026-07-14  
**Status:** Accepted — Corrective PR 2  
**Phase:** Post-Phase-6 Corrective Track

---

## Context

The active Supabase migration (`savr-platform/supabase/migrations/20260220000000_initial_schema.sql`) contained a `subscription_tier` column with a check constraint that allowed both legacy and current tier names:

- **Legacy values** (older billing flow): `free`, `plus`, `premium`
- **Current values** (active Stripe integration): `basic`, `pro`

The production `SAVR-old/web/` code and the `SAVR-old/mobile/` code referenced both sets of values in different areas. The Stripe webhook reconciliation code used `basic` and `pro`, while some display and conditional logic referenced `free`, `plus`, and `premium`.

---

## Decision

**Accepted.** `basic` and `pro` are the only canonical billing tier values for SAVR.

| Legacy value | Canonical mapping |
|---|---|
| `free` | `basic` |
| `plus` | `pro` |
| `premium` | `pro` |

### Access rules

- **Active access** requires `subscription_status` to be `active` or `trialing`. Tier alone never grants access. Statuses `pending`, `canceled`, `past_due`, `incomplete`, `incomplete_expired`, and `unpaid` do not confer entitlement.
- **Basic access** is granted to active/trialing users whose tier is `basic` or `pro`.
- **Pro access** is granted only to active/trialing users whose tier is `pro`.

### Canonical tier contract

- `basic` and `pro` are the only valid runtime tier values.
- Legacy values (`free`, `plus`, `premium`) must not appear in any canonical runtime code path.
- They may appear only in: the data-normalization migration, ADR history, and explicit legacy-migration tests.

### Pricing contract

There are exactly two plans with four recurring prices:

| Plan | Monthly | Yearly |
|---|---|---|
| Basic | $4.99 / month | $49.99 / year |
| Pro | $9.99 / month | $99.99 / year |

All prices are in USD. There is no Free, Plus, or Premium plan. The existing five-day trial is unchanged.

---

## Implementation

1. **Migration:** `savr-platform/supabase/migrations/20260714000000_normalize_billing_tiers.sql`
   - Normalizes existing legacy rows (`free` → `basic`, `plus` → `pro`, `premium` → `pro`)
   - Drops the old check constraint
   - Adds a new constraint allowing only `basic` and `pro`
2. **Canonical billing helpers:** `savr-platform/web/lib/billing.ts` and `savr-platform/mobile/src/lib/billing.ts`
3. **Webhook:** Price-to-tier resolution now uses explicit Stripe price ID env vars, not metadata or amount inference.

---

## Historical conflict (resolved)

| Source | Tier values used (before this ADR) |
|---|---|
| `subscription_tier` check constraint | `free`, `plus`, `premium`, `basic`, `pro` |
| Stripe webhook handler | `basic`, `pro` |
| Some UI/conditional checks | `free`, `plus`, `premium` |

---

## Impact on downstream work

- All new feature work must gate access using `hasBasicAccess` or `hasProAccess` from the canonical billing helpers.
- Do not introduce a third tier naming scheme without a new ADR.
