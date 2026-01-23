/**
 * Create Company E2E Tests
 *
 * Tests for creating companies via the new CompanyForm:
 * - Create top-level company with all required fields
 * - Create subsidiary company with parent, ownership %, consolidation method
 * - Form validation: required fields, ownership validation
 * - Cannot set company as own parent (edit mode)
 * - Auto-suggest consolidation method based on ownership
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

/**
 * Helper to verify a Combobox has a specific value selected.
 * Since Combobox is not a native select, we check the displayed text.
 */
async function expectComboboxContains(
  page: Page,
  testId: string,
  expectedText: string
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)
  const displayButton = combobox.locator("button")
  await expect(displayButton).toContainText(expectedText)
}

test.describe("Create Company Form", () => {
  test("should create top-level company with all fields", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-company-toplevel-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Top Company Test User"
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
        name: `Top-Level Company Test Org ${Date.now()}`,
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
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 6. Should show create company form page with all sections
    await expect(page.getByRole("heading", { name: "Create New Company" })).toBeVisible()
    await expect(page.getByTestId("company-form")).toBeVisible()

    // 7. Fill in Basic Information section
    const newCompanyName = `Acme Corp ${Date.now()}`
    await page.fill("#company-name", newCompanyName)
    await page.fill("#company-legal-name", `${newCompanyName} Inc.`)
    // Use Combobox helper for JurisdictionSelect
    await selectComboboxOption(page, "company-jurisdiction-select", "United States")
    await page.fill("#company-tax-id", "12-3456789")

    // 8. Fill in Currency section (should already default to org's currency)
    // Use Combobox check for currency values (they display as "USD - US Dollar ($)" etc)
    await expectComboboxContains(page, "company-functional-currency-select", "USD")
    await expectComboboxContains(page, "company-reporting-currency-select", "USD")

    // 9. Fiscal Year section - use Mar 31 preset
    await page.getByTestId("company-fiscal-year-end-preset-3-31").click()
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("3")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("31")

    // 10. Parent Company section should not show subsidiary fields (no parent selected)
    await expect(page.locator("#company-parent")).toHaveValue("")

    // 11. Submit form
    await page.click('button[type="submit"]')

    // 12. Should navigate back to companies list and show new company
    await page.waitForURL(/\/companies\/?$/)
    await expect(page.getByRole("link", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 13. Should show updated company count
    await expect(page.getByText(/1 company/i)).toBeVisible()
  })

  test("should create subsidiary company with ownership and consolidation method", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-subsidiary-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Subsidiary Test User"
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
        name: `Subsidiary Test Org ${Date.now()}`,
        reportingCurrency: "EUR",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a parent company via API
    const parentCompanyName = `Parent Holdings ${Date.now()}`
    const createParentRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: parentCompanyName,
        legalName: `${parentCompanyName} Ltd`,
        jurisdiction: "GB",
        functionalCurrency: "GBP",
        reportingCurrency: "GBP",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
        parentCompanyId: null,
        ownershipPercentage: null,
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
      }
    })
    expect(createParentRes.ok()).toBeTruthy()
    const parentData = await createParentRes.json()

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

    // 6. Navigate directly to new company page
    await page.goto(`/organizations/${orgData.id}/companies/new`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 7. Fill in subsidiary company details
    const subsidiaryName = `Subsidiary GmbH ${Date.now()}`
    await page.fill("#company-name", subsidiaryName)
    await page.fill("#company-legal-name", `${subsidiaryName} Ltd`)
    // Use Combobox helper for JurisdictionSelect
    await selectComboboxOption(page, "company-jurisdiction-select", "United Kingdom")

    // 8. Select parent company - should show subsidiary fields
    await page.selectOption("#company-parent", parentData.id)

    // 9. Ownership field should appear (consolidation method is now in ConsolidationGroups)
    await expect(page.locator("#company-ownership")).toBeVisible()

    // 10. Enter ownership percentage (80%)
    await page.fill("#company-ownership", "80")

    // 11. Submit form
    await page.click('button[type="submit"]')

    // 12. Should navigate back to companies list and show updated company count (2 companies)
    await page.waitForURL(/\/companies\/?$/)
    await expect(page.getByText(/2 companies/i)).toBeVisible({ timeout: 10000 })

    // 13. Expand parent company to see subsidiary (may need to click expand button)
    // The parent row should have an expand button since it now has a child
    const parentRow = page.locator('[data-testid^="company-row-"]').filter({ hasText: parentCompanyName })
    await expect(parentRow).toBeVisible()

    // Find and click the expand button for the parent company (children may be collapsed)
    const expandButton = parentRow.getByRole("button", { name: /expand/i })
    if (await expandButton.isVisible()) {
      await expandButton.click()
    }

    // 14. Should show new subsidiary in list after expansion
    await expect(page.getByRole("link", { name: subsidiaryName })).toBeVisible({ timeout: 5000 })
  })

  test("should validate required fields for subsidiary", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-validate-subsidiary-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Validate Subsidiary Test User"
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
        name: `Validate Subsidiary Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a parent company via API
    const parentCompanyName = `Parent Corp ${Date.now()}`
    const createParentRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: parentCompanyName,
        legalName: `${parentCompanyName} Inc.`,
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "USD",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
        parentCompanyId: null,
        ownershipPercentage: null,
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
      }
    })
    expect(createParentRes.ok()).toBeTruthy()
    const parentData = await createParentRes.json()

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

    // 6. Navigate directly to new company page
    await page.goto(`/organizations/${orgData.id}/companies/new`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 7. Fill in subsidiary company details
    await page.fill("#company-name", "Subsidiary Without Ownership")
    await page.fill("#company-legal-name", "Subsidiary Without Ownership Ltd")
    // Use Combobox helper for JurisdictionSelect
    await selectComboboxOption(page, "company-jurisdiction-select", "United Kingdom")

    // 8. Select parent company
    await page.selectOption("#company-parent", parentData.id)

    // 9. Leave ownership percentage empty and try to submit
    await page.click('button[type="submit"]')

    // 10. Should show validation error for ownership
    await expect(page.getByTestId("company-ownership-error")).toBeVisible()
    await expect(page.getByText(/Ownership percentage is required/i)).toBeVisible()

    // 11. Form should still be visible (submission was prevented)
    await expect(page.getByTestId("company-form")).toBeVisible()
  })

  // Note: Consolidation method auto-suggest test removed - consolidationMethod is now
  // configured in ConsolidationGroups, not on Company entities

  test("should use fiscal year end presets", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-fy-presets-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "FY Presets Test User"
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
        name: `FY Presets Test Org ${Date.now()}`,
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
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 6. Default should be Dec 31
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("12")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("31")

    // 7. Click Mar 31 preset
    await page.getByTestId("company-fiscal-year-end-preset-3-31").click()
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("3")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("31")

    // 8. Click Jun 30 preset
    await page.getByTestId("company-fiscal-year-end-preset-6-30").click()
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("6")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("30")

    // 9. Click Sep 30 preset
    await page.getByTestId("company-fiscal-year-end-preset-9-30").click()
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("9")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("30")
  })

  test("should clear subsidiary fields when parent is unselected", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-clear-subsidiary-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Clear Subsidiary Test User"
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
        name: `Clear Subsidiary Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a parent company via API
    const parentCompanyName = `Parent Corp ${Date.now()}`
    const createParentRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: parentCompanyName,
        legalName: `${parentCompanyName} Inc.`,
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "USD",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: null,
        incorporationDate: null,
        registrationNumber: null,
        parentCompanyId: null,
        ownershipPercentage: null,
        registeredAddress: null,
        industryCode: null,
        companyType: null,
        incorporationJurisdiction: null
      }
    })
    expect(createParentRes.ok()).toBeTruthy()
    const parentData = await createParentRes.json()

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

    // 6. Navigate directly to new company page
    await page.goto(`/organizations/${orgData.id}/companies/new`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 7. Select parent company
    await page.selectOption("#company-parent", parentData.id)

    // 8. Fill in ownership percentage
    await page.fill("#company-ownership", "100")

    // 9. Unselect parent company
    await page.selectOption("#company-parent", "")

    // 10. Subsidiary fields should be hidden
    await expect(page.locator("#company-ownership")).not.toBeVisible()
  })

  test("should create company in new jurisdiction (Canada)", async ({ page, request }) => {
    // Test for COMPANY_DETAILS.md Phase 1 - new jurisdictions
    // 1. Register a test user
    const testUser = {
      email: `test-canada-jurisdiction-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Canada Jurisdiction Test User"
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
        name: `Canada Test Org ${Date.now()}`,
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
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 6. Fill in company details with Canada jurisdiction
    const newCompanyName = `Canadian Corp ${Date.now()}`
    await page.fill("#company-name", newCompanyName)
    await page.fill("#company-legal-name", `${newCompanyName} Inc.`)
    // Use Combobox helper for JurisdictionSelect
    await selectComboboxOption(page, "company-jurisdiction-select", "Canada")
    await page.fill("#company-tax-id", "123456789RC0001")

    // 7. Verify functional currency auto-set to CAD
    await page.waitForTimeout(100)
    await expectComboboxContains(page, "company-functional-currency-select", "CAD")

    // 8. Submit form
    await page.click('button[type="submit"]')

    // 9. Should navigate back to companies list and show new company
    await page.waitForURL(/\/companies\/?$/)
    await expect(page.getByRole("link", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 10. Click on company to see details
    await page.getByRole("link", { name: newCompanyName }).click()

    // 11. Verify jurisdiction badge displays Canada
    await expect(page.getByTestId("company-jurisdiction-badge")).toHaveText("Canada")
  })

  test("should create company with incorporation date", async ({ page, request }) => {
    // Test for COMPANY_DETAILS.md Phase 2 - incorporation date
    // 1. Register a test user
    const testUser = {
      email: `test-incorporation-date-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Incorporation Date Test User"
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
        name: `Incorporation Date Test Org ${Date.now()}`,
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
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 6. Fill in company details with incorporation date
    const newCompanyName = `Inc Date Corp ${Date.now()}`
    await page.fill("#company-name", newCompanyName)
    await page.fill("#company-legal-name", `${newCompanyName} Inc.`)
    // Use Combobox helper for JurisdictionSelect
    await selectComboboxOption(page, "company-jurisdiction-select", "United States")

    // 7. Set incorporation date
    await page.fill("#company-incorporation-date", "2020-01-15")

    // 8. Submit form
    await page.click('button[type="submit"]')

    // 9. Should navigate back to companies list and show new company
    await page.waitForURL(/\/companies\/?$/)
    await expect(page.getByRole("link", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 10. Click on company to see details
    await page.getByRole("link", { name: newCompanyName }).click()

    // 11. Verify incorporation date is displayed in the detail page
    // Note: The exact date may vary by 1 day due to timezone handling in PostgreSQL DATE type
    // We verify the date is displayed and contains the year/month we set
    const incorporationDateText = await page.getByTestId("company-incorporation-date").textContent()
    expect(incorporationDateText).toContain("2020")
    expect(incorporationDateText).toMatch(/January (14|15), 2020/)
  })

  test("should create company with registration number", async ({ page, request }) => {
    // Test for COMPANY_DETAILS.md Phase 3 - registration number
    // 1. Register a test user
    const testUser = {
      email: `test-registration-number-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Registration Number Test User"
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
        name: `Registration Number Test Org ${Date.now()}`,
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
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 6. Fill in company details with registration number
    const newCompanyName = `Reg Number Corp ${Date.now()}`
    await page.fill("#company-name", newCompanyName)
    await page.fill("#company-legal-name", `${newCompanyName} Inc.`)
    // Use Combobox helper for JurisdictionSelect
    await selectComboboxOption(page, "company-jurisdiction-select", "United Kingdom")

    // 7. Set registration number
    await page.fill("#company-registration-number", "12345678")

    // 8. Submit form
    await page.click('button[type="submit"]')

    // 9. Should navigate back to companies list and show new company
    await page.waitForURL(/\/companies\/?$/)
    await expect(page.getByRole("link", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 10. Click on company to see details
    await page.getByRole("link", { name: newCompanyName }).click()

    // 11. Verify registration number is displayed in the detail page
    await expect(page.getByTestId("company-registration-number")).toHaveText("12345678")
  })

  test("should set functional currency from jurisdiction default", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-jurisdiction-currency-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Jurisdiction Currency Test User"
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
        name: `Jurisdiction Currency Test Org ${Date.now()}`,
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
    await page.waitForTimeout(500)
    await expect(page.getByTestId("new-company-page")).toBeVisible()

    // 6. Initially should have org's default currency (USD)
    await expectComboboxContains(page, "company-functional-currency-select", "USD")

    // 7. Select UK jurisdiction - should auto-set GBP as functional currency
    await selectComboboxOption(page, "company-jurisdiction-select", "United Kingdom")
    await page.waitForTimeout(100)
    await expectComboboxContains(page, "company-functional-currency-select", "GBP")

    // 8. Select US jurisdiction - should auto-set USD as functional currency
    await selectComboboxOption(page, "company-jurisdiction-select", "United States")
    await page.waitForTimeout(100)
    await expectComboboxContains(page, "company-functional-currency-select", "USD")
  })
})
