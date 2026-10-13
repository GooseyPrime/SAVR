# ADR-004 — Mobile Google OAuth with Expo Auth Session

**Status:** Accepted  
**Date:** 2026-07-14  
**Branch:** `copilot/corrective-pr-7`

---

## Context

The SAVR mobile app (Expo/React Native) contained a placeholder Google sign-in implementation that called `supabase.auth.signInWithOAuth` without the required `skipBrowserRedirect: true` option or any deep-link handling. That call silently did nothing on a real device because:

- React Native is not a browser and does not process HTTP redirects.
- The Supabase JS client's automatic redirect only fires in a browser context.
- No deep-link scheme was registered for the OAuth callback.

The production authentication contract requires that Google sign-in work on both Android and iOS standalone builds, matching the web app's provider support.

---

## Decision

Replace the placeholder with a complete Expo-compatible Supabase OAuth flow using the already-installed `expo-auth-session` and `expo-web-browser` packages.

**Implementation pattern:**

1. Build the deep-link redirect URI with `makeRedirectUri({ scheme: 'savr', path: 'auth/callback' })`.
2. Obtain the authorization URL from Supabase with `signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`.
3. Open the URL in the system browser with `WebBrowser.openAuthSessionAsync(url, redirectUri)`.
4. Parse the `access_token` and `refresh_token` from the URL fragment returned in the callback.
5. Exchange the tokens with `supabase.auth.setSession({ access_token, refresh_token })`.
6. Let `onAuthStateChange` drive all downstream UI state updates.

**Error cases handled explicitly:**

| Scenario | Result reason | Behavior |
|---|---|---|
| User closes browser | `canceled` | Return silently; no Alert, no throw |
| Browser fails to open | `browser_error` | Throw with message for UI to display |
| Callback URL has no tokens | `invalid_callback` | Throw with message for UI to display |
| `setSession` fails | `exchange_error` | Throw with message for UI to display |

**Deep-link scheme:** `savr` (already declared in `app.config.ts`).

**Android intent filter** added to `app.config.ts` to register the `savr://auth/callback` URI as a recognised link, allowing Custom Tabs to redirect back to the app.

**`WebBrowser.maybeCompleteAuthSession()`** called at module load in `google-auth.ts` to allow Android to complete in-progress authentication sessions on app resume.

---

## Required configuration before live use

### Supabase dashboard

Register the following redirect URLs under **Authentication → URL Configuration → Redirect URLs**:

| Environment | Redirect URL |
|---|---|
| Standalone (Android + iOS) | `savr://auth/callback` |
| Expo Go (development) | `exp://127.0.0.1:8081/--/auth/callback` |

The exact Expo Go URL depends on the local development IP and port. During development, log the output of `buildRedirectUri()` to confirm the value for your machine.

### Google Cloud Console

1. Create (or reuse) a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google People API** and **Google OAuth 2.0** for the project.
3. Under **Credentials → OAuth 2.0 Client IDs**, create:

| Client type | Use | Configuration |
|---|---|---|
| **Web application** | Supabase server-side OAuth | Add the Supabase Auth callback URL as an authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback` |
| **Android** | Android standalone build | Package name: `cam.savr.app`; SHA-1 from your keystore |
| **iOS** | iOS standalone build | Bundle ID: `cam.savr.app` |

4. Copy the **Web client ID** and **client secret** into the Supabase dashboard under **Authentication → Providers → Google**.
5. Copy the **Android client ID** and **iOS client ID** into `.env`:

```
# Android OAuth client ID (not secret — safe for environment, not for source)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android-client-id>
# iOS OAuth client ID (not secret — safe for environment, not for source)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>
```

**Do not** place the Google client **secret** in any `EXPO_PUBLIC_*` variable.

### Expo Go (development)

Expo Go uses the `exp://` scheme for deep links. The redirect URI returned by `makeRedirectUri` will automatically use this scheme when running in Expo Go. Ensure `exp://` redirect URLs are registered in Supabase for local development.

Note: Google OAuth in Expo Go requires adding the Expo Go `exp://` redirect to the Google Console authorized origins, which may require a different OAuth client or permissive redirect configuration. For a more reliable development experience, use a development build with the `savr` scheme.

---

## Remaining physical-device validation gates

The following must be verified on a real device or managed emulator before production release. These cannot be automated in CI without signing credentials and a live OAuth project.

- [ ] Google sign-in flow completes end-to-end on Android (standalone build)
- [ ] Google sign-in flow completes end-to-end on iOS (standalone build)
- [ ] Canceling the browser returns the user to the sign-in screen without error
- [ ] Session persists across app restarts (AsyncStorage)
- [ ] Sign-out clears the session correctly
- [ ] Expired token refresh works correctly after session exchange

---

## Consequences

- The Google sign-in button on SignInScreen and SignUpScreen now triggers a real OAuth flow instead of a no-op placeholder.
- The `AuthContext.signInWithGoogle` method surfaces errors correctly to callers.
- The canceled-login case is handled silently (no alert, no throw), matching conventional mobile UX.
- `WebBrowser.maybeCompleteAuthSession()` is called at module load, which is a no-op except during an active Android authentication session.
- No Google client secrets are included in any `EXPO_PUBLIC_*` or source-committed variable.
- ADR-003 (Expo 57 canonical version) remains in effect; this decision builds on top of it.
