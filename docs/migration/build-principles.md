# SAVR Build Principles

## Core migration stance

- Use incremental migration, not a big-bang rewrite.
- Land one bounded feature or one bounded platform layer per PR.
- Preserve production contracts before changing presentation.
- Establish shared design tokens and platform shells before migrating individual screens.

## Feature migration rules

- Rebuild each migrated screen against verified production contracts from `SAVR-old/`.
- Use the premium app to guide layout, navigation, motion, and state presentation.
- Document whether each migrated area preserves behavior, adapts presentation, consolidates duplicates, or defers a contract conflict.
- Do not claim a migration is done because files exist or a screen renders.

## PR expectations

Every feature PR must include:

- scope boundary
- production contract referenced
- premium UI reference used
- web impact and mobile impact
- explicit acceptance criteria
- explicit rollback strategy
- exact validation commands and exact output

## Acceptance principles

- Validate each migrated screen against working production behavior, not just the prototype UI.
- Include web/mobile parity assessment in every feature PR.
- Preserve auth, subscription, storage, AI, and data ownership invariants before polish work.
- If a feature depends on unresolved schema, auth, or billing conflicts, defer it and record the blocker.

## Rollback principles

- Keep work small enough to revert without damaging adjacent features.
- Avoid cross-cutting dependency churn while contracts are still being reconciled.
- Prefer additive migration steps over replacing multiple working paths at once.
