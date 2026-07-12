# AGENTS — Root

Rules that apply to every agent working in this repository.

---

1. **`savr-platform/` is the only future production working directory.** All canonical application code lives there.

2. **Once imported, `SAVR-old/` and `savr-premium-mobile-app/` are read-only references.** Do not modify files inside these folders unless explicitly instructed.

3. **Do not begin migration work until both source folders exist.** Confirm their presence before taking any action that touches `savr-platform/`.

4. **Do not invent architecture, frameworks, build commands, database schemas, or feature behavior.** Every decision must be derived from the actual source repositories after import.

5. **Do not introduce Firebase, Turborepo, Nx, pnpm, Yarn, or other tooling before inspecting the production source repository.** Tooling choices follow discovery, not assumption.

6. **Do not add application dependencies during initialization.** No `package.json`, `requirements.txt`, `go.mod`, or equivalent dependency files until the architecture is understood.

7. **Keep future pull requests small and phase-specific.** One phase per PR; do not bundle initialization, discovery, and migration work together.

8. **Do not claim success without actual command output.** Every verification statement must be backed by real terminal output included in the PR or commit message.

9. **Preserve working production features when migration begins.** Never remove or break a feature that exists in `SAVR-old/` without an explicit architectural decision record in `docs/decisions/`.

10. **Prototype implementations must not replace production implementations without an explicit architectural decision.** Document the decision in `docs/decisions/` before promoting any prototype.
