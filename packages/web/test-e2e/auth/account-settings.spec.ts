/**
 * Account Settings E2E Tests
 *
 * Tests the account settings page including:
 * - Display of user information (email, display name)
 * - Display of linked identity providers
 * - Change password functionality
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
    email: `test-settings-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Settings Test ${random}`
  }
}

test.describe("Account Settings", () => {
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
    // Clear any existing auth state
    await page.goto("/")
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Login the test user
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)

    // Submit login and wait for network response
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    // Wait for redirect to home
    await page.waitForURL("/", { timeout: 10000 })
  })

  test("should display user information correctly", async ({ page }) => {
    // Navigate to account settings
    await page.goto("/settings/account")

    // Wait for the page to load
    await expect(page.getByTestId("account-settings-page")).toBeVisible()

    // Verify user email is displayed
    await expect(page.getByTestId("user-email")).toContainText(testUser.email)

    // Verify user display name is displayed
    await expect(page.getByTestId("user-display-name")).toContainText(
      testUser.displayName
    )
  })

  test("should display profile section with user info", async ({ page }) => {
    await page.goto("/settings/account")

    // Profile section should be visible
    const profileSection = page.getByTestId("profile-section")
    await expect(profileSection).toBeVisible()

    // Should contain Display Name and Email labels
    await expect(profileSection.locator("text=Display Name")).toBeVisible()
    await expect(profileSection.locator("text=Email")).toBeVisible()
  })

  test("should display linked accounts section", async ({ page }) => {
    await page.goto("/settings/account")

    // Linked accounts section should be visible
    const linkedAccountsSection = page.getByTestId("linked-accounts-section")
    await expect(linkedAccountsSection).toBeVisible()

    // Should show the "Email & Password" provider since we registered with local auth
    const identitiesList = page.getByTestId("identities-list")
    await expect(identitiesList).toBeVisible()

    // Should show the local identity
    const localIdentity = page.getByTestId("identity-local")
    await expect(localIdentity).toBeVisible()
    await expect(localIdentity).toContainText("Email & Password")
    await expect(localIdentity).toContainText(testUser.email)
  })

  test("should display change password section for local auth users", async ({ page }) => {
    await page.goto("/settings/account")

    // Change password section should be visible since user has local auth
    const changePasswordSection = page.getByTestId("change-password-section")
    await expect(changePasswordSection).toBeVisible()

    // Should have password input fields
    await expect(page.getByTestId("current-password-input")).toBeVisible()
    await expect(page.getByTestId("new-password-input")).toBeVisible()
    await expect(page.getByTestId("confirm-password-input")).toBeVisible()
    await expect(page.getByTestId("change-password-submit")).toBeVisible()
  })

  test("should show validation error when passwords do not match", async ({ page }) => {
    await page.goto("/settings/account")

    // Fill the change password form with mismatched passwords
    await page.getByTestId("current-password-input").fill(testUser.password)
    await page.getByTestId("new-password-input").fill("NewSecureP@ss123!")
    await page.getByTestId("confirm-password-input").fill("DifferentPassword!")

    // Submit the form
    await page.getByTestId("change-password-submit").click()

    // Should show validation error
    await expect(page.getByTestId("password-validation-error")).toBeVisible()
    await expect(page.getByTestId("password-validation-error")).toContainText(
      "Passwords do not match"
    )
  })

  test("should show validation error for short password", async ({ page }) => {
    await page.goto("/settings/account")

    // Fill the change password form with a short password
    await page.getByTestId("current-password-input").fill(testUser.password)
    await page.getByTestId("new-password-input").fill("short")
    await page.getByTestId("confirm-password-input").fill("short")

    // Submit the form
    await page.getByTestId("change-password-submit").click()

    // Should show validation error
    await expect(page.getByTestId("password-validation-error")).toBeVisible()
    await expect(page.getByTestId("password-validation-error")).toContainText(
      "at least 8 characters"
    )
  })

  test("should show error when current password is incorrect", async ({ page }) => {
    await page.goto("/settings/account")

    // Fill the change password form with wrong current password
    await page.getByTestId("current-password-input").fill("WrongPassword123!")
    await page.getByTestId("new-password-input").fill("NewSecureP@ss123!")
    await page.getByTestId("confirm-password-input").fill("NewSecureP@ss123!")

    // Submit the form
    await page.getByTestId("change-password-submit").click()

    // Should show error notification
    await expect(page.getByTestId("notification-error")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("notification-error")).toContainText(
      "Current password is incorrect"
    )
  })

  test("should successfully change password and redirect to login", async ({ page }) => {
    const newPassword = "NewSecureP@ss123!"

    await page.goto("/settings/account")

    // Verify we see the password change warning
    await expect(page.getByTestId("password-change-warning")).toBeVisible()
    await expect(page.getByTestId("password-change-warning")).toContainText(
      "log you out"
    )

    // Fill the change password form
    await page.getByTestId("current-password-input").fill(testUser.password)
    await page.getByTestId("new-password-input").fill(newPassword)
    await page.getByTestId("confirm-password-input").fill(newPassword)

    // Submit the form
    await page.getByTestId("change-password-submit").click()

    // SECURITY: Should redirect to login page with password_changed message
    // The server has invalidated the session, so the user must re-login
    await page.waitForURL(/\/login.*message=password_changed/, { timeout: 15000 })

    // Should show the success message on login page
    await expect(page.getByTestId("login-status-message")).toBeVisible()
    await expect(page.getByTestId("login-status-message")).toContainText(
      "Password changed successfully"
    )
    await expect(page.getByTestId("login-status-message")).toContainText(
      "sign in with your new password"
    )

    // Verify we can login with the new password
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(newPassword)
    await page.getByTestId("login-submit").click()

    // Should redirect to home after successful login
    await page.waitForURL("/", { timeout: 10000 })

    // Update test user password for subsequent tests
    testUser.password = newPassword
  })

  test("should not be able to login with old password after change", async ({ page, request }) => {
    // Create a new test user for this specific test to avoid interfering with other tests
    const changeUser = generateTestCredentials()
    const newPassword = "ChangedP@ssword789!"

    // Register the new user
    await request.post("/api/auth/register", {
      data: {
        email: changeUser.email,
        password: changeUser.password,
        displayName: changeUser.displayName
      }
    })

    // Clear any existing auth state from beforeEach (we need to login as changeUser, not testUser)
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Login the user
    await page.goto("/login")
    // Wait for the login form to be fully loaded and stable (avoid hydration issues)
    await page.getByTestId("login-form").waitFor({ state: "visible", timeout: 10000 })
    await page.getByTestId("login-email").fill(changeUser.email)
    await page.getByTestId("login-password").fill(changeUser.password)

    // Submit login and wait for network response
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])
    await page.waitForURL("/", { timeout: 10000 })

    // Go to settings and change password
    await page.goto("/settings/account")
    await page.getByTestId("current-password-input").fill(changeUser.password)
    await page.getByTestId("new-password-input").fill(newPassword)
    await page.getByTestId("confirm-password-input").fill(newPassword)
    await page.getByTestId("change-password-submit").click()

    // Wait for redirect to login
    await page.waitForURL(/\/login.*message=password_changed/, { timeout: 15000 })

    // Wait for the login form to be fully loaded and visible
    await page.getByTestId("login-form").waitFor({ state: "visible", timeout: 10000 })

    // Try to login with the OLD password - should fail
    await page.getByTestId("login-email").fill(changeUser.email)
    await page.getByTestId("login-password").fill(changeUser.password)

    // Submit login and wait for network response
    const [oldPasswordResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    // API should return an error
    expect(oldPasswordResponse.ok()).toBe(false)

    // Should see an error
    await expect(page.getByTestId("login-error")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("login-error")).toContainText("Invalid email or password")

    // Now try with new password - should succeed
    await page.getByTestId("login-password").clear()
    await page.getByTestId("login-password").fill(newPassword)

    // Submit login and wait for network response
    const [newPasswordResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes("/api/auth/login")),
      page.getByTestId("login-submit").click()
    ])

    // API should succeed
    expect(newPasswordResponse.ok()).toBe(true)

    // Should redirect to home
    await page.waitForURL("/", { timeout: 10000 })
  })

  test("should redirect unauthenticated users to login", async ({ page }) => {
    // Clear auth token
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Try to navigate to account settings
    await page.goto("/settings/account")

    // Should redirect to login with redirect param
    await page.waitForURL(/\/login\?redirect=/)
  })

  test("should dismiss notification when clicking dismiss button", async ({ page }) => {
    await page.goto("/settings/account")

    // Trigger an error to show a notification
    await page.getByTestId("current-password-input").fill("WrongPassword123!")
    await page.getByTestId("new-password-input").fill("NewSecureP@ss123!")
    await page.getByTestId("confirm-password-input").fill("NewSecureP@ss123!")
    await page.getByTestId("change-password-submit").click()

    // Wait for notification to appear
    await expect(page.getByTestId("notification-error")).toBeVisible({ timeout: 10000 })

    // Click dismiss button
    await page.getByTestId("notification-dismiss").click()

    // Notification should be hidden
    await expect(page.getByTestId("notification-error")).not.toBeVisible()
  })

  test("should show linked on date for identities", async ({ page }) => {
    await page.goto("/settings/account")

    // Wait for identities to load
    const localIdentity = page.getByTestId("identity-local")
    await expect(localIdentity).toBeVisible()

    // Should contain "Linked on" text with a date
    await expect(localIdentity).toContainText("Linked on")
  })
})
