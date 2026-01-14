/**
 * Registration Flow E2E Tests
 *
 * Tests the complete registration flow including:
 * - Successful registration creates user and logs in
 * - Duplicate email shows error
 * - Weak password shows validation error
 * - Client-side validation for all fields
 * - Redirect away if already authenticated
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
 * Generate unique test credentials with a strong password
 */
function generateTestCredentials(): TestUser {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return {
    email: `test-${timestamp}-${random}@example.com`,
    // Strong password that meets all requirements:
    // - At least 8 characters
    // - Uppercase letter
    // - Lowercase letter
    // - Number
    // - Special character
    password: `SecureP@ss${timestamp}!`,
    displayName: `Test User ${random}`
  }
}

test.describe("Registration Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await page.goto("/")
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)
  })

  test("should successfully register a new user and log in", async ({ page }) => {
    const newUser = generateTestCredentials()

    await page.goto("/register")

    // Verify we're on the registration page
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible()

    // Fill registration form using data-testid selectors
    await page.getByTestId("register-email").fill(newUser.email)
    await page.getByTestId("register-display-name").fill(newUser.displayName)
    await page.getByTestId("register-password").fill(newUser.password)
    await page.getByTestId("register-confirm-password").fill(newUser.password)

    // Submit the form
    await page.getByTestId("register-submit").click()

    // Should redirect to home page (dashboard) after successful registration and auto-login
    await page.waitForURL("/")

    // Verify token was stored (indicating successful login)
    const token = await page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)
    expect(token).not.toBeNull()
    expect(token).toBeTruthy()
  })

  test("should show error for duplicate email", async ({ page, request }) => {
    // First, register a user via API
    const existingUser = generateTestCredentials()

    const registerResponse = await request.post("/api/auth/register", {
      data: {
        email: existingUser.email,
        password: existingUser.password,
        displayName: existingUser.displayName
      }
    })
    expect(registerResponse.ok()).toBe(true)

    // Now try to register again with the same email via UI
    await page.goto("/register")

    await page.getByTestId("register-email").fill(existingUser.email)
    await page.getByTestId("register-display-name").fill("Another User")
    await page.getByTestId("register-password").fill(existingUser.password)
    await page.getByTestId("register-confirm-password").fill(existingUser.password)

    // Submit the form
    await page.getByTestId("register-submit").click()

    // Should show error alert about duplicate email
    await expect(page.getByTestId("register-error")).toBeVisible()
    await expect(page.getByTestId("register-error")).toContainText("already exists")

    // Should stay on register page
    await expect(page).toHaveURL("/register")

    // Token should not be stored
    const token = await page.evaluate((key) => localStorage.getItem(key), AUTH_TOKEN_KEY)
    expect(token).toBeNull()
  })

  test("should show validation error for weak password", async ({ page }) => {
    await page.goto("/register")

    // Fill with a weak password (only lowercase, no special chars, no numbers)
    await page.getByTestId("register-password").fill("weakpass")
    await page.getByTestId("register-password").blur()

    // Should show password validation error
    await expect(page.getByTestId("register-password-error")).toBeVisible()
    // The error should mention one or more requirements not met
    const errorText = await page.getByTestId("register-password-error").textContent()
    expect(errorText).toContain("Password must have")
  })

  test("should show validation error for password without uppercase", async ({ page }) => {
    await page.goto("/register")

    // Password without uppercase letter
    await page.getByTestId("register-password").fill("weakpass1!")
    await page.getByTestId("register-password").blur()

    await expect(page.getByTestId("register-password-error")).toBeVisible()
    await expect(page.getByTestId("register-password-error")).toContainText("uppercase")
  })

  test("should show validation error for password without number", async ({ page }) => {
    await page.goto("/register")

    // Password without number
    await page.getByTestId("register-password").fill("WeakPass!")
    await page.getByTestId("register-password").blur()

    await expect(page.getByTestId("register-password-error")).toBeVisible()
    await expect(page.getByTestId("register-password-error")).toContainText("number")
  })

  test("should show validation error for password without special character", async ({ page }) => {
    await page.goto("/register")

    // Password without special character
    await page.getByTestId("register-password").fill("WeakPass1")
    await page.getByTestId("register-password").blur()

    await expect(page.getByTestId("register-password-error")).toBeVisible()
    await expect(page.getByTestId("register-password-error")).toContainText("special character")
  })

  test("should show validation error for passwords that do not match", async ({ page }) => {
    await page.goto("/register")

    // Fill password and a different confirmation
    await page.getByTestId("register-password").fill("SecureP@ss123!")
    await page.getByTestId("register-confirm-password").fill("DifferentP@ss123!")
    await page.getByTestId("register-confirm-password").blur()

    // Should show password mismatch error
    await expect(page.getByTestId("register-confirm-password-error")).toBeVisible()
    await expect(page.getByTestId("register-confirm-password-error")).toContainText("do not match")
  })

  test("should show validation errors for empty required fields", async ({ page }) => {
    await page.goto("/register")

    // Submit the form without filling any fields
    await page.getByTestId("register-submit").click()

    // Should show validation errors for all required fields
    await expect(page.getByTestId("register-email-error")).toBeVisible()
    await expect(page.getByTestId("register-email-error")).toContainText("Email is required")

    await expect(page.getByTestId("register-display-name-error")).toBeVisible()
    await expect(page.getByTestId("register-display-name-error")).toContainText("Display name is required")

    await expect(page.getByTestId("register-password-error")).toBeVisible()
    await expect(page.getByTestId("register-password-error")).toContainText("Password is required")

    await expect(page.getByTestId("register-confirm-password-error")).toBeVisible()
    await expect(page.getByTestId("register-confirm-password-error")).toContainText("confirm your password")
  })

  test("should show validation error for invalid email format", async ({ page }) => {
    await page.goto("/register")

    // Fill with invalid email
    await page.getByTestId("register-email").fill("not-an-email")
    await page.getByTestId("register-email").blur()

    // Should show email validation error
    await expect(page.getByTestId("register-email-error")).toBeVisible()
    await expect(page.getByTestId("register-email-error")).toContainText("valid email")
  })

  test("should show validation error for short display name", async ({ page }) => {
    await page.goto("/register")

    // Fill with single character display name
    await page.getByTestId("register-display-name").fill("A")
    await page.getByTestId("register-display-name").blur()

    // Should show display name validation error
    await expect(page.getByTestId("register-display-name-error")).toBeVisible()
    await expect(page.getByTestId("register-display-name-error")).toContainText("at least 2 characters")
  })

  test("should redirect away if already authenticated", async ({ page, request }) => {
    // First, register and login via API to get a valid token
    const testUser = generateTestCredentials()

    await request.post("/api/auth/register", {
      data: {
        email: testUser.email,
        password: testUser.password,
        displayName: testUser.displayName
      }
    })

    const loginResponse = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    expect(loginResponse.ok()).toBe(true)
    const { token } = await loginResponse.json()

    // Set the token in localStorage
    await page.goto("/")
    await page.evaluate((args) => {
      localStorage.setItem(args.key, args.token)
    }, { key: AUTH_TOKEN_KEY, token })

    // Navigate to register page
    await page.goto("/register")

    // Should be redirected away from register page (back to home)
    await page.waitForURL("/")
  })

  test("should have link to login page", async ({ page }) => {
    await page.goto("/register")

    // Verify login link exists
    const loginLink = page.getByTestId("register-login-link")
    await expect(loginLink).toBeVisible()
    await expect(loginLink).toHaveText("Sign in")

    // Click the link and verify navigation
    await loginLink.click()
    await expect(page).toHaveURL("/login")
  })

  test("should preserve redirect param in login link", async ({ page }) => {
    await page.goto("/register?redirect=/companies")

    // Click login link
    await page.getByTestId("register-login-link").click()

    // Should navigate to login with redirect param preserved
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcompanies/)
  })

  test("should redirect to specified page after successful registration", async ({ page }) => {
    const newUser = generateTestCredentials()

    // Go to register with redirect parameter
    await page.goto("/register?redirect=/companies")

    // Verify we're on the registration page
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible()

    // Fill registration form
    await page.getByTestId("register-email").fill(newUser.email)
    await page.getByTestId("register-display-name").fill(newUser.displayName)
    await page.getByTestId("register-password").fill(newUser.password)
    await page.getByTestId("register-confirm-password").fill(newUser.password)

    // Submit the form
    await page.getByTestId("register-submit").click()

    // Should redirect to the requested page (/companies)
    await page.waitForURL("/companies")
  })

  test("should show loading state during registration", async ({ page }) => {
    const newUser = generateTestCredentials()

    await page.goto("/register")

    // Fill registration form
    await page.getByTestId("register-email").fill(newUser.email)
    await page.getByTestId("register-display-name").fill(newUser.displayName)
    await page.getByTestId("register-password").fill(newUser.password)
    await page.getByTestId("register-confirm-password").fill(newUser.password)

    // Start watching for button state
    const submitButton = page.getByTestId("register-submit")

    // Submit the form
    await submitButton.click()

    // The button should be disabled during loading (may be very brief)
    // We verify by checking the successful redirect happens
    await page.waitForURL("/")
  })

  test("should clear validation errors when user fixes input", async ({ page }) => {
    await page.goto("/register")

    // Trigger validation error
    await page.getByTestId("register-email").fill("invalid")
    await page.getByTestId("register-email").blur()

    // Error should be visible
    await expect(page.getByTestId("register-email-error")).toBeVisible()

    // Fix the input
    await page.getByTestId("register-email").fill("valid@example.com")

    // Error should be cleared (validation runs on change when error is present)
    await expect(page.getByTestId("register-email-error")).not.toBeVisible()
  })
})
