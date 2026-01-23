/**
 * Companies List Page E2E Tests
 *
 * Tests for companies list page within an organization with SSR:
 * - loader fetches companies for organization
 * - Flat list view showing all companies
 * - Columns: Name, Legal Name, Jurisdiction, Functional Currency, Status
 * - Filter by Active/Inactive status
 * - Create company: form calls api.POST, then router.invalidate()
 * - Link to company details
 *
 * Note: Parent-subsidiary relationships and ownership percentages are now managed
 * through ConsolidationGroups, not through Company entities.
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

test.describe("Companies List Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to companies list without authentication
    await page.goto("/organizations/some-org-id/companies")

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect query param
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations")
  })

  test("should display companies list with cards (SSR - no loading spinner)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-companies-page-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Companies Page Test User"
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
    const orgName = `Companies Page Test Org ${Date.now()}`
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

    // 4. Create companies via API
    const companyName1 = `Alpha Company ${Date.now()}`
    const createCompanyRes1 = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: companyName1,
        legalName: `${companyName1} Inc.`,
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "EUR",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
      }
    })
    expect(createCompanyRes1.ok()).toBeTruthy()

    const companyName2 = `Beta Company ${Date.now()}`
    const createCompanyRes2 = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: companyName2,
        legalName: `${companyName2} GmbH`,
        jurisdiction: "DE",
        functionalCurrency: "EUR",
        reportingCurrency: "EUR",
        fiscalYearEnd: { month: 3, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
      }
    })
    expect(createCompanyRes2.ok()).toBeTruthy()

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

    // 6. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // 7. Should be on companies list page
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies`)

    // 8. Should show "Companies" heading in breadcrumb (page title)
    await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible()

    // 9. Should show companies count
    await expect(page.getByText(/2 companies/i)).toBeVisible()

    // 10. Should show first company in hierarchy tree (use link role, not heading)
    await expect(page.getByRole("link", { name: companyName1 })).toBeVisible()
    await expect(page.getByText("USD")).toBeVisible() // Currency
    // Note: fiscal year end is not shown in the hierarchy tree view

    // 11. Should show second company in hierarchy tree
    await expect(page.getByRole("link", { name: companyName2 })).toBeVisible()
    await expect(page.getByText("DE", { exact: true })).toBeVisible() // Jurisdiction (exact match)
  })

  test("should display empty state when no companies", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-companies-empty-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Companies Empty Test User"
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

    // 3. Create an organization via API (no companies)
    const orgName = `Companies Empty Test Org ${Date.now()}`
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

    // 5. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // 6. Should show 0 companies count
    await expect(page.getByText(/0 companies/i)).toBeVisible()

    // 7. Should show empty state
    await expect(page.getByText(/No companies/i)).toBeVisible()

    // 8. Should show create company link (styled as button)
    await expect(page.getByRole("link", { name: /Create Company/i })).toBeVisible()
  })

  test("should create company via dedicated page", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-company-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Company Test User"
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
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Create Company Test Org ${Date.now()}`,
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

    // 5. Set localStorage token (needed for client-side API calls)
    await page.goto("/login")
    await page.evaluate((token) => {
      localStorage.setItem("accountabilitySessionToken", token)
    }, sessionToken)

    // 6. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // Wait for "Create Company" button in empty state (no companies exist yet)
    const createCompanyButton = page.getByTestId("create-company-empty-button")
    await expect(createCompanyButton).toBeVisible()
    await expect(createCompanyButton).toBeEnabled()

    // Wait for full hydration before clicking
    await page.waitForTimeout(500)

    // 7. Click "Create Company" button - navigates to dedicated page
    await createCompanyButton.click({ force: true })

    // 8. Should navigate to new company page
    await page.waitForURL(/\/companies\/new$/)
    await expect(page.getByTestId("new-company-page")).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("heading", { name: "Create New Company" })).toBeVisible({ timeout: 10000 })

    // 9. Fill in company details
    const newCompanyName = `New Test Company ${Date.now()}`
    await page.fill("#company-name", newCompanyName)
    await page.fill("#company-legal-name", `${newCompanyName} LLC`)
    // Use Combobox helpers for jurisdiction and currency selects
    await selectComboboxOption(page, "company-jurisdiction-select", "United Kingdom")
    await selectComboboxOption(page, "company-functional-currency-select", "GBP")
    await selectComboboxOption(page, "company-reporting-currency-select", "GBP")
    // Use fiscal year end preset for Mar 31
    await page.getByTestId("company-fiscal-year-end-preset-3-31").click()

    // 10. Submit form
    await page.click('button[type="submit"]')

    // 11. Should navigate back to companies list and show new company
    await page.waitForURL(/\/companies\/?$/)
    await expect(page.getByRole("link", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 12. Should show updated company count
    await expect(page.getByText(/1 company/i)).toBeVisible()

    // 13. Should show company details (in tree view columns)
    await expect(page.getByText("GBP")).toBeVisible()
  })

  test("should show validation error for empty company name", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-company-validation-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Company Validation Test User"
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
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Validation Test Org ${Date.now()}`,
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

    // 5. Navigate directly to new company page
    await page.goto(`/organizations/${orgData.id}/companies/new`)

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // Wait for the form input to be visible
    await expect(page.locator("#company-name")).toBeVisible({ timeout: 10000 })

    // 6. Fill legal name and set company name to whitespace only (bypasses HTML5 required validation)
    await page.fill("#company-name", "   ")
    await page.fill("#company-legal-name", "Some Legal Name LLC")

    // 7. Submit form
    await page.click('button[type="submit"]')

    // 8. Should show validation error (our custom validation catches whitespace-only input)
    // The validation error appears as a field-level error, not a role="alert"
    await expect(page.getByTestId("company-name-error")).toBeVisible()
    await expect(page.getByText(/Company name is required/i)).toBeVisible()
  })

  test("should cancel create company form and navigate back", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-cancel-company-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Cancel Company Test User"
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
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Cancel Company Test Org ${Date.now()}`,
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

    // 5. Navigate to new company page
    await page.goto(`/organizations/${orgData.id}/companies/new`)

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 6. Form should be visible
    await expect(
      page.getByRole("heading", { name: "Create New Company" })
    ).toBeVisible({ timeout: 10000 })

    // 7. Click cancel
    await page.getByTestId("company-form-cancel-button").click()

    // 8. Should navigate back to companies list
    await page.waitForURL(/\/companies\/?$/)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()
  })

  test("should navigate to company details when clicking a company card", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-company-nav-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Company Nav Test User"
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
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Company Nav Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company
    const companyName = `Nav Test Company ${Date.now()}`
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: companyName,
        legalName: `${companyName} Inc.`,
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "USD",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
      }
    })
    expect(createCompanyRes.ok()).toBeTruthy()
    const companyData = await createCompanyRes.json()

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

    // 6. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // 7. Should see company in tree view (use link role - company name is a link)
    await expect(page.getByRole("link", { name: companyName })).toBeVisible()

    // 8. Click on company link to navigate to details
    await page.getByRole("link", { name: companyName }).click()

    // 9. Should be on company details page
    await page.waitForURL(/\/companies\/[^/]+$/)
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 10. Should show company details (use main region to avoid matching header)
    await expect(page.getByRole("main").getByRole("heading", { name: companyName })).toBeVisible()
    await expect(page.getByText(`${companyName} Inc.`)).toBeVisible()
  })

  test("should show breadcrumb navigation", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-companies-breadcrumb-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Companies Breadcrumb Test User"
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
    const orgName = `Breadcrumb Test Org ${Date.now()}`
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

    // 5. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // 6. Should show breadcrumb with Accountability link
    await expect(page.getByRole("link", { name: "Accountability" })).toBeVisible()

    // 7. Should show Organizations link in breadcrumb
    await expect(page.getByRole("link", { name: "Organizations" })).toBeVisible()

    // 8. Should show organization name link in breadcrumb
    await expect(page.getByRole("link", { name: orgName })).toBeVisible()

    // 9. Click organization name link to navigate back
    await page.getByRole("link", { name: orgName }).click()

    // 10. Should be on organization details page
    await page.waitForURL(`/organizations/${orgData.id}`)
    expect(page.url()).toContain(`/organizations/${orgData.id}`)
    expect(page.url()).not.toContain("/companies")
  })

  test("should navigate from organization details to companies list", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-org-to-companies-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Org to Companies Test User"
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
    const orgName = `Org to Companies Test Org ${Date.now()}`
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

    // 4. Create a company so the "View all" link appears
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Test Company ${Date.now()}`,
        legalName: "Test Company LLC",
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "USD",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
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

    // 6. Navigate to organization details page
    await page.goto(`/organizations/${orgData.id}`)

    // 7. Should see "View all" link (only visible when companies exist)
    await expect(page.getByRole("link", { name: "View all" })).toBeVisible()

    // 8. Click "View all" link
    await page.getByRole("link", { name: "View all" }).click()

    // 9. Should be on companies list page
    await page.waitForURL(`/organizations/${orgData.id}/companies`)
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies`)

    // 10. Should show Companies heading (use exact match to avoid matching org name containing "Companies")
    await expect(page.getByRole("heading", { name: "Companies", exact: true })).toBeVisible()
  })

  // Note: Hierarchy tree view tests removed - parent-subsidiary relationships are now
  // managed through ConsolidationGroups, not through Company entities.

  test("should filter companies by active/inactive status", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-filter-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Filter Test User"
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

    // 3. Create an organization
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Filter Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create an active company
    const activeCompanyName = `Active Company ${Date.now()}`
    await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: activeCompanyName,
        legalName: `${activeCompanyName} Inc.`,
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "USD",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
      }
    })

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

    // 6. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // 7. Should show status filter buttons
    await expect(page.locator('[data-testid="status-filter"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-all"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-active"]')).toBeVisible()
    await expect(page.locator('[data-testid="filter-inactive"]')).toBeVisible()

    // 8. "All" filter should be active by default and show the company (use link role to be specific)
    await expect(page.getByRole("link", { name: activeCompanyName })).toBeVisible()

    // 9. Click "Active" filter - should still show the company
    await page.locator('[data-testid="filter-active"]').click()
    await expect(page.getByRole("link", { name: activeCompanyName })).toBeVisible()

    // 10. Click "Inactive" filter - should hide the active company
    await page.locator('[data-testid="filter-inactive"]').click()
    await expect(page.locator('[data-testid="no-filtered-results"]')).toBeVisible()
    await expect(page.getByText("No inactive companies found")).toBeVisible()

    // 11. Click "Show all companies" to reset filter
    await page.getByText("Show all companies").click()
    await expect(page.getByRole("link", { name: activeCompanyName })).toBeVisible()
  })

  // Note: Expand/collapse tests removed - parent-subsidiary hierarchy is now
  // managed through ConsolidationGroups, not through Company entities.
})
