/**
 * Pure utility functions for the Google OAuth flow.
 *
 * This module has no native dependencies so it can be unit-tested in Node.js.
 * The platform-dependent flow lives in google-auth.ts.
 */

/**
 * Discriminated union for the result of a Google OAuth attempt.
 *
 * - `success: true` — the session was exchanged successfully.
 * - `success: false` — an explicit error occurred; reason and message are set.
 */
export type GoogleAuthResult =
  | { success: true }
  | {
      success: false;
      reason: 'canceled' | 'browser_error' | 'invalid_callback' | 'exchange_error';
      message: string;
    };

/**
 * Shape matching the subset of expo-web-browser's WebBrowserAuthSessionResult
 * needed for shouldExchangeSession without importing the native module.
 */
export type AuthSessionResult =
  | { type: 'success'; url: string }
  | { type: 'cancel' | 'dismiss' | 'locked' | 'opened' };

/**
 * Parse the callback URL fragment for Supabase session tokens.
 *
 * Supabase places access_token and refresh_token in the URL hash after
 * a successful OAuth redirect, e.g.:
 *   savr://auth/callback#access_token=...&refresh_token=...
 *
 * Returns the token pair, or null when the fragment is absent or incomplete.
 */
export function parseOAuthCallback(
  callbackUrl: string
): { access_token: string; refresh_token: string } | null {
  const hashIndex = callbackUrl.indexOf('#');
  if (hashIndex === -1) return null;

  const hash = callbackUrl.slice(hashIndex + 1);
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

/**
 * Return true when the WebBrowser result should proceed to token exchange.
 *
 * Only a 'success' result with a non-empty URL should proceed.
 * Any other result (cancel, dismiss, locked, or missing URL) must not attempt exchange.
 */
export function shouldExchangeSession(result: AuthSessionResult): result is { type: 'success'; url: string } {
  return result.type === 'success' && 'url' in result && typeof result.url === 'string' && result.url.length > 0;
}
