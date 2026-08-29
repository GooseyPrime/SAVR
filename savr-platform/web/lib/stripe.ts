/**
 * Stripe SDK lazy initialization utility
 *
 * The Stripe client is only created when first accessed at runtime so that a
 * build without runtime environment variables does not fail.
 *
 * The secret key is read through the shared credential reader, which rejects
 * values carrying stray whitespace or line breaks. Without that guard a
 * credential pasted with a trailing newline produces an unreadable transport
 * error ("Invalid character in header content") on every Stripe call instead
 * of an actionable configuration error.
 */

import Stripe from 'stripe';
import {
  inspectCredentialEnv,
  readCredentialEnv,
  type CredentialHygiene,
} from '@/lib/env-credentials';

export const STRIPE_SECRET_KEY_ENV = 'STRIPE_SECRET_KEY';
export const STRIPE_WEBHOOK_SECRET_ENV = 'STRIPE_WEBHOOK_SECRET';

let stripeInstance: Stripe | null = null;
let stripeInstanceKey: string | null = null;

/**
 * Get or create a Stripe instance with lazy initialization.
 *
 * @throws {Error} If STRIPE_SECRET_KEY is missing or unusable at runtime
 * @returns {Stripe} Initialized Stripe instance
 */
export function getStripeInstance(): Stripe {
  const secretKey = readCredentialEnv(STRIPE_SECRET_KEY_ENV);

  // Rebuild the cached client when the configured key changes so a corrected
  // credential takes effect without relying on a cold start.
  if (stripeInstance && stripeInstanceKey === secretKey) {
    return stripeInstance;
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
  });
  stripeInstanceKey = secretKey;

  return stripeInstance;
}

/**
 * Read the webhook signing secret with the same hygiene guarantees.
 *
 * @throws {Error} If STRIPE_WEBHOOK_SECRET is missing or unusable
 */
export function getStripeWebhookSecret(): string {
  return readCredentialEnv(STRIPE_WEBHOOK_SECRET_ENV);
}

/**
 * True when the Stripe secret key is present AND usable.
 *
 * A key that exists but carries a line break is not configured for any
 * practical purpose, so it is reported as unconfigured here.
 */
export function isStripeConfigured(): boolean {
  try {
    readCredentialEnv(STRIPE_SECRET_KEY_ENV);
    return true;
  } catch {
    return false;
  }
}

/** Which Stripe environment the configured key targets. */
export type StripeKeyMode = 'live' | 'test' | 'restricted' | 'unknown';

function resolveKeyMode(): StripeKeyMode {
  const raw = process.env[STRIPE_SECRET_KEY_ENV]?.trim() ?? '';
  if (raw.startsWith('sk_live_')) return 'live';
  if (raw.startsWith('sk_test_')) return 'test';
  if (raw.startsWith('rk_')) return 'restricted';
  return 'unknown';
}

/** Non-sensitive Stripe configuration report for operator diagnostics. */
export interface StripeConfigDiagnostics {
  secretKey: CredentialHygiene;
  webhookSecret: CredentialHygiene;
  keyMode: StripeKeyMode;
}

export function getStripeConfigDiagnostics(): StripeConfigDiagnostics {
  return {
    secretKey: inspectCredentialEnv(STRIPE_SECRET_KEY_ENV),
    webhookSecret: inspectCredentialEnv(STRIPE_WEBHOOK_SECRET_ENV),
    keyMode: resolveKeyMode(),
  };
}
