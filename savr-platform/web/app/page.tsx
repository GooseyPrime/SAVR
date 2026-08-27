'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import VideoHero from '@/components/VideoHero';
import { useAuth, hasActiveSubscription } from '@/contexts/AuthContext';
import { trackCheckoutIntentIfReturning, hasRecentCheckoutIntent } from '@/lib/checkout';

export default function Home() {
  const { user, userData, loading } = useAuth();
  const hasActiveSub = hasActiveSubscription(userData);

  useEffect(() => {
    trackCheckoutIntentIfReturning();
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (hasActiveSub) return;
    if (hasRecentCheckoutIntent()) {
      window.location.href = '/dashboard?stripeSuccess=true';
    }
  }, [loading, user, hasActiveSub]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 radial-glow-top" />
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-20 animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(0, 212, 255, 0.15), transparent 70%)' }} />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full opacity-15 animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15), transparent 70%)', animationDelay: '1.5s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Official static SAVR logo */}
            <VideoHero />

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 8px rgba(0, 212, 255, 0.6)' }} />
              <span className="text-sm font-medium text-primary">AI-Powered Smart Kitchen</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] mb-6">
              <span className="text-foreground">Cook Smarter.</span>
              <br />
              <span className="gradient-text">Save Everything.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#9ca3c2' }}>
              Transform your pantry into restaurant-quality meals with AI. Smart inventory tracking,
              personalized recipes, pet-safe treats, and intelligent meal planning — all in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              {!user || !hasActiveSub ? (
                <>
                  <Link href="/sign-up" className="btn-primary text-base sm:text-lg w-full sm:w-auto text-center">
                    Get Started
                  </Link>
                  <Link href="/pricing" className="btn-secondary text-base sm:text-lg w-full sm:w-auto text-center">
                    View Pricing
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/dashboard" className="btn-primary text-base sm:text-lg w-full sm:w-auto text-center">
                    Go to Dashboard
                  </Link>
                  <Link href="/pricing" className="btn-secondary text-base sm:text-lg w-full sm:w-auto text-center">
                    Manage Subscription
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
