'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { useAuth, isProTier } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getDataConsent, upsertDataConsent } from '@/lib/db';
import { callApi } from '@/lib/api';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user, userData, logout } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncingSubscription, setSyncingSubscription] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');
  const [consentLoading, setConsentLoading] = useState(true);
  const [consent, setConsent] = useState<{
    imageTraining: boolean;
    interactionAnalytics: boolean;
    consentDate?: string;
  }>({ imageTraining: false, interactionAnalytics: false });
  const [deletionPhase, setDeletionPhase] = useState<'idle' | 'confirming' | 'deleting'>('idle');
  const [deletionError, setDeletionError] = useState('');

  useEffect(() => {
    async function loadConsent() {
      if (!user) return;
      try {
        const data = await getDataConsent(user.id);
        if (data) {
          setConsent({
            imageTraining: data.data_usage_for_training ?? false,
            interactionAnalytics: data.analytics_tracking ?? false,
            consentDate: new Date(data.updated_at).toLocaleDateString(),
          });
        }
      } catch (err) {
        console.error('Failed to load consent:', err);
      } finally {
        setConsentLoading(false);
      }
    }
    loadConsent();
  }, [user]);

  async function handleConsentChange(field: 'imageTraining' | 'interactionAnalytics', value: boolean) {
    if (!user) return;
    const updated = { ...consent, [field]: value };
    setConsent(updated);
    try {
      await upsertDataConsent(user.id, {
        marketing_emails: false, // Default value
        data_usage_for_training: updated.imageTraining,
        analytics_tracking: updated.interactionAnalytics,
        consent_version: '1.0',
      });
    } catch (err) {
      console.error('Failed to save consent:', err);
      setConsent({ ...consent, [field]: !value }); // revert on failure
    }
  }

  const tier = userData?.subscription_tier;
  const tierLabel = tier === 'pro' ? 'Pro' : 'Basic';
  const hasPro = isProTier(userData?.subscription_tier);

  async function handleManageSubscription() {
    if (!user) return;

    setLoadingPortal(true);
    setError('');

    try {
      const result = await callApi('/stripe/portal', {});

      const data = result as { success: boolean; url: string };
      if (!data.success) {
        throw new Error('Portal creation failed');
      }

      window.location.href = data.url;
    } catch (err) {
      console.error('Error opening billing portal:', err);
      setError('Failed to open billing portal. Please try again.');
      setLoadingPortal(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  async function handleDeleteAccount() {
    setDeletionError('');
    setDeletionPhase('deleting');
    try {
      await callApi('/account/delete', {});
      // Sign the user out locally — the session is invalid after deletion.
      await logout();
    } catch (err) {
      setDeletionError(
        err instanceof Error ? err.message : 'Account deletion failed. Please try again.'
      );
      setDeletionPhase('idle');
    }
  }

  async function handleSyncSubscription() {
    setSyncingSubscription(true);
    setSyncResult(null);

    try {
      const result = await callApi('/stripe/sync', {}) as {
        synced?: boolean;
        message?: string;
        subscription_status?: string;
        subscription_tier?: string;
        error?: string;
      };

      if (result.synced) {
        setSyncResult({
          success: true,
          message:
            result.message ??
            `Stripe sync complete: status=${result.subscription_status}, tier=${result.subscription_tier}.`,
        });
      } else {
        setSyncResult({
          success: false,
          message: result.message ?? result.error ?? 'Subscription sync returned no update.',
        });
      }
    } catch (err) {
      setSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Subscription sync failed.',
      });
    } finally {
      setSyncingSubscription(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-4">Settings</h1>
        <p className="text-foreground-muted mb-8">
          Manage your account details, subscription, and preferences.
        </p>

        {error && (
          <div className="mb-6 rounded border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400">
            {error}
          </div>
        )}

        {/* Account section */}
        <section className="mb-6 rounded-lg glass-card p-6 shadow">
          <h2 className="text-xl font-semibold text-foreground mb-4">Account</h2>
          <div className="space-y-2 text-sm text-foreground-muted">
            <p>
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            {userData?.stripe_email && userData.stripe_email !== user?.email && (
              <p>
                <span className="font-medium">Billing email:</span> {userData.stripe_email}
              </p>
            )}
            <p>
              <span className="font-medium">Subscription tier:</span> {tierLabel}
            </p>
            {userData?.subscription_status && (
              <p>
                <span className="font-medium">Subscription status:</span>{' '}
                <span className="capitalize">{userData.subscription_status}</span>
              </p>
            )}
            {userData?.cancel_at_period_end && (
              <p className="text-amber-400">
                Your subscription will cancel at the end of the current billing period.
              </p>
            )}
            {userData?.payment_action_required && (
              <p className="text-red-400">
                Payment action required. Please update your payment method in the billing portal.
              </p>
            )}
            {userData?.last_payment_status === 'failed' && (
              <p className="text-red-400">
                Your last payment failed. Please update your payment method to maintain access.
              </p>
            )}
          </div>
        </section>

        {/* Subscription section */}
        <section className="mb-6 rounded-lg glass-card p-6 shadow">
          <h2 className="text-xl font-semibold text-foreground mb-4">Subscription</h2>

          <p className="mb-4 text-sm text-foreground-muted">
            You&apos;re on the <span className="font-semibold text-primary">{tierLabel}</span> plan.{' '}
            {hasPro
              ? 'You have access to unlimited recipes, meal plans, AI chat, and more.'
              : 'Upgrade to Pro to unlock unlimited recipes, AI chat, and more.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {userData?.stripe_customer_id && (
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="rounded-lg bg-primary text-primary-foreground font-semibold px-5 py-2 text-sm hover:bg-primary-hover disabled:opacity-50"
              >
                {loadingPortal ? 'Opening portal...' : 'Manage billing'}
              </button>
            )}
            {!hasPro && (
              <Link
                href="/pricing"
                className="inline-block rounded-lg bg-secondary text-secondary-foreground font-semibold px-5 py-2 text-sm hover:bg-secondary-hover"
              >
                Upgrade to Pro
              </Link>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-border/40 bg-background/30 px-4 py-4">
            <p className="text-sm text-foreground-muted">
              Need to recover a missed checkout or refresh subscription state from Stripe? Run a secure sync here.
            </p>
            {syncResult && (
              <div
                role={syncResult.success ? 'status' : 'alert'}
                aria-live={syncResult.success ? 'polite' : 'assertive'}
                className="mt-4 rounded-lg px-4 py-3 text-sm"
                style={{
                  background: syncResult.success
                    ? 'rgba(0, 191, 166, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${syncResult.success ? 'rgba(0, 191, 166, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: syncResult.success ? '#00bfa6' : '#f87171',
                }}
              >
                {syncResult.message}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSyncSubscription}
                disabled={syncingSubscription}
                className="rounded-lg bg-secondary text-secondary-foreground font-semibold px-5 py-2 text-sm hover:bg-secondary-hover disabled:opacity-50"
              >
                {syncingSubscription ? 'Syncing…' : 'Sync subscription from Stripe'}
              </button>
              <Link
                href="/subscription-debug"
                className="inline-flex items-center rounded-lg border border-border/50 px-5 py-2 text-sm font-semibold text-foreground-muted hover:text-foreground"
              >
                View billing debug details
              </Link>
            </div>
          </div>
        </section>

        {/* Preferences link */}
        <section className="mb-6 rounded-lg glass-card p-6 shadow">
          <h2 className="text-xl font-semibold text-foreground mb-2">Food Preferences</h2>
          <p className="mb-4 text-sm text-foreground-muted">
            Set your favorite cuisines, dietary preferences, and restrictions so the AI can personalize every recipe and meal plan.
          </p>
          <Link
            href="/preferences"
            className="inline-block rounded-lg bg-secondary text-secondary-foreground font-semibold px-5 py-2 text-sm hover:bg-secondary-hover"
          >
            Manage preferences
          </Link>
        </section>

        {/* Data & Privacy section */}
        <section className="mb-6 rounded-lg glass-card p-6 shadow">
          <h2 className="text-xl font-semibold text-foreground mb-2">Data &amp; Privacy</h2>
          <p className="mb-4 text-sm text-foreground-muted">
            Help improve SAVR by allowing us to use your anonymized data for training. You can change these settings at any time. See our{' '}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for details.
          </p>

          {consentLoading ? (
            <p className="text-sm text-foreground-muted">Loading preferences...</p>
          ) : (
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.imageTraining}
                  onChange={(e) => handleConsentChange('imageTraining', e.target.checked)}
                  className="mt-1 accent-primary w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Image &amp; inventory data</p>
                  <p className="text-xs text-foreground-muted">
                    Allow SAVR to use your uploaded pantry images and ingredient data (anonymized) to improve food recognition accuracy for all users.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.interactionAnalytics}
                  onChange={(e) => handleConsentChange('interactionAnalytics', e.target.checked)}
                  className="mt-1 accent-primary w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Usage &amp; interaction analytics</p>
                  <p className="text-xs text-foreground-muted">
                    Allow SAVR to analyze your recipe preferences, chat interactions, and feature usage (anonymized) to improve recommendations and the AI assistant.
                  </p>
                </div>
              </label>

              {consent.consentDate && (
                <p className="text-xs text-foreground-muted">Last updated: {consent.consentDate}</p>
              )}
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section className="rounded-lg border border-red-500/20 bg-red-500/10 p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-3">Danger zone</h2>

          <p className="mb-4 text-sm text-red-400">
            Log out of your account on this device, or permanently delete your account and all
            associated data (inventory, recipes, meal plans, grocery lists).
            Deletion is irreversible.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleLogout}
              disabled={deletionPhase === 'deleting'}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-foreground hover:bg-red-700 disabled:opacity-50"
            >
              Log out
            </button>

            {deletionPhase === 'idle' && (
              <button
                type="button"
                onClick={() => setDeletionPhase('confirming')}
                className="rounded-lg border border-red-500/40 px-5 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
              >
                Delete my account
              </button>
            )}
          </div>

          {deletionPhase === 'confirming' && (
            <div className="mt-4 rounded border border-red-500/30 bg-red-900/20 p-4">
              <p className="mb-3 text-sm font-semibold text-red-300">
                This will permanently delete your account and all data. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Yes, delete my account
                </button>
                <button
                  type="button"
                  onClick={() => { setDeletionPhase('idle'); setDeletionError(''); }}
                  className="rounded-lg border border-border/50 px-5 py-2 text-sm font-medium text-foreground-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {deletionPhase === 'deleting' && (
            <p className="mt-4 text-sm text-red-400">Deleting account…</p>
          )}

          {deletionError && (
            <p className="mt-3 text-sm text-red-400">{deletionError}</p>
          )}
        </section>
      </div>
    </div>
  );
}
