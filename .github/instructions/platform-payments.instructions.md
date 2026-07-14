---
applyTo:
  - savr-platform/**/*stripe*.ts
  - savr-platform/**/*stripe*.tsx
  - savr-platform/**/*billing*.ts
  - savr-platform/**/*billing*.tsx
  - savr-platform/**/*subscription*.ts
  - savr-platform/**/*subscription*.tsx
  - savr-platform/**/*entitlement*.ts
  - savr-platform/**/*entitlement*.tsx
---

# SAVR platform payments rules

- Stripe logic is server-authoritative.
- Preserve webhook signature verification, idempotency, replay safety, and subscription-state reconciliation.
- Keep secrets on the server only.
- Never trust client-reported entitlement state.
- Billing changes must prove how checkout, portal, webhook, and account-state updates remain synchronized.
- Validate in test mode before claiming billing behavior is preserved.
