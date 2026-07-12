# UI Reference — `savr-premium-mobile-app/`

This document records what is approved as visual and interaction direction in `savr-premium-mobile-app/` and what must not be copied as production architecture.

## Verification status

- Imported folder present: yes
- Expected upstream repository: `GooseyPrime/savr-premium-mobile-app`
- Expected source SHA: `1273037c3ac98ce12a2fa81319879ee05301daf4`
- Verified SHA: not verifiable from the imported folder
- Verification limitation: `savr-premium-mobile-app/` does not include nested `.git` metadata and no committed source-head manifest matching the expected SHA was found in the imported contents.

## Reference architecture detected

- Vite + React + TypeScript single-page application
- React Router-based navigation
- Zustand store with persisted browser storage
- Supabase client integrations and Supabase edge-function folders present
- Tailwind v4 theme tokens defined in `src/theme.css`

This architecture is useful as a prototype reference, but it is not the production baseline.

## Approved visual patterns

- Dark, high-contrast visual system with lime-forward brand accent (`#BAFF5C`) plus mint, citrus, and pet-mode accents
- Typography stack using Outfit, Inter, JetBrains Mono, and Caveat
- Soft rounded surfaces, laser-thin borders, glow states, and strong focus styling
- Safe-area spacing primitives and mobile-first layout discipline
- Motion system with explicit easing tokens, spring transitions, and reduced-motion support
- Touch-safe controls, explicit empty/error/loading states, and visually distinct success/warning/error semantics

## Approved navigation concepts

- Splash, onboarding, auth, home, pantry, recipes, meal plans, grocery, profile, settings, and cooking-mode flows are all represented
- Bottom navigation with a prominent scan action is a strong interaction reference
- Protected-route gating distinguishes onboarding completion from full authentication

## Approved interaction flows

- Home dashboard summaries and quick actions
- Pantry search, filtering, grouping, and expiring-item emphasis
- Scanner capture followed by review/edit/confirm flow
- Recipe browsing, generation, detail, and cooking progression
- Meal-plan generation and grocery-list derivation
- Profile and settings coverage for preferences, dietary choices, storage, and AI settings
- Clear loading, empty, error, and confirmation states across flows

## Reusable visual assets and primitives

- Design token palette and spacing/radius/motion variables in `src/theme.css`
- Reusable UI primitives for buttons, cards, inputs, layout chrome, and nav
- Iconography and semantic state patterns that can be adapted to production implementations

## Prototype-only implementation details

- Zustand is the primary app-state container with persisted browser storage
- `src/services/data-service.ts` uses localStorage as a fallback and, in guest paths, as active persistence for inventory, recipes, and grocery data
- `src/pages/Plans.tsx` passes grocery-list ingredients through `sessionStorage`, and `src/pages/GroceryList.tsx` consumes that browser-only handoff
- The repository `README.md` is largely default Vite boilerplate and is not an authoritative architecture guide
- `docs/PRODUCTION_INTEGRATION_REPORT.md` describes integration work, but it is still subordinate to active production contracts in `SAVR-old/`

## Incomplete or cautionary functionality

- Browser-storage-based guest flows are useful UX references but not production data authority
- Any Supabase function wiring in this repository must be revalidated against `SAVR-old` backend contracts before adoption
- Settings and AI controls may present options that are not yet proven to change production behavior end-to-end
- Prototype route structure is useful for flow design, but future production routing must follow the chosen platform implementation in `savr-platform/`

## Architecture that must not be ported by default

- localStorage- or sessionStorage-authoritative authenticated persistence
- prototype Zustand persistence as the default production source of truth
- disconnected or duplicate inventory/data models when `SAVR-old` already defines the contract
- UI-only AI settings or provider switches that are not reconciled with server-side production support
- any empty or cosmetic control that does not drive real product behavior
- prototype edge-function or service structure copied without a verified production contract mapping

## Migration interpretation rule

Use this repository to answer:

- how the merged product should look
- how the merged product should feel to navigate
- which loading, empty, error, and confirmation states need to exist

Do not use this repository alone to answer:

- where authoritative data lives
- which auth flow is canonical
- which backend or billing contract wins
- which persistence strategy is acceptable in production
