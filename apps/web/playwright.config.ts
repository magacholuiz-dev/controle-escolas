import { defineConfig, devices } from '@playwright/test';

const MONGO = process.env.MONGO_TEST_HOST ?? 'mongodb://127.0.0.1:27019';

// End-to-end: a real Nest API on a throwaway database + the built Next app in front of it, driven by a
// real Chromium. `npm run build` (root) must have run first.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3310', trace: 'retain-on-failure', locale: 'pt-BR' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-api.mjs',
      url: 'http://127.0.0.1:3210/api/auth/me',
      // 401 is a valid "it's up" answer
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { MONGO_TEST_HOST: MONGO },
    },
    {
      command: 'NEXT_DIST_DIR=.next-e2e API_URL=http://127.0.0.1:3210 npx next build && NEXT_DIST_DIR=.next-e2e API_URL=http://127.0.0.1:3210 npx next start -p 3310',
      url: 'http://127.0.0.1:3310/login',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
