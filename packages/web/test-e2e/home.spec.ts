/**
 * Home Page E2E Tests
 *
 * Tests for home page behavior:
 * - Unauthenticated: shows welcome message with login/register links
 * - Authenticated: redirects to appropriate page based on organization count
 * - Clean, professional design matching accounting application
 */

import { test, expect } from "@playwright/test"

test.describe("Home Page - Unauthenticated", () => {
  test("should display welcome message with branding", async ({ page }) => {
    // Navigate to home page without auth
    await page.goto("/")

    // Verify main heading is visible (exact: true to avoid matching "Welcome to Accountability")
    await expect(
      page.getByRole("heading", { name: "Accountability", exact: true })
    ).toBeVisible()

    // Verify tagline is visible
    await expect(
      page.getByText("Multi-company, multi-currency accounting")
    ).toBeVisible()
  })

  test("should display welcome card with description", async ({ page }) => {
    await page.goto("/")

    // Verify welcome card content
    await expect(
      page.getByText("Welcome to Accountability")
    ).toBeVisible()

    await expect(
      page.getByText(
        "Professional accounting software for managing multiple companies across currencies."
      )
    ).toBeVisible()
  })

  test("should have sign in link", async ({ page }) => {
    await page.goto("/")

    // Find Sign In link
    const signInLink = page.getByRole("link", { name: "Sign In" })
    await expect(signInLink).toBeVisible()

    // Click and verify navigation
    await signInLink.click()
    await page.waitForURL("/login")
    expect(page.url()).toContain("/login")
  })

  test("should have create account link", async ({ page }) => {
    await page.goto("/")

    // Find Create Account link
    const createAccountLink = page.getByRole("link", { name: "Create Account" })
    await expect(createAccountLink).toBeVisible()

    // Click and verify navigation
    await createAccountLink.click()
    await page.waitForURL("/register")
    expect(page.url()).toContain("/register")
  })

  test("should display feature highlights", async ({ page }) => {
    await page.goto("/")

    // Verify feature cards are visible (use exact: true to avoid matching tagline text)
    await expect(page.getByText("Company Support")).toBeVisible()
    await expect(page.getByText("Currency", { exact: true })).toBeVisible()
    await expect(page.getByText("Audit Trail")).toBeVisible()
  })
})

test.describe("Home Page - Authenticated Redirect", () => {
  // Note: Organizations are globally visible in this app (not user-scoped),
  // so the redirect behavior depends on the total count of all organizations
  // in the shared test database.

  test("should redirect authenticated user to an authenticated page", async ({
    page,
    request
  }) => {
    // Register and login a user
    const testUser = {
      email: `test-home-redirect-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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

    // Set session cookie
    await page.context().addCookies([
      {
        name: "accountability_session",
        value: loginData.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ])

    // Navigate to home page - should redirect based on organization count
    await page.goto("/")

    // Wait for redirect
    await page.waitForFunction(() => window.location.pathname !== "/")

    // Should be redirected to either:
    // - /organizations/new (if no orgs exist)
    // - /organizations/:id/dashboard (if 1 org exists)
    // - /organizations (if multiple orgs exist)
    const url = page.url()
    const validRedirects =
      url.includes("/organizations/new") ||
      url.includes("/dashboard") ||
      (url.includes("/organizations") && !url.includes("/new") && !url.includes("/dashboard"))

    expect(validRedirects).toBeTruthy()
  })

  test("should not stay on home page for authenticated user", async ({
    page,
    request
  }) => {
    // Register and login a user
    const testUser = {
      email: `test-home-no-stay-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
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

    // Set session cookie
    await page.context().addCookies([
      {
        name: "accountability_session",
        value: loginData.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ])

    // Navigate to home page
    await page.goto("/")

    // Wait for redirect to complete
    await page.waitForFunction(() => window.location.pathname !== "/")

    // URL should not be just "/" (the landing page)
    const pathname = new URL(page.url()).pathname
    expect(pathname).not.toBe("/")
  })
})

test.describe("Home Page - Professional Design", () => {
  test("should have clean, professional layout for unauthenticated users", async ({
    page
  }) => {
    await page.goto("/")

    // Page should have gray background
    const body = page.locator("body")
    await expect(body).toHaveClass(/bg-gray-50/)

    // Cards should have borders and proper styling
    const welcomeCard = page.locator(".rounded-lg.border.bg-white").first()
    await expect(welcomeCard).toBeVisible()
  })

  test("should have proper navigation links styling", async ({ page }) => {
    await page.goto("/")

    // Sign In link should have blue styling
    const signInLink = page.getByRole("link", { name: "Sign In" })
    await expect(signInLink).toHaveClass(/bg-blue-600/)

    // Create Account link should have proper styling
    const createAccountLink = page.getByRole("link", { name: "Create Account" })
    await expect(createAccountLink).toBeVisible()
  })
})
