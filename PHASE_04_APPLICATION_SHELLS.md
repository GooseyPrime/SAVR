# Phase 04 — Application Shells

## Objective

Build the canonical web and mobile shells in `savr-platform/` on top of the validated baseline and shared design system.

## Required work

- create production-safe web shell
- create production-safe mobile shell
- preserve routing, auth boundaries, navigation affordances, safe areas, and responsive structure

## Parallel-safe workstreams

- **Web shell** and **mobile shell** may run concurrently after Phase 03 is complete.
- Both workstreams must use the same documented token layer and must not fork shared contracts.

## Exit criteria

- web and mobile shells exist in `savr-platform/`
- neither shell changes backend contracts
- both shells are ready for bounded feature migration
