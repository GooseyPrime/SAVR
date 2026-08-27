# Owner-only launch commands

None of these can be completed from the agent. Use your Expo, Play Console, Stripe, and EAS logins.

## 1. Link Expo and pin projectId

```bash
cd savr-platform/mobile
npx expo login
eas init                 # link or create @intellme/savr
# paste the printed UUID into app.config.ts extra.eas.projectId
# or set EAS_PROJECT_ID for the production EAS environment
eas credentials -p android
```

## 2. Production EAS env

```bash
eas env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_URL --value <prod supabase url>
eas env:create --scope project --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
eas env:create --scope project --environment production --name EXPO_PUBLIC_API_URL --value https://www.savr.cam
eas env:create --scope project --environment production --name EXPO_PUBLIC_APP_URL --value https://www.savr.cam
eas env:create --scope project --environment production --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value <web client id>
eas env:create --scope project --environment production --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value <android client id>
```

Confirm Vercel production has:

- `STRIPE_PRICE_BASIC_MONTHLY=price_1TswjQJF6bibA8netYlk5tmj`
- `STRIPE_PRICE_BASIC_YEARLY=price_1TswjTJF6bibA8neA5OQJgNB`
- `STRIPE_PRICE_PRO_MONTHLY=price_1TswjWJF6bibA8nedzOe1gu2`
- `STRIPE_PRICE_PRO_YEARLY=price_1TswjaJF6bibA8ne2SIUE1bx`
- Stripe webhook endpoint `https://www.savr.cam/api/stripe/webhook` in livemode

## 3. Build AAB

```bash
cd savr-platform/mobile
eas build --platform android --profile production
```

Package `com.savr.app`, version `1.0.0`. Do not run an iOS submit.

## 4. Play Console

Follow `PLAY_CONSOLE_SUBMIT.md`. Internal testing first. Physical-device smoke: Google sign-in → camera pantry scan → item saved with nutrition note → generate recipe.
