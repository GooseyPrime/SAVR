import { notFound } from 'next/navigation';
import SubscriptionDebugContent from './SubscriptionDebugContent';

// This route exposes per-user billing identifiers (Stripe customer ID,
// subscription ID). It is restricted to non-production environments so those
// identifiers are never reachable in production without explicit debug
// configuration.
//
// Guard: the server-only variable DEBUG_MODE (no NEXT_PUBLIC_ prefix) is
// intentionally never bundled into the client by Next.js. Only set it in
// trusted server/hosting environments. Never use NEXT_PUBLIC_DEBUG_MODE.
export default function SubscriptionDebugPage() {
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG_MODE !== 'true') {
    notFound();
  }
  return <SubscriptionDebugContent />;
}
