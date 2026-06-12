import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Teskel end-to-end smoke tests.
 *
 * IMPORTANT — these tests are NOT run in CI by default and CANNOT run without a
 * fully provisioned environment. Before `npm run test:e2e` you MUST have:
 *   1. Postgres running        ->  npm run db:up   (docker compose, host :5433)
 *   2. Schema + demo data      ->  npm run db:migrate && npm run db:seed
 *   3. The app running on 3000 ->  npm run dev   (or npm run build && start)
 *   4. (optional) OPENAI_API_KEY set so the AI-dependent steps execute;
 *      without it those steps assert the "AI is not configured" path instead.
 *
 * The `webServer` block below is intentionally commented out: starting the app
 * automatically requires the database to be migrated first, which we cannot do
 * from the test runner. Start the app yourself, then run the e2e suite.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Uncomment to let Playwright start the app automatically. This only works
  // once the database has been migrated AND seeded (see notes above).
  //
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
