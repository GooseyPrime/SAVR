---
applyTo: "savr-platform/web/app/api/ai/**,savr-platform/web/lib/services/ai*.ts,savr-platform/web/lib/config/forbiddenFoods.ts,savr-platform/mobile/src/utils/api.ts"
---

# SAVR platform AI rules

- AI integrations must stay behind provider abstractions and server-side boundaries.
- Use typed request and response schemas plus runtime output validation for recipe, meal-plan, grocery, chat, OCR, and image-analysis flows.
- No client-side secrets, no silent model substitution, and no undocumented provider fallback.
- Preserve usage tracking, durable rate limiting, and explicit fallback behavior.
- Pet-safety checks must remain deterministic and testable rather than prompt-only.
- Add fixtures, evaluations, or comparable repeatable validation for AI-critical behavior.
