# Phase 01 — Baseline Import into `savr-platform`

## Objective

Copy the validated production baseline into `savr-platform/` without visual migration and without changing product behavior.

## Inputs

- `docs/architecture/production-reference.md`
- `docs/architecture/source-of-truth.md`
- `docs/validation/required-gates.md`

## Required work

- bring over the production baseline structure from `SAVR-old/`
- preserve active web, mobile, Supabase, Stripe, AI, and transfer contracts
- keep `SAVR-old/` read-only
- do not introduce premium visual migration yet

## Do not do

- no redesign
- no dependency swaps
- no schema redesign
- no auth-system replacement

## Exit criteria

- `savr-platform/` contains the production baseline only
- production contracts are unchanged
- stale references are documented, not silently rewritten

## Concurrency

None. This phase should run alone because it establishes the canonical working tree.
