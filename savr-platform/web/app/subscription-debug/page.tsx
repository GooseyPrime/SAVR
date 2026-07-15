import { notFound } from 'next/navigation';
import SubscriptionDebugContent from './SubscriptionDebugContent';

// This route exposes per-user billing identifiers (Stripe customer ID,
// subscription ID). It is restricted to non-production environments so those
// identifiers are never reachable in production without explicit debug
// configuration.  Set NEXT_PUBLIC_DEBUG_MODE=true to re-enable in a
// controlled staging deployment.
export default function SubscriptionDebugPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEBUG_MODE !== 'true') {
    notFound();
  }
  return <SubscriptionDebugContent />;
}
