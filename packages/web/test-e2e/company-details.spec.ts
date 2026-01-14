/**
 * Company Details Page E2E Tests
 *
 * Tests for company details page with SSR:
 * - loader fetches company by ID
 * - Display company info: name, currency, fiscal year, address
 * - Navigation links: Chart of Accounts, Journal Entries, Reports
 * - Edit company: form calls api.PUT, then router.invalidate()
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
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
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

    // 10. Should show functional currency
    await expect(page.getByText("USD")).toBeVisible()

    // 11. Should show reporting currency
    await expect(page.getByText("EUR")).toBeVisible()

    // 12. Should show fiscal year end
    await expect(page.getByText("December 31")).toBeVisible()

    // 13. Should show jurisdiction
    await expect(page.getByText("United States")).toBeVisible()

    // 14. Should show tax ID
    await expect(page.getByText("12-3456789")).toBeVisible()

    // 15. Should show active status
    await expect(page.getByText("Active")).toBeVisible()

    // 16. Should show creation date
    await expect(page.getByText(/Created/)).toBeVisible()

    // 17. Should show company ID
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
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
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

    // 7. Should show "Company Data" section heading
    await expect(page.getByRole("heading", { name: "Company Data" })).toBeVisible()

    // 8. Should show Chart of Accounts navigation card
    await expect(page.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible()
    await expect(page.getByText("Manage accounts and account hierarchy")).toBeVisible()
    await expect(page.getByText("View Accounts")).toBeVisible()

    // 9. Should show Journal Entries navigation card
    await expect(page.getByRole("heading", { name: "Journal Entries" })).toBeVisible()
    await expect(page.getByText("Create and manage journal entries")).toBeVisible()
    await expect(page.getByText("View Entries")).toBeVisible()

    // 10. Should show Reports navigation card
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible()
    await expect(page.getByText("Financial statements and reports")).toBeVisible()
    await expect(page.getByText("View Reports")).toBeVisible()
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
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
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
    await page.getByRole("button", { name: /Edit/i }).click()

    // 9. Should show edit form modal
    await expect(page.getByRole("heading", { name: "Edit Company" })).toBeVisible()

    // 10. Update company name
    const newCompanyName = `Updated Company ${Date.now()}`
    await page.fill("#edit-company-name", newCompanyName)

    // 11. Update legal name
    await page.fill("#edit-company-legal-name", `${newCompanyName} LLC`)

    // 12. Add tax ID
    await page.fill("#edit-company-tax-id", "98-7654321")

    // 13. Change reporting currency
    await page.selectOption("#edit-company-currency", "GBP")

    // 14. Change fiscal year end
    await page.selectOption("#edit-company-fy-month", "3")
    await page.selectOption("#edit-company-fy-day", "31")

    // 15. Submit form
    await page.click('button[type="submit"]')

    // 16. Should show updated company name - target main content h1
    await expect(page.getByRole("main").getByRole("heading", { name: newCompanyName })).toBeVisible({ timeout: 10000 })

    // 17. Should show updated legal name
    await expect(page.getByText(`${newCompanyName} LLC`)).toBeVisible()

    // 18. Should show updated reporting currency
    await expect(page.getByText("GBP")).toBeVisible()

    // 19. Should show updated fiscal year end
    await expect(page.getByText("March 31")).toBeVisible()

    // 20. Should show tax ID
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
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
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

    // 7. Click Edit button
    await page.getByRole("button", { name: /Edit/i }).click()

    // 8. Clear the name field and submit (whitespace only)
    await page.fill("#edit-company-name", "   ")
    await page.click('button[type="submit"]')

    // 9. Should show validation error
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
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
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

    // 7. Click Edit button
    await page.getByRole("button", { name: /Edit/i }).click()

    // 8. Modal should be visible
    await expect(page.getByRole("heading", { name: "Edit Company" })).toBeVisible()

    // 9. Click cancel
    await page.getByRole("button", { name: /Cancel/i }).click()

    // 10. Modal should be hidden
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
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
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
    await expect(page.getByRole("link", { name: "Companies" })).toBeVisible()

    // 11. Should show company name in main content
    await expect(page.getByRole("main").getByRole("heading", { name: companyName })).toBeVisible()

    // 12. Click Companies link to navigate back to companies list
    await page.getByRole("link", { name: "Companies" }).click()

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

    // 6. Should show error message - h2 with "Error" text
    await expect(page.getByRole("heading", { level: 2, name: /Error/i })).toBeVisible()
    await expect(page.getByText(/Company not found|not found/i)).toBeVisible()

    // 7. Should have link back to Organizations
    await expect(page.getByRole("link", { name: /Back to Organizations/i })).toBeVisible()
  })
})
