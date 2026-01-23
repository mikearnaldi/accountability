/**
 * Reports Module E2E Tests
 *
 * Tests for financial reports:
 * - Reports hub page (company selection)
 * - Report type selection page
 * - Trial Balance report
 * - Balance Sheet report
 * - Income Statement report
 * - Cash Flow Statement
 * - Equity Statement
 * - Report parameter selection
 * - Report generation
 */

import { test, expect } from "@playwright/test"

test.describe("Reports Module", () => {
  test.describe("Reports Hub Page (Company Selection)", () => {
    test("should redirect to login if not authenticated", async ({ page }) => {
      // Navigate to reports page without authentication
      await page.goto("/organizations/some-org-id/reports")

      // Should redirect to login with redirect param
      await page.waitForURL(/\/login/)
      const url = new URL(page.url())
      expect(url.pathname).toBe("/login")
    })

    test("should display reports hub with company selection", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-reports-hub-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Reports Hub Test User"
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
          name: `Reports Hub Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const companyName = `Test Company ${Date.now()}`
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: companyName,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to reports hub
      await page.goto(`/organizations/${orgData.id}/reports`)

      // 7. Should show reports hub page
      await expect(page.getByTestId("reports-hub-page")).toBeVisible()

      // 8. Should show step indicator with step 1 active
      await expect(page.getByText("Select Company")).toBeVisible()
      await expect(page.getByText("Choose Report")).toBeVisible()
      // "View Report" text appears twice (step indicator and company card link), use first
      await expect(page.getByText("View Report").first()).toBeVisible()

      // 9. Should show company selection card
      await expect(
        page.getByTestId(`company-report-card-${companyData.id}`)
      ).toBeVisible()
      await expect(page.getByText(companyName)).toBeVisible()
    })

    test("should show empty state when no companies", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-reports-empty-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Reports Empty Test User"
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

      // 3. Create an organization (without companies)
      const createOrgRes = await request.post("/api/v1/organizations", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          name: `Reports Empty Test Org ${Date.now()}`,
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

      // 5. Navigate to reports hub
      await page.goto(`/organizations/${orgData.id}/reports`)

      // 6. Should show reports hub page
      await expect(page.getByTestId("reports-hub-page")).toBeVisible()

      // 7. Should show empty state
      await expect(page.getByTestId("reports-no-companies")).toBeVisible()
      await expect(page.getByText("No companies available")).toBeVisible()
    })

    test("should navigate from reports hub to company reports", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-reports-nav-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Reports Nav Test User"
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
          name: `Reports Nav Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const companyName = `Test Nav Company ${Date.now()}`
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: companyName,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to reports hub
      await page.goto(`/organizations/${orgData.id}/reports`)

      // 7. Wait for page to load
      await expect(page.getByTestId("reports-hub-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 8. Click on company card
      await page.getByTestId(`company-report-card-${companyData.id}`).click()

      // 9. Should navigate to company reports page
      await page.waitForURL(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )

      // 10. Should show company reports page with step 2 active
      await expect(page.getByTestId("company-reports-page")).toBeVisible()
    })
  })

  test.describe("Company Reports Page (Report Type Selection)", () => {
    test("should display all report type cards", async ({ page, request }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-report-types-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Report Types Test User"
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
          name: `Report Types Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const companyName = `Test Report Types Company ${Date.now()}`
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: companyName,
          legalName: "Test Company Inc.",
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

      // 6. Navigate directly to company reports page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )

      // 7. Should show company reports page
      await expect(page.getByTestId("company-reports-page")).toBeVisible()

      // 8. Should show all 5 report type cards
      await expect(page.getByTestId("report-card-trial-balance")).toBeVisible()
      await expect(page.getByTestId("report-card-balance-sheet")).toBeVisible()
      await expect(page.getByTestId("report-card-income-statement")).toBeVisible()
      await expect(page.getByTestId("report-card-cash-flow")).toBeVisible()
      await expect(page.getByTestId("report-card-equity-statement")).toBeVisible()

      // 9. Should show step 2 as active (Choose Report)
      await expect(page.getByText("Choose Report")).toBeVisible()
    })

    test("should navigate to Trial Balance report from company reports page", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-trial-balance-nav-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Trial Balance Nav Test User"
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
          name: `Trial Balance Nav Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Trial Balance Nav Company ${Date.now()}`,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to company reports page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )

      // 7. Wait for page to load
      await expect(page.getByTestId("company-reports-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 8. Click on Trial Balance card
      await page.getByTestId("report-card-trial-balance").click()

      // 9. Should navigate to trial balance page
      await page.waitForURL(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports/trial-balance`
      )

      // 10. Should show trial balance page
      await expect(page.getByTestId("trial-balance-page")).toBeVisible()
    })
  })

  test.describe("Trial Balance Report", () => {
    test("should display trial balance report form", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-tb-form-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Trial Balance Form Test User"
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
          name: `TB Form Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const companyName = `TB Form Test Company ${Date.now()}`
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: companyName,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to trial balance page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports/trial-balance`
      )

      // 7. Should show trial balance page
      await expect(page.getByTestId("trial-balance-page")).toBeVisible()

      // 8. Should show page title
      await expect(page.getByTestId("page-title")).toContainText("Trial Balance")

      // 9. Should show company name in subtitle (may appear in breadcrumb too)
      await expect(page.getByText(companyName).first()).toBeVisible()

      // 10. Should show date input with today's date
      const dateInput = page.getByTestId("trial-balance-as-of-date")
      await expect(dateInput).toBeVisible()

      // 11. Should show Generate Report button
      await expect(
        page.getByRole("button", { name: /Generate Report/i })
      ).toBeVisible()

      // 12. Should show back link to reports
      await expect(page.getByText("Back to Reports")).toBeVisible()
    })

    test("should navigate back to reports from trial balance page", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-tb-back-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Trial Balance Back Test User"
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
          name: `TB Back Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `TB Back Test Company ${Date.now()}`,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to trial balance page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports/trial-balance`
      )

      // 7. Wait for page to load
      await expect(page.getByTestId("trial-balance-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 8. Click back link
      await page.getByText("Back to Reports").click()

      // 9. Should navigate back to company reports page
      await page.waitForURL(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )
      await expect(page.getByTestId("company-reports-page")).toBeVisible()
    })
  })

  test.describe("Other Report Types", () => {
    test("should navigate to Balance Sheet report", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-balance-sheet-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Balance Sheet Test User"
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
          name: `Balance Sheet Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Balance Sheet Test Company ${Date.now()}`,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to company reports page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )

      // 7. Wait for page to load
      await expect(page.getByTestId("company-reports-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 8. Click on Balance Sheet card
      await page.getByTestId("report-card-balance-sheet").click()

      // 9. Should navigate to balance sheet page
      await page.waitForURL(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports/balance-sheet`
      )

      // 10. Should show balance sheet page
      await expect(page.getByTestId("balance-sheet-page")).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("Balance Sheet")
    })

    test("should navigate to Income Statement report", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-income-stmt-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Income Statement Test User"
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
          name: `Income Statement Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Income Statement Test Company ${Date.now()}`,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to company reports page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )

      // 7. Wait for page to load
      await expect(page.getByTestId("company-reports-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 8. Click on Income Statement card
      await page.getByTestId("report-card-income-statement").click()

      // 9. Should navigate to income statement page
      await page.waitForURL(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports/income-statement`
      )

      // 10. Should show income statement page
      await expect(page.getByTestId("income-statement-page")).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("Income Statement")
    })

    test("should navigate to Cash Flow Statement report", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-cash-flow-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Cash Flow Test User"
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
          name: `Cash Flow Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Cash Flow Test Company ${Date.now()}`,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to company reports page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )

      // 7. Wait for page to load
      await expect(page.getByTestId("company-reports-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 8. Click on Cash Flow card
      await page.getByTestId("report-card-cash-flow").click()

      // 9. Should navigate to cash flow page
      await page.waitForURL(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports/cash-flow`
      )

      // 10. Should show cash flow page
      await expect(page.getByTestId("cash-flow-page")).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("Cash Flow Statement")
    })

    test("should navigate to Equity Statement report", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-equity-stmt-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Equity Statement Test User"
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
          name: `Equity Statement Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create a company
      const createCompanyRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Equity Statement Test Company ${Date.now()}`,
          legalName: "Test Company Inc.",
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

      // 6. Navigate to company reports page
      await page.goto(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports`
      )

      // 7. Wait for page to load
      await expect(page.getByTestId("company-reports-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 8. Click on Equity Statement card
      await page.getByTestId("report-card-equity-statement").click()

      // 9. Should navigate to equity statement page
      await page.waitForURL(
        `/organizations/${orgData.id}/companies/${companyData.id}/reports/equity-statement`
      )

      // 10. Should show equity statement page
      await expect(page.getByTestId("equity-statement-page")).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("Statement of Changes in Equity")
    })
  })

  test.describe("Sidebar Navigation to Reports", () => {
    test("should navigate to reports via sidebar", async ({ page, request }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-sidebar-reports-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Sidebar Reports Test User"
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
          name: `Sidebar Reports Test Org ${Date.now()}`,
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

      // 5. Navigate to org dashboard
      await page.goto(`/organizations/${orgData.id}/dashboard`)

      // 6. Wait for page to load
      await expect(page.getByTestId("org-dashboard")).toBeVisible()
      await page.waitForTimeout(500)

      // 7. Click on Reports link in sidebar
      await page.getByTestId("nav-reports").click()

      // 8. Should navigate to reports hub
      await page.waitForURL(`/organizations/${orgData.id}/reports`)
      await expect(page.getByTestId("reports-hub-page")).toBeVisible()
    })
  })
})
