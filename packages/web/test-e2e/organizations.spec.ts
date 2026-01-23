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

import { test, expect, type Page } from "@playwright/test"

/**
 * Helper to select an option from a Combobox component.
 * The Combobox is a div-based searchable dropdown, not a native select.
 * Uses @floating-ui/react which handles click on the container div, not the button.
 *
 * @param page - Playwright page
 * @param testId - The data-testid of the combobox
 * @param searchText - Text to search for (partial match)
 */
async function selectComboboxOption(
  page: Page,
  testId: string,
  searchText: string
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)

  // Wait for combobox to be ready
  await expect(combobox).toBeVisible({ timeout: 5000 })

  // Get the button inside (to verify state before/after click)
  const button = combobox.locator("button")
  await expect(button).toBeVisible({ timeout: 5000 })

  // Click the button to trigger the dropdown open
  // The floating-ui useClick hook is on the parent div, but the button click bubbles up
  await button.click()

  // Wait a moment for React state to update
  await page.waitForTimeout(100)

  // Wait for dropdown to open - the combobox shows input when open
  const input = combobox.locator("input")

  // If input is not visible yet, the click might not have triggered - try clicking again
  const inputVisible = await input.isVisible().catch(() => false)
  if (!inputVisible) {
    // Try clicking the container div directly with force
    await combobox.click({ force: true })
    await page.waitForTimeout(100)
  }

  await expect(input).toBeVisible({ timeout: 5000 })

  // Type to filter options
  await input.fill(searchText)

  // Wait for dropdown list to appear (rendered in FloatingPortal)
  await expect(page.locator("li").first()).toBeVisible({ timeout: 5000 })

  // Click the first matching option in the dropdown
  const option = page.locator(`li:has-text("${searchText}")`).first()
  await expect(option).toBeVisible({ timeout: 5000 })
  await option.click()

  // Wait for dropdown to close and state to update
  await page.waitForTimeout(200)
}

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
      // List state - "New Organization" is a Link, not a button
      await expect(page.getByTestId("new-organization-button")).toBeVisible()
    } else {
      // Empty state - "Create Organization" is a Link
      await expect(page.getByText("No organizations")).toBeVisible()
      await expect(
        page.getByText("Get started by creating your first organization")
      ).toBeVisible()
      await expect(page.getByTestId("create-organization-button")).toBeVisible()
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

    // 4. Navigate to organizations page
    await page.goto("/organizations")

    // 5. Wait for React hydration
    await page.waitForTimeout(500)

    // 6. Click create organization button (handles both empty state and list view)
    // Empty state has create-organization-button, list has new-organization-button
    const createButton = page.getByTestId("create-organization-button")
    const newOrgButton = page.getByTestId("new-organization-button")

    // Wait for either button to be visible (fresh user sees empty state)
    await expect(createButton.or(newOrgButton)).toBeVisible({ timeout: 10000 })

    // Click whichever button is visible
    if (await createButton.isVisible()) {
      await createButton.click({ force: true })
    } else {
      await newOrgButton.click({ force: true })
    }

    // 7. Wait for navigation to create organization page
    await page.waitForURL("/organizations/new", { timeout: 10000 })

    // 8. Fill form
    const newOrgName = `New Org ${Date.now()}`
    await page.fill("#org-name", newOrgName)

    // 9. Select currency using Combobox helper
    await selectComboboxOption(page, "org-currency-select", "EUR")

    // 10. Submit form
    await page.getByTestId("org-form-submit-button").click()

    // 11. After creating, should navigate to the new org's detail page
    await page.waitForURL(/\/organizations\/[^/]+$/, { timeout: 15000 })

    // 12. Should see the organization name on the detail page (use heading to avoid breadcrumb)
    await expect(page.getByRole("heading", { name: newOrgName })).toBeVisible({ timeout: 5000 })
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

    // 4. Navigate to create organization page directly
    await page.goto("/organizations/new")

    // 5. Wait for form to load and hydrate
    const nameInput = page.locator("#org-name")
    await expect(nameInput).toBeVisible()
    // Wait for form to be ready - ensure React hydration is complete
    await expect(page.getByTestId("org-form-submit-button")).toBeEnabled()

    // Wait for full hydration before interacting
    await page.waitForTimeout(500)

    // 6. Clear the name field and submit
    await nameInput.click()
    await nameInput.fill("   ") // Just whitespace
    await expect(nameInput).toHaveValue("   ")

    // Click submit button using force to ensure click registers
    const submitButton = page.getByTestId("org-form-submit-button")
    await submitButton.click({ force: true })

    // 7. Should show validation error - check both possible error locations
    // The error could appear as an inline error message under the input
    await expect(
      page.getByText(/Organization name is required/i).or(page.getByTestId("org-name-error"))
    ).toBeVisible({ timeout: 15000 })
  })

  test("should cancel form and navigate back", async ({ page, request }) => {
    // 1. Register a test user
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

    // 4. Navigate to create organization page
    await page.goto("/organizations/new")

    // 5. Wait for form to be visible
    await expect(page.getByTestId("organization-form")).toBeVisible()

    // 6. First, blur the auto-focused name input by clicking on the header
    await page.getByRole("heading", { name: "Create Organization" }).click()
    await page.waitForTimeout(100)

    // 7. Click cancel button (now a link)
    await page.getByTestId("org-form-cancel-button").click()

    // 8. Should navigate back to organizations list
    await page.waitForURL("/organizations", { timeout: 10000 })
    expect(page.url()).toContain("/organizations")
    expect(page.url()).not.toContain("/new")
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

    // 6. Wait for page to be fully loaded
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()
    await page.waitForTimeout(500)

    // 7. Should show both organizations
    await expect(page.getByText(org1Name)).toBeVisible()
    await expect(page.getByText(org2Name)).toBeVisible()

    // 8. Click on the first organization card
    const orgCard = page.locator(`[data-testid="organization-card-${org1Data.id}"]`)
    await expect(orgCard).toBeVisible()
    await orgCard.click({ force: true })

    // 9. Should navigate to organization dashboard
    await page.waitForURL(`/organizations/${org1Data.id}/dashboard`, { timeout: 15000 })
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

    // 6. Wait for page to be fully hydrated
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()
    await page.waitForTimeout(500)

    // 7. All three organizations should be visible initially
    await expect(page.getByText(alphaOrgName)).toBeVisible()
    await expect(page.getByText(betaOrgName)).toBeVisible()
    await expect(page.getByText(gammaOrgName)).toBeVisible()

    // 8. Search for "Alpha"
    const searchInput = page.locator('[data-testid="organizations-search-input"]')
    await expect(searchInput).toBeVisible()
    await searchInput.pressSequentially("Alpha", { delay: 50 })

    // 9. Only Alpha Corp should be visible (wait for filter to apply)
    await expect(page.getByText(alphaOrgName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(betaOrgName)).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByText(gammaOrgName)).not.toBeVisible({ timeout: 10000 })

    // 10. Clear search and search by currency
    await searchInput.clear()
    await page.waitForTimeout(200)
    await searchInput.pressSequentially("EUR", { delay: 50 })

    // 11. Only Beta Industries (EUR) should be visible (wait for filter to apply)
    await expect(page.getByText(alphaOrgName)).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByText(betaOrgName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(gammaOrgName)).not.toBeVisible({ timeout: 10000 })

    // 12. Clear search
    await searchInput.clear()

    // 13. All organizations should be visible again (wait for filter to clear)
    await expect(page.getByText(alphaOrgName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(betaOrgName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(gammaOrgName)).toBeVisible({ timeout: 10000 })
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

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("organizations-list-container")).toBeVisible()

    // Wait for search input to be visible
    const searchInput = page.locator('[data-testid="organizations-search-input"]')
    await expect(searchInput).toBeVisible()

    // 6. Search for something that doesn't exist - use pressSequentially to ensure proper event triggering
    await searchInput.pressSequentially("XYZ NonExistent", { delay: 50 })

    // 7. Should show no results message (wait for React state update)
    await expect(page.locator('[data-testid="organizations-no-results"]')).toBeVisible({ timeout: 10000 })
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
        incorporationDate: null,
        registrationNumber: null,
        functionalCurrency: "EUR",
        reportingCurrency: "EUR",
        fiscalYearEnd: { month: 12, day: 31 },
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
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
