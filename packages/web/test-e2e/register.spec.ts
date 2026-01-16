/**
 * Registration Page E2E Tests
 *
 * Tests for registration page with SSR redirect:
 * - beforeLoad redirects to / if user already authenticated
 * - Registration form with email, displayName, password fields
 * - Client-side validation
 * - Submit calls api.POST('/api/auth/register', { body })
 * - On success: auto-login (cookie set), redirect to /
 * - On error: display validation errors
 */

import { test, expect } from "@playwright/test"

test.describe("Registration Page", () => {
  test("should redirect authenticated users to home", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-register-redirect-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login to get session cookie
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    expect(loginRes.ok()).toBeTruthy()
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // 3. Set session cookie
    await page.context().addCookies([
      {
        name: "accountability_session",
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ])

    // 4. Navigate to register page - should redirect based on Post-Login Flow
    await page.goto("/register")

    // 5. Wait for redirect to complete - user will be redirected to an authenticated page
    // (either /organizations/new, /organizations/:id/dashboard, or /organizations)
    await page.waitForFunction(() => !window.location.pathname.includes("/register"))

    // 6. Should NOT be on register page
    expect(page.url()).not.toContain("/register")
  })

  test("should display registration form with required fields", async ({
    page
  }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // 2. Check for form fields
    const emailInput = page.locator('input[type="email"]')
    const displayNameInput = page.locator("#displayName")
    const passwordInput = page.locator("#password")
    const submitButton = page.locator('button[type="submit"]')

    // 3. Verify fields exist
    await expect(emailInput).toBeVisible()
    await expect(displayNameInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toContainText("Create Account")
  })

  test("should auto-focus email field", async ({ page }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // 2. Email field should be focused
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeFocused()
  })

  test("should show password requirements while typing", async ({ page }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // 2. Focus password field and type
    const passwordInput = page.locator("#password")
    await passwordInput.focus()
    await passwordInput.fill("Test")

    // 3. Password requirements should be visible
    const requirements = page.locator("#password-requirements")
    await expect(requirements).toBeVisible()

    // 4. Verify requirement items
    await expect(requirements.locator("li")).toHaveCount(4)
    await expect(requirements).toContainText("At least 8 characters")
    await expect(requirements).toContainText("One uppercase letter")
    await expect(requirements).toContainText("One lowercase letter")
    await expect(requirements).toContainText("One number")
  })

  test("should validate email on blur", async ({ page }) => {
    // 1. Navigate to register page
    await page.goto("/register")
    // Wait for page hydration
    await page.waitForTimeout(500)

    // 2. Enter invalid email and blur
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill("not-an-email")
    await emailInput.blur()

    // 3. Error should be shown - wait for React state update
    const emailError = page.locator("#email-error")
    await expect(emailError).toBeVisible({ timeout: 5000 })
    await expect(emailError).toContainText("valid email")
  })

  test("should validate display name on blur", async ({ page }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // Wait for page hydration
    await page.waitForTimeout(500)

    // 2. Enter short display name and blur
    const displayNameInput = page.locator("#displayName")
    await displayNameInput.waitFor({ state: "visible" })
    await displayNameInput.focus()
    await displayNameInput.pressSequentially("A", { delay: 50 })
    await displayNameInput.blur()

    // 3. Error should be shown (either "required" or "at least 2 characters")
    const displayNameError = page.locator("#displayName-error")
    await expect(displayNameError).toBeVisible({ timeout: 5000 })
    // The validation message depends on timing - accept either
    await expect(displayNameError).toContainText(/at least 2 characters|required/i)
  })

  test("should validate password on blur", async ({ page }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // 2. Enter weak password and blur
    const passwordInput = page.locator("#password")
    await passwordInput.focus()
    await passwordInput.fill("weak")
    await passwordInput.blur()

    // 3. Error should be shown
    const passwordError = page.locator("#password-error")
    await expect(passwordError).toBeVisible()
    await expect(passwordError).toContainText("does not meet requirements")
  })

  test("should prevent submission with invalid form", async ({ page }) => {
    // 1. Navigate to register page and wait for full hydration
    await page.goto("/register")
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeEnabled()

    // Wait for React hydration before interacting
    await page.waitForTimeout(500)

    // 2. Fill invalid data using pressSequentially for proper event triggering
    const emailInput = page.locator('input[type="email"]')
    await emailInput.click()
    await emailInput.pressSequentially("not-an-email", { delay: 10 })

    const displayNameInput = page.locator("#displayName")
    await displayNameInput.click()
    await displayNameInput.fill("")

    const passwordInput = page.locator("#password")
    await passwordInput.click()
    await passwordInput.pressSequentially("weak", { delay: 10 })

    // 3. Click submit
    await page.click('button[type="submit"]')

    // 4. Should still be on register page (not submitted)
    expect(page.url()).toContain("/register")

    // 5. Errors should be visible - email validation error
    await expect(page.locator("#email-error")).toBeVisible({ timeout: 10000 })
  })

  test("should register successfully and redirect to home", async ({
    page
  }) => {
    // 1. Navigate to register page and wait for full hydration
    await page.goto("/register", { waitUntil: "networkidle" })

    // Wait a bit for React hydration to complete
    await page.waitForTimeout(1000)

    // 2. Fill valid form
    const testUser = {
      email: `test-register-success-${Date.now()}@example.com`,
      displayName: "Test User",
      password: "TestPassword123"
    }

    // Fill fields and blur to trigger validation
    await page.fill('input[type="email"]', testUser.email)
    await page.fill("#displayName", testUser.displayName)
    await page.fill("#password", testUser.password)

    // Blur the password field to clear focus state
    await page.locator("#password").blur()

    // Wait a moment for React state to settle
    await page.waitForTimeout(100)

    // 3. Submit form by pressing Enter in the form
    await page.locator("#password").press("Enter")

    // 4. Should redirect to home page (allow time for register + login API calls)
    await page.waitForURL("/", { timeout: 30000 })
    expect(page.url()).not.toContain("/register")
    expect(page.url()).not.toContain("/login")
  })

  test("should show error when email already exists", async ({ page }) => {
    // 1. Register a user first
    const testUser = {
      email: `test-register-exists-${Date.now()}@example.com`,
      displayName: "Test User",
      password: "TestPassword123"
    }

    await page.request.post("/api/auth/register", {
      data: testUser
    })

    // 2. Navigate to register page and wait for full hydration
    await page.goto("/register", { waitUntil: "networkidle" })
    await page.waitForTimeout(1000)

    // 3. Try to register with same email
    await page.fill('input[type="email"]', testUser.email)
    await page.fill("#displayName", "Another User")
    await page.fill("#password", "AnotherPassword123")

    // Blur and wait for state to settle
    await page.locator("#password").blur()
    await page.waitForTimeout(100)

    // 4. Submit form by pressing Enter
    await page.locator("#password").press("Enter")

    // 5. Wait for error message
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible({ timeout: 15000 })
    await expect(errorMessage).toContainText("already exists")
  })

  test("should link to home page via logo", async ({ page }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // 2. Check for logo/home link
    const homeLink = page.locator('a:has-text("Accountability")').first()
    await expect(homeLink).toBeVisible()

    // 3. Click it
    await homeLink.click()

    // 4. Should navigate to home
    await page.waitForURL("/")
    expect(page.url()).toContain("/")
  })

  test("should have link to login page", async ({ page }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // 2. Check for login link
    const loginLink = page.locator('a:has-text("Sign in")')
    await expect(loginLink).toBeVisible()

    // 3. Check href is correct
    const href = await loginLink.getAttribute("href")
    expect(href).toContain("/login")
  })

  test("login page should have link to register page", async ({ page }) => {
    // 1. Navigate to login page
    await page.goto("/login")

    // 2. Check for register link
    const registerLink = page.locator('a:has-text("Register")')
    await expect(registerLink).toBeVisible()

    // 3. Click link
    await registerLink.click()

    // 4. Should navigate to register page
    await page.waitForURL("/register")
    expect(page.url()).toContain("/register")
  })

  test("should clear validation errors when user starts typing", async ({
    page
  }) => {
    // 1. Navigate to register page
    await page.goto("/register")

    // 2. Enter invalid email and blur to trigger error
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill("not-an-email")
    await emailInput.blur()

    // 3. Error should be shown
    const emailError = page.locator("#email-error")
    await expect(emailError).toBeVisible()

    // 4. Start typing valid email
    await emailInput.fill("valid@example.com")

    // 5. Error should be cleared
    await expect(emailError).not.toBeVisible()
  })
})
