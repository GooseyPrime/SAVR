# Migration Status

Tracks the current phase of the SAVR consolidation project.

---

## Current Phase

**Repository guidance and architecture discovery**

---

## Status Checklist

| Item | Status |
|---|---|
| Source repositories imported | ✅ Yes |
| Source roles established | ✅ Yes |
| Architecture discovery complete | ✅ Yes, with explicit verification limitations and unresolved conflicts documented |
| Canonical application initialized | ❌ No |
| Feature migration started | ❌ No |

---

## Current Findings and Blockers

- Imported source heads for `SAVR-old/` and `savr-premium-mobile-app/` cannot be verified from the committed folder contents because nested git metadata is absent.
- `SAVR-old/package.json` still contains Firebase-era deploy scripts that conflict with the active Supabase/Vercel architecture.
- `SAVR-old/README.md` references `.github/workflows/`, but the imported reference folder did not include that directory.
- `SAVR-old/.cursor/theme.config.ts` contains unrelated branding and should not be treated as architecture truth.
- `savr-premium-mobile-app` includes prototype-only persistence patterns such as localStorage-backed guest data and sessionStorage handoffs that must not become production architecture by default.
- Reproducible validation gaps remain for mobile validation, TypeScript scripts, Supabase migration validation, and security scanning.

---

## Next Phase

**Production-baseline import into `savr-platform`**

Required outcome of the next phase:

1. Copy the validated production baseline into `savr-platform` without visual migration.
2. Preserve production contracts while reconciling stale configuration and validation gaps.
3. Keep `SAVR-old/` and `savr-premium-mobile-app/` read-only.

---

## Guardrails

- No product code has been written in `savr-platform/` yet.
- No migration work should begin without using the repository guidance in `AGENTS.md`, `.github/copilot-instructions.md`, and `docs/`.
