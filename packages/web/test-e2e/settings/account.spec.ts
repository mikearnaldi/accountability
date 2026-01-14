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
    await page.getByTestId("login-submit").click()

    // Wait for redirect to home
    await page.waitForURL("/")
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

  test("should successfully change password", async ({ page }) => {
    const newPassword = "NewSecureP@ss123!"

    await page.goto("/settings/account")

    // Fill the change password form
    await page.getByTestId("current-password-input").fill(testUser.password)
    await page.getByTestId("new-password-input").fill(newPassword)
    await page.getByTestId("confirm-password-input").fill(newPassword)

    // Submit the form
    await page.getByTestId("change-password-submit").click()

    // Should show success notification
    await expect(page.getByTestId("notification-success")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("notification-success")).toContainText(
      "Password changed successfully"
    )

    // Password fields should be cleared
    await expect(page.getByTestId("current-password-input")).toHaveValue("")
    await expect(page.getByTestId("new-password-input")).toHaveValue("")
    await expect(page.getByTestId("confirm-password-input")).toHaveValue("")

    // Verify we can login with the new password
    // First logout
    await page.getByTestId("user-menu").click()
    await expect(page.getByTestId("user-menu-dropdown")).toBeVisible()
    await page.getByTestId("user-menu-logout").click()
    await page.waitForURL("/login")

    // Login with new password
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(newPassword)
    await page.getByTestId("login-submit").click()

    // Should redirect to home
    await page.waitForURL("/")

    // Update test user password for subsequent tests
    testUser.password = newPassword
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
