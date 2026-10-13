# Owner-only launch commands

None of these can be completed from the agent. Use your Expo, Play Console, Stripe, and EAS logins.

## 1. Link Expo and pin projectId — **DONE**

`eas init` created `@intellme/savr` (`acf58b96-e2fd-4d00-b289-e0686d13875c`).
EAS cannot write into a dynamic config, so the id is pinned in `app.config.ts`
(PR #114). Android credentials exist — EAS generated and holds the upload
keystore on the first production build. Do not create a second keystore.

## 2. Production EAS env — **DONE**

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_APP_URL`, and the three Google client ids are set for production,
preview and development. `EXPO_PUBLIC_API_URL` is intentionally unset —
`src/utils/api.ts` falls back to `EXPO_PUBLIC_APP_URL`.

`eas env:create` is deprecated; use `eas env:set`. To re-set a value without
retyping a long key, read it from the backup rather than pasting:

```powershell
$bak = "<path to savr-platform.mobile.expo.env>"
$v = @{}
Get-Content $bak | ForEach-Object { if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$') { $v[$matches[1]] = $matches[2] } }
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value $v['EXPO_PUBLIC_SUPABASE_ANON_KEY'] `
  --visibility plaintext --environment production --environment preview --environment development --non-interactive
```

Never run `eas integrations:supabase:connect` on this project. It provisions a
**new empty** Supabase project and repoints the app at it.

## 3. Build AAB

```bash
cd savr-platform/mobile
eas build --platform android --profile production
```

Package `com.savr.app`, version `1.0.0`. Do not run an iOS submit.

## 4. Play Console

Follow `PLAY_CONSOLE_SUBMIT.md`. Internal testing first. Physical-device smoke: Google sign-in → camera pantry scan → item saved with nutrition note → generate recipe.
