# Task: Make EAS work for the SAVR mobile app — Android / Google Play ONLY

Repo: `GooseyPrime/SAVR`  ·  App: `savr-platform/mobile` (Expo, owner `intellme`,
slug `savr`, Android package `cam.savr.app`).

There is **no Apple Developer account yet**. Configure everything for an
Android/Google Play first release. Leave the iOS *app* config in place but
parked/commented so Apple can be reconnected later — just remove iOS from any
path that blocks EAS (build validation, submit).

Do the work on a branch `fix/eas-android-only` and open a PR. Do not touch any
secrets or other apps.

## Bug 1 — `app.config.ts` fails to load (ERR_UNSUPPORTED_DIR_IMPORT)
`savr-platform/mobile/app.config.ts` imports the Expo config *directory*:
`import { ExpoConfig, ConfigContext } from 'expo/config';`
Under Node 22 ESM this throws `ERR_UNSUPPORTED_DIR_IMPORT`, so `eas init`,
`eas config`, and `expo config` all fail.

Fix: make it a **type-only** import so no runtime `require('expo/config')` is
emitted:
```ts
import type { ExpoConfig, ConfigContext } from 'expo/config';
```
Also: if a compiled `savr-platform/mobile/app.config.js` is committed, delete it
(it is a build artifact shadowing the .ts) and add `app.config.js` to
`savr-platform/mobile/.gitignore`.

## Bug 2 — `eas.json` invalid (empty iOS submit fields)
`savr-platform/mobile/eas.json` -> `submit.production.ios` has empty
`appleId` / `ascAppId` / `appleTeamId`, which fails EAS schema validation.

Fix (Android-only): remove the entire `ios` object under `submit.production`.
Keep Android. The `submit` block should end up as:
```json
"submit": {
  "production": {
    "android": { "track": "internal", "releaseStatus": "draft" }
  }
}
```
Notes:
- The previous `serviceAccountKeyPath: "./google-play-service-account.json"` was
  removed above because that file is not in the repo and would break
  `eas submit`. Configure the Play service account later via
  `eas credentials` (recommended) or re-add the path once the key exists.
- Leaving `ios` keys inside the `build` profiles is harmless, but you may delete
  them for tidiness since no iOS builds will run. Keep `android` build profiles
  as-is (development=apk, preview=apk, production=app-bundle).

## Create/link the EAS project and pin the ID
`app.config.ts` currently sets `extra.eas.projectId = process.env.EAS_PROJECT_ID || ''`.
Because this is a *dynamic* config, `eas init` cannot auto-write it. After the
two fixes above:
1. `cd savr-platform/mobile && npm install`
2. `npx expo config --json`  → must print valid JSON with NO ESM error.
3. `eas init`  (logged in as an account with access to the `intellme` org).
   This creates/links the Expo project `@intellme/savr` and prints a project
   UUID.
4. Pin that UUID directly in `app.config.ts` (project IDs are NOT secret):
   ```ts
   extra: {
     eas: { projectId: '<uuid-from-eas-init>' },
     supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
     supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
     googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
     googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
     googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
   },
   ```
   (Keep the `owner: 'intellme'` line.)

## Build-time env vars (already provisioned as GitHub secrets)
These are already stored as GitHub Actions secrets and in the team's secrets
backup; the mobile build must receive them at build time. Register them as EAS
environment variables (preferred) so `eas build` embeds them:
```
eas env:create --scope project --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <url>
# repeat for: EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_GOOGLE_CLIENT_ID,
#             EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
#             EXPO_PUBLIC_APP_URL (https://savr.cam)
# also create the same set for --environment preview
```
`EXPO_TOKEN` is already a GitHub secret for CI-triggered EAS builds.

## Acceptance criteria
- `npx expo config --json` succeeds (no ERR_UNSUPPORTED_DIR_IMPORT).
- `eas.json` validates (no empty-iOS-submit error); only Android in `submit`.
- `app.config.ts` uses `import type`, has a real `extra.eas.projectId`, and its
  `ios` block is preserved (parked for later) — nothing in the build/submit path
  requires Apple credentials.
- `eas build --platform android --profile production` starts without config or
  validation errors (a full build/upload is optional in CI).
- PR description notes: "iOS parked until Apple Developer account is added;
  re-add `submit.production.ios` + Apple IDs and an iOS build profile later."

## Out of scope (do NOT attempt)
- Creating the Google Play Console app / uploading the service-account JSON
  (owner will do this before first `eas submit`).
- Any Apple/iOS credential setup.
- Changing secrets or other apps in the monorepo.
