/**
 * Authentication Test Fixtures
 *
 * Provides reusable fixtures for authenticated E2E tests:
 * - testUser: Creates a fresh user via API, returns credentials and token
 * - authenticatedPage: Page with auth token pre-configured in localStorage
 *
 * Includes cleanup (logout) after each test to invalidate sessions.
 *
 * @module test-e2e/fixtures/auth
 */

import { test as base, expect, type Page } from "@playwright/test"

// =============================================================================
// Types
// =============================================================================

/**
 * Test credentials for creating users
 */
export interface TestCredentials {
  email: string
  password: string
  displayName: string
}

/**
 * Test user with credentials and session token
 */
export interface TestUser {
  id: string
  email: string
  password: string
  displayName: string
  token: string
}

/**
 * Auth fixtures available in tests
 */
export interface AuthFixtures {
  /** Fresh test user created via API */
  testUser: TestUser
  /** Page with auth token pre-configured in localStorage */
  authenticatedPage: Page
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique test credentials for user registration
 *
 * Creates a unique email using timestamp and random suffix to avoid
 * collisions between parallel test runs or repeated executions.
 *
 * @returns Test credentials with unique email, strong password, and display name
 */
export function generateTestCredentials(): TestCredentials {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Test User ${random}`
  }
}

/**
 * Create a test user via the API
 *
 * Registers a new user with local provider and then logs in to get a session token.
 * The returned TestUser contains both credentials (for re-login) and the token.
 *
 * @param page - Playwright page to use for API requests
 * @returns TestUser with id, credentials, and session token
 * @throws Error if registration or login fails
 */
export async function createTestUser(page: Page): Promise<TestUser> {
  const creds = generateTestCredentials()

  // Register the user via POST /api/auth/register
  const registerResponse = await page.request.post("/api/auth/register", {
    data: {
      email: creds.email,
      password: creds.password,
      displayName: creds.displayName
    }
  })

  if (!registerResponse.ok()) {
    const errorText = await registerResponse.text()
    throw new Error(`Failed to register test user: ${registerResponse.status()} - ${errorText}`)
  }

  const registerResult = await registerResponse.json()
  const userId = registerResult.user.id

  // Login to get session token via POST /api/auth/login
  const loginResponse = await page.request.post("/api/auth/login", {
    data: {
      provider: "local",
      credentials: {
        email: creds.email,
        password: creds.password
      }
    }
  })

  if (!loginResponse.ok()) {
    const errorText = await loginResponse.text()
    throw new Error(`Failed to login test user: ${loginResponse.status()} - ${errorText}`)
  }

  const loginResult = await loginResponse.json()

  return {
    id: userId,
    email: creds.email,
    password: creds.password,
    displayName: creds.displayName,
    token: loginResult.token
  }
}

/**
 * Logout a test user to invalidate their session
 *
 * @param page - Playwright page to use for API request
 * @param token - Session token to invalidate
 */
async function logoutTestUser(page: Page, token: string): Promise<void> {
  try {
    await page.request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch {
    // Ignore logout errors - session may already be invalid
    // This is cleanup code and shouldn't fail tests
  }
}

// =============================================================================
// Fixtures
// =============================================================================

/**
 * Extended test with authentication fixtures
 *
 * Usage:
 * ```ts
 * import { test, expect } from "./fixtures/auth"
 *
 * test("should access protected resource", async ({ authenticatedPage, testUser }) => {
 *   await authenticatedPage.goto("/companies")
 *   await expect(authenticatedPage.getByText(testUser.displayName)).toBeVisible()
 * })
 * ```
 */
export const test = base.extend<AuthFixtures>({
  /**
   * testUser fixture - creates a fresh user for each test
   *
   * Creates a new user via the registration API, logs in to get a session token,
   * and provides both credentials and token. After the test, the session is
   * invalidated via logout.
   */
  testUser: async ({ page }, use) => {
    const user = await createTestUser(page)
    await use(user)
    // Cleanup: logout to invalidate session
    await logoutTestUser(page, user.token)
  },

  /**
   * authenticatedPage fixture - page with auth token pre-configured
   *
   * Depends on testUser fixture. Navigates to root, sets the auth token in
   * localStorage, and provides the page for authenticated interactions.
   */
  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to the app to ensure localStorage is accessible for the domain
    await page.goto("/")

    // Set auth token in localStorage
    await page.evaluate((token) => {
      localStorage.setItem("accountability_auth_token", token)
    }, testUser.token)

    await use(page)
  }
})

/**
 * Re-export expect from base test for convenience
 */
export { expect }
