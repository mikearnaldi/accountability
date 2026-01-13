import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E test configuration
 *
 * Tests run against the built app with a testcontainers PostgreSQL instance.
 * Global setup starts the container and runs migrations, global teardown stops it.
 */

const TEST_PORT = 3333
const baseURL = `http://localhost:${TEST_PORT}`

export default defineConfig({
  testDir: "./test-e2e",

  // Run tests sequentially for database state isolation
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [["html", { open: "never" }], ["list"]],

  // Global setup/teardown for testcontainers
  globalSetup: "./test-e2e/global-setup.ts",
  globalTeardown: "./test-e2e/global-teardown.ts",

  // Timeout for each test
  timeout: 30000,

  // Timeout for expect assertions
  expect: {
    timeout: 5000
  },

  use: {
    baseURL,

    // Collect trace when retrying failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Default timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000
  },

  // Web server configuration - builds and runs preview server
  // The start-server.sh script reads DATABASE_URL from .env.test
  webServer: {
    command: `bash test-e2e/start-server.sh`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // 3 minutes for build
    env: {
      TEST_PORT: String(TEST_PORT),
      NODE_ENV: "production"
    }
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
})
