'use client';

import { useAuth, isProTier, hasActiveSubscription } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasRecentCheckoutIntent, clearCheckoutIntent } from '@/lib/checkout';

export default function ProtectedRoute({
  children,
  requirePro = false,
}: {
  children: React.ReactNode;
  requirePro?: boolean;
}) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActive = hasActiveSubscription(userData);
  const hasPro = isProTier(userData?.subscription_tier);
  const isReturningFromStripe = searchParams.get('stripeSuccess') === 'true';
  const [hasCheckoutIntent, setHasCheckoutIntent] = useState(() => hasRecentCheckoutIntent());
  const inGracePeriod = isReturningFromStripe || hasCheckoutIntent;

  useEffect(() => {
    if (isActive && hasCheckoutIntent) {
      clearCheckoutIntent();
      setHasCheckoutIntent(false);
    }
  }, [isActive, hasCheckoutIntent]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/sign-in');
      } else if (!isActive && !inGracePeriod) {
        router.push('/pricing');
      } else if (requirePro && !hasPro) {
        router.push('/pricing');
      }
    }
  }, [user, userData, loading, router, requirePro, hasPro, isActive, inGracePeriod]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="flex items-center gap-4 rounded-3xl border border-[var(--color-border)] bg-[rgba(20,26,23,0.82)] px-6 py-5 shadow-[var(--shadow-md)]">
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[var(--color-border-strong)] border-t-[var(--color-primary)]" />
          <div>
            <p className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-foreground)]">
              Loading your workspace
            </p>
            <p className="text-sm text-[var(--color-foreground-muted)]">
              Checking auth and subscription access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || (!isActive && !inGracePeriod) || (requirePro && !hasPro)) {
    return null;
  }

  return <>{children}</>;
}
