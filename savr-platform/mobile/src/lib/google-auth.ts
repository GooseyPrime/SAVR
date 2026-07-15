/**
 * Google OAuth flow for SAVR mobile.
 *
 * Implements the Expo-compatible Supabase OAuth pattern:
 * 1. Build a deep-link redirect URI using expo-auth-session.
 * 2. Generate the OAuth authorization URL from Supabase (skipBrowserRedirect: true).
 * 3. Open the URL in the system browser via expo-web-browser.
 * 4. Parse the callback URL fragment for Supabase session tokens.
 * 5. Exchange the tokens to establish an authenticated session.
 *
 * ADR-004 documents the redirect URL and Google OAuth client configuration
 * required for each build environment.
 */

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../config/supabase';
import {
  parseOAuthCallback,
  shouldExchangeSession,
  type AuthSessionResult,
} from './google-auth-utils';

export type { GoogleAuthResult } from './google-auth-utils';

// Required for the auth session to complete properly on Android.
WebBrowser.maybeCompleteAuthSession();

/**
 * Build the deep-link redirect URI for the current build environment.
 *
 * - Standalone Android/iOS: savr://auth/callback
 * - Expo Go (development): exp://127.0.0.1:8081/--/auth/callback
 *
 * The scheme 'savr' must match the value declared in app.config.ts.
 */
export function buildRedirectUri(): string {
  return makeRedirectUri({
    scheme: 'savr',
    path: 'auth/callback',
  });
}

/**
 * Initiate a Google sign-in via Supabase OAuth.
 *
 * Handles all error cases explicitly — no silent fallbacks.
 */
export async function signInWithGoogle(): Promise<import('./google-auth-utils').GoogleAuthResult> {
  const redirectUri = buildRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return {
      success: false,
      reason: 'browser_error',
      message: error?.message ?? 'Failed to generate OAuth authorization URL',
    };
  }

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
  } catch (browserError) {
    return {
      success: false,
      reason: 'browser_error',
      message:
        browserError instanceof Error
          ? browserError.message
          : 'Browser failed to open the authentication session',
    };
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { success: false, reason: 'canceled', message: 'Sign-in was canceled by the user' };
  }

  const adaptedResult: AuthSessionResult =
    result.type === 'success'
      ? { type: 'success', url: (result as WebBrowser.WebBrowserRedirectResult).url }
      : { type: result.type as 'locked' | 'opened' };

  if (!shouldExchangeSession(adaptedResult)) {
    return {
      success: false,
      reason: 'browser_error',
      message: 'Browser session did not complete successfully',
    };
  }

  const tokens = parseOAuthCallback(adaptedResult.url);
  if (!tokens) {
    return {
      success: false,
      reason: 'invalid_callback',
      message: 'OAuth callback URL did not contain valid session tokens',
    };
  }

  const { error: sessionError } = await supabase.auth.setSession(tokens);
  if (sessionError) {
    return { success: false, reason: 'exchange_error', message: sessionError.message };
  }

  return { success: true };
}
