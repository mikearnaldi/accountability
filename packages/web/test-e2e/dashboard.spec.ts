/**
 * Dashboard E2E Tests
 *
 * Tests for the organization-scoped dashboard at /organizations/:id/dashboard
 * - Dashboard metrics display correctly
 * - Sidebar navigation works
 * - Quick actions navigate correctly
 * - Responsive design elements
 * - Data-testid elements are accessible
 */

import { test, expect } from "@playwright/test"

import type { Page, APIRequestContext } from "@playwright/test"

/**
 * Helper to setup authenticated user with an organization
 */
async function setupUserWithOrganization(
  page: Page,
  request: APIRequestContext
): Promise<{ token: string; organizationId: string }> {
  // Register user
  const testUser = {
    email: `test-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: "TestPassword123",
    displayName: "Dashboard Test User"
  }

  await request.post("/api/auth/register", { data: testUser })

  // Login to get session
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
  const token = loginData.token

  // Set session cookie
  await page.context().addCookies([
    {
      name: "accountability_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax"
    }
  ])

  // Create an organization
  const orgRes = await request.post("/api/v1/organizations", {
    headers: {
      Authorization: `Bearer ${token}`
    },
    data: {
      name: `Test Org ${Date.now()}`,
      reportingCurrency: "USD",
      settings: null
    }
  })

  if (!orgRes.ok()) {
    const errorText = await orgRes.text()
    throw new Error(`Failed to create organization: ${orgRes.status()} - ${errorText}`)
  }

  const orgData = await orgRes.json()

  if (!orgData.id) {
    throw new Error(`Organization response missing id: ${JSON.stringify(orgData)}`)
  }

  return { token, organizationId: orgData.id }
}

test.describe("Dashboard - Organization Scoped", () => {
  let organizationId: string

  test.beforeEach(async ({ page, request }) => {
    const result = await setupUserWithOrganization(page, request)
    organizationId = result.organizationId
  })

  test("should display organization dashboard with header", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Verify we're on the organization dashboard
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // Verify organization header is displayed
    await expect(page.locator('[data-testid="org-dashboard-header"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-dashboard-name"]')).toBeVisible()
  })

  test("should display metrics cards for organization", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // Verify organization-specific metric cards
    await expect(page.locator('[data-testid="metric-org-companies"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-org-accounts"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-org-pending-entries"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-org-consolidation-groups"]')).toBeVisible()
  })

  test("should display quick actions for organization", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // Verify quick actions section
    await expect(page.locator('[data-testid="org-quick-actions"]')).toBeVisible()

    // Verify individual quick action cards
    await expect(page.locator('[data-testid="org-quick-action-create-company"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-quick-action-reports"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-quick-action-exchange-rates"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-quick-action-settings"]')).toBeVisible()
  })

  test("should navigate from quick action to companies", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // Click on create company quick action
    await page.locator('[data-testid="org-quick-action-create-company"]').click()

    // Should navigate to companies page
    await page.waitForURL(new RegExp(`/organizations/${organizationId}/companies`))
    expect(page.url()).toContain("/companies")
  })

  test("should display reporting currency", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // Verify currency is displayed
    await expect(page.locator('[data-testid="org-dashboard-currency"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-dashboard-currency"]')).toHaveText("USD")
  })

  test("should show activity feed section", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // Verify activity feed section exists (either with data or empty state)
    const activityFeed = page.locator('[data-testid="activity-feed"]')
    const activityFeedEmpty = page.locator('[data-testid="activity-feed-empty"]')
    await expect(activityFeed.or(activityFeedEmpty)).toBeVisible()
  })
})

test.describe("Dashboard - Sidebar Navigation", () => {
  let organizationId: string

  test.beforeEach(async ({ page, request }) => {
    const result = await setupUserWithOrganization(page, request)
    organizationId = result.organizationId
  })

  test("should display sidebar with navigation items", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for app layout to load
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()

    // Verify sidebar is displayed
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Verify organization-scoped navigation items
    await expect(page.locator('[data-testid="nav-org-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-companies"]')).toBeVisible()
  })

  test("should navigate to exchange rates from sidebar", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for sidebar to load
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Click on exchange rates link (this is a direct link, not an expandable menu)
    await page.locator('[data-testid="nav-exchange-rates"]').click()

    // Should navigate to exchange rates page
    await page.waitForURL(new RegExp(`/organizations/${organizationId}/exchange-rates`))
    expect(page.url()).toContain("/exchange-rates")
  })

  test("should highlight active route in sidebar", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for sidebar to load
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Dashboard link should be highlighted (has bg-blue-50 class)
    const dashboardLink = page.locator('[data-testid="nav-org-dashboard"]')
    await expect(dashboardLink).toHaveClass(/bg-blue-50/)
  })

  test("should collapse and expand sidebar", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for app layout to be fully rendered (React hydration)
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()

    // Wait for sidebar to load
    const sidebar = page.locator('[data-testid="sidebar"]')
    await expect(sidebar).toBeVisible()

    // Verify sidebar is initially expanded - use longer timeout for initial state
    await expect(sidebar).toHaveClass(/w-64/, { timeout: 10000 })

    // Wait for collapse toggle button to be visible and clickable
    const collapseToggle = page.locator('[data-testid="sidebar-collapse-toggle"]')
    await expect(collapseToggle).toBeVisible()
    await expect(collapseToggle).toBeEnabled()

    // Wait a moment for React hydration to complete before clicking
    await page.waitForTimeout(500)

    // Click collapse toggle using force to ensure the click registers
    await collapseToggle.click({ force: true })

    // Sidebar should be collapsed (narrower width) - wait for state update and CSS transition
    await expect(sidebar).toHaveClass(/w-16/, { timeout: 15000 })

    // Wait for CSS transition to complete (duration-300 = 300ms)
    await page.waitForTimeout(400)

    // Wait for toggle button to be ready again
    await expect(collapseToggle).toBeVisible()
    await expect(collapseToggle).toBeEnabled()

    // Click again to expand
    await collapseToggle.click({ force: true })

    // Sidebar should be expanded - wait for state update
    await expect(sidebar).toHaveClass(/w-64/, { timeout: 15000 })
  })

  test("should show sidebar logo that links to home", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto(`/organizations/${organizationId}/dashboard`)

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
  let organizationId: string

  test.beforeEach(async ({ page, request }) => {
    const result = await setupUserWithOrganization(page, request)
    organizationId = result.organizationId
  })

  test("should display header with user menu", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Verify header is displayed
    await expect(page.locator('[data-testid="header"]')).toBeVisible()

    // Verify user menu button
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible()
  })

  test("should open user menu dropdown", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for app layout to be fully rendered (React hydration)
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()

    // Wait for React hydration to complete
    await page.waitForTimeout(500)

    // Wait for user menu button to be visible and enabled
    const userMenuButton = page.locator('[data-testid="user-menu-button"]')
    await expect(userMenuButton).toBeVisible()
    await expect(userMenuButton).toBeEnabled()

    // Click user menu button with force to ensure it registers
    await userMenuButton.click({ force: true })

    // Verify dropdown is displayed (wait for React state update)
    await expect(page.locator('[data-testid="user-menu-dropdown"]')).toBeVisible({ timeout: 15000 })

    // Verify menu items
    await expect(page.locator('[data-testid="user-menu-profile"]')).toBeVisible()
    await expect(page.locator('[data-testid="user-menu-logout"]')).toBeVisible()
  })

  test("should logout from user menu", async ({ page }) => {
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for page to be fully hydrated
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()
    await page.waitForTimeout(500)

    // Click user menu button with force
    const userMenuButton = page.locator('[data-testid="user-menu-button"]')
    await expect(userMenuButton).toBeVisible()
    await userMenuButton.click({ force: true })

    // Wait for dropdown
    await expect(page.locator('[data-testid="user-menu-dropdown"]')).toBeVisible({ timeout: 15000 })

    // Click logout
    await page.locator('[data-testid="user-menu-logout"]').click()

    // Should show unauthenticated home page with sign in link
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible({
      timeout: 10000
    })
  })
})

test.describe("Dashboard - Responsive Design", () => {
  let organizationId: string

  test.beforeEach(async ({ page, request }) => {
    const result = await setupUserWithOrganization(page, request)
    organizationId = result.organizationId
  })

  test("should show mobile menu toggle on small screens", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Verify mobile menu toggle is displayed
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible()

    // Desktop sidebar should be hidden
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  test("should open mobile sidebar when clicking menu toggle", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Click mobile menu toggle
    await page.locator('[data-testid="mobile-menu-toggle"]').click()

    // Verify mobile sidebar is displayed
    await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible()

    // Verify organization-scoped navigation items (mobile versions)
    await expect(page.locator('[data-testid="mobile-nav-org-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="mobile-nav-companies"]')).toBeVisible()
  })

  test("should close mobile sidebar when clicking close button", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for page to fully load (React hydration)
    await expect(page.locator('[data-testid="header"]')).toBeVisible()

    // Wait for mobile menu toggle to be visible and enabled
    const mobileMenuToggle = page.locator('[data-testid="mobile-menu-toggle"]')
    await expect(mobileMenuToggle).toBeVisible()
    await expect(mobileMenuToggle).toBeEnabled()

    // Open mobile sidebar
    await mobileMenuToggle.click()
    await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible({ timeout: 10000 })

    // Click close button
    await page.locator('[data-testid="mobile-sidebar-close"]').click()

    // Mobile sidebar should be hidden
    await expect(page.locator('[data-testid="mobile-sidebar"]')).not.toBeVisible()
  })

  test("should display dashboard in responsive layout", async ({ page }) => {
    // Set viewport to tablet size
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(`/organizations/${organizationId}/dashboard`)

    // Wait for dashboard to load
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // All metric cards should be visible
    await expect(page.locator('[data-testid="metric-org-companies"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-org-accounts"]')).toBeVisible()
  })
})
