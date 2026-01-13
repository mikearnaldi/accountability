import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E test configuration
 *
 * Tests run against the production Docker Compose stack.
 * Global setup starts the containers, global teardown stops them.
 */
export default defineConfig({
  testDir: "./test-e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },

  globalSetup: "./test-e2e/global-setup.ts",
  globalTeardown: "./test-e2e/global-teardown.ts",

  // Timeout for each test
  timeout: 30000,

  // Timeout for expect assertions
  expect: {
    timeout: 5000
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
})
