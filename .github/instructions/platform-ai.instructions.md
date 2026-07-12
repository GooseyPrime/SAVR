---
applyTo:
  - ../../savr-platform/**/*ai*.ts
  - ../../savr-platform/**/*ai*.tsx
  - ../../savr-platform/**/*ai*.js
  - ../../savr-platform/**/*ai*.jsx
  - ../../savr-platform/**/*prompt*.ts
  - ../../savr-platform/**/*prompt*.tsx
  - ../../savr-platform/**/*vision*.ts
  - ../../savr-platform/**/*vision*.tsx
  - ../../savr-platform/**/*image-analysis*.ts
  - ../../savr-platform/**/*image-analysis*.tsx
  - ../../savr-platform/**/*pet-safety*.ts
  - ../../savr-platform/**/*pet-safety*.tsx
---

# SAVR platform AI rules

- AI integrations must stay behind provider abstractions and server-side boundaries.
- Use typed request and response schemas plus runtime output validation for recipe, meal-plan, grocery, chat, OCR, and image-analysis flows.
- No client-side secrets, no silent model substitution, and no undocumented provider fallback.
- Preserve usage tracking, durable rate limiting, and explicit fallback behavior.
- Pet-safety checks must remain deterministic and testable rather than prompt-only.
- Add fixtures, evaluations, or comparable repeatable validation for AI-critical behavior.
