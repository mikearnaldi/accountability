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

  // Run tests in parallel - each test creates its own isolated data
  fullyParallel: true,
  workers: process.env.CI ? 2 : "50%",

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry failed tests (helps with flaky tests due to timing/parallelism issues)
  retries: process.env.CI ? 2 : 1,

  // Reporter configuration
  // Default: 'dot' shows minimal output (dots for passes, details only for failures)
  // Use --reporter=list for verbose output showing all tests
  reporter: process.env.VERBOSE
    ? [["html", { open: "never" }], ["list"]]
    : [["html", { open: "never" }], ["dot"]],

  // Global teardown for cleanup (setup is done by webServer command)
  globalTeardown: "./test-e2e/global-teardown.ts",

  // Timeout for each test (increased for CI)
  timeout: process.env.CI ? 60000 : 30000,

  // Timeout for expect assertions (increased for CI due to slower rendering)
  expect: {
    timeout: process.env.CI ? 10000 : 5000
  },

  use: {
    baseURL,

    // Collect trace when retrying failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure for debugging CI issues
    video: process.env.CI ? "on-first-retry" : "off",

    // Default timeouts (increased for CI)
    actionTimeout: process.env.CI ? 15000 : 10000,
    navigationTimeout: process.env.CI ? 45000 : 30000
  },

  // Web server configuration - global-setup handles container, migrations, build, and server
  webServer: {
    command: `npx tsx test-e2e/global-setup.ts`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300000, // 5 minutes for container + build + server start
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
