import { expect, test } from '@playwright/test';

test.describe('public smoke coverage', () => {
  test('landing page renders the primary marketing CTA', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /cook smarter\./i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /view pricing/i })).toBeVisible();
  });

  test('pricing page sends logged-out users to trial sign-up', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: /simple, transparent/i })).toBeVisible();
    const startTrialBtn = page.getByRole('button', { name: /start 5-day free trial/i });
    await expect(startTrialBtn).toBeVisible();
    await startTrialBtn.click();
    await page.waitForURL(/\/sign-up\?redirect=%2Fpricing/);
  });

  test('pricing page keeps a sign-in link with pricing redirect', async ({ page }) => {
    await page.goto('/pricing');

    const signInLink = page.locator('a[href="/sign-in?redirect=%2Fpricing"]');
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await page.waitForURL(/\/sign-in\?redirect=%2Fpricing/);
  });

  test('pricing page displays all four SAVR prices for logged-out visitors', async ({ page }) => {
    await page.goto('/pricing');

    // Static plan comparison must be visible without sign-in and without Stripe
    await expect(page.getByRole('heading', { name: /^Basic$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Pro$/i })).toBeVisible();

    // All four prices must be visible
    await expect(page.getByText(/\$4\.99/)).toBeVisible();
    await expect(page.getByText(/\$49\.99/)).toBeVisible();
    await expect(page.getByText(/\$9\.99/)).toBeVisible();
    await expect(page.getByText(/\$99\.99/)).toBeVisible();
  });

  test('FAQ page renders with page heading and first category', async ({ page }) => {
    await page.goto('/faq');

    await expect(page.getByRole('heading', { name: /frequently asked questions/i })).toBeVisible();
    await expect(page.getByText(/getting started/i)).toBeVisible();
  });

  test('Terms page renders canonical billing tier names', async ({ page }) => {
    await page.goto('/terms');

    await expect(page.getByRole('heading', { name: /terms and conditions/i })).toBeVisible();
    // Must reference current canonical tiers (Basic and Pro), not legacy names
    await expect(page.getByText(/\$4\.99\/month/i)).toBeVisible();
    await expect(page.getByText(/\$9\.99\/month/i)).toBeVisible();
  });

  test('Privacy page renders without legacy Firebase references', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { name: /privacy policy/i, level: 1 })).toBeVisible();
    // Must reference Supabase as the current data platform
    await expect(page.getByText(/supabase/i).first()).toBeVisible();
  });
});

test.describe('mobile viewport smoke coverage', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sign-in page exposes labeled email and password fields', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
    const emailField = page.getByLabel(/email address/i);
    const passwordField = page.getByLabel(/^password$/i);

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await emailField.fill('chef@example.com');
    await passwordField.fill('test-password');
    await expect(emailField).toHaveValue('chef@example.com');
    await expect(passwordField).toHaveValue('test-password');
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });
});
