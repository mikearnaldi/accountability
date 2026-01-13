/**
 * Session Management E2E Tests
 *
 * Tests the session lifecycle including:
 * - Session persists across page navigations
 * - Logout clears session and redirects to login
 * - Expired/invalidated session redirects to login
 * - Protected routes redirect to login without auth
 * - Token is cleared from localStorage on logout
 *
 * @module test-e2e/auth/session.spec
 */

import { test, expect } from "../fixtures/auth.ts"

test.describe("Session Management", () => {
  test("should maintain session across page navigations", async ({
    authenticatedPage,
    testUser
  }) => {
    // Navigate to home page first
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()

    // Navigate to companies page (protected route)
    await authenticatedPage.goto("/companies")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()
    await expect(
      authenticatedPage.getByRole("heading", { name: "Companies" })
    ).toBeVisible()

    // Navigate to reports page (protected route)
    await authenticatedPage.goto("/reports")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()
    await expect(
      authenticatedPage.getByRole("heading", { name: "Reports", exact: true })
    ).toBeVisible()

    // Navigate back to home
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()

    // Verify user display name is still shown (session is valid)
    await expect(authenticatedPage.getByText(testUser.displayName)).toBeVisible()
  })

  test("should logout and redirect to login page", async ({
    authenticatedPage,
    testUser
  }) => {
    // Start on home page with authenticated session
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()
    await expect(authenticatedPage.getByText(testUser.displayName)).toBeVisible()

    // Click on user menu button to open dropdown
    // Use aria-label to find the exact button
    const userMenuButton = authenticatedPage.getByRole("button", { name: /User menu for/ })
    await userMenuButton.click()

    // Wait for the dropdown menu to appear
    const dropdown = authenticatedPage.getByRole("menu", { name: "User menu" })
    await expect(dropdown).toBeVisible()

    // Click on "Sign out" button within the menu
    const signOutButton = dropdown.getByRole("menuitem", { name: "Sign out" })
    await expect(signOutButton).toBeVisible()
    await signOutButton.click()

    // Should redirect to login page
    await authenticatedPage.waitForURL("/login", { timeout: 10000 })

    // Should show login form
    await expect(
      authenticatedPage.getByRole("heading", { name: "Sign In" })
    ).toBeVisible()
  })

  test("should clear token from localStorage on logout", async ({
    authenticatedPage,
    testUser
  }) => {
    // Start on home page with authenticated session
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()
    await expect(authenticatedPage.getByText(testUser.displayName)).toBeVisible()

    // Verify token exists in localStorage before logout
    const tokenBefore = await authenticatedPage.evaluate(() =>
      localStorage.getItem("accountability_auth_token")
    )
    expect(tokenBefore).not.toBeNull()
    expect(tokenBefore).not.toBe("")

    // Click on user menu button to open dropdown
    const userMenuButton = authenticatedPage.getByRole("button", { name: /User menu for/ })
    await userMenuButton.click()

    // Wait for dropdown to appear
    const dropdown = authenticatedPage.getByRole("menu", { name: "User menu" })
    await expect(dropdown).toBeVisible()

    // Click on "Sign out" button within the menu
    const signOutButton = dropdown.getByRole("menuitem", { name: "Sign out" })
    await expect(signOutButton).toBeVisible()
    await signOutButton.click()

    // Wait for redirect to login
    await authenticatedPage.waitForURL("/login", { timeout: 10000 })

    // Verify token is cleared from localStorage
    const tokenAfter = await authenticatedPage.evaluate(() =>
      localStorage.getItem("accountability_auth_token")
    )
    expect(tokenAfter).toBeNull()
  })

  test("should redirect to login when session is invalidated via API", async ({
    authenticatedPage,
    testUser
  }) => {
    // Start on home page with authenticated session
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()

    // Invalidate session via API (simulating server-side logout or token expiry)
    const logoutResponse = await authenticatedPage.request.post(
      "/api/auth/logout",
      {
        headers: { Authorization: `Bearer ${testUser.token}` }
      }
    )
    expect(logoutResponse.ok()).toBe(true)

    // Now try to navigate to a protected page
    // The auth state should detect the invalidated session and redirect to login
    await authenticatedPage.goto("/companies")

    // Should redirect to login page (session is invalid)
    await authenticatedPage.waitForURL(/\/login/)

    // Verify we see the login page
    await expect(
      authenticatedPage.getByRole("heading", { name: "Sign In" })
    ).toBeVisible()
  })

  test("should redirect protected routes to login without authentication", async ({
    page
  }) => {
    // Clear any existing token and start fresh on home page
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.removeItem("accountability_auth_token")
    })

    // Try to access protected page: /companies
    await page.goto("/companies")
    await page.waitForURL(/\/login\?redirect=/)
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcompanies/)
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

    // Go back to home and clear token again before next test
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.removeItem("accountability_auth_token")
    })

    // Try to access protected page: /reports
    await page.goto("/reports")
    await page.waitForURL(/\/login\?redirect=/)
    await expect(page).toHaveURL(/\/login\?redirect=%2Freports/)
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

    // Go back to home and clear token before testing /account
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.removeItem("accountability_auth_token")
    })

    // Add explicit wait to ensure state is cleared
    await page.waitForTimeout(100)

    // Try to access protected page: /account
    await page.goto("/account")

    // Wait for redirect
    await page.waitForURL(/\/login\?redirect=/, { timeout: 10000 })

    // Check the redirect parameter
    const currentUrl = page.url()
    const urlObj = new URL(currentUrl)
    const redirectParam = urlObj.searchParams.get("redirect")
    expect(redirectParam, "Redirect param should be /account").toBe("/account")

    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
  })

  test("should preserve redirect URL when redirecting unauthenticated user to login", async ({
    page
  }) => {
    // Ensure no token exists
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.removeItem("accountability_auth_token")
    })

    // Try to access a specific protected route
    await page.goto("/companies")

    // Should redirect to login with the redirect parameter set
    await page.waitForURL(/\/login\?redirect=/)

    // Verify the redirect parameter is the original path
    const url = new URL(page.url())
    expect(url.searchParams.get("redirect")).toBe("/companies")
  })

  test("should handle invalid token gracefully", async ({ page }) => {
    // Navigate to app first to access localStorage
    await page.goto("/")

    // Set a token that has valid format but doesn't exist in the database
    // SessionId requires min 32 chars, alphanumeric with underscores/hyphens
    // This token has the right format but won't match any session in DB
    const fakeValidToken = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    await page.evaluate((token) => {
      localStorage.setItem("accountability_auth_token", token)
    }, fakeValidToken)

    // Verify token was set
    const tokenBefore = await page.evaluate(() =>
      localStorage.getItem("accountability_auth_token")
    )
    expect(tokenBefore).toBe(fakeValidToken)

    // Try to access a protected page - the API call will return 401
    // because this session doesn't exist in the database
    await page.goto("/companies")

    // The app should detect the invalid token and redirect to login
    // This happens when the /api/auth/me call returns 401 (session not found)
    await page.waitForURL(/\/login/, { timeout: 15000 })

    // Verify we're on the login page
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

    // Token should be cleared from localStorage after auth state settles
    // Poll until token is cleared (the atom clearing may be slightly delayed)
    await expect(async () => {
      const token = await page.evaluate(() =>
        localStorage.getItem("accountability_auth_token")
      )
      expect(token).toBeNull()
    }).toPass({ timeout: 5000 })
  })

  test("should redirect to home after login when on login page", async ({
    page,
    testUser
  }) => {
    // Ensure logged out
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.removeItem("accountability_auth_token")
    })

    // Go to login page directly (no redirect param)
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

    // Login with valid credentials
    await page.fill("#email", testUser.email)
    await page.fill("#password", testUser.password)
    await page.click('button[type="submit"]')

    // Should redirect to home page
    await page.waitForURL("/")

    // Verify authenticated state
    await expect(page.getByTestId("user-menu")).toBeVisible()
  })

  test("should redirect to saved path after login when redirect param exists", async ({
    page,
    testUser
  }) => {
    // Ensure logged out
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.removeItem("accountability_auth_token")
    })

    // Go to login page with redirect param
    await page.goto("/login?redirect=/reports")
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()

    // Login with valid credentials
    await page.fill("#email", testUser.email)
    await page.fill("#password", testUser.password)
    await page.click('button[type="submit"]')

    // Should redirect to the saved redirect path
    await page.waitForURL("/reports")

    // Verify authenticated state
    await expect(page.getByTestId("user-menu")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible()
  })

  test("should keep user logged in after page refresh", async ({
    authenticatedPage,
    testUser
  }) => {
    // Start on home page with authenticated session
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()
    await expect(authenticatedPage.getByText(testUser.displayName)).toBeVisible()

    // Reload the page
    await authenticatedPage.reload()

    // Should still be authenticated after refresh
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()
    await expect(authenticatedPage.getByText(testUser.displayName)).toBeVisible()
  })

  test("should require re-authentication after session expiry on API call", async ({
    authenticatedPage,
    testUser
  }) => {
    // Start on home page authenticated
    await authenticatedPage.goto("/")
    await expect(authenticatedPage.getByTestId("user-menu")).toBeVisible()

    // Invalidate the session on the server side
    await authenticatedPage.request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${testUser.token}` }
    })

    // Make an API call that requires authentication by navigating to a protected route
    // The request will fail and the app should redirect to login
    await authenticatedPage.goto("/companies")

    // Should redirect to login because the API request will return 401
    await authenticatedPage.waitForURL(/\/login/, { timeout: 10000 })
  })

  test("should not allow access to protected routes via direct URL without auth", async ({
    page
  }) => {
    // Ensure completely logged out
    await page.goto("/")
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // List of protected routes to test
    const protectedRoutes = [
      "/companies",
      "/reports",
      "/account",
      "/journal-entries"
    ]

    for (const route of protectedRoutes) {
      // Navigate directly to the protected route
      await page.goto(route)

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 5000 })

      // Clear URL to prepare for next iteration
      await page.goto("/login")
    }
  })
})
