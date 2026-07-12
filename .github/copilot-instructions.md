# Copilot Instructions

Read `/AGENTS.md` first.

Then, before changing anything:

1. Read every matching file in `.github/instructions/` for the paths you will touch.
2. Read the relevant architecture and migration documents under `docs/architecture/`, `docs/migration/`, and `docs/validation/`.
3. Inspect active source code before trusting repository documentation.

Operating rules for this repository:

- Never modify `SAVR-old/` or `savr-premium-mobile-app/` during consolidation work unless explicitly instructed.
- Make future production changes only under `savr-platform/`.
- Preserve production behavior and backend contracts from `SAVR-old/`.
- Adapt approved UX from `savr-premium-mobile-app/` without copying its prototype architecture by default.
- Do not weaken types, lint, tests, RLS, auth, validation, or billing checks to finish a task.
- Keep PRs small and phase-specific.
- Include exact validation commands and exact results in completion reports.
- If production contracts conflict with prototype UX or stale documentation, stop and document the conflict instead of inventing a fix.
