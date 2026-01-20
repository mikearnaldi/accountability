# Testing Guide

This is the consolidated guide for testing in the Accountability project, covering unit tests, integration tests, and E2E tests.

---

## Table of Contents

1. [Overview](#overview)
2. [Unit & Integration Tests (@effect/vitest)](#unit--integration-tests-effectvitest)
3. [E2E Tests (Playwright)](#e2e-tests-playwright)
4. [Test Data Patterns](#test-data-patterns)
5. [CI Integration](#ci-integration)
6. [Running Tests](#running-tests)

---

## Overview

| Test Type | Framework | Location | Purpose |
|-----------|-----------|----------|---------|
| Unit | @effect/vitest | `packages/*/test/*.test.ts` | Test individual functions, services |
| Integration | @effect/vitest | `packages/*/test/*.test.ts` | Test services with real database |
| E2E | Playwright | `packages/web/tests/*.spec.ts` | Test full user flows in browser |

**Coverage Target:**
- Route coverage: ~95%
- Critical flows: ~100%
- Error handling: ~80%
- Total E2E tests: 250+

---

## Unit & Integration Tests (@effect/vitest)

For comprehensive Effect testing patterns, see [effect-guide.md](./effect-guide.md#testing-patterns-effectvitest).

### Quick Reference

```typescript
import { describe, expect, it, layer } from "@effect/vitest"
import { Effect, TestClock, Fiber, Duration } from "effect"
```

### Test Variants

| Method | TestServices | Use Case |
|--------|--------------|----------|
| `it.effect` | TestClock | Most tests - deterministic time |
| `it.live` | Real clock | Tests needing real time/IO |
| `it.scoped` | TestClock | Tests with resources |

### Basic Example

```typescript
it.effect("processes after delay", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(
      Effect.sleep(Duration.minutes(5)).pipe(Effect.map(() => "done"))
    )
    yield* TestClock.adjust(Duration.minutes(5))
    const result = yield* Fiber.join(fiber)
    expect(result).toBe("done")
  })
)
```

### Shared Layers

```typescript
layer(AccountServiceLive)("AccountService", (it) => {
  it.effect("finds account by id", () =>
    Effect.gen(function* () {
      const service = yield* AccountService
      const account = yield* service.findById(testAccountId)
      expect(account.name).toBe("Test")
    })
  )
})
```

### Database Testing

Use the shared PostgreSQL container from global setup:

```typescript
// In tests - container URL is injected via vitest's inject()
const TestLayer = RepositoriesLayer.pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(SharedPgClientLive)  // Uses global container
)

it.layer(TestLayer, { timeout: "30 seconds" })("Repository", (it) => {
  it.effect("creates and retrieves", () =>
    Effect.gen(function*() {
      const sql = yield* PgClient.PgClient
      // Test code...
    })
  )
})
```

---

## E2E Tests (Playwright)

### Project Structure

```
packages/web/
├── playwright.config.ts
├── tests/
│   ├── fixtures/
│   │   ├── auth.ts           # Authentication helpers
│   │   ├── organizations.ts  # Org/company fixtures
│   │   └── accounts.ts       # Account fixtures
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── register.spec.ts
│   ├── companies/
│   │   └── companies.spec.ts
│   └── journal-entries/
│       └── workflow.spec.ts
└── test-results/
```

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,  // Sequential for shared DB
  workers: 1,
  retries: process.env.CI ? 2 : 0,

  globalSetup: "./tests/global-setup.ts",

  use: {
    baseURL: "http://localhost:3333",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  webServer: {
    command: `pnpm build && pnpm preview --port 3333`,
    url: "http://localhost:3333",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

### Authentication Fixture

```typescript
// tests/fixtures/auth.ts
export interface TestUser {
  id: string
  email: string
  password: string
  displayName: string
  token: SessionId
}

function generateTestCredentials() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Test User ${random}`,
  }
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({ page }, use) => {
    const user = await createTestUser(page)
    await use(user)
    // Cleanup
    await page.request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${user.token}` },
    })
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    await page.goto("/")
    await page.evaluate((token) => {
      localStorage.setItem("accountability_auth_token", token)
    }, testUser.token)
    await use(page)
  },
})
```

### CRITICAL: Use data-testid for Element Selection

**ALL element selection in E2E tests MUST use `data-testid` attributes.**

```typescript
// CORRECT: Always use data-testid
await page.click('[data-testid="submit-button"]')
await page.fill('[data-testid="login-email-input"]', email)
await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

// WRONG: CSS class selectors - fragile
await page.click('button.primary-btn.submit')

// WRONG: Text selectors - break on copy changes
await page.click('text=Submit')

// WRONG: Structural selectors - break on DOM changes
await page.click('form > div:nth-child(2) > button')
```

**Naming conventions:**
- Use kebab-case: `data-testid="submit-button"`
- Be descriptive: `data-testid="organization-list"`
- Include context: `data-testid="login-email-input"`
- For lists: `data-testid="account-row-{id}"`

**Component implementation:**
```tsx
function LoginForm() {
  return (
    <form data-testid="login-form">
      <input data-testid="login-email-input" type="email" />
      <input data-testid="login-password-input" type="password" />
      <button data-testid="login-submit-button" type="submit">
        Log In
      </button>
    </form>
  )
}
```

### Test Patterns

#### Authentication Flow

```typescript
test("should login with valid credentials", async ({ page, testUser }) => {
  await page.goto("/login")
  await page.fill('[data-testid="login-email-input"]', testUser.email)
  await page.fill('[data-testid="login-password-input"]', testUser.password)
  await page.click('[data-testid="login-submit-button"]')

  await page.waitForURL("/")
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
})
```

#### Protected Resource

```typescript
test("should create new company", async ({ authenticatedPage, testOrg }) => {
  await authenticatedPage.goto("/companies")
  await authenticatedPage.click('[data-testid="new-company-button"]')

  const companyName = `New Company ${Date.now()}`
  await authenticatedPage.fill('[data-testid="company-name-input"]', companyName)
  await authenticatedPage.click('[data-testid="submit-button"]')

  await expect(authenticatedPage.getByText(companyName)).toBeVisible()
})
```

#### Use API for Setup, UI for Assertions

```typescript
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
    },
  })

  // Verify in UI
  await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)
  await expect(authenticatedPage.getByText("Cash")).toBeVisible()
})
```

---

## Test Data Patterns

### Unique Identifiers

Always use timestamps and random strings for test data to avoid collisions:

```typescript
const timestamp = Date.now()
const random = Math.random().toString(36).slice(2, 8)

const testEmail = `test-${timestamp}-${random}@example.com`
const testOrgName = `Org-${timestamp}-${random}`
```

### Test Isolation

Each test should be independent:

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

### Fixture Cleanup

```typescript
export const test = base.extend<AuthFixtures>({
  testUser: async ({ page }, use) => {
    const user = await createTestUser(page)
    await use(user)
    // Cleanup after test
    await page.request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${user.token}` },
    })
  },
})
```

---

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

      - run: pnpm install
      - run: pnpm --filter @accountability/web exec playwright install --with-deps chromium
      - run: pnpm build
      - run: pnpm --filter @accountability/web test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: packages/web/playwright-report/
          retention-days: 7
```

---

## Running Tests

### Unit/Integration Tests

```bash
# Run all tests (minimal output - dots for passes, details for failures)
pnpm test

# Run with full output (all test names)
pnpm test:verbose

# Run with coverage
pnpm test:coverage

# Run specific package
pnpm --filter @accountability/core test

# Run specific test file
pnpm test packages/core/test/Account.test.ts
```

### E2E Tests

```bash
# Run all E2E tests (minimal output)
pnpm test:e2e

# Run with full output
pnpm test:e2e:verbose

# Run with interactive UI
pnpm test:e2e:ui

# View report
pnpm test:e2e:report

# Run specific test file
pnpm test:e2e --grep "login"

# Run in headed mode (see browser)
pnpm test:e2e --headed

# Debug specific test
pnpm test:e2e --debug tests/auth/login.spec.ts
```

### Debugging

```bash
# Run with trace
pnpm test:e2e --trace on

# View trace
npx playwright show-trace test-results/*/trace.zip
```

```typescript
// Pause at specific point in test
await page.pause()

// Take screenshot
await page.screenshot({ path: "debug.png" })
```

---

## Current Test Coverage

**Total Tests:** 261 tests (259 passed, 2 skipped)

### E2E Test Files

| Test File | Coverage Area | Tests |
|-----------|---------------|-------|
| auth.spec.ts | Authentication basics | - |
| login.spec.ts | Login flows | - |
| register.spec.ts | Registration flows | - |
| organizations.spec.ts | Organization CRUD | - |
| companies-list.spec.ts | Company list | - |
| accounts.spec.ts | Chart of accounts CRUD | - |
| journal-entries.spec.ts | Journal entry CRUD | - |
| consolidation.spec.ts | Consolidation groups | 12 |
| exchange-rates.spec.ts | Exchange rates | 11 |
| intercompany.spec.ts | Intercompany transactions | 12 |
| reports.spec.ts | Financial reports | 13 |
| audit-log.spec.ts | Audit log | 10 |
| profile.spec.ts | User profile | 8 |
| error-states.spec.ts | Error handling | 16 |

### Skipped Tests

2 tests are intentionally skipped in `organizations.spec.ts`:
1. "should auto-redirect when user has only one organization"
2. "should show empty state when user has no organizations"

**Reason:** Organizations are currently globally visible (not user-scoped). These tests require architectural changes to implement user-scoped organization ownership.
