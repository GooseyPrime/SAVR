import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer:
    process.env.PLAYWRIGHT_USE_WEBSERVER === 'true' || (!process.env.CI && !process.env.BASE_URL)
      ? {
          command: 'cd ../web && npm run dev',
          url: process.env.BASE_URL || 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
        }
      : undefined,
});
