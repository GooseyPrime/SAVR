---
applyTo:
  - ../../savr-platform/**
---

# SAVR platform production tree

- `savr-platform/` is the only canonical production implementation tree.
- Preserve production capabilities from `SAVR-old/` before changing presentation.
- Use the premium app as visual direction, not as architecture authority.
- No hidden feature removal, no placeholder callbacks, and no mock data in production paths.
- No local-only authenticated persistence, no duplicate backend contracts, and no second auth state system.
- Validate the impact of every change on both web and mobile behavior.
- If a migration needs a contract change, document it first in `docs/decisions/`.
