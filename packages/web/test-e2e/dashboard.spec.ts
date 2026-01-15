/**
 * Dashboard E2E Tests
 *
 * Tests for the full-featured dashboard:
 * - Dashboard metrics display correctly
 * - Sidebar navigation works
 * - Quick actions navigate correctly
 * - Responsive design elements
 * - Data-testid elements are accessible
 */

import { test, expect } from "@playwright/test"

test.describe("Dashboard - Authenticated User", () => {
  test.beforeEach(async ({ page, request }) => {
    // Register and login a test user
    const testUser = {
      email: `test-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Dashboard Test User"
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

  test("should display dashboard with metrics", async ({ page }) => {
    await page.goto("/")

    // Verify we're on the authenticated dashboard
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify welcome message
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible()
    await expect(page.getByText(/Welcome back/)).toBeVisible()
  })

  test("should display metrics cards", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify metrics grid is displayed
    await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible()

    // Verify individual metric cards
    await expect(page.locator('[data-testid="metric-organizations"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-companies"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-pending-entries"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-open-periods"]')).toBeVisible()
  })

  test("should display correct metric values", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify metric values are displayed (should be numbers - could be any count since database is shared)
    const orgsValue = page.locator('[data-testid="metric-organizations-value"]')
    await expect(orgsValue).toBeVisible()
    const orgsText = await orgsValue.textContent()
    expect(orgsText).toMatch(/^\d+$/) // Should be a number

    const companiesValue = page.locator('[data-testid="metric-companies-value"]')
    await expect(companiesValue).toBeVisible()
    const companiesText = await companiesValue.textContent()
    expect(companiesText).toMatch(/^\d+$/) // Should be a number
  })

  test("should display quick actions", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify quick actions section
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible()

    // Verify individual quick action cards
    await expect(page.locator('[data-testid="quick-action-new-journal"]')).toBeVisible()
    await expect(page.locator('[data-testid="quick-action-run-report"]')).toBeVisible()
    await expect(page.locator('[data-testid="quick-action-create-company"]')).toBeVisible()
  })

  test("should navigate from quick action to organizations", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Click on create company quick action
    await page.locator('[data-testid="quick-action-create-company"]').click()

    // Should navigate to organizations page
    await page.waitForURL("/organizations")
    expect(page.url()).toContain("/organizations")
  })

  test("should display activity feed", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify activity feed is displayed (empty state for new user)
    await expect(page.locator('[data-testid="activity-feed-empty"]')).toBeVisible()
  })

  test("should display balance summary", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify balance summary section is displayed (either with data or empty state)
    // Note: Database is shared, so we check for either state
    const balanceSummary = page.locator('[data-testid="balance-summary"]')
    const balanceSummaryEmpty = page.locator('[data-testid="balance-summary-empty"]')

    // Wait for one of the two states to be visible
    await expect(balanceSummary.or(balanceSummaryEmpty)).toBeVisible()
  })

  test("should display period deadlines", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify period deadlines is displayed (empty state for new user)
    await expect(page.locator('[data-testid="period-deadlines-empty"]')).toBeVisible()
  })

  test("should display getting started section for new user", async ({ page }) => {
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Getting started section is only shown when user has no organizations
    // Since database is shared, we check that either getting started is shown
    // OR the metrics show data (meaning user has organizations)
    const gettingStarted = page.locator('[data-testid="getting-started"]')
    const metricsGrid = page.locator('[data-testid="metrics-grid"]')

    // Dashboard should show either getting started OR metrics with data
    await expect(metricsGrid).toBeVisible()

    // If organizations count is 0, getting started should be visible
    const orgsValue = await page.locator('[data-testid="metric-organizations-value"]').textContent()
    if (orgsValue === "0") {
      await expect(gettingStarted).toBeVisible()
      await expect(page.getByText("Getting Started")).toBeVisible()
    } else {
      // Getting started is hidden when user has organizations
      await expect(gettingStarted).not.toBeVisible()
    }
  })
})

test.describe("Dashboard - Sidebar Navigation", () => {
  test.beforeEach(async ({ page, request }) => {
    // Register and login a test user
    const testUser = {
      email: `test-sidebar-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Sidebar Test User"
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

  test("should display sidebar with navigation items", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto("/")

    // Wait for app layout to load
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()

    // Verify sidebar is displayed
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Verify navigation items
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-organizations"]')).toBeVisible()
  })

  test("should navigate to organizations from sidebar", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto("/")

    // Wait for sidebar to load
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Click on organizations link
    await page.locator('[data-testid="nav-organizations"]').click()

    // Should navigate to organizations page
    await page.waitForURL("/organizations")
    expect(page.url()).toContain("/organizations")
  })

  test("should highlight active route in sidebar", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto("/")

    // Wait for sidebar to load
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Dashboard link should be highlighted (has bg-blue-50 class)
    const dashboardLink = page.locator('[data-testid="nav-dashboard"]')
    await expect(dashboardLink).toHaveClass(/bg-blue-50/)
  })

  test("should collapse and expand sidebar", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto("/")

    // Wait for sidebar to load
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Click collapse toggle
    await page.locator('[data-testid="sidebar-collapse-toggle"]').click()

    // Sidebar should be collapsed (narrower width)
    const sidebar = page.locator('[data-testid="sidebar"]')
    await expect(sidebar).toHaveClass(/w-16/)

    // Click again to expand
    await page.locator('[data-testid="sidebar-collapse-toggle"]').click()

    // Sidebar should be expanded
    await expect(sidebar).toHaveClass(/w-64/)
  })

  test("should show sidebar logo that links to home", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })

    // Start from home page (AppLayout with sidebar is only on home dashboard)
    await page.goto("/")

    // Wait for app layout to load
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()

    // Wait for sidebar to be visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Get the sidebar logo
    const sidebarLogo = page.locator('[data-testid="sidebar-logo"]')
    await expect(sidebarLogo).toBeVisible()

    // Verify logo has href to home
    await expect(sidebarLogo).toHaveAttribute("href", "/")

    // Verify logo text/content is present
    await expect(sidebarLogo).toContainText("Accountability")
  })
})

test.describe("Dashboard - Header", () => {
  test.beforeEach(async ({ page, request }) => {
    // Register and login a test user
    const testUser = {
      email: `test-header-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Header Test User"
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

  test("should display header with user menu", async ({ page }) => {
    await page.goto("/")

    // Verify header is displayed
    await expect(page.locator('[data-testid="header"]')).toBeVisible()

    // Verify user menu button
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible()

    // Note: NO search/notifications per requirements - "NO search/notifications (no API)"
  })

  test("should open user menu dropdown", async ({ page }) => {
    await page.goto("/")

    // Click user menu button
    await page.locator('[data-testid="user-menu-button"]').click()

    // Verify dropdown is displayed
    await expect(page.locator('[data-testid="user-menu-dropdown"]')).toBeVisible()

    // Verify menu items
    await expect(page.locator('[data-testid="user-menu-profile"]')).toBeVisible()
    await expect(page.locator('[data-testid="user-menu-settings"]')).toBeVisible()
    await expect(page.locator('[data-testid="user-menu-logout"]')).toBeVisible()
  })

  test("should logout from user menu", async ({ page }) => {
    await page.goto("/")

    // Click user menu button
    await page.locator('[data-testid="user-menu-button"]').click()

    // Wait for dropdown
    await expect(page.locator('[data-testid="user-menu-dropdown"]')).toBeVisible()

    // Click logout
    await page.locator('[data-testid="user-menu-logout"]').click()

    // Should show unauthenticated home page with sign in link
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible({
      timeout: 10000
    })
  })

  // Note: Search input test removed - per requirements "NO search/notifications (no API)"
})

test.describe("Dashboard - Responsive Design", () => {
  test.beforeEach(async ({ page, request }) => {
    // Register and login a test user
    const testUser = {
      email: `test-responsive-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Responsive Test User"
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

  test("should show mobile menu toggle on small screens", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")

    // Verify mobile menu toggle is displayed
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible()

    // Desktop sidebar should be hidden
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  test("should open mobile sidebar when clicking menu toggle", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")

    // Click mobile menu toggle
    await page.locator('[data-testid="mobile-menu-toggle"]').click()

    // Verify mobile sidebar is displayed
    await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible()

    // Verify navigation items
    await expect(page.locator('[data-testid="mobile-nav-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-nav-organizations"]')).toBeVisible()
  })

  test("should close mobile sidebar when clicking close button", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto("/")

    // Open mobile sidebar
    await page.locator('[data-testid="mobile-menu-toggle"]').click()
    await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible()

    // Click close button
    await page.locator('[data-testid="mobile-sidebar-close"]').click()

    // Mobile sidebar should be hidden
    await expect(page.locator('[data-testid="mobile-sidebar"]')).not.toBeVisible()
  })

  test("should display metrics in responsive grid", async ({ page }) => {
    // Set viewport to tablet size
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto("/")

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="authenticated-dashboard"]')).toBeVisible()

    // Verify metrics grid is displayed
    await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible()

    // All metric cards should be visible
    await expect(page.locator('[data-testid="metric-organizations"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-companies"]')).toBeVisible()
  })
})
