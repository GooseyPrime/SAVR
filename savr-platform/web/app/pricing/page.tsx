'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { callApi } from '@/lib/api';
import { hasProAccess, isSubscriptionActive } from '@/lib/billing';

type BillingPeriod = 'monthly' | 'yearly';
type Plan = 'basic_monthly' | 'basic_yearly' | 'pro_monthly' | 'pro_yearly';

function planKey(tier: 'basic' | 'pro', period: BillingPeriod): Plan {
  return `${tier}_${period}` as Plan;
}

export default function PricingPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  const hasActiveSub = isSubscriptionActive(userData?.subscription_status);
  const isPro = hasProAccess(userData);

  // If a logged-out user returns with stripeSuccess, redirect to sign-in
  useEffect(() => {
    if (!user) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('stripeSuccess') === 'true') {
        router.push('/sign-in?redirect=' + encodeURIComponent('/dashboard?stripeSuccess=true'));
      }
    }
  }, [user, router]);

  async function handleManageBilling() {
    if (!user) { router.push('/sign-in'); return; }
    setLoadingPortal(true);
    setError('');
    try {
      const result = await callApi('/stripe/portal', {}) as { success: boolean; url: string };
      if (!result.success) throw new Error('Portal creation failed');
      window.location.href = result.url;
    } catch (err) {
      console.error('Error opening billing portal:', err);
      setError('Failed to open billing portal. Please try again.');
      setLoadingPortal(false);
    }
  }

  async function handleSubscribe(tier: 'basic' | 'pro') {
    if (!user) {
      router.push('/sign-up?redirect=%2Fpricing');
      return;
    }
    const plan = planKey(tier, period);
    setLoadingPlan(plan);
    setError('');
    try {
      const result = await callApi('/stripe/checkout', { plan }) as { url?: string; error?: string };
      if (!result.url) throw new Error(result.error ?? 'No checkout URL returned');
      window.location.href = result.url;
    } catch (err) {
      console.error('Error starting checkout:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  }

  const yearlyDiscount = '17%';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

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

        {/* Existing Subscriber */}
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
          /* New Subscriber */
          <div className="max-w-4xl mx-auto">
            {/* Billing period toggle */}
            <div className="flex items-center justify-center gap-3 mb-10">
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-150 ${
                  period === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface/60 text-foreground-muted hover:text-foreground border border-border/50'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriod('yearly')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-150 ${
                  period === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface/60 text-foreground-muted hover:text-foreground border border-border/50'
                }`}
              >
                Yearly
                <span className="ml-2 text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Save {yearlyDiscount}
                </span>
              </button>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10" aria-label="Plan comparison">
              {/* Basic */}
              <div className="rounded-2xl p-8 bg-surface/60 border border-border/60 flex flex-col">
                <h3 className="text-xl font-bold text-foreground mb-2">Basic</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-foreground">
                    {period === 'monthly' ? '$4.99' : '$49.99'}
                  </span>
                  <span className="text-foreground-muted text-sm">
                    {period === 'monthly' ? '/ month' : '/ year'}
                  </span>
                </div>
                {period === 'yearly' && (
                  <p className="text-sm text-foreground-muted mb-4">billed annually — save {yearlyDiscount}</p>
                )}
                {period === 'monthly' && (
                  <p className="text-sm text-foreground-muted mb-4">or $49.99 / year — save {yearlyDiscount}</p>
                )}
                <ul className="space-y-2 text-sm text-foreground-muted mb-6 flex-1">
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Pantry &amp; inventory tracking</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> AI recipe generation</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Meal planning</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Grocery lists</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> 5-day free trial</li>
                </ul>
                {user ? (
                  <button
                    type="button"
                    onClick={() => handleSubscribe('basic')}
                    disabled={loadingPlan !== null}
                    className="w-full rounded-lg bg-secondary text-secondary-foreground font-semibold px-6 py-3 text-sm hover:bg-secondary-hover disabled:opacity-50 transition-all duration-200"
                  >
                    {loadingPlan === planKey('basic', period) ? 'Redirecting…' : 'Start free trial'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/sign-up?redirect=%2Fpricing')}
                    className="w-full rounded-lg bg-secondary text-secondary-foreground font-semibold px-6 py-3 text-sm hover:bg-secondary-hover transition-all duration-200"
                  >
                    Start free trial
                  </button>
                )}
              </div>

              {/* Pro */}
              <div className="rounded-2xl p-8 bg-surface/60 border border-primary/40 relative flex flex-col">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Most popular</div>
                <h3 className="text-xl font-bold text-foreground mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-foreground">
                    {period === 'monthly' ? '$9.99' : '$99.99'}
                  </span>
                  <span className="text-foreground-muted text-sm">
                    {period === 'monthly' ? '/ month' : '/ year'}
                  </span>
                </div>
                {period === 'yearly' && (
                  <p className="text-sm text-foreground-muted mb-4">billed annually — save {yearlyDiscount}</p>
                )}
                {period === 'monthly' && (
                  <p className="text-sm text-foreground-muted mb-4">or $99.99 / year — save {yearlyDiscount}</p>
                )}
                <ul className="space-y-2 text-sm text-foreground-muted mb-6 flex-1">
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Everything in Basic</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> AI Chef chat (unlimited)</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Advanced meal planning</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> Priority support</li>
                  <li className="flex items-center gap-2"><span className="text-primary">✓</span> 5-day free trial</li>
                </ul>
                {user ? (
                  <button
                    type="button"
                    onClick={() => handleSubscribe('pro')}
                    disabled={loadingPlan !== null}
                    className="w-full rounded-lg bg-primary text-primary-foreground font-semibold px-6 py-3 text-sm hover:bg-primary-hover disabled:opacity-50 transition-all duration-200"
                  >
                    {loadingPlan === planKey('pro', period) ? 'Redirecting…' : 'Start free trial'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/sign-up?redirect=%2Fpricing')}
                    className="w-full rounded-lg bg-primary text-primary-foreground font-semibold px-6 py-3 text-sm hover:bg-primary-hover transition-all duration-200"
                  >
                    Start free trial
                  </button>
                )}
              </div>
            </div>

            {!user && (
              <p className="text-center text-sm text-foreground-muted">
                Already have an account?{' '}
                <Link href="/sign-in?redirect=%2Fpricing" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            )}

            <p className="text-center text-xs text-foreground-muted mt-4">
              Coupon codes can be applied at checkout. When a coupon reduces your total to $0, no payment information is required.
            </p>
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
              answer="Yes! Both monthly and yearly plans accept coupon codes. Click 'Start free trial', then enter your code in the coupon field on the Stripe checkout page. If a coupon reduces your total to $0.00, no payment method is required."
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
