import { expect, test } from '@playwright/test';

test.describe('public smoke coverage', () => {
  test('landing page renders the primary marketing CTA', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /cook smarter\./i })).toBeVisible();
    await expect(page.getByRole('link', { name: /start free trial/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view pricing/i })).toBeVisible();
  });

  test('pricing page keeps logged-out users on the sign-in path', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: /simple, transparent/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in to continue/i })).toBeVisible();
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
