/**
 * Organization Details Page E2E Tests
 *
 * Tests for organization details page with SSR:
 * - loader fetches organization by ID and its companies
 * - Display organization name, currency, creation date
 * - List companies within the organization
 * - Edit organization: form calls api.PUT, then router.invalidate()
 * - Link to create new company (placeholder button)
 */

import { test, expect } from "@playwright/test"

test.describe("Organization Details Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to organization details without authentication
    await page.goto("/organizations/some-org-id")

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect query param
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations")
  })

  test("should display organization details (SSR - no loading spinner)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-org-details-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Org Details Test User"
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

    // 5. Navigate to organization details page
    await page.goto(`/organizations/${orgData.id}`)

    // 6. Should be on organization details page
    expect(page.url()).toContain(`/organizations/${orgData.id}`)

    // 7. Should show organization name (SSR - no loading spinner)
    await expect(page.getByRole("heading", { name: orgName })).toBeVisible()

    // 8. Should show reporting currency
    await expect(page.getByText("EUR")).toBeVisible()

    // 9. Should show creation date
    await expect(page.getByText(/Created/)).toBeVisible()

    // 10. Should show organization ID
    await expect(page.getByText(orgData.id)).toBeVisible()

    // 11. Should have Edit button
    await expect(page.getByRole("button", { name: /Edit/i })).toBeVisible()
  })

  test("should display companies list", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-companies-list-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Companies List Test User"
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
    const orgName = `Companies List Test Org ${Date.now()}`
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

    // 4. Create a company within the organization
    const companyName = `Test Company ${Date.now()}`
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

    // 7. Should show companies section (use exact match to avoid matching org names with "Companies" in them)
    await expect(page.getByRole("heading", { name: "Companies", exact: true })).toBeVisible()

    // 8. Should show company count
    await expect(page.getByText(/1 company/i)).toBeVisible()

    // 9. Should show company name in list (use heading role to be specific)
    await expect(page.getByRole("heading", { name: companyName })).toBeVisible()

    // 10. Should show company details (legal name, status)
    await expect(page.getByText(`${companyName} Inc.`)).toBeVisible()
    await expect(page.getByText("Active")).toBeVisible()
  })

  test("should display empty state when no companies", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-empty-companies-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Empty Companies Test User"
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
    const orgName = `Empty Companies Test Org ${Date.now()}`
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

    // 5. Navigate to organization details page
    await page.goto(`/organizations/${orgData.id}`)

    // 6. Should show 0 companies count
    await expect(page.getByText(/0 companies/i)).toBeVisible()

    // 7. Should show empty state
    await expect(page.getByText(/No companies yet/i)).toBeVisible()

    // 8. Should show create company button (navigates to companies creation page)
    await expect(page.getByRole("button", { name: /Create Company/i })).toBeVisible()
  })

  test("should edit organization via form", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-edit-org-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Edit Org Test User"
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
    const orgName = `Edit Test Org ${Date.now()}`
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

    // 5. Set localStorage token (needed for client-side API calls)
    await page.goto("/login")
    await page.evaluate((token) => {
      localStorage.setItem("accountabilitySessionToken", token)
    }, sessionToken)

    // 6. Navigate to organization details page
    await page.goto(`/organizations/${orgData.id}`)

    // 7. Wait for page to fully load (hydration) and click Edit button
    const editButton = page.getByTestId("edit-organization-button")
    await expect(editButton).toBeVisible()
    await page.waitForTimeout(100)
    await editButton.click()

    // 8. Should show edit form modal
    await expect(page.getByRole("heading", { name: "Edit Organization" })).toBeVisible({ timeout: 10000 })

    // 9. Update organization name
    const newOrgName = `Updated Org ${Date.now()}`
    await page.fill("#edit-org-name", newOrgName)

    // 10. Change currency
    await page.selectOption("#edit-org-currency", "GBP")

    // 11. Submit form
    await page.click('button[type="submit"]')

    // 12. Should show updated organization name
    await expect(page.getByRole("heading", { name: newOrgName })).toBeVisible({ timeout: 10000 })

    // 13. Should show updated currency
    await expect(page.getByText("GBP")).toBeVisible()
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

    // 5. Navigate to organization details page
    await page.goto(`/organizations/${orgData.id}`)

    // 6. Wait for page to fully load (hydration) and click Edit button
    const editButton = page.getByTestId("edit-organization-button")
    await expect(editButton).toBeVisible()
    // Wait for hydration to complete
    await page.waitForTimeout(100)
    await editButton.click()

    // 7. Wait for modal to appear
    const modalHeading = page.getByRole("heading", { name: "Edit Organization" })
    await expect(modalHeading).toBeVisible({ timeout: 10000 })

    // 8. Clear the name field and submit
    await page.fill("#edit-org-name", "   ") // Just whitespace
    await page.click('button[type="submit"]')

    // 9. Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText(/Organization name is required/i)).toBeVisible()
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

    // 5. Navigate to organization details page
    await page.goto(`/organizations/${orgData.id}`)

    // 6. Wait for page to fully load (hydration) and click Edit button
    const editButton = page.getByTestId("edit-organization-button")
    await expect(editButton).toBeVisible()
    // Wait for hydration to complete
    await page.waitForTimeout(100)
    await editButton.click()

    // 7. Modal should be visible
    const modalHeading = page.getByRole("heading", { name: "Edit Organization" })
    await expect(modalHeading).toBeVisible({ timeout: 10000 })

    // 8. Click cancel
    await page.getByTestId("org-form-cancel-button").click()

    // 9. Modal should be hidden
    await expect(modalHeading).not.toBeVisible()
  })

  test("should navigate from organizations list to details", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-nav-details-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Nav Details Test User"
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
    const orgName = `Nav Details Test Org ${Date.now()}`
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

    // 5. Navigate to organizations list
    await page.goto("/organizations")

    // 6. Wait for page to be fully hydrated
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()
    await page.waitForTimeout(500)

    // 7. Should see organization card
    await expect(page.getByText(orgName)).toBeVisible()

    // 8. Click on organization card (it's now a link)
    await page.getByText(orgName).click({ force: true })

    // 9. Should be on organization dashboard (card click goes to dashboard)
    await page.waitForURL(/\/organizations\/[^/]+\/dashboard/, { timeout: 15000 })
    expect(page.url()).toContain(`/organizations/${orgData.id}/dashboard`)

    // 10. Should show organization name on dashboard
    await expect(page.getByTestId("org-dashboard-name")).toContainText(orgName)
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

    // 5. Navigate to organization details page
    await page.goto(`/organizations/${orgData.id}`)

    // 6. Should show breadcrumb with Accountability link
    await expect(page.getByRole("link", { name: "Accountability" })).toBeVisible()

    // 7. Should show Organizations link in breadcrumb
    await expect(page.getByRole("link", { name: "Organizations" })).toBeVisible()

    // 8. Click Organizations link to navigate back
    await page.getByRole("link", { name: "Organizations" }).click()

    // 9. Should be on organizations list page
    await page.waitForURL(/\/organizations($|\?)/, { timeout: 15000 })
    expect(page.url()).toContain("/organizations")
  })
})
