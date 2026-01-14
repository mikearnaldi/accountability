/**
 * Session Management E2E Tests
 *
 * Tests the session management functionality including:
 * - User menu display when authenticated
 * - Logout clears session and redirects to login
 * - User info display in the menu
 */

import { test, expect } from "@playwright/test"

// Token storage key (must match tokenStorage.ts)
const AUTH_TOKEN_KEY = "auth_token"

// Test user credentials
interface TestUser {
  email: string
  password: string
  displayName: string
}

/**
 * Generate unique test credentials
 */
function generateTestCredentials(): TestUser {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return {
    email: `test-session-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Session Test ${random}`
  }
}

test.describe("Session Management", () => {
  let testUser: TestUser

  test.beforeAll(async ({ request }) => {
    // Create a test user via API before running tests
    testUser = generateTestCredentials()

    const response = await request.post("/api/auth/register", {
      data: {
        email: testUser.email,
        password: testUser.password,
        displayName: testUser.displayName
      }
    })

    if (!response.ok()) {
      console.error("Failed to register test user:", await response.text())
    }
    expect(response.ok()).toBe(true)
  })

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await page.goto("/")
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)
  })

  test("should show Login button when not authenticated", async ({ page }) => {
    // Navigate to a protected page (will redirect to login)
    await page.goto("/organizations")

    // Should be redirected to login page since not authenticated
    await page.waitForURL(/\/login/)

    // The login page should be visible
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
  })

  test("should show user menu when authenticated", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect to home
    await page.waitForURL("/")

    // User menu should be visible in the header
    const userMenu = page.getByTestId("user-menu")
    await expect(userMenu).toBeVisible()
  })

  test("should display user initials and name in the menu trigger", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect
    await page.waitForURL("/")

    // User menu should show the user's display name
    const userMenu = page.getByTestId("user-menu")
    await expect(userMenu).toBeVisible()
    await expect(userMenu).toContainText(testUser.displayName)
  })

  test("should show dropdown with user email and options on click", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect
    await page.waitForURL("/")

    // Click the user menu trigger
    await page.getByTestId("user-menu").click()

    // Dropdown should appear
    const dropdown = page.getByTestId("user-menu-dropdown")
    await expect(dropdown).toBeVisible()

    // Should show user email
    await expect(page.getByTestId("user-menu-email")).toContainText(testUser.email)

    // Should show account settings link
    await expect(page.getByTestId("user-menu-settings")).toBeVisible()

    // Should show logout button
    await expect(page.getByTestId("user-menu-logout")).toBeVisible()
  })

  test("should logout, clear session, and redirect to login", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect
    await page.waitForURL("/")

    // Verify we are logged in (token exists)
    let token = await page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)
    expect(token).not.toBeNull()

    // Open user menu
    await page.getByTestId("user-menu").click()

    // Wait for dropdown to be visible
    await expect(page.getByTestId("user-menu-dropdown")).toBeVisible()

    // Click logout
    await page.getByTestId("user-menu-logout").click()

    // Should redirect to login page
    await page.waitForURL("/login")

    // Token should be cleared
    token = await page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)
    expect(token).toBeNull()
  })

  test("should close dropdown when clicking outside", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect
    await page.waitForURL("/")

    // Open user menu
    await page.getByTestId("user-menu").click()

    // Wait for dropdown to be visible
    await expect(page.getByTestId("user-menu-dropdown")).toBeVisible()

    // Click outside the dropdown (on the main content area)
    await page.getByTestId("main-content").click()

    // Dropdown should close
    await expect(page.getByTestId("user-menu-dropdown")).not.toBeVisible()
  })

  test("should close dropdown when pressing Escape", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect
    await page.waitForURL("/")

    // Open user menu
    await page.getByTestId("user-menu").click()

    // Wait for dropdown to be visible
    await expect(page.getByTestId("user-menu-dropdown")).toBeVisible()

    // Press Escape
    await page.keyboard.press("Escape")

    // Dropdown should close
    await expect(page.getByTestId("user-menu-dropdown")).not.toBeVisible()
  })

  test("should navigate to account settings when clicking settings link", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect
    await page.waitForURL("/")

    // Open user menu
    await page.getByTestId("user-menu").click()

    // Wait for dropdown to be visible
    await expect(page.getByTestId("user-menu-dropdown")).toBeVisible()

    // Click account settings
    await page.getByTestId("user-menu-settings").click()

    // Should navigate to account settings page
    await expect(page).toHaveURL("/settings/account")
  })

  test("should require re-login after logout to access protected pages", async ({ page }) => {
    // Login first
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect
    await page.waitForURL("/")

    // Open user menu and logout
    await page.getByTestId("user-menu").click()
    await expect(page.getByTestId("user-menu-dropdown")).toBeVisible()
    await page.getByTestId("user-menu-logout").click()

    // Should redirect to login
    await page.waitForURL("/login")

    // Try to navigate to a protected page
    await page.goto("/organizations")

    // Should be redirected back to login with redirect parameter
    await page.waitForURL(/\/login\?redirect=/)
  })
})
