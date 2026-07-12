# AGENTS — SAVR Consolidation Policy

This file is the authoritative operating policy for agents working in `GooseyPrime/SAVR`.

## Repository mission

Consolidate the working production behavior in `SAVR-old/` with the approved visual and interaction direction in `savr-premium-mobile-app/`, and land the canonical production application in `savr-platform/` without inventing architecture, weakening safeguards, or regressing existing product capabilities.

## Source-of-truth hierarchy

1. Security requirements and explicit architectural decisions in `docs/decisions/`
2. Active production contracts in `SAVR-old/`
3. Active database schema, RLS, storage, and backend behavior in `SAVR-old/supabase/` and active web API routes
4. Existing working production behavior in `SAVR-old/web/` and `SAVR-old/mobile/`
5. Approved visual, navigation, and interaction direction in `savr-premium-mobile-app/`
6. Current repository guidance in `docs/architecture/`, `docs/migration/`, and `docs/validation/`
7. Historical and archived material only when no active source answers the question

When sources conflict, document the conflict and stop short of invention.

## Folder roles

- `SAVR-old/`: read-only production architecture and feature baseline
- `savr-premium-mobile-app/`: read-only UI/UX and interaction reference
- `savr-platform/`: only canonical production implementation tree for future merged work
- `docs/`: durable architecture, migration, validation, and decision records

## Read-only reference-folder rule

- Never modify files under `SAVR-old/**` or `savr-premium-mobile-app/**` unless the task explicitly authorizes it.
- Never run formatting, dependency, codemod, or lockfile updates inside either reference folder as part of consolidation work.
- Never add `AGENTS.md`, instruction files, helper scripts, or generated output inside either reference folder.

## Canonical working-folder rule

- Future production code belongs only in `savr-platform/`.
- Do not create production application code elsewhere in this repository.
- Do not initialize or redesign `savr-platform/` from memory; build it from verified production contracts and documented migration phases.

## Architecture-preservation rules

- Preserve the active production architecture discovered in `SAVR-old/`: Next.js web app, Expo mobile app, Supabase backend, Stripe billing, AI/image-analysis routes, npm package management.
- Treat Firebase-era deploy scripts and archived Firebase documentation as historical unless active code still depends on them.
- Do not introduce Firebase, Turborepo, Nx, pnpm, Yarn, a second Supabase schema, a second authentication state system, or a replacement local-only persistence architecture without an explicit architectural decision.
- Do not silently replace working production contracts with prototype implementations because the prototype looks newer.

## Feature-preservation rules

- Preserve working production behavior for authentication, subscriptions, inventory, pantry, recipes, cooking, meal plans, grocery lists, transfer/sharing, storage, scanner/image analysis, and AI-assisted flows.
- Distinguish each area as one of: working production behavior, partially working behavior, UI-only behavior, disconnected implementation, historical implementation, or missing implementation.
- Never claim a feature is complete because a route, screen, hook, table, or component exists.
- Never remove a production capability without a documented decision and an explicit replacement plan.

## Security invariants

- Keep server-only secrets and service-role access out of client bundles.
- Preserve request validation, typed boundaries, and explicit error handling.
- Do not weaken lint, types, tests, auth checks, rate limits, RLS, or input validation to make work pass.
- Never create mock production data paths, fake entitlements, or silent fallbacks that hide contract failures.

## Database invariants

- Treat active Supabase migrations and RLS policies as the production backend contract.
- Preserve table ownership, row-level security, storage bucket intent, and webhook-driven subscription fields.
- Do not fork schema ownership into duplicate tables or parallel data models without a decision record.
- Document stale or conflicting schema references instead of guessing which one wins.

## Authentication invariants

- Supabase Auth is the production identity system.
- Preserve authenticated-user ownership boundaries across web and mobile.
- Guest, onboarding, and account-conversion flows must be explicit and validated; no hidden second auth state.
- Do not make client-local state authoritative for authenticated production data.

## Stripe invariants

- Billing authority stays server-side.
- Preserve webhook signature verification, idempotent reconciliation, replay safety, and server-driven entitlement updates.
- Never let the client become the source of truth for subscription state.

## AI invariants

- Keep AI access behind typed server or edge boundaries.
- Validate runtime inputs and outputs for recipe, meal-plan, grocery, chat, OCR, vision, and pet-safety flows.
- No client secrets, prompt-only safety controls, silent model substitution, or undocumented provider swaps.
- Preserve durable rate-limiting and explicit fallback behavior.

## Web/mobile parity expectations

- `savr-platform/` must preserve production data contracts across web and mobile.
- Differences in UI can exist, but data ownership, business rules, auth state, subscription state, and validation rules must remain aligned.
- Every feature migration PR must state the effect on both web and mobile.

## UI adaptation rules

- `savr-premium-mobile-app/` is the approved visual and interaction reference, not the production architecture baseline.
- Adapt design tokens, layout, navigation, motion, and state presentation where they fit production contracts.
- Do not copy prototype persistence, auth, AI wiring, router assumptions, sessionStorage handoffs, or localStorage-first authenticated behavior into production paths.

## Testing requirements

- Use only validation commands that already exist or are directly supported by the checked-in codebase.
- Record the exact commands run and exact results.
- Treat missing validation commands as gaps to document, not as permission to invent passing claims.
- Before completion, verify no reference-folder files changed and no unintended files were added to `savr-platform/`.

## Pull-request size rules

- Keep PRs small, phase-specific, and reversible.
- One bounded feature or platform layer per PR.
- Do not mix repository guidance, baseline import, feature migration, and architectural redesign in the same PR.

## Completion-reporting requirements

Every completion report must include:

- files created and modified
- exact commands run and exact output
- validation gaps and blockers
- unresolved source conflicts
- confirmation of whether `SAVR-old/` and `savr-premium-mobile-app/` changed
- confirmation of whether any production code was written in `savr-platform/`

## Prohibited shortcuts

- no big-bang rewrite
- no source-folder edits to “fix” reference code during consolidation planning
- no placeholder callbacks or mock integrations in production paths
- no copying prototype architecture because it is visually complete
- no dependency churn or framework changes before source contracts are reconciled
- no build-success claims without command output

## Required discovery sequence

1. Read this file.
2. Read `.github/copilot-instructions.md` and any matching `.github/instructions/*.instructions.md` files.
3. Identify whether the task touches production reference, UI reference, or `savr-platform/`.
4. Inspect active code and configuration before relying on any README or planning doc.
5. Check `docs/architecture/source-of-truth.md`, then the relevant architecture and migration guidance.
6. Document conflicts between active code, prototype code, and historical documentation before proposing implementation.

## Required validation sequence

1. Confirm the task stayed within the allowed folders.
2. Run the applicable existing static checks or document the missing gate.
3. Verify no reference-folder files changed.
4. Verify no secrets or environment files were created.
5. Record exact command output.
6. Stop and document unresolved contract conflicts instead of inventing completion.
