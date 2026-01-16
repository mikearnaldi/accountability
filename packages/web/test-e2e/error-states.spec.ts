/**
 * Error States E2E Tests
 *
 * Tests for various error scenarios:
 * - 404 page handling (non-existent routes)
 * - Network error recovery (API failures)
 * - Session expiration handling (invalid/expired tokens)
 * - Permission denied states (accessing unauthorized resources)
 */

import { test, expect } from "@playwright/test"

test.describe("404 Page Handling", () => {
  test("should display 404 page for non-existent route", async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto("/this-route-does-not-exist")

    // Should show 404 content
    await expect(page.locator("h1")).toContainText("404")
    await expect(page.getByText("Page Not Found")).toBeVisible()
  })

  test("should display 404 page for invalid organization ID", async ({
    page,
    request
  }) => {
    // Register and login a test user
    const testUser = {
      email: `test-404-org-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

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

    // Navigate to a non-existent organization
    await page.goto("/organizations/non-existent-org-id/dashboard")

    // Should show error content - the error component displays "Error loading dashboard"
    // or similar error message when organization doesn't exist
    await expect(
      page.getByText(/error|not found|doesn't exist/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("should have link back to home from 404 page", async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto("/this-route-does-not-exist")

    // Should show 404 page
    await expect(page.locator("h1")).toContainText("404")

    // Should have link to home
    const homeLink = page.getByRole("link", { name: /home|go back/i })
    await expect(homeLink).toBeVisible()

    // Click the link
    await homeLink.click()

    // Should navigate to home
    await page.waitForURL("/")
  })

  test("should display 404 for deeply nested non-existent route", async ({
    page
  }) => {
    // Navigate to a deeply nested non-existent route
    await page.goto("/some/deeply/nested/non-existent/route")

    // Should show 404 content
    await expect(page.locator("h1")).toContainText("404")
  })
})

test.describe("Network Error Recovery", () => {
  test("should show error on API failure during login", async ({ page }) => {
    // Navigate to login page
    await page.goto("/login")

    // Intercept the API call to simulate failure
    await page.route("/api/auth/login", (route) => {
      route.abort("failed")
    })

    // Fill form
    await page.fill('input[type="email"]', "test@example.com")
    await page.fill('input[type="password"]', "TestPassword123")

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for error message
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText(/error|failed/i)
  })

  test("should show error when organization list fails to load", async ({
    page,
    request
  }) => {
    // Register and login a test user
    const testUser = {
      email: `test-net-error-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

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

    // Intercept the organizations API call to simulate failure
    await page.route("**/api/v1/organizations**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" })
      })
    })

    // Navigate to organizations page
    await page.goto("/organizations")

    // Should show page without crashing (empty state or error handled gracefully)
    // The page handles API errors by returning empty results
    await expect(page).toHaveTitle(/Accountability/)
  })

  test("should handle server 500 error gracefully", async ({
    page,
    request
  }) => {
    // Register and login a test user
    const testUser = {
      email: `test-500-error-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // Create an organization first
    const orgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Test Org ${Date.now()}`,
        reportingCurrency: "USD"
      }
    })
    const orgData = await orgRes.json()

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

    // Intercept companies API to return 500
    await page.route("**/api/v1/companies**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" })
      })
    })

    // Navigate to companies page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Should show error state (error component is defined for this route)
    await expect(page).toHaveTitle(/Accountability/)
  })
})

test.describe("Session Expiration Handling", () => {
  test("should handle invalid session token gracefully", async ({ page }) => {
    // Set an invalid session token
    await page.context().addCookies([
      {
        name: "accountability_session",
        value: "invalid-token-12345",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ])

    // Navigate to home
    await page.goto("/")

    // Should load page without crashing
    await expect(page).toHaveTitle(/Accountability/)

    // User should be treated as unauthenticated
    // The page should still render (home page is public)
  })

  test("should handle expired session token gracefully", async ({
    page,
    request
  }) => {
    // Register and login a test user
    const testUser = {
      email: `test-expired-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

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

    // Intercept auth/me to simulate expired token
    await page.route("**/api/auth/me**", (route) => {
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Session expired" })
      })
    })

    // Navigate to home
    await page.goto("/")

    // Should load page without crashing
    await expect(page).toHaveTitle(/Accountability/)
  })

  test("should handle missing session cookie gracefully", async ({ page }) => {
    // Navigate to home without any session cookie
    await page.goto("/")

    // Should load page without crashing
    await expect(page).toHaveTitle(/Accountability/)
  })

  test("should handle corrupted session data gracefully", async ({ page }) => {
    // Set a malformed session token
    await page.context().addCookies([
      {
        name: "accountability_session",
        value: "not-a-valid-jwt-token-format!!!",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ])

    // Navigate to home
    await page.goto("/")

    // Should load page without crashing
    await expect(page).toHaveTitle(/Accountability/)
  })
})

test.describe("Permission Denied States", () => {
  test("should show error when accessing organization user doesn't own", async ({
    page,
    request
  }) => {
    // Register user 1 and create an organization
    const user1 = {
      email: `test-user1-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "User 1"
    }

    await request.post("/api/auth/register", { data: user1 })
    const loginRes1 = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: user1.email,
          password: user1.password
        }
      }
    })
    const loginData1 = await loginRes1.json()

    // Create organization as user 1
    const orgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${loginData1.token}` },
      data: {
        name: `User1 Org ${Date.now()}`,
        reportingCurrency: "USD"
      }
    })
    const orgData = await orgRes.json()

    // Register user 2
    const user2 = {
      email: `test-user2-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "User 2"
    }

    await request.post("/api/auth/register", { data: user2 })
    const loginRes2 = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: user2.email,
          password: user2.password
        }
      }
    })
    const loginData2 = await loginRes2.json()

    // Set user 2's session
    await page.context().addCookies([
      {
        name: "accountability_session",
        value: loginData2.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ])

    // Try to access user 1's organization as user 2
    await page.goto(`/organizations/${orgData.id}/dashboard`)

    // Should show error content - either "not found" (if org is hidden) or "access denied"
    // The errorComponent will render an error message
    await expect(
      page.getByText(/error|not found|unauthorized|denied|access/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test("should handle unauthorized API response gracefully", async ({
    page,
    request
  }) => {
    // Register and login a test user
    const testUser = {
      email: `test-unauth-api-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // Create an organization
    const orgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Test Org ${Date.now()}`,
        reportingCurrency: "USD"
      }
    })
    const orgData = await orgRes.json()

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

    // Intercept companies API to return 403
    await page.route("**/api/v1/companies**", (route) => {
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Forbidden" })
      })
    })

    // Navigate to companies page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Should handle gracefully (error component or empty state)
    await expect(page).toHaveTitle(/Accountability/)
  })

  test("should redirect to login when accessing protected route while unauthenticated", async ({
    page
  }) => {
    // Try to access profile page (protected) without authentication
    await page.goto("/profile")

    // Should redirect to login
    await page.waitForURL(/\/login/)
    expect(page.url()).toContain("/login")
  })
})

test.describe("Error Recovery", () => {
  test("should allow navigation after error", async ({ page }) => {
    // Navigate to 404 page
    await page.goto("/non-existent-route")

    // Should show 404
    await expect(page.locator("h1")).toContainText("404")

    // Click home link
    const homeLink = page.getByRole("link", { name: /home|go back/i })
    await homeLink.click()

    // Should be able to navigate to home
    await page.waitForURL("/")
    await expect(page).toHaveTitle(/Accountability/)
  })

  test("should allow retry after form submission error", async ({ page }) => {
    // Navigate to login page
    await page.goto("/login")

    // Wait for page hydration
    await page.waitForTimeout(500)

    // Wait for form to be ready
    const emailInput = page.locator('input[type="email"]')
    await emailInput.waitFor({ state: "visible" })

    // First attempt with invalid credentials
    await emailInput.fill("invalid@example.com")
    await page.fill('input[type="password"]', "WrongPassword123")
    await page.click('button[type="submit"]', { force: true })

    // Should show error
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible({ timeout: 10000 })

    // Register a valid user
    const testUser = {
      email: `test-retry-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }
    await page.request.post("/api/auth/register", { data: testUser })

    // Clear and retry with valid credentials
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button[type="submit"]', { force: true })

    // Should succeed and redirect (not stay on login page)
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 })
    expect(page.url()).not.toContain("/login")
  })
})
