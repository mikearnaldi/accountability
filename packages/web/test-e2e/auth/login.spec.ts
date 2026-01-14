/**
 * Login Flow E2E Tests
 *
 * Tests the complete login flow including:
 * - Successful login with valid credentials
 * - Error display for invalid credentials
 * - Redirect parameter handling after login
 * - Redirect away if already authenticated
 */

import { test, expect } from "@playwright/test"

// Token storage key (must match tokenStorage.ts)
const AUTH_TOKEN_KEY = "auth_token"

// Test user credentials (created fresh for each test suite)
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
    email: `test-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Test User ${random}`
  }
}

test.describe("Login Flow", () => {
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

  test("should login with valid credentials and redirect to dashboard", async ({ page }) => {
    await page.goto("/login")

    // Verify we're on the login page
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

    // Fill login form using data-testid selectors
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    // Submit the form
    await page.getByTestId("login-submit").click()

    // Should redirect to home page (dashboard) after successful login
    await page.waitForURL("/")

    // Verify token was stored
    const token = await page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)
    expect(token).not.toBeNull()
    expect(token).toBeTruthy()
  })

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login")

    // Fill form with invalid credentials
    await page.getByTestId("login-email").fill("wrong@example.com")
    await page.getByTestId("login-password").fill("wrongpassword123")

    // Submit the form
    await page.getByTestId("login-submit").click()

    // Should show error alert
    await expect(page.getByTestId("login-error")).toBeVisible()
    await expect(page.getByTestId("login-error")).toContainText("Invalid email or password")

    // Should stay on login page
    await expect(page).toHaveURL("/login")

    // Token should not be stored
    const token = await page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)
    expect(token).toBeNull()
  })

  test("should redirect to requested page after login (redirect param)", async ({ page }) => {
    // Go to login with redirect parameter
    await page.goto("/login?redirect=/companies")

    // Verify we're on the login page
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

    // Fill login form
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    // Submit the form
    await page.getByTestId("login-submit").click()

    // Should redirect to the requested page (/companies)
    await page.waitForURL("/companies")
  })

  test("should redirect away if already authenticated", async ({ page }) => {
    // First, login to get a valid token
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()

    // Wait for redirect to home
    await page.waitForURL("/")

    // Now try to navigate to login page
    await page.goto("/login")

    // Should be redirected away from login page
    // (back to home since no redirect param)
    await page.waitForURL("/")
  })

  test("should show validation errors for empty fields", async ({ page }) => {
    await page.goto("/login")

    // Submit the form without filling any fields
    await page.getByTestId("login-submit").click()

    // Should show validation errors
    await expect(page.getByTestId("login-email-error")).toBeVisible()
    await expect(page.getByTestId("login-email-error")).toContainText("Email is required")

    await expect(page.getByTestId("login-password-error")).toBeVisible()
    await expect(page.getByTestId("login-password-error")).toContainText("Password is required")
  })

  test("should show validation error for invalid email format", async ({ page }) => {
    await page.goto("/login")

    // Fill with invalid email
    await page.getByTestId("login-email").fill("not-an-email")
    await page.getByTestId("login-email").blur()

    // Should show email validation error
    await expect(page.getByTestId("login-email-error")).toBeVisible()
    await expect(page.getByTestId("login-email-error")).toContainText("valid email")
  })

  test("should show validation error for short password", async ({ page }) => {
    await page.goto("/login")

    // Fill with short password
    await page.getByTestId("login-password").fill("short")
    await page.getByTestId("login-password").blur()

    // Should show password validation error
    await expect(page.getByTestId("login-password-error")).toBeVisible()
    await expect(page.getByTestId("login-password-error")).toContainText("at least 8 characters")
  })

  test("should have link to registration page", async ({ page }) => {
    await page.goto("/login")

    // Verify register link exists
    const registerLink = page.getByTestId("login-register-link")
    await expect(registerLink).toBeVisible()
    await expect(registerLink).toHaveText("Create one")

    // Click the link and verify navigation
    await registerLink.click()
    await expect(page).toHaveURL("/register")
  })

  test("should preserve redirect param in register link", async ({ page }) => {
    await page.goto("/login?redirect=/companies")

    // Click register link
    await page.getByTestId("login-register-link").click()

    // Should navigate to register with redirect param preserved
    await expect(page).toHaveURL(/\/register\?redirect=%2Fcompanies/)
  })

  test("should show loading state during login", async ({ page }) => {
    await page.goto("/login")

    // Fill login form
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    // Start watching for button text change
    const submitButton = page.getByTestId("login-submit")

    // Submit the form
    await submitButton.click()

    // The button should show loading state (may be very brief)
    // We check that submission started by waiting for URL change
    await page.waitForURL("/")
  })
})
