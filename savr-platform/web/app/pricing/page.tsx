'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Script from 'next/script';
import { callApi } from '@/lib/api';
import { hasProAccess, isSubscriptionActive } from '@/lib/billing';

export default function PricingPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState('');
  const pricingTableRef = useRef<HTMLDivElement>(null);

  const hasActiveSub = isSubscriptionActive(userData?.subscription_status);
  const isPro = hasProAccess(userData);

  // Redirect logged-out users who try to use pricing table
  useEffect(() => {
    if (!user) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('stripeSuccess') === 'true') {
        router.push('/sign-in?redirect=' + encodeURIComponent('/dashboard?stripeSuccess=true'));
      }
    }
  }, [user, router]);

  // Get Stripe configuration from environment variables
  const pricingTableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID || '';
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const stripeConfigured = pricingTableId && publishableKey;

  // Inject Stripe pricing table when ready - Official Stripe integration method
  useEffect(() => {
    if (!user || hasActiveSub || !stripeConfigured || !pricingTableRef.current) {
      return;
    }

    // Check if pricing table already exists to avoid duplicates
    const existingTable = pricingTableRef.current.querySelector('stripe-pricing-table');
    if (existingTable) {
      return; // Table already injected
    }

    // Create stripe-pricing-table element
    const table = document.createElement('stripe-pricing-table');
    table.setAttribute('pricing-table-id', pricingTableId);
    table.setAttribute('publishable-key', publishableKey);

    // Add a safety check for the UID
    if (user.id) {
      table.setAttribute('client-reference-id', user.id);
      
      // Set customer email to prevent init endpoint 400 errors
      // This prefills and locks the email field in Stripe Checkout
      if (user.email) {
        table.setAttribute('customer-email', user.email);
      }
      
      pricingTableRef.current.appendChild(table);
    }
  }, [user, hasActiveSub, stripeConfigured, pricingTableId, publishableKey]);

  async function handleManageBilling() {
    if (!user) {
      router.push('/sign-in');
      return;
    }

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

  // Helper to generate missing env vars message
  const getMissingEnvVars = () => {
    const missing = [];
    if (!pricingTableId) missing.push('NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID');
    if (!publishableKey) missing.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
    return missing.join(', ');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Load Stripe Pricing Table script - Stripe's official integration */}
      <Script
        async
        src="https://js.stripe.com/v3/pricing-table.js"
        strategy="afterInteractive"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        {/* Onboarding banner for new users */}
        {user && userData?.subscription_status === 'pending' && (
          <div className="max-w-2xl mx-auto mb-10 rounded-xl px-6 py-5 text-center" style={{ background: 'rgba(0, 212, 255, 0.06)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
            <h3 className="text-lg font-semibold text-foreground mb-2">Choose a plan to get started</h3>
            <p className="text-sm text-foreground-muted">
              Select a plan below to begin your 5-day free trial. Your payment info is collected now but you will not be charged until the trial ends. Cancel anytime.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">Pricing</h2>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
            Simple, transparent<br />
            <span className="gradient-text">pricing</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto text-foreground-muted">
            Try any plan free for 5 days. No charge until your trial ends. Coupon codes accepted at checkout.
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-8 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Existing Subscriber - Show Billing Portal Access */}
        {hasActiveSub ? (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl p-8 text-center bg-surface/70 border border-primary/25">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-primary/10">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                You&apos;re on the {isPro ? 'Pro' : 'Basic'} plan
              </h3>
              <p className="text-foreground-muted mb-6">
                {isPro 
                  ? 'You have access to unlimited recipes, meal plans, AI chat, and more.'
                  : 'Enjoying your subscription. Upgrade to Pro for unlimited access and AI chat.'}
              </p>
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={loadingPortal}
                className="inline-flex items-center rounded-lg bg-primary text-primary-foreground font-semibold px-8 py-3 text-sm hover:bg-primary-hover disabled:opacity-50 transition-all duration-200"
              >
                {loadingPortal ? 'Opening portal...' : 'Manage subscription & billing'}
              </button>
              <p className="text-xs text-[#6b7294] mt-4">
                Update payment method, view invoices, or change plans
              </p>
            </div>
          </div>
        ) : (
          /* New Subscriber - Show Stripe Pricing Table */
          <div className="max-w-5xl mx-auto">
            {/* Static plan comparison — visible before sign-in and when Stripe is unavailable.
                Hidden for logged-in users when the Stripe Pricing Table is present (avoids duplication). */}
            {(!user || !stripeConfigured) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12" aria-label="Plan comparison">
              {/* Basic plan */}
              <div className="rounded-2xl p-8 bg-surface/60 border border-border/60">
                <h3 className="text-xl font-bold text-foreground mb-2">Basic</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-foreground">$4.99</span>
                  <span className="text-foreground-muted text-sm">/ month</span>
                </div>
                <p className="text-sm text-foreground-muted mb-4">or <strong className="text-foreground">$49.99 / year</strong> — save 17%</p>
                <ul className="space-y-2 text-sm text-foreground-muted">
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Pantry &amp; inventory tracking</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> AI recipe generation</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Meal planning</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Grocery lists</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> 5-day free trial</li>
                </ul>
              </div>
              {/* Pro plan */}
              <div className="rounded-2xl p-8 bg-surface/60 border border-primary/40 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Most popular</div>
                <h3 className="text-xl font-bold text-foreground mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-foreground">$9.99</span>
                  <span className="text-foreground-muted text-sm">/ month</span>
                </div>
                <p className="text-sm text-foreground-muted mb-4">or <strong className="text-foreground">$99.99 / year</strong> — save 17%</p>
                <ul className="space-y-2 text-sm text-foreground-muted">
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Everything in Basic</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> AI Chef chat (unlimited)</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Advanced meal planning</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Priority support</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> 5-day free trial</li>
                </ul>
              </div>
            </div>
            )}

            {!user && (
              <div className="mb-8 text-center">
                <p className="text-foreground-muted mb-4">
                  Create an account to start your 5-day free trial
                </p>
                <button
                  onClick={() => router.push('/sign-up?redirect=%2Fpricing')}
                  className="inline-flex items-center rounded-lg bg-primary text-primary-foreground font-semibold px-8 py-3 text-sm hover:bg-primary-hover transition-all duration-200"
                >
                  Start 5-day free trial
                </button>
                <p className="mt-3 text-sm text-foreground-muted">
                  Already have an account?{' '}
                  <Link href="/sign-in?redirect=%2Fpricing" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            )}
            {user && !stripeConfigured && (
              <div className="max-w-2xl mx-auto mb-8 px-6 py-8 rounded-xl text-center" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                  <svg className="w-8 h-8" fill="none" stroke="#f87171" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Configuration Error</h3>
                <p className="text-[#f87171] mb-4">
                  The pricing table cannot be displayed because Stripe is not configured.
                </p>
                <p className="text-sm text-foreground-muted mb-6">
                  Missing environment variables: {getMissingEnvVars()}
                </p>
                <div className="text-left bg-black/30 rounded-lg p-4 text-xs font-mono text-foreground-muted">
                  <p className="mb-2">For administrators:</p>
                  <p>1. Set GitHub Secrets in repository settings</p>
                  <p>2. Redeploy the application</p>
                  <p>3. See MANUAL_STEPS_REQUIRED.md for details</p>
                </div>
              </div>
            )}
            {user && stripeConfigured && (
              <div ref={pricingTableRef} className="w-full" />
            )}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">FAQ</h2>
            <p className="text-3xl md:text-4xl font-bold text-foreground">Frequently asked questions</p>
          </div>
          <div className="space-y-4">
            <FAQItem
              question="How does the 5-day free trial work?"
              answer="Every plan starts with a 5-day free trial. You'll get full access to all features in your chosen plan. Your card is collected at signup but won't be charged until the trial ends. Cancel anytime during the trial and you won't be billed."
            />
            <FAQItem
              question="Can I use a coupon code?"
              answer="Yes! Both monthly and yearly plans accept coupon codes. Enter your code at checkout. If a coupon reduces your total to $0.00, no payment method is required."
            />
            <FAQItem
              question="Can I switch plans anytime?"
              answer="Yes! You can upgrade or downgrade your subscription through the billing portal. Changes are prorated and take effect immediately. You can cancel anytime and retain access until the end of your billing period."
            />
            <FAQItem
              question="What payment methods do you accept?"
              answer="We accept all major credit cards including Visa, Mastercard, American Express, and Discover through our secure Stripe payment processor."
            />
            <FAQItem
              question="Is my data secure?"
              answer="We use industry-standard encryption and security practices. We use Supabase for secure data storage, Stripe to process payments, and AI providers to generate recipe and planning features. We do not sell your personal data."
            />
            <FAQItem
              question="Can I get a refund?"
              answer="We offer a 30-day money-back guarantee. If you're not satisfied, contact our support team for a full refund."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: isOpen ? 'rgba(13, 17, 41, 0.8)' : 'rgba(13, 17, 41, 0.5)',
        border: `1px solid ${isOpen ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)'}`,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 text-left flex justify-between items-center"
      >
        <span className="font-semibold text-foreground text-sm">{question}</span>
        <svg
          className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="#6b7294"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 pb-5 text-sm leading-relaxed text-foreground-muted">
          {answer}
        </div>
      )}
    </div>
  );
}
