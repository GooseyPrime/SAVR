import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

import {
  buildCheckoutSessionParams,
  findBlockingSubscription,
  findOpenSubscriptionCheckoutSession,
  getSubscriptionPeriodEndUnix,
  loadCustomerBillingSnapshotsByEmail,
  isPlan,
  mapStripeStatusToDatabase,
  pickCurrentSubscription,
  resolvePriceId,
  resolveStripeSubscriptionSnapshot,
  selectCustomerBillingSnapshot,
  TRIAL_PERIOD_DAYS,
} from '../lib/stripe-billing';
import { createCheckoutSessionResponse } from '../app/api/stripe/checkout/route';
import {
  syncStripeSubscriptionPost,
  syncStripeSubscriptionResponse,
} from '../app/api/stripe/sync/route';

process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_YEARLY = 'price_basic_yearly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_YEARLY = 'price_pro_yearly';
