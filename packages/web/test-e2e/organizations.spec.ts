/**
 * Organizations Page E2E Tests
 *
 * Tests for organizations list page with SSR:
 * - beforeLoad redirects to /login if not authenticated
 * - loader fetches organizations via api.GET('/api/v1/organizations')
 * - Component uses Route.useLoaderData() for immediate data access
 * - No loading spinner on initial page load (SSR)
 * - Create organization: form calls api.POST, then router.invalidate()
 * - Empty state when no organizations
 */

import { test, expect } from "@playwright/test"

test.describe("Organizations Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to organizations without authentication
    await page.goto("/organizations")

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect query param
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations")
  })

  test("should display organizations page content (SSR)", async ({
    page,
    request
  }) => {
    // Note: Organizations are globally visible to all users (no per-user filtering yet).
    // This test verifies the page renders correctly regardless of existing data.

    // 1. Register a fresh test user
    const testUser = {
      email: `test-orgs-page-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Orgs Page Test User"
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

    // 4. Navigate to organizations page
    await page.goto("/organizations")

    // 5. Should be on organizations page (not redirected)
    expect(page.url()).toContain("/organizations")

    // 6. Should show either empty state or organizations list (depends on existing data)
    // The page should always show the organizations heading and either:
    // - Empty state: "No organizations" with "Create Organization" button
    // - List state: Organization count with "New Organization" button
    const hasOrganizations = await page.getByText(/\d+ organization/i).isVisible()

    if (hasOrganizations) {
      // List state
      await expect(page.getByRole("button", { name: /New Organization/i })).toBeVisible()
    } else {
      // Empty state
      await expect(page.getByText("No organizations")).toBeVisible()
      await expect(
        page.getByText("Get started by creating your first organization")
      ).toBeVisible()
      await expect(page.getByRole("button", { name: /Create Organization/i })).toBeVisible()
    }
  })

  test("should render organizations list with data (SSR - no loading spinner)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-list-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "List Test User"
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
    const orgName = `Test Org ${Date.now()}`
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: orgName,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()

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

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Should be on organizations page
    expect(page.url()).toContain("/organizations")

    // 7. Should NOT show loading spinner (SSR data is immediately available)
    // The organization name should be visible immediately
    await expect(page.getByText(orgName)).toBeVisible()

    // 8. Should show organization count (at least 1 since we just created one)
    // Note: Count may be higher than 1 if other tests have created organizations
    await expect(page.getByText(/\d+ organization/i)).toBeVisible()
  })

  test("should create organization via form", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Test User"
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

    // 4. Set localStorage token (needed for client-side API calls)
    // Navigate to a page first to set localStorage (can only set localStorage for loaded pages)
    await page.goto("/login")
    await page.evaluate((token) => {
      localStorage.setItem("accountabilitySessionToken", token)
    }, sessionToken)

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Click create organization button (either "Create Organization" in empty state or "New Organization" in list state)
    const createButton = page.getByRole("button", { name: /Create Organization|New Organization/i })
    await createButton.click()

    // 7. Fill form
    const newOrgName = `New Org ${Date.now()}`
    await page.fill("#org-name", newOrgName)

    // 8. Select currency
    await page.selectOption("#org-currency", "EUR")

    // 9. Submit form
    await page.click('button[type="submit"]')

    // 10. After creating, should navigate to the new org's dashboard
    // The form submits and navigates to /organizations/:id/dashboard
    await page.waitForURL(/\/organizations\/[^/]+\/dashboard/, { timeout: 10000 })

    // 11. Should see the organization name on the dashboard
    await expect(page.getByTestId("org-dashboard-name")).toContainText(newOrgName)
  })

  test("should show form validation error for empty name", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-validation-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Validation Test User"
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

    // 4. Navigate to organizations page
    await page.goto("/organizations")

    // 5. Click create organization button (either "Create Organization" in empty state or "New Organization" in list state)
    const createButton = page.getByRole("button", { name: /Create Organization|New Organization/i })
    await createButton.click()

    // 6. Clear the name field and submit
    await page.fill("#org-name", "   ") // Just whitespace
    await page.click('button[type="submit"]')

    // 7. Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText(/Organization name is required/i)).toBeVisible()
  })

  test("should cancel form and close modal", async ({ page, request }) => {
    // 1. Register a test user with existing org
    const testUser = {
      email: `test-cancel-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Cancel Test User"
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

    // 3. Create an organization (so we get the modal instead of inline form)
    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Existing Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })

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

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Click new organization button
    await page.getByRole("button", { name: /New Organization/i }).click()

    // 7. Modal should be visible
    await expect(page.getByText("Create Organization")).toBeVisible()

    // 8. Click cancel (use specific data-testid to avoid matching organization cards)
    await page.locator('[data-testid="cancel-create-org-button"]').click()

    // 9. Modal should be hidden
    await expect(page.getByRole("heading", { name: "Create Organization" })).not.toBeVisible()
  })
})

// =============================================================================
// Organization Selection Flow E2E Tests (Story 3.1)
// =============================================================================

test.describe("Organization Selection Flow", () => {
  test("should navigate to organization dashboard when card is clicked", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-card-click-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Card Click Test User"
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

    // 3. Create two organizations (to avoid auto-redirect)
    const org1Name = `Test Org 1 ${Date.now()}`
    const org2Name = `Test Org 2 ${Date.now()}`

    const createOrg1Res = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: org1Name,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrg1Res.ok()).toBeTruthy()
    const org1Data = await createOrg1Res.json()

    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: org2Name,
        reportingCurrency: "EUR",
        settings: null
      }
    })

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

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Should show both organizations
    await expect(page.getByText(org1Name)).toBeVisible()
    await expect(page.getByText(org2Name)).toBeVisible()

    // 7. Click on the first organization card
    await page.locator(`[data-testid="organization-card-${org1Data.id}"]`).click()

    // 8. Should navigate to organization dashboard
    await page.waitForURL(`/organizations/${org1Data.id}/dashboard`)
    expect(page.url()).toContain(`/organizations/${org1Data.id}/dashboard`)
  })

  // NOTE: This test is skipped because organizations are currently globally visible.
  // Auto-redirect only works when EXACTLY 1 organization exists in the database globally,
  // which we cannot guarantee in E2E tests with shared database state.
  // When user-scoped organization visibility is implemented, re-enable this test.
  test.skip("should auto-redirect to dashboard when user has only one organization", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-auto-redirect-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Auto Redirect Test User"
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

    // 3. Create exactly one organization
    const orgName = `Single Org ${Date.now()}`
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: orgName,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

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

    // 5. Navigate to organizations page - should auto-redirect
    await page.goto("/organizations")

    // 6. Should be redirected to the organization's dashboard
    await page.waitForURL(`/organizations/${orgData.id}/dashboard`, { timeout: 10000 })
    expect(page.url()).toContain(`/organizations/${orgData.id}/dashboard`)
  })

  // NOTE: This test is skipped because organizations are currently globally visible.
  // Empty state only shows when 0 organizations exist in the database globally,
  // which we cannot guarantee in E2E tests with shared database state.
  // When user-scoped organization visibility is implemented, re-enable this test.
  test.skip("should show empty state when user has no organizations", async ({
    page,
    request
  }) => {
    // 1. Register a fresh test user (no organizations)
    const testUser = {
      email: `test-empty-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Empty State Test User"
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

    // 4. Navigate to organizations page
    await page.goto("/organizations")

    // 5. Should show empty state
    await expect(page.locator('[data-testid="organizations-empty-state"]')).toBeVisible()
    await expect(page.getByText("No organizations")).toBeVisible()
    await expect(page.getByText("Get started by creating your first organization")).toBeVisible()
    await expect(page.locator('[data-testid="create-organization-button"]')).toBeVisible()
  })

  test("should filter organizations with search", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-search-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Search Test User"
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

    // 3. Create multiple organizations with different names
    const timestamp = Date.now()
    const alphaOrgName = `Alpha Corp ${timestamp}`
    const betaOrgName = `Beta Industries ${timestamp}`
    const gammaOrgName = `Gamma Ltd ${timestamp}`

    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: { name: alphaOrgName, reportingCurrency: "USD", settings: null }
    })

    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: { name: betaOrgName, reportingCurrency: "EUR", settings: null }
    })

    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: { name: gammaOrgName, reportingCurrency: "GBP", settings: null }
    })

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

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. All three organizations should be visible initially
    await expect(page.getByText(alphaOrgName)).toBeVisible()
    await expect(page.getByText(betaOrgName)).toBeVisible()
    await expect(page.getByText(gammaOrgName)).toBeVisible()

    // 7. Search for "Alpha"
    await page.locator('[data-testid="organizations-search-input"]').fill("Alpha")

    // 8. Only Alpha Corp should be visible
    await expect(page.getByText(alphaOrgName)).toBeVisible()
    await expect(page.getByText(betaOrgName)).not.toBeVisible()
    await expect(page.getByText(gammaOrgName)).not.toBeVisible()

    // 9. Clear search and search by currency
    await page.locator('[data-testid="organizations-search-input"]').fill("EUR")

    // 10. Only Beta Industries (EUR) should be visible
    await expect(page.getByText(alphaOrgName)).not.toBeVisible()
    await expect(page.getByText(betaOrgName)).toBeVisible()
    await expect(page.getByText(gammaOrgName)).not.toBeVisible()

    // 11. Clear search
    await page.locator('[data-testid="organizations-search-input"]').fill("")

    // 12. All organizations should be visible again
    await expect(page.getByText(alphaOrgName)).toBeVisible()
    await expect(page.getByText(betaOrgName)).toBeVisible()
    await expect(page.getByText(gammaOrgName)).toBeVisible()
  })

  test("should show no results message when search has no matches", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-no-results-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "No Results Test User"
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

    // 3. Create two organizations
    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: { name: `Org A ${Date.now()}`, reportingCurrency: "USD", settings: null }
    })

    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: { name: `Org B ${Date.now()}`, reportingCurrency: "EUR", settings: null }
    })

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

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Search for something that doesn't exist
    await page.locator('[data-testid="organizations-search-input"]').fill("XYZ NonExistent")

    // 7. Should show no results message
    await expect(page.locator('[data-testid="organizations-no-results"]')).toBeVisible()
    await expect(page.getByText("No results found")).toBeVisible()
    await expect(page.getByText(/No organizations match "XYZ NonExistent"/)).toBeVisible()

    // 8. Clear search button should work
    await page.getByText("Clear search").click()

    // 9. Organizations should be visible again
    await expect(page.locator('[data-testid="organizations-grid"]')).toBeVisible()
  })

  test("should display organization card with all required information", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-card-info-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Card Info Test User"
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

    // 3. Create two organizations (to avoid auto-redirect)
    const orgName = `Info Card Org ${Date.now()}`
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: orgName,
        reportingCurrency: "EUR",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // Create a second org to avoid auto-redirect
    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Second Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })

    // 4. Create a company for the first organization
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: "Test Company",
        legalName: "Test Company Inc.",
        jurisdiction: "US",
        taxId: null,
        functionalCurrency: "EUR",
        reportingCurrency: "EUR",
        fiscalYearEnd: { month: 12, day: 31 },
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
      }
    })
    expect(createCompanyRes.ok()).toBeTruthy()

    // 5. Set session cookie
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

    // 6. Navigate to organizations page
    await page.goto("/organizations")

    // 7. Verify organization card has all required information
    const orgCard = page.locator(`[data-testid="organization-card-${orgData.id}"]`)
    await expect(orgCard).toBeVisible()

    // Organization name
    await expect(page.locator(`[data-testid="organization-name-${orgData.id}"]`)).toContainText(orgName)

    // Reporting currency
    await expect(page.locator(`[data-testid="organization-currency-${orgData.id}"]`)).toContainText("EUR")

    // Companies count - wait with retry for the count to update
    // The SSR loader fetches company count, may need a reload if data isn't fresh
    await expect(
      page.locator(`[data-testid="organization-companies-count-${orgData.id}"]`)
    ).toContainText("1 company", { timeout: 5000 }).catch(async () => {
      // Reload page if company count isn't showing yet (SSR cache issue)
      await page.reload()
      await expect(
        page.locator(`[data-testid="organization-companies-count-${orgData.id}"]`)
      ).toContainText("1 company", { timeout: 5000 })
    })

    // Last accessed date (using Created for now)
    await expect(page.locator(`[data-testid="organization-last-accessed-${orgData.id}"]`)).toContainText("Created")
  })
})
