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

import { test, expect } from "@playwright/test"

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

    // 5. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // 6. Click "New Company" button - wait for it to be visible and enabled
    const newCompanyButton = page.getByRole("button", { name: /New Company/i })
    await expect(newCompanyButton).toBeVisible()
    await expect(newCompanyButton).toBeEnabled()
    await newCompanyButton.click({ force: true })

    // Wait for modal to appear
    await expect(page.getByTestId("create-company-modal")).toBeVisible({ timeout: 10000 })

    // 7. Should show create company form modal with all sections
    await expect(page.getByRole("heading", { name: "Create Company" })).toBeVisible()
    await expect(page.getByTestId("company-form")).toBeVisible()

    // 8. Fill in Basic Information section
    const newCompanyName = `Acme Corp ${Date.now()}`
    await page.fill("#company-name", newCompanyName)
    await page.fill("#company-legal-name", `${newCompanyName} Inc.`)
    await page.selectOption("#company-jurisdiction", "US")
    await page.fill("#company-tax-id", "12-3456789")

    // 9. Fill in Currency section (should already default to org's currency)
    await expect(page.locator("#company-functional-currency")).toHaveValue("USD")
    await expect(page.locator("#company-reporting-currency")).toHaveValue("USD")

    // 10. Fiscal Year section - use Mar 31 preset
    await page.getByTestId("company-fiscal-year-end-preset-3-31").click()
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("3")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("31")

    // 11. Parent Company section should not show subsidiary fields (no parent selected)
    await expect(page.locator("#company-parent")).toHaveValue("")

    // 12. Submit form
    await page.click('button[type="submit"]')

    // 13. Should show new company in list (after invalidation)
    await expect(page.getByRole("link", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 14. Should show updated company count
    await expect(page.getByText(/1 company/i)).toBeVisible()

    // 15. Modal should be closed
    await expect(page.getByRole("heading", { name: "Create Company" })).not.toBeVisible()
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
        parentCompanyId: null,
        ownershipPercentage: null
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

    // 6. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // 7. Click "New Company" button - wait for it to be visible and enabled
    const newCompanyButton = page.getByRole("button", { name: /New Company/i })
    await expect(newCompanyButton).toBeVisible()
    await expect(newCompanyButton).toBeEnabled()
    await newCompanyButton.click({ force: true })

    // Wait for modal to appear
    await expect(page.getByTestId("create-company-modal")).toBeVisible({ timeout: 10000 })

    // 8. Fill in subsidiary company details
    const subsidiaryName = `Subsidiary GmbH ${Date.now()}`
    await page.fill("#company-name", subsidiaryName)
    await page.fill("#company-legal-name", `${subsidiaryName} Ltd`)
    await page.selectOption("#company-jurisdiction", "GB")

    // 9. Select parent company - should show subsidiary fields
    await page.selectOption("#company-parent", parentData.id)

    // 10. Ownership field should appear (consolidation method is now in ConsolidationGroups)
    await expect(page.locator("#company-ownership")).toBeVisible()

    // 11. Enter ownership percentage (80%)
    await page.fill("#company-ownership", "80")

    // 12. Submit form
    await page.click('button[type="submit"]')

    // 13. Should show updated company count (2 companies)
    await expect(page.getByText(/2 companies/i)).toBeVisible({ timeout: 10000 })

    // 14. Expand parent company to see subsidiary (may need to click expand button)
    // The parent row should have an expand button since it now has a child
    const parentRow = page.locator('[data-testid^="company-row-"]').filter({ hasText: parentCompanyName })
    await expect(parentRow).toBeVisible()

    // Find and click the expand button for the parent company (children may be collapsed)
    const expandButton = parentRow.getByRole("button", { name: /expand/i })
    if (await expandButton.isVisible()) {
      await expandButton.click()
    }

    // 15. Should show new subsidiary in list after expansion
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
        parentCompanyId: null,
        ownershipPercentage: null
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

    // 6. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // 7. Click "New Company" button - wait for it to be visible and enabled
    const newCompanyButton = page.getByRole("button", { name: /New Company/i })
    await expect(newCompanyButton).toBeVisible()
    await expect(newCompanyButton).toBeEnabled()
    await newCompanyButton.click({ force: true })

    // Wait for modal to appear
    await expect(page.getByTestId("create-company-modal")).toBeVisible({ timeout: 10000 })

    // 8. Fill in subsidiary company details
    await page.fill("#company-name", "Subsidiary Without Ownership")
    await page.fill("#company-legal-name", "Subsidiary Without Ownership Ltd")
    await page.selectOption("#company-jurisdiction", "GB")

    // 9. Select parent company
    await page.selectOption("#company-parent", parentData.id)

    // 10. Leave ownership percentage empty and try to submit
    await page.click('button[type="submit"]')

    // 11. Should show validation error for ownership
    await expect(page.getByTestId("company-ownership-error")).toBeVisible()
    await expect(page.getByText(/Ownership percentage is required/i)).toBeVisible()

    // 12. Form should still be visible (submission was prevented)
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

    // 5. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // 6. Click "New Company" button - wait for it to be visible and enabled
    const newCompanyButton = page.getByRole("button", { name: /New Company/i })
    await expect(newCompanyButton).toBeVisible()
    await expect(newCompanyButton).toBeEnabled()
    await newCompanyButton.click({ force: true })

    // Wait for modal to appear
    await expect(page.getByTestId("create-company-modal")).toBeVisible({ timeout: 10000 })

    // 7. Default should be Dec 31
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("12")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("31")

    // 8. Click Mar 31 preset
    await page.getByTestId("company-fiscal-year-end-preset-3-31").click()
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("3")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("31")

    // 9. Click Jun 30 preset
    await page.getByTestId("company-fiscal-year-end-preset-6-30").click()
    await expect(page.locator("#company-fiscal-year-end-month")).toHaveValue("6")
    await expect(page.locator("#company-fiscal-year-end-day")).toHaveValue("30")

    // 10. Click Sep 30 preset
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
        parentCompanyId: null,
        ownershipPercentage: null
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

    // 6. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // 7. Click "New Company" button - wait for it to be visible and enabled
    const newCompanyButton = page.getByRole("button", { name: /New Company/i })
    await expect(newCompanyButton).toBeVisible()
    await expect(newCompanyButton).toBeEnabled()
    await newCompanyButton.click({ force: true })

    // Wait for modal to appear
    await expect(page.getByTestId("create-company-modal")).toBeVisible({ timeout: 10000 })

    // 8. Select parent company
    await page.selectOption("#company-parent", parentData.id)

    // 9. Fill in ownership percentage
    await page.fill("#company-ownership", "100")

    // 10. Unselect parent company
    await page.selectOption("#company-parent", "")

    // 11. Subsidiary fields should be hidden
    await expect(page.locator("#company-ownership")).not.toBeVisible()
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

    // 5. Navigate to companies list page
    await page.goto(`/organizations/${orgData.id}/companies`)

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // 6. Click "New Company" button - wait for it to be visible and enabled
    const newCompanyButton = page.getByRole("button", { name: /New Company/i })
    await expect(newCompanyButton).toBeVisible()
    await expect(newCompanyButton).toBeEnabled()
    await newCompanyButton.click({ force: true })

    // Wait for modal to appear
    await expect(page.getByTestId("create-company-modal")).toBeVisible({ timeout: 10000 })

    // 7. Initially should have org's default currency (USD)
    await expect(page.locator("#company-functional-currency")).toHaveValue("USD")

    // 8. Select UK jurisdiction - should auto-set GBP as functional currency
    await page.selectOption("#company-jurisdiction", "GB")
    await page.waitForTimeout(100)
    await expect(page.locator("#company-functional-currency")).toHaveValue("GBP")

    // 9. Select US jurisdiction - should auto-set USD as functional currency
    await page.selectOption("#company-jurisdiction", "US")
    await page.waitForTimeout(100)
    await expect(page.locator("#company-functional-currency")).toHaveValue("USD")
  })
})
