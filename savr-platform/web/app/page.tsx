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
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-20 animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(163, 230, 53, 0.12), transparent 70%)' }} />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full opacity-15 animate-pulse-glow" style={{ background: 'radial-gradient(circle, rgba(163, 230, 53, 0.08), transparent 70%)', animationDelay: '1.5s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <VideoHero />

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ background: 'rgba(163, 230, 53, 0.08)', border: '1px solid rgba(163, 230, 53, 0.2)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#a3e635', boxShadow: '0 0 8px rgba(163, 230, 53, 0.6)' }} />
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

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} className="w-5 h-5" fill="#f59e0b" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-medium text-foreground-muted">Loved by home cooks</span>
              </div>
              <div className="hidden sm:block w-px h-5" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm font-medium text-foreground-muted">Vet-reviewed pet recipes</span>
              </div>
            </div>
          </div>
        </div>
      </section>
