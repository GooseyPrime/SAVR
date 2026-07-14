---
applyTo: "savr-platform/web/app/api/stripe/**,savr-platform/web/lib/stripe.ts,savr-platform/web/app/pricing/**,savr-platform/web/contexts/AuthContext.tsx,savr-platform/mobile/src/types/index.ts,savr-platform/mobile/src/screens/main/ProfileScreen.tsx"
---

# SAVR platform payments rules

- Stripe logic is server-authoritative.
- Preserve webhook signature verification, idempotency, replay safety, and subscription-state reconciliation.
- Keep secrets on the server only.
- Never trust client-reported entitlement state.
- Billing changes must prove how checkout, portal, webhook, and account-state updates remain synchronized.
- Validate in test mode before claiming billing behavior is preserved.
