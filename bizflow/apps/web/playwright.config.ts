import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local for local execution
dotenv.config({ path: path.resolve(__dirname, '.env.local') })
// Fallback to .env
dotenv.config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  testDir: './tests',
  testMatch: [
    'tests/api/**/*.spec.ts',
    'tests/e2e/**/*.spec.ts',
  ],
  globalSetup: require.resolve('./tests/setup/global-setup.ts'),
  fullyParallel: false,        // API tests share DB state — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,                   // Sequential — tests depend on seed data
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
    trace: 'on-first-retry',
  },

  projects: [
    // API tests — no browser needed, uses request context only
    {
      name: 'api',
      testMatch: 'tests/api/**/*.spec.ts',
      use: {
        // No browser — API tests use request context
      },
    },
    // E2E browser tests
    {
      name: 'e2e-chromium',
      testMatch: 'tests/e2e/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start Next.js dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '',
      NEXTAUTH_SECRET: 'test-secret-minimum-32-characters-for-ci',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
  },
})
