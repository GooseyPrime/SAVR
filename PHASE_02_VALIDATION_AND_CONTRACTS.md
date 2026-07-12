# Phase 02 — Validation and Contract Reconciliation

## Objective

Make the baseline reproducible before broad UI adaptation begins.

## Required work

- establish or document web, mobile, database, and E2E validation gates
- reconcile stale Firebase-era scripts and other conflicting configuration
- document unresolved auth, billing, and schema ambiguities
- preserve current production behavior while clarifying what is actually trusted

## Exit criteria

- validation commands and gaps are explicit
- source-of-truth conflicts are documented
- downstream agents can tell which contracts are safe to build against

## Concurrency

None. Later phases depend on the clarified contracts from this phase.
