# Google Play — owner submit steps

Code-side Play readiness is on `main` (PR #70 + #72). This file is the remaining operator checklist. None of these steps can be completed from the agent without your Expo / Play / Stripe logins.

## 1. Expo EAS (required before AAB)

```bash
cd savr-platform/mobile
npx expo login          # your Expo account
eas init                # create or link your Expo project
# pin the printed UUID in app.config.ts extra.eas.projectId
eas credentials -p android
eas env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_URL --value ...
eas env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value ...
eas env:create --scope project --environment production --name EXPO_PUBLIC_API_URL --value https://<your-vercel-deployment>.vercel.app
eas build --platform android --profile production
```

Package: `com.savr.app`  Version: `1.0.0`

## 2. Play Console

1. Create app SAVR — Food & Drink — free with subscriptions.
2. Paste listing copy from the launch pack (`PLAY_STORE_LISTING.md`).
3. Privacy: https://<your-production-domain>/privacy
4. Terms: https://<your-production-domain>/terms
5. Data safety: account email, user photos (optional), purchase history via Stripe. No precise location.
6. Content rating questionnaire.
7. Upload production AAB to **internal testing** first.
8. Add a Play review account (Pro trial) in review notes.
9. Promote to production only after a physical device smoke: Google sign-in → camera → pantry save → recipe.

## 3. Do not ship yet if

- EAS projectId is still empty
- Live Stripe webhook is not pointed at the production host
- Screenshots still show “Production workspace” (fixed on main; wait for Vercel deploy)
- iOS — parked until Apple Developer license
