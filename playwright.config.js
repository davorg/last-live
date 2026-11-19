import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/last-live/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-development',
      testMatch: '**/storage.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4174/last-live/',
      },
    },
  ],
  webServer: [
    {
      command: 'npm run build -- --outDir .test-dist && npm run preview -- --outDir .test-dist --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/last-live/',
      // A separate production build keeps test credentials out of deployable dist/.
      env: { VITE_LASTFM_API_KEY: 'last-live-test-key' },
      reuseExistingServer: false,
    },
    {
      command: 'node tests/dev-server.js',
      url: 'http://127.0.0.1:4174/last-live/',
      env: { VITE_LASTFM_API_KEY: 'last-live-test-key' },
      reuseExistingServer: false,
    },
  ],
});
