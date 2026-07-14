---
applyTo:
  - SAVR-old/**
---

# SAVR-old production reference

- `SAVR-old/` is the production architecture and feature baseline.
- Inspect this tree to recover backend contracts, production behavior, and security requirements.
- Do not modify files in this tree during consolidation planning or migration execution unless the task explicitly says to do so.
- Active source code outranks archived docs and Firebase-era material.
- Use current migrations, active API routes, auth code, storage code, Stripe code, and AI routes as the authoritative contract.
- Record conflicts such as stale Firebase deploy scripts, outdated docs, or orphaned configuration.
- Never run formatting, dependency upgrades, or lockfile changes here as part of repository guidance work.
