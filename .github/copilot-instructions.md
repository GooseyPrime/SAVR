# Copilot Instructions

Rules for GitHub Copilot and all AI-assisted workflows in this repository.

---

- **The repository is currently in the initialization phase.** Only repository structure and documentation have been created. No application code exists.

- **Do not assume the source repositories are present.** Until `SAVR-old/` and `savr-premium-mobile-app/` folders exist in the repository, treat both as absent.

- **Do not create mock source files to compensate for missing repositories.** Placeholder files, stub implementations, and invented schemas are prohibited.

- **Do not initialize the production application prematurely.** `savr-platform/` must remain empty until `SAVR-old/` has been imported and its architecture documented.

- **Wait for both source folders before making architecture decisions.** No framework, toolchain, database, or deployment choice may be made before discovery is complete.

- **When both source folders are added, inspect them before modifying `savr-platform/`.** Read and document what exists before writing anything new.

- **Never modify imported reference folders unless explicitly instructed.** `SAVR-old/` and `savr-premium-mobile-app/` are read-only once imported.

- **All future merged production work belongs in `savr-platform/`.** Contributions to the canonical application go only in that directory.
