---
applyTo:
  - ../../savr-platform/web/**
---

# SAVR platform web rules

- Follow the production web contract proven in `SAVR-old/web/`: Next.js App Router, TypeScript, server/client separation, and npm-driven tooling until a documented decision says otherwise.
- Keep server-only secrets, Stripe server operations, and service-role database access on the server.
- Preserve accessible semantics, keyboard flow, responsive behavior, and exact validation/error states while adapting premium visuals.
- API routes must enforce auth, validation, and explicit failure handling.
- Do not ship client-authoritative billing, auth, storage, or AI behavior.
- Production web changes must build cleanly with the committed web validation gates once they exist in `savr-platform/`.
