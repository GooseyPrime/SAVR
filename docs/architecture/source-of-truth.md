# SAVR Source of Truth

Future agents must resolve consolidation questions in the following order.

## Precedence order

1. Security requirements and explicit architectural decisions
2. Active production contracts in `SAVR-old/`
3. Current database migrations and backend behavior in `SAVR-old/supabase/` plus active web API routes
4. Existing production web and mobile behavior in `SAVR-old/web/` and `SAVR-old/mobile/`
5. Approved visual and interaction direction in `savr-premium-mobile-app/`
6. Current repository guidance documents in this repository
7. Historical and archived documentation
8. Prototype implementation details that are not mapped back to production contracts

## Conflict-resolution procedure

### 1. Security and decision records always win

If a prototype flow, stale README, or convenience implementation conflicts with security boundaries, RLS, server-only secrets, billing integrity, or a recorded architecture decision, the secure and documented rule wins.

### 2. Active production code outranks descriptive documentation

When `SAVR-old` code and a README disagree, treat the code and active config as authoritative and record the discrepancy.

### 3. Backend contract outranks UI convenience

If `savr-premium-mobile-app/` shows a nicer interaction but relies on browser-local persistence, session handoffs, duplicate models, or unverified AI wiring, keep the interaction goal and rebuild it against the production contract.

### 4. Historical material can explain, not authorize

Files under archive, legacy, historical, incident, and obsolete areas may explain prior choices, but they do not grant permission to reintroduce old architecture.

### 5. Unknowns must stay explicit

If the imported contents do not prove a source SHA, a workflow, or a fully working feature path, record that limitation. Do not infer success or readiness.

## Required source classification

For every future migration area, classify findings as:

- working production behavior
- partially working behavior
- UI-only behavior
- disconnected implementation
- historical implementation
- missing implementation

Agents must keep these labels visible in planning and PR descriptions so reviewers can see what is being preserved versus rebuilt.
