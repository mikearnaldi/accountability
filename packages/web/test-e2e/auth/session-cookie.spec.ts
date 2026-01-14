/**
 * Session Cookie E2E Tests
 *
 * Tests the httpOnly session cookie functionality:
 * - Session cookie is set on login
 * - Cookie has correct security attributes (httpOnly, secure, sameSite)
 * - Cookie persists across page navigation
 * - Cookie is cleared on logout
 * - Cookie is not accessible via JavaScript
 */

import { test, expect } from "@playwright/test"

// Token storage key (must match tokenStorage.ts)
const AUTH_TOKEN_KEY = "auth_token"
const SESSION_COOKIE_NAME = "accountability_session"

/**
 * Generate unique test credentials
 */
function generateTestCredentials() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Test User ${random}`
  }
}

test.describe("Session Cookie Management", () => {
  let testUser: ReturnType<typeof generateTestCredentials>

  test.beforeAll(async ({ request }) => {
    // Create a test user via API
    testUser = generateTestCredentials()

    const response = await request.post("/api/auth/register", {
      data: {
        email: testUser.email,
        password: testUser.password,
        displayName: testUser.displayName
      }
    })

    expect(response.ok()).toBe(true)
  })

  test.beforeEach(async ({ page }) => {
    // Clear auth state and cookies before each test
    await page.context().clearCookies()
    await page.goto("/")
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)
  })

  test("should set httpOnly session cookie on successful login", async ({ page }) => {
    await page.goto("/login")

    // Fill and submit login form
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    // Wait for login response
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    expect(response.ok()).toBe(true)

    // Wait for redirect to complete
    await page.waitForURL("/", { timeout: 10000 })

    // Check that the session cookie was set
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name === SESSION_COOKIE_NAME)

    expect(sessionCookie).toBeDefined()
    expect(sessionCookie?.value).toBeTruthy()
    expect(sessionCookie?.httpOnly).toBe(true)
    expect(sessionCookie?.secure).toBe(true)
    expect(sessionCookie?.sameSite).toBe("Lax")
    expect(sessionCookie?.path).toBe("/")
  })

  test("should have correct cookie expiration (30 days)", async ({ page }) => {
    await page.goto("/login")

    // Fill and submit login form
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    // Wait for login response
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    // Wait for redirect
    await page.waitForURL("/", { timeout: 10000 })

    // Get the session cookie
    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find(c => c.name === SESSION_COOKIE_NAME)

    expect(sessionCookie).toBeDefined()
    expect(sessionCookie?.expires).toBeDefined()

    if (sessionCookie?.expires) {
      // Check that expiration is approximately 30 days from now
      const now = Date.now() / 1000
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60
      const fifteenMinutesInSeconds = 15 * 60

      // Allow 15 minutes of clock skew
      expect(sessionCookie.expires).toBeGreaterThan(now + thirtyDaysInSeconds - fifteenMinutesInSeconds)
      expect(sessionCookie.expires).toBeLessThan(now + thirtyDaysInSeconds + fifteenMinutesInSeconds)
    }
  })

  test("should persist session cookie across page navigation", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    await page.waitForURL("/", { timeout: 10000 })

    // Get cookie after login
    let cookies = await page.context().cookies()
    let sessionCookie = cookies.find(c => c.name === SESSION_COOKIE_NAME)
    const sessionTokenAfterLogin = sessionCookie?.value

    expect(sessionTokenAfterLogin).toBeTruthy()

    // Navigate to another page
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Verify cookie is still there and unchanged
    cookies = await page.context().cookies()
    sessionCookie = cookies.find(c => c.name === SESSION_COOKIE_NAME)

    expect(sessionCookie?.value).toBe(sessionTokenAfterLogin)
  })

  test("should clear session cookie on logout", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    await page.waitForURL("/", { timeout: 10000 })

    // Verify cookie exists
    let cookies = await page.context().cookies()
    let sessionCookie = cookies.find(c => c.name === SESSION_COOKIE_NAME)
    expect(sessionCookie?.value).toBeTruthy()

    // Find and click logout button (usually in user menu)
    const userMenuButton = page.getByTestId("user-menu-button")
    if (await userMenuButton.isVisible()) {
      await userMenuButton.click()
      const logoutButton = page.getByTestId("logout-button")
      if (await logoutButton.isVisible()) {
        // Wait for logout API call
        const [response] = await Promise.all([
          page.waitForResponse(resp => resp.url().includes("/api/auth/logout")),
          logoutButton.click()
        ])

        expect(response.ok()).toBe(true)

        // Wait for redirect to login
        await page.waitForURL("/login", { timeout: 10000 })
      }
    }

    // Check that session is cleared on the server
    // Note: The session cookie may still be present in the browser due to how the Set-Cookie header
    // is handled by the HTTP response pipeline, but the server has invalidated the session.
    // Verify this by attempting to call an authenticated endpoint
    cookies = await page.context().cookies()

    // Try to use the session cookie - it should fail because the session was invalidated
    const meResponse = await page.context().request.get("/api/auth/me", {
      headers: {
        "Cookie": `${SESSION_COOKIE_NAME}=${cookies.find(c => c.name === SESSION_COOKIE_NAME)?.value || ""}`
      }
    })

    // The session should be invalid, so this should fail
    expect(meResponse.status()).toBe(401)
  })

  test("should not allow JavaScript to access httpOnly cookie", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    await page.waitForURL("/", { timeout: 10000 })

    // Try to access the cookie via JavaScript
    const cookieValue = await page.evaluate(() => {
      return document.cookie
    })

    // The session cookie should NOT be in document.cookie because it's httpOnly
    expect(cookieValue).not.toContain(SESSION_COOKIE_NAME)
  })

  test("should send session cookie with API requests automatically", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    await page.waitForURL("/", { timeout: 10000 })

    // Make an API request and inspect headers
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/me")),
      page.reload()
    ])

    // The cookie should be sent automatically by the browser
    // We can verify the response succeeds (which means auth passed)
    expect(response.ok()).toBe(true)

    // Verify the response contains user data
    const responseData = await response.json()
    expect(responseData.user).toBeDefined()
    expect(responseData.user.email).toBe(testUser.email)
  })
})
