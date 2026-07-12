# Phase 05 — Feature Migration

## Objective

Migrate features in bounded vertical slices while preserving production behavior and applying premium UX.

## Recommended order

1. Home
2. Pantry
3. Scanner and review flow
4. Recipes and recipe detail
5. Cooking mode
6. Meal plans
7. Grocery lists
8. Profile and settings
9. Authentication and guest conversion validation
10. Subscription and entitlement validation

## Parallel-safe work

Limited parallelism is acceptable only when contract surfaces do not overlap:

- Home and Pantry can overlap once shared inventory reads and shell primitives are stable.
- Authentication/guest-conversion validation and subscription/entitlement validation can overlap after feature screens are migrated.

## Not parallel-safe

- Scanner/review, recipes, meal plans, and grocery flows should remain mostly sequential because they share AI, inventory, and data-shaping contracts.

## Exit criteria

- each migrated slice states preserved production behavior
- each slice documents premium UX adapted
- web/mobile effects and rollback path are explicit
