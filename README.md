# SAVR — Consolidation Repository

This repository is the future home of the unified SAVR platform. It is currently in the **initialization phase**. No application code has been imported yet.

---

## Purpose

This workspace consolidates two separate source repositories into a single canonical application located in `savr-platform/`. The repository structure is prepared and documented, but no migration work has begun.

---

## Three-Folder Source-of-Truth Model

| Folder | Role | Status |
|---|---|---|
| `SAVR-old/` | Production architecture and feature baseline | **Not yet imported** |
| `savr-premium-mobile-app/` | UI/UX and interaction reference | **Not yet imported** |
| `savr-platform/` | Canonical future production application | **Empty workspace** |

Once both source folders are imported, `SAVR-old/` and `savr-premium-mobile-app/` are to be treated as **read-only references**. All active development occurs in `savr-platform/`.

---

## Current State

- ✅ Repository initialization is complete.
- ❌ Source repositories have not been imported.
- ❌ No production application exists in `savr-platform/` yet.
- ❌ No application builds or runs from this repository.

---

## Next Steps

1. Import `SAVR-old/` into this repository (as a subtree or direct copy).
2. Import `savr-premium-mobile-app/` into this repository.
3. Run a separate **architecture-discovery task** to inspect both source folders before touching `savr-platform/`.
4. Only after discovery: begin planning the canonical application structure in `savr-platform/`.

See [`MIGRATION_STATUS.md`](./MIGRATION_STATUS.md) for current phase tracking and [`SOURCE_ORIGINS.md`](./SOURCE_ORIGINS.md) for source registry details.