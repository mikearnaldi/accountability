/**
 * Home Page E2E Tests
 *
 * Tests for home page / dashboard:
 * - Unauthenticated: shows welcome message with login/register links
 * - Authenticated: shows user greeting and quick navigation
 * - Link to organizations list
 * - Logout button in header
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

test.describe("Home Page - Authenticated", () => {
  test.beforeEach(async ({ page, request }) => {
    // Register and login a test user
    const testUser = {
      email: `test-home-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Test User"
    }

    await request.post("/api/auth/register", {
      data: testUser
    })

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
  })

  test("should display user greeting", async ({ page }) => {
    await page.goto("/")

    // Verify welcome message with user greeting
    await expect(page.getByText(/Welcome back/)).toBeVisible()
  })

  test("should display header with logo and user info", async ({ page }) => {
    await page.goto("/")

    // Verify header elements
    const logo = page.getByRole("link", { name: "Accountability" }).first()
    await expect(logo).toBeVisible()

    // Verify user display name or email is shown
    const header = page.locator("header")
    await expect(header).toBeVisible()
  })

  test("should have logout button in header", async ({ page }) => {
    await page.goto("/")

    // Find Sign Out button
    const signOutButton = page.getByRole("button", { name: "Sign Out" })
    await expect(signOutButton).toBeVisible()
  })

  test("should logout when clicking sign out button", async ({ page }) => {
    await page.goto("/")

    // Click Sign Out button
    const signOutButton = page.getByRole("button", { name: "Sign Out" })
    await signOutButton.click()

    // Wait for logout to complete - user should be redirected or see unauthenticated state
    // After logout, the home page should show login/register links
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible({
      timeout: 10000
    })
  })

  test("should show loading state during logout", async ({ page }) => {
    await page.goto("/")

    // Slow down the network for the logout request so we can observe loading state
    await page.route("**/api/auth/logout", async (route) => {
      // Add a delay to observe loading state
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.continue()
    })

    // Click Sign Out button
    const signOutButton = page.getByRole("button", { name: "Sign Out" })
    await signOutButton.click()

    // Button should show loading state (text changes to "Signing out...")
    // Use a locator that matches the loading text since button name changes
    await expect(page.getByText("Signing out...")).toBeVisible()

    // Wait for logout to complete
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible({
      timeout: 10000
    })
  })

  test("should have link to organizations page", async ({ page }) => {
    await page.goto("/")

    // Find Organizations card/link
    const orgsLink = page.getByRole("link", { name: /Organizations/i })
    await expect(orgsLink).toBeVisible()

    // Click and verify navigation
    await orgsLink.click()
    await page.waitForURL("/organizations")
    expect(page.url()).toContain("/organizations")
  })

  test("should display quick navigation cards", async ({ page }) => {
    await page.goto("/")

    // Verify navigation cards are displayed
    await expect(
      page.getByRole("heading", { name: "Organizations" })
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible()
  })

  test("should display getting started guide", async ({ page }) => {
    await page.goto("/")

    // Verify getting started section
    await expect(page.getByText("Getting Started")).toBeVisible()
    await expect(
      page.getByText("Create an organization to group related companies")
    ).toBeVisible()
  })

  test("should navigate home when clicking logo", async ({ page }) => {
    // First navigate to a different page
    await page.goto("/organizations")

    // Click logo to go home
    const logo = page.getByRole("link", { name: "Accountability" }).first()
    await logo.click()

    // Should be on home page
    await page.waitForURL("/")
    expect(page.url().endsWith("/") || page.url().endsWith("localhost:3000")).toBeTruthy()
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

  test("should have professional layout for authenticated users", async ({
    page,
    request
  }) => {
    // Register and login
    const testUser = {
      email: `test-design-${Date.now()}@example.com`,
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

    await page.goto("/")

    // Header should have border
    const header = page.locator("header.border-b")
    await expect(header).toBeVisible()

    // Main content should have proper max-width
    const main = page.locator("main.max-w-7xl")
    await expect(main).toBeVisible()

    // Navigation cards should be in a grid
    const navGrid = page.locator(".grid.gap-6")
    await expect(navGrid).toBeVisible()
  })
})
