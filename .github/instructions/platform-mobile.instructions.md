---
applyTo:
  - ../../savr-platform/mobile/**
---

# SAVR platform mobile rules

- Follow the proven Expo/React Native production patterns from `SAVR-old/mobile/` until a documented decision changes them.
- Preserve navigation clarity, safe-area handling, camera and photo permissions, and mobile-specific validation.
- Device storage may support explicit offline behavior, but authenticated production state must reconcile with the backend contract.
- Keep auth, scanner, image upload, and recipe flows aligned with the production backend.
- Validate native behavior, permission prompts, and screen transitions instead of assuming parity from web code.
