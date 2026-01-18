/**
 * Organization-Scoped Dashboard E2E Tests
 *
 * Tests for the organization dashboard at /organizations/:organizationId/dashboard:
 * - beforeLoad redirects to /login if not authenticated
 * - Dashboard shows organization header with name and currency
 * - Dashboard shows org-scoped metrics (companies, accounts, pending entries, consolidation groups)
 * - Quick actions navigate correctly
 * - Activity feed shows placeholder
 */

import { test, expect } from "@playwright/test"

test.describe("Organization Dashboard", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // Navigate to org dashboard without authentication
    await page.goto("/organizations/test-org-id/dashboard")

    // Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toContain("/organizations/test-org-id/dashboard")
  })

  test("should display organization dashboard with org-scoped data", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-org-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Org Dashboard Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login to get session token
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

    // 3. Create an organization via API
    const orgName = `Test Dashboard Org ${Date.now()}`
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: orgName,
        reportingCurrency: "EUR",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const organization = await createOrgRes.json()

    // 4. Set session cookie
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

    // 5. Navigate to organization dashboard
    await page.goto(`/organizations/${organization.id}/dashboard`)

    // 6. Should be on the dashboard page
    expect(page.url()).toContain(`/organizations/${organization.id}/dashboard`)

    // 7. Verify org dashboard is displayed
    await expect(page.locator('[data-testid="org-dashboard"]')).toBeVisible()

    // 8. Verify organization header
    await expect(page.locator('[data-testid="org-dashboard-header"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-dashboard-name"]')).toContainText(orgName)
    await expect(page.locator('[data-testid="org-dashboard-currency"]')).toContainText("EUR")
  })

  test("should display org-scoped metrics cards", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-org-metrics-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Metrics Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // 2. Create organization
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Metrics Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    const organization = await createOrgRes.json()

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

    // 4. Navigate to dashboard
    await page.goto(`/organizations/${organization.id}/dashboard`)

    // 5. Verify metrics grid
    await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible()

    // 6. Verify individual metric cards
    await expect(page.locator('[data-testid="metric-org-companies"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-org-accounts"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-org-pending-entries"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-org-consolidation-groups"]')).toBeVisible()
  })

  test("should display quick actions", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-org-actions-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Actions Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // 2. Create organization
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Actions Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    const organization = await createOrgRes.json()

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

    // 4. Navigate to dashboard
    await page.goto(`/organizations/${organization.id}/dashboard`)

    // 5. Verify quick actions section
    await expect(page.locator('[data-testid="org-quick-actions"]')).toBeVisible()

    // 6. Verify individual quick action cards
    await expect(page.locator('[data-testid="org-quick-action-create-company"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-quick-action-reports"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-quick-action-exchange-rates"]')).toBeVisible()
    await expect(page.locator('[data-testid="org-quick-action-settings"]')).toBeVisible()
  })

  test("should navigate to companies from quick action", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-org-nav-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Navigation Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // 2. Create organization
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Nav Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    const organization = await createOrgRes.json()

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

    // 4. Navigate to dashboard
    await page.goto(`/organizations/${organization.id}/dashboard`)

    // 5. Click on create company quick action (which links to new company form)
    await page.locator('[data-testid="org-quick-action-create-company"]').click()

    // 6. Should navigate to new company form page
    await page.waitForURL(`/organizations/${organization.id}/companies/new`)
    expect(page.url()).toContain(`/organizations/${organization.id}/companies/new`)
  })

  test("should display activity feed section", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-org-activity-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Activity Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // 2. Create organization
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Activity Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    const organization = await createOrgRes.json()

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

    // 4. Navigate to dashboard
    await page.goto(`/organizations/${organization.id}/dashboard`)

    // 5. Verify activity feed section is present (either with data or empty state)
    // The activity feed can show entries (from audit log) or empty state depending on system state
    const activityFeedWithData = page.locator('[data-testid="activity-feed"]')
    const activityFeedEmpty = page.locator('[data-testid="activity-feed-empty"]')

    // Wait for either the populated feed or empty state to be visible
    await expect(activityFeedWithData.or(activityFeedEmpty)).toBeVisible({ timeout: 10000 })

    // Verify the Recent Activity heading is visible (use role to get the heading specifically)
    await expect(page.getByRole("heading", { name: "Recent Activity" })).toBeVisible()
  })

  test("should show sidebar with org-scoped navigation", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-org-sidebar-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Sidebar Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // 2. Create organization
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Sidebar Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    const organization = await createOrgRes.json()

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

    // 4. Set viewport to desktop
    await page.setViewportSize({ width: 1280, height: 720 })

    // 5. Navigate to dashboard
    await page.goto(`/organizations/${organization.id}/dashboard`)

    // 6. Verify sidebar is displayed
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // 7. Verify org-scoped navigation items
    await expect(page.locator('[data-testid="nav-org-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-companies"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-exchange-rates"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-consolidation"]')).toBeVisible()

    // 8. Dashboard link should be active (highlighted)
    const dashboardLink = page.locator('[data-testid="nav-org-dashboard"]')
    await expect(dashboardLink).toHaveClass(/bg-blue-50/)
  })

  test("should show organization not found for invalid org id", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-org-notfound-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: "TestPassword123",
      displayName: "Not Found Test User"
    }

    await request.post("/api/auth/register", { data: testUser })
    const loginRes = await request.post("/api/auth/login", {
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    const loginData = await loginRes.json()
    const sessionToken = loginData.token

    // 2. Set session cookie
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

    // 3. Navigate to dashboard with invalid org id
    await page.goto("/organizations/invalid-org-id/dashboard")

    // 4. Should show not found message
    await expect(page.getByText("Organization Not Found")).toBeVisible()
    await expect(page.getByText("The requested organization could not be found")).toBeVisible()
  })
})
