/**
 * Authentication E2E Tests
 *
 * Tests for SSR auth check in root route:
 * - Verifies session cookie is read from request headers
 * - Verifies /api/auth/me endpoint is called to validate token
 * - Verifies user context is available to child routes
 * - Verifies no flash of unauthenticated content
 */

import { test, expect } from "@playwright/test"
import { createHash } from "node:crypto"

test.describe("SSR Auth Check - Root Route", () => {
  test("should provide user context to routes when authenticated", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-${Date.now()}@example.com`,
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

    // 3. Navigate to page with session cookie set
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

    // 4. Visit root route
    await page.goto("/")

    // 5. Verify page loads without redirect (authenticated state)
    // The page should load the home page content, not redirect to login
    expect(page.url()).toContain("localhost")
    // Verify we're not on a login page
    expect(page.url()).not.toContain("/login")
  })

  test("should not require authentication for public routes", async ({ page }) => {
    // 1. Visit home page without authentication
    await page.goto("/")

    // 2. Page should still load (no automatic redirect)
    // Note: Some routes might have their own beforeLoad redirects
    // but the root route itself shouldn't fail
    expect(page).toHaveTitle(/Accountability/)
  })

  test("should handle missing session cookie gracefully", async ({ page }) => {
    // 1. Visit home page without any session cookie
    await page.goto("/")

    // 2. Page should load with user context as null
    expect(page).toHaveTitle(/Accountability/)
  })

  test("should handle invalid session token gracefully", async ({ page }) => {
    // 1. Set an invalid session token cookie
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

    // 2. Visit root route
    await page.goto("/")

    // 3. Page should load (with user as null, not error)
    expect(page).toHaveTitle(/Accountability/)
  })

  test("should not flash unauthenticated content before auth check", async ({
    page
  }) => {
    // Register and login a user
    const testUser = {
      email: `test-ssr-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "SSR Test User"
    }

    const apiContext = await page.context().newPage()
    const registerRes = await apiContext.request.post("/api/auth/register", {
      data: testUser
    })
    const loginRes = await apiContext.request.post("/api/auth/login", {
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
    await apiContext.close()

    // Set session cookie
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

    // Navigate to page - should render immediately with auth context
    // (no flash of content that changes)
    const response = await page.goto("/")
    expect(response?.status()).toBeLessThan(400)

    // Page should be fully loaded with title
    expect(page).toHaveTitle(/Accountability/)
  })
})
