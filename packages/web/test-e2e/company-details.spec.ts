/**
 * Company Details Page E2E Tests
 *
 * Tests for company details page with SSR:
 * - loader fetches company by ID
 * - Display company info: name, currency, fiscal year, address, jurisdiction
 * - Navigation links: Chart of Accounts, Journal Entries, Reports, Fiscal Periods
 * - Edit company: form calls api.PUT, then router.invalidate()
 * - Functional currency is read-only (ASC 830)
 * - Deactivate/Activate company functionality
 *
 * Note: Parent-subsidiary relationships are now managed through ConsolidationGroups,
 * not through Company entities. parentCompanyId and ownershipPercentage fields
 * have been removed from the Company domain entity.
 */

import { test, expect } from "@playwright/test"

test.describe("Company Details Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to company details without authentication
    await page.goto("/organizations/some-org-id/companies/some-company-id")

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect query param
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations")
  })

  test("should display company details (SSR - no loading spinner)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-company-details-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Company Details Test User"
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
    const orgName = `Details Test Org ${Date.now()}`
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

    // 4. Create a company via API
    const companyName = `Test Company ${Date.now()}`
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: companyName,
        legalName: `${companyName} Inc.`,
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "EUR",
        fiscalYearEnd: { month: 12, day: 31 },
        taxId: "12-3456789",
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 7. Should be on company details page
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 8. Should show company name (SSR - no loading spinner) - target main content h1
    await expect(page.getByRole("main").getByRole("heading", { name: companyName })).toBeVisible()

    // 9. Should show legal name
    await expect(page.getByText(`${companyName} Inc.`)).toBeVisible()

    // 10. Should show functional currency (in company info card)
    await expect(page.getByTestId("company-info-card").getByText("USD")).toBeVisible()

    // 11. Should show reporting currency (in company info card)
    await expect(page.getByTestId("company-info-card").getByText("EUR")).toBeVisible()

    // 12. Should show fiscal year end (in company info card)
    await expect(page.getByTestId("company-info-card").getByText("December 31")).toBeVisible()

    // 13. Should show jurisdiction
    await expect(page.getByText("United States")).toBeVisible()

    // 14. Should show tax ID
    await expect(page.getByText("12-3456789")).toBeVisible()

    // 15. Should show active status
    await expect(page.getByText("Active")).toBeVisible()

    // 16. Should show creation date
    await expect(page.getByText(/Created/)).toBeVisible()

    // 17. Should show company ID (in Technical Details section - expand it first)
    await page.getByTestId("technical-details-toggle").click()
    await expect(page.getByText(companyData.id)).toBeVisible()

    // 18. Should have Edit button
    await expect(page.getByRole("button", { name: /Edit/i })).toBeVisible()
  })

  test("should display navigation links to accounts, entries, and reports", async ({
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
        name: `Nav Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company via API
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Nav Test Company ${Date.now()}`,
        legalName: "Nav Test Company Inc.",
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // Scope to company details page to avoid conflicts with sidebar navigation
    const detailsPage = page.getByTestId("company-details-page")

    // 7. Should show Chart of Accounts navigation link (in quick actions row)
    await expect(detailsPage.getByTestId("nav-accounts")).toBeVisible()
    await expect(detailsPage.getByTestId("nav-accounts").getByText("Chart of Accounts")).toBeVisible()
    await expect(detailsPage.getByTestId("nav-accounts").getByText(/\d+ accounts/)).toBeVisible()

    // 8. Should show Journal Entries navigation link
    await expect(detailsPage.getByTestId("nav-journal-entries")).toBeVisible()
    await expect(detailsPage.getByTestId("nav-journal-entries").getByText("Journal Entries")).toBeVisible()
    await expect(detailsPage.getByTestId("nav-journal-entries").getByText(/\d+ entries/)).toBeVisible()

    // 9. Should show Reports navigation link
    await expect(detailsPage.getByTestId("nav-reports")).toBeVisible()
    await expect(detailsPage.getByTestId("nav-reports").getByText("Reports")).toBeVisible()
    await expect(detailsPage.getByTestId("nav-reports").getByText("Financial statements")).toBeVisible()

    // 10. Should show Fiscal Periods navigation link
    await expect(detailsPage.getByTestId("nav-fiscal-periods")).toBeVisible()
    await expect(detailsPage.getByTestId("nav-fiscal-periods").getByText("Fiscal Periods")).toBeVisible()
  })

  test("should edit company via form", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-edit-company-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Edit Company Test User"
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
        name: `Edit Company Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company via API
    const companyName = `Edit Test Company ${Date.now()}`
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

    // 6. Set localStorage token (needed for client-side API calls)
    await page.goto("/login")
    await page.evaluate((token) => {
      localStorage.setItem("accountabilitySessionToken", token)
    }, sessionToken)

    // 7. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 8. Click Edit button
    await page.getByTestId("edit-company-button").click()

    // 9. Should show edit form modal
    await expect(page.getByRole("heading", { name: "Edit Company" })).toBeVisible()

    // 10. Update company name
    const newCompanyName = `Updated Company ${Date.now()}`
    await page.fill("#edit-company-name", newCompanyName)

    // 11. Update legal name
    await page.fill("#edit-company-legal-name", `${newCompanyName} LLC`)

    // 12. Add tax ID (on Basic Info tab)
    await page.fill("#edit-company-tax-id", "98-7654321")

    // 13. Switch to Financial tab to change reporting currency and fiscal year end
    await page.getByTestId("edit-tab-financial").click()

    // 14. Change reporting currency
    await page.selectOption("#edit-company-currency", "GBP")

    // 15. Change fiscal year end
    await page.selectOption("#edit-company-fy-month", "3")
    await page.selectOption("#edit-company-fy-day", "31")

    // 16. Submit form
    await page.click('button[type="submit"]')

    // 17. Should show updated company name - target main content h1
    await expect(page.getByRole("main").getByRole("heading", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 18. Should show updated legal name
    await expect(page.getByText(`${newCompanyName} LLC`)).toBeVisible()

    // 19. Should show updated reporting currency
    await expect(page.getByText("GBP")).toBeVisible()

    // 20. Should show updated fiscal year end (in company info card)
    await expect(page.getByTestId("company-info-card").getByText("March 31")).toBeVisible()

    // 21. Should show tax ID
    await expect(page.getByText("98-7654321")).toBeVisible()
  })

  test("should show validation error for empty name in edit form", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-edit-validation-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Edit Validation Test User"
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

    // 4. Create a company via API
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Validation Test Company ${Date.now()}`,
        legalName: "Validation Test Company Inc.",
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // Wait for page to fully load
    await expect(page.getByTestId("company-details-page")).toBeVisible()

    // Wait for Edit button to be visible and enabled
    const editButton = page.getByTestId("edit-company-button")
    await expect(editButton).toBeVisible()
    await expect(editButton).toBeEnabled()

    // Wait for full hydration before clicking
    await page.waitForTimeout(500)

    // 7. Click Edit button with force
    await editButton.click({ force: true })

    // 8. Wait for modal to appear
    await expect(page.getByTestId("edit-company-modal")).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("heading", { name: "Edit Company" })).toBeVisible({ timeout: 10000 })

    // 9. Clear the name field and submit (whitespace only)
    await page.fill("#edit-company-name", "   ")
    await page.click('button[type="submit"]')

    // 10. Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText(/Company name is required/i)).toBeVisible()
  })

  test("should cancel edit form and close modal", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-cancel-edit-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Cancel Edit Test User"
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
        name: `Cancel Edit Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company via API
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Cancel Edit Test Company ${Date.now()}`,
        legalName: "Cancel Edit Test Company Inc.",
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 7. Wait for hydration
    await page.waitForTimeout(500)

    // 8. Click Edit button
    await page.getByTestId("edit-company-button").click({ force: true })

    // 9. Modal should be visible
    await expect(page.getByRole("heading", { name: "Edit Company" })).toBeVisible({ timeout: 10000 })

    // 10. Click cancel
    await page.getByTestId("company-form-cancel-button").click()

    // 11. Modal should be hidden
    await expect(page.getByRole("heading", { name: "Edit Company" })).not.toBeVisible()
  })

  test("should show breadcrumb navigation", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-breadcrumb-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Breadcrumb Test User"
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

    // 4. Create a company via API
    const companyName = `Breadcrumb Test Company ${Date.now()}`
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 7. Should show breadcrumb with Accountability link
    await expect(page.getByRole("link", { name: "Accountability" })).toBeVisible()

    // 8. Should show Organizations link in breadcrumb
    await expect(page.getByRole("link", { name: "Organizations" })).toBeVisible()

    // 9. Should show organization name link in breadcrumb
    await expect(page.getByRole("link", { name: orgName })).toBeVisible()

    // 10. Should show Companies link in breadcrumb
    await expect(page.getByTestId("breadcrumbs").getByRole("link", { name: "Companies" })).toBeVisible()

    // 11. Should show company name in main content
    await expect(page.getByRole("main").getByRole("heading", { name: companyName })).toBeVisible()

    // 12. Click Companies link in breadcrumb to navigate back to companies list
    await page.getByTestId("breadcrumbs").getByRole("link", { name: "Companies" }).click()

    // 13. Should be on companies list page
    await page.waitForURL(`/organizations/${orgData.id}/companies`)
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies`)
    expect(page.url()).not.toContain(companyData.id)
  })

  test("should handle 404 for non-existent company", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-404-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "404 Test User"
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
        name: `404 Test Org ${Date.now()}`,
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

    // 5. Navigate to non-existent company (use valid UUID format to trigger 404 not decode error)
    await page.goto(`/organizations/${orgData.id}/companies/00000000-0000-0000-0000-000000000000`)

    // 6. Should show error message - h2 with "Something went wrong" text
    await expect(page.getByRole("heading", { level: 2, name: /Something went wrong/i })).toBeVisible()

    // 7. Should have link back to Organizations
    await expect(page.getByRole("link", { name: /Back to Organizations/i })).toBeVisible()
  })

  test("should show jurisdiction badge in header", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-jurisdiction-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Jurisdiction Test User"
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
        name: `Jurisdiction Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company via API with specific jurisdiction
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Jurisdiction Test Company ${Date.now()}`,
        legalName: "Jurisdiction Test Company Inc.",
        jurisdiction: "GB",
        functionalCurrency: "GBP",
        reportingCurrency: "GBP",
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 7. Should show jurisdiction badge in header
    await expect(page.getByTestId("company-jurisdiction-badge")).toBeVisible()
    await expect(page.getByTestId("company-jurisdiction-badge")).toHaveText("United Kingdom")
  })

  // Note: Fiscal Periods test removed - FiscalPeriodsApi has been removed from the codebase
  // Fiscal period management is now computed automatically from company's fiscalYearEnd setting

  test("should show functional currency as read-only in edit form with ASC 830 note", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-asc830-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "ASC 830 Test User"
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
        name: `ASC 830 Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company via API
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `ASC 830 Test Company ${Date.now()}`,
        legalName: "ASC 830 Test Company Inc.",
        jurisdiction: "US",
        functionalCurrency: "EUR",
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 7. Wait for page to hydrate and Edit button to be ready
    const editButton = page.getByTestId("edit-company-button")
    await expect(editButton).toBeVisible()
    await expect(editButton).toBeEnabled()
    await page.waitForTimeout(500) // Wait for React hydration

    // 8. Click Edit button with force to ensure click registers
    await editButton.click({ force: true })

    // 9. Should show edit form modal
    await expect(page.getByTestId("edit-company-modal")).toBeVisible({ timeout: 10000 })

    // 10. Switch to Financial tab
    await page.getByTestId("edit-tab-financial").click()

    // 11. Functional currency should be displayed but disabled
    const functionalCurrencyInput = page.getByTestId("edit-company-functional-currency-input")
    await expect(functionalCurrencyInput).toBeVisible()
    await expect(functionalCurrencyInput).toBeDisabled()
    await expect(functionalCurrencyInput).toHaveValue("EUR")

    // 12. Should show ASC 830 note (helper text with Input component)
    await expect(page.getByTestId("edit-company-functional-currency-helper")).toBeVisible()
    await expect(page.getByTestId("edit-company-functional-currency-helper")).toContainText("ASC 830")
  })

  test("should deactivate and reactivate a company", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-deactivate-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Deactivate Test User"
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
        name: `Deactivate Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company via API
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Deactivate Test Company ${Date.now()}`,
        legalName: "Deactivate Test Company Inc.",
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

    // 6. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 7. Verify company is initially active
    await expect(page.getByTestId("company-status-badge")).toHaveText("Active")
    await expect(page.getByTestId("toggle-active-button")).toHaveText("Deactivate")

    // 8. Click Deactivate button
    await page.getByTestId("toggle-active-button").click()

    // 9. Wait for status to change to Inactive
    await expect(page.getByTestId("company-status-badge")).toHaveText("Inactive", { timeout: 10000 })
    await expect(page.getByTestId("toggle-active-button")).toHaveText("Activate")

    // 10. Click Activate button to reactivate
    await page.getByTestId("toggle-active-button").click()

    // 11. Wait for status to change back to Active
    await expect(page.getByTestId("company-status-badge")).toHaveText("Active", { timeout: 10000 })
    await expect(page.getByTestId("toggle-active-button")).toHaveText("Deactivate")
  })

  // Note: Parent company section and subsidiaries section tests removed -
  // Parent-subsidiary relationships are now managed through ConsolidationGroups,
  // not through Company entities. parentCompanyId and ownershipPercentage fields
  // have been removed from the Company domain entity.
})
