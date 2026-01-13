# E2E Testing with Playwright

This document covers end-to-end testing patterns using Playwright for the Accountability application.

> **See also**: [EFFECT_TESTING.md](./EFFECT_TESTING.md) for unit/integration testing with @effect/vitest.

## Overview

E2E tests verify the complete user flow from browser UI to database and back. They complement the existing unit and integration tests by testing:

- Full authentication flows (registration, login, logout, session management)
- Protected route access and redirects
- Multi-step workflows (journal entries, consolidations)
- Cross-component state management
- API + UI integration

## Tech Stack

| Tool | Purpose |
|------|---------|
| Playwright | Browser automation and E2E testing |
| @playwright/test | Test runner with fixtures |
| Testcontainers | PostgreSQL container for isolated test data |
| TanStack Start | Full-stack app serving (dev/preview modes) |

## Project Structure

```
packages/web/
├── playwright.config.ts      # Playwright configuration
├── tests/
│   ├── fixtures/
│   │   ├── auth.ts           # Authentication helpers
│   │   ├── organizations.ts  # Org/company fixtures
│   │   └── accounts.ts       # Account fixtures
│   ├── auth/
│   │   ├── login.spec.ts     # Login flow tests
│   │   ├── register.spec.ts  # Registration tests
│   │   └── session.spec.ts   # Session management tests
│   ├── companies/
│   │   └── companies.spec.ts # Company CRUD tests
│   ├── accounts/
│   │   └── accounts.spec.ts  # Account management tests
│   └── journal-entries/
│       └── workflow.spec.ts  # Journal entry workflow tests
└── test-results/             # Test artifacts (screenshots, traces)
```

## Configuration

### playwright.config.ts

```typescript
import { defineConfig, devices } from "@playwright/test"

const PORT = process.env.TEST_PORT || 3333
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./tests",

  // Run tests in parallel within files, but files sequentially
  // for shared database state isolation
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ["html", { open: "never" }],
    ["list"]
  ],

  // Global setup/teardown
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",

  use: {
    baseURL,

    // Collect trace when retrying failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Default timeout
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // Web server configuration
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for build
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || "",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Add more browsers for cross-browser testing
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "mobile",
    //   use: { ...devices["iPhone 13"] },
    // },
  ],
})
```

### Global Setup

```typescript
// tests/global-setup.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync } from "child_process"

let container: StartedPostgreSqlContainer

export default async function globalSetup() {
  // Start PostgreSQL container
  container = await new PostgreSqlContainer("postgres:alpine")
    .withDatabase("accountability_test")
    .start()

  const dbUrl = container.getConnectionUri()

  // Run migrations
  execSync(`DATABASE_URL="${dbUrl}" pnpm --filter @accountability/persistence migrate`, {
    stdio: "inherit",
  })

  // Store for tests and teardown
  process.env.TEST_DATABASE_URL = dbUrl
  process.env.TEST_CONTAINER_ID = container.getId()

  return async () => {
    // Teardown: stop container
    await container.stop()
  }
}
```

## Test Fixtures

### Authentication Fixture

```typescript
// tests/fixtures/auth.ts
import { test as base, expect, Page } from "@playwright/test"
import type { SessionId } from "@accountability/core/Auth/SessionId"

export interface TestUser {
  id: string
  email: string
  password: string
  displayName: string
  token: SessionId
}

export interface AuthFixtures {
  testUser: TestUser
  authenticatedPage: Page
}

/**
 * Generate unique test credentials
 */
function generateTestCredentials() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Test User ${random}`,
  }
}

/**
 * Create a test user via API
 */
async function createTestUser(page: Page): Promise<TestUser> {
  const creds = generateTestCredentials()

  // Register user
  const registerResponse = await page.request.post("/api/auth/register", {
    data: {
      email: creds.email,
      password: creds.password,
      displayName: creds.displayName,
    },
  })

  if (!registerResponse.ok()) {
    throw new Error(`Failed to register: ${await registerResponse.text()}`)
  }

  const { user } = await registerResponse.json()

  // Login to get token
  const loginResponse = await page.request.post("/api/auth/login", {
    data: {
      provider: "local",
      credentials: {
        email: creds.email,
        password: creds.password,
      },
    },
  })

  if (!loginResponse.ok()) {
    throw new Error(`Failed to login: ${await loginResponse.text()}`)
  }

  const { token } = await loginResponse.json()

  return {
    id: user.id,
    email: creds.email,
    password: creds.password,
    displayName: creds.displayName,
    token,
  }
}

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  // Create fresh test user for each test
  testUser: async ({ page }, use) => {
    const user = await createTestUser(page)
    await use(user)
    // Cleanup: logout (invalidates session in DB)
    await page.request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${user.token}` },
    })
  },

  // Page with authentication pre-configured
  authenticatedPage: async ({ page, testUser }, use) => {
    // Set token in localStorage
    await page.goto("/")
    await page.evaluate((token) => {
      localStorage.setItem("accountability_auth_token", token)
    }, testUser.token)

    await use(page)
  },
})

export { expect }
```

### Organization Fixture

```typescript
// tests/fixtures/organizations.ts
import { test as authTest, TestUser } from "./auth"
import type { Page } from "@playwright/test"

export interface TestOrganization {
  id: string
  name: string
}

export interface TestCompany {
  id: string
  organizationId: string
  name: string
}

export interface OrgFixtures {
  testOrg: TestOrganization
  testCompany: TestCompany
}

async function createOrganization(
  page: Page,
  token: string,
  name?: string
): Promise<TestOrganization> {
  const response = await page.request.post("/api/v1/organizations", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: name || `Org-${Date.now()}`,
      reportingCurrency: "USD",
    },
  })

  if (!response.ok()) {
    throw new Error(`Failed to create org: ${await response.text()}`)
  }

  return await response.json()
}

async function createCompany(
  page: Page,
  token: string,
  orgId: string,
  name?: string
): Promise<TestCompany> {
  const response = await page.request.post("/api/v1/companies", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      organizationId: orgId,
      name: name || `Company-${Date.now()}`,
      legalName: `${name || "Company"} Inc.`,
      jurisdiction: "US",
      functionalCurrency: "USD",
      reportingCurrency: "USD",
      fiscalYearEnd: { month: 12, day: 31 },
    },
  })

  if (!response.ok()) {
    throw new Error(`Failed to create company: ${await response.text()}`)
  }

  return await response.json()
}

export const test = authTest.extend<OrgFixtures>({
  testOrg: async ({ page, testUser }, use) => {
    const org = await createOrganization(page, testUser.token)
    await use(org)
  },

  testCompany: async ({ page, testUser, testOrg }, use) => {
    const company = await createCompany(page, testUser.token, testOrg.id)
    await use(company)
  },
})

export { expect } from "./auth"
```

## Test Patterns

### Authentication Flow Tests

```typescript
// tests/auth/login.spec.ts
import { test, expect } from "../fixtures/auth"

test.describe("Login Flow", () => {
  test("should login with valid credentials", async ({ page, testUser }) => {
    await page.goto("/login")

    // Fill login form
    await page.fill('[name="email"]', testUser.email)
    await page.fill('[name="password"]', testUser.password)
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await page.waitForURL("/")

    // Should show authenticated UI
    await expect(page.getByTestId("user-menu")).toBeVisible()
  })

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login")

    await page.fill('[name="email"]', "wrong@example.com")
    await page.fill('[name="password"]', "wrongpassword")
    await page.click('button[type="submit"]')

    // Should show error
    await expect(page.getByRole("alert")).toContainText("Invalid email or password")

    // Should stay on login page
    await expect(page).toHaveURL("/login")
  })

  test("should redirect to requested page after login", async ({ page, testUser }) => {
    // Try to access protected page
    await page.goto("/companies")

    // Should redirect to login with redirect param
    await page.waitForURL(/\/login\?redirect=/)

    // Login
    await page.fill('[name="email"]', testUser.email)
    await page.fill('[name="password"]', testUser.password)
    await page.click('button[type="submit"]')

    // Should redirect back to companies
    await page.waitForURL("/companies")
  })
})
```

### Protected Resource Tests

```typescript
// tests/companies/companies.spec.ts
import { test, expect } from "../fixtures/organizations"

test.describe("Companies Management", () => {
  test("should list companies for organization", async ({
    authenticatedPage,
    testOrg,
    testCompany
  }) => {
    await authenticatedPage.goto("/companies")

    // Should show company in list
    await expect(authenticatedPage.getByText(testCompany.name)).toBeVisible()
  })

  test("should create new company", async ({ authenticatedPage, testOrg }) => {
    await authenticatedPage.goto("/companies")
    await authenticatedPage.click('button:has-text("New Company")')

    // Fill form
    const companyName = `New Company ${Date.now()}`
    await authenticatedPage.fill('[name="name"]', companyName)
    await authenticatedPage.fill('[name="legalName"]', `${companyName} Inc.`)
    await authenticatedPage.selectOption('[name="jurisdiction"]', "US")
    await authenticatedPage.click('button[type="submit"]')

    // Should show success and new company in list
    await expect(authenticatedPage.getByText(companyName)).toBeVisible()
  })

  test("should require authentication for companies API", async ({ page }) => {
    // Direct API call without auth
    const response = await page.request.get("/api/v1/companies")
    expect(response.status()).toBe(401)
  })
})
```

### Session Management Tests

```typescript
// tests/auth/session.spec.ts
import { test, expect } from "../fixtures/auth"

test.describe("Session Management", () => {
  test("should maintain session across page navigations", async ({
    authenticatedPage,
    testUser
  }) => {
    // Navigate to different pages
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()

    await authenticatedPage.goto("/companies")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()

    await authenticatedPage.goto("/reports")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()
  })

  test("should logout and clear session", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/")

    // Open user menu and logout
    await authenticatedPage.click('[data-testid="user-menu"]')
    await authenticatedPage.click('text=Logout')

    // Should redirect to login
    await authenticatedPage.waitForURL("/login")

    // Token should be cleared
    const token = await authenticatedPage.evaluate(() =>
      localStorage.getItem("accountability_auth_token")
    )
    expect(token).toBeNull()
  })

  test("should handle expired session gracefully", async ({
    authenticatedPage,
    testUser
  }) => {
    await authenticatedPage.goto("/")

    // Invalidate session via API (simulating expiry)
    await authenticatedPage.request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${testUser.token}` },
    })

    // Next API call should fail and redirect to login
    await authenticatedPage.goto("/companies")
    await authenticatedPage.waitForURL(/\/login/)
  })
})
```

### API Integration Tests

```typescript
// tests/api/organizations.spec.ts
import { test, expect } from "../fixtures/auth"

test.describe("Organizations API", () => {
  test("should create and list organizations", async ({ page, testUser }) => {
    const headers = { Authorization: `Bearer ${testUser.token}` }

    // Create organization
    const createResponse = await page.request.post("/api/v1/organizations", {
      headers,
      data: {
        name: "Test Org",
        reportingCurrency: "USD",
      },
    })

    expect(createResponse.ok()).toBe(true)
    const org = await createResponse.json()
    expect(org.name).toBe("Test Org")

    // List organizations
    const listResponse = await page.request.get("/api/v1/organizations", {
      headers,
    })

    expect(listResponse.ok()).toBe(true)
    const { organizations } = await listResponse.json()
    expect(organizations.some((o: any) => o.id === org.id)).toBe(true)
  })

  test("should return 401 without authentication", async ({ page }) => {
    const response = await page.request.get("/api/v1/organizations")
    expect(response.status()).toBe(401)

    const body = await response.json()
    expect(body._tag).toBe("UnauthorizedError")
  })
})
```

## Running Tests

```bash
# Run all E2E tests
pnpm --filter @accountability/web test:e2e

# Run specific test file
pnpm --filter @accountability/web test:e2e tests/auth/login.spec.ts

# Run tests in headed mode (see browser)
pnpm --filter @accountability/web test:e2e --headed

# Run tests with UI mode (interactive)
pnpm --filter @accountability/web test:e2e --ui

# Debug specific test
pnpm --filter @accountability/web test:e2e --debug tests/auth/login.spec.ts

# Generate and view HTML report
pnpm --filter @accountability/web test:e2e --reporter=html
npx playwright show-report
```

## CI Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm --filter @accountability/web exec playwright install --with-deps chromium

      - name: Build
        run: pnpm build

      - name: Run E2E tests
        run: pnpm --filter @accountability/web test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: packages/web/playwright-report/
          retention-days: 7
```

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on state from other tests:

```typescript
// GOOD: Create fresh data for each test
test("should create account", async ({ authenticatedPage, testCompany }) => {
  // testCompany is fresh for this test
})

// BAD: Relying on data from previous test
test("should list accounts", async ({ authenticatedPage }) => {
  // Assumes accounts were created in previous test
})
```

### 2. Use API for Setup, UI for Assertions

```typescript
// GOOD: Fast setup via API, verify in UI
test("should display created account", async ({
  authenticatedPage,
  testUser,
  testCompany
}) => {
  // Create via API (fast)
  await authenticatedPage.request.post("/api/v1/accounts", {
    headers: { Authorization: `Bearer ${testUser.token}` },
    data: {
      companyId: testCompany.id,
      accountNumber: "1000",
      name: "Cash",
      accountType: "Asset",
      accountCategory: "CurrentAsset",
      normalBalance: "Debit",
    },
  })

  // Verify in UI
  await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)
  await expect(authenticatedPage.getByText("Cash")).toBeVisible()
})
```

### 3. Use data-testid for Stability

```typescript
// GOOD: Stable selector
await page.click('[data-testid="submit-button"]')

// BAD: Fragile selectors
await page.click('button.primary-btn.submit')
await page.click('text=Submit')  // May match multiple elements
```

### 4. Wait for Network Idle

```typescript
// Wait for API calls to complete
await page.waitForLoadState("networkidle")

// Or wait for specific response
await Promise.all([
  page.waitForResponse("/api/v1/accounts"),
  page.click('button[type="submit"]'),
])
```

### 5. Handle Flaky Tests

```typescript
// Retry flaky assertions
await expect(async () => {
  const response = await page.request.get("/api/v1/accounts")
  expect(response.ok()).toBe(true)
}).toPass({ timeout: 5000 })

// Use appropriate timeouts
await expect(page.getByText("Loading...")).toBeHidden({ timeout: 10000 })
```

## Debugging

### Trace Viewer

```bash
# Run with trace
pnpm --filter @accountability/web test:e2e --trace on

# View trace
npx playwright show-trace test-results/*/trace.zip
```

### Debug Mode

```bash
# Step through test
pnpm --filter @accountability/web test:e2e --debug

# Pause at specific point
await page.pause()  // In test code
```

### Screenshots

```typescript
// Take screenshot during test
await page.screenshot({ path: "debug-screenshot.png" })

// Full page screenshot
await page.screenshot({ path: "full-page.png", fullPage: true })
```
