import { notFound } from 'next/navigation';
import SubscriptionDebugContent from './SubscriptionDebugContent';

// This route exposes per-user billing identifiers (Stripe customer ID,
// subscription ID). It is restricted to non-production environments so those
// identifiers are never reachable in production without explicit debug
// configuration.  Set the server-only env var DEBUG_MODE=true to re-enable in
// a controlled staging deployment.  A server-only variable is used
// intentionally so the flag is never visible in the client bundle.
export default function SubscriptionDebugPage() {
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_MODE !== 'true') {
    notFound();
  }
  return <SubscriptionDebugContent />;
}
