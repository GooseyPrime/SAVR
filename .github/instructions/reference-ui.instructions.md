---
applyTo:
  - savr-premium-mobile-app/**
---

# SAVR premium UI reference

- `savr-premium-mobile-app/` is the approved visual and interaction reference.
- Treat this tree as read-only during consolidation planning and migration work.
- Adapt visual patterns, navigation ideas, interaction states, motion, and design tokens only after mapping them to verified production contracts.
- Do not assume prototype auth, persistence, data flow, AI gateways, or local state management are production-approved.
- Flag prototype-only behavior such as localStorage-authenticated data, sessionStorage handoffs, disconnected services, hardcoded provider assumptions, or UI controls that do not change real behavior.
- Never port implementation details from this tree without a documented production-contract match.
