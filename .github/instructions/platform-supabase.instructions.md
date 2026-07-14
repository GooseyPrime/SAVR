---
applyTo:
  - savr-platform/supabase/**
  - savr-platform/**/supabase/**
  - savr-platform/**/*supabase*.ts
  - savr-platform/**/*supabase*.tsx
  - savr-platform/**/*supabase*.js
  - savr-platform/**/*supabase*.jsx
---

# SAVR platform Supabase rules

- Treat `SAVR-old/supabase/migrations/` and active server usage as the production database contract.
- Preserve schema compatibility, row-level security, storage ownership, webhook-written subscription fields, and generated-type correctness.
- Every migration must include forward intent, rollback thinking, and data-ownership clarity.
- Do not create a second schema, duplicate tables for the same capability, or bypass RLS with client shortcuts.
- Regenerate or realign types only from the authoritative schema state.
