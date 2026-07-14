import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const shouldStartWebServer =
  process.env.PLAYWRIGHT_USE_WEBSERVER === 'true' || (!process.env.CI && !process.env.BASE_URL);

export default defineConfig({
  testDir: './',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: shouldStartWebServer
    ? {
        command: 'cd ../web && npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
