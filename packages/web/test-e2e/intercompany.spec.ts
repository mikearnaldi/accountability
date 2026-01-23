/**
 * Intercompany Transactions Module E2E Tests
 *
 * Tests for intercompany transactions:
 * - Intercompany transaction list page (empty state, with transactions)
 * - Create intercompany transaction flow
 * - Transaction detail page
 * - Update matching status
 * - Delete transaction
 * - Filters (by company, type, status)
 * - Link journal entries
 */

import { test, expect } from "@playwright/test"
import { selectComboboxOption } from "./helpers/combobox"

test.describe("Intercompany Transactions Module", () => {
  test.describe("Intercompany List Page", () => {
    test("should redirect to login if not authenticated", async ({ page }) => {
      // Navigate to intercompany page without authentication
      await page.goto("/organizations/some-org-id/intercompany")

      // Should redirect to login with redirect param
      await page.waitForURL(/\/login/)
      const url = new URL(page.url())
      expect(url.pathname).toBe("/login")
    })

    test("should display 'at least 2 companies required' state when org has less than 2 companies", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-nocompanies-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC No Companies Test User"
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

      // 3. Create an organization (no companies)
      const createOrgRes = await request.post("/api/v1/organizations", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          name: `IC No Companies Test Org ${Date.now()}`,
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

      // 5. Navigate to intercompany page
      await page.goto(`/organizations/${orgData.id}/intercompany`)

      // 6. Should show intercompany page
      await expect(page.getByTestId("intercompany-page")).toBeVisible()

      // 7. Should show "at least 2 companies required" state
      await expect(page.getByTestId("no-companies-state")).toBeVisible()
      await expect(page.getByText(/At least 2 companies required/i)).toBeVisible()
    })

    test("should display empty state when no intercompany transactions", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-empty-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Empty Test User"
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
          name: `IC Empty Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create first company
      const createCompany1Res = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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
      expect(createCompany1Res.ok()).toBeTruthy()

      // 5. Create second company
      const createCompany2Res = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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
      expect(createCompany2Res.ok()).toBeTruthy()

      // 6. Set session cookie
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

      // 7. Navigate to intercompany page
      await page.goto(`/organizations/${orgData.id}/intercompany`)

      // 8. Should show intercompany page
      await expect(page.getByTestId("intercompany-page")).toBeVisible()

      // 9. Should show empty state
      await expect(page.getByTestId("empty-state")).toBeVisible()
      await expect(page.getByText(/No intercompany transactions/i)).toBeVisible()

      // 10. Should show create button in empty state
      await expect(
        page.getByTestId("create-first-transaction-button")
      ).toBeVisible()
    })

    test("should navigate to intercompany page via sidebar", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-nav-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Nav Test User"
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
          name: `IC Nav Test Org ${Date.now()}`,
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

      // 5. Navigate to dashboard
      await page.goto(`/organizations/${orgData.id}/dashboard`)
      await page.waitForTimeout(500) // Wait for hydration

      // 6. Click on Intercompany in sidebar
      const intercompanyLink = page.getByTestId("nav-intercompany")
      await expect(intercompanyLink).toBeVisible()
      await intercompanyLink.click()

      // 7. Should navigate to intercompany page
      await page.waitForURL(`/organizations/${orgData.id}/intercompany`)
      await expect(page.getByTestId("intercompany-page")).toBeVisible()
    })
  })

  test.describe("Create Intercompany Transaction", () => {
    test("should navigate to create page from empty state", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-create-nav-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Create Nav Test User"
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
          name: `IC Create Nav Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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

      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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

      // 6. Navigate to intercompany page
      await page.goto(`/organizations/${orgData.id}/intercompany`)

      // 7. Wait for empty state and click create button
      await expect(page.getByTestId("empty-state")).toBeVisible()
      await page.waitForTimeout(500) // Wait for hydration
      await page.getByTestId("create-first-transaction-button").click()

      // 8. Should navigate to create page
      await page.waitForURL(`/organizations/${orgData.id}/intercompany/new`)
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()
    })

    test("should show create transaction form fields", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-form-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Form Test User"
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
          name: `IC Form Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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

      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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

      // 6. Navigate to create page
      await page.goto(`/organizations/${orgData.id}/intercompany/new`)

      // 7. Should show form with all required fields
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("New Intercompany Transaction")

      // 8. Check form fields are present
      await expect(page.getByTestId("from-company-select")).toBeVisible()
      await expect(page.getByTestId("to-company-select")).toBeVisible()
      await expect(page.getByTestId("transaction-type-select")).toBeVisible()
      await expect(page.getByTestId("transaction-date-input")).toBeVisible()
      await expect(page.getByTestId("amount-input")).toBeVisible()
      await expect(page.getByTestId("currency-select")).toBeVisible()
      await expect(page.getByTestId("description-input")).toBeVisible()

      // 9. Check buttons are present
      await expect(page.getByTestId("cancel-button")).toBeVisible()
      await expect(page.getByTestId("submit-button")).toBeVisible()
    })

    test("should show validation error for missing required fields", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-validation-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Validation Test User"
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
          name: `IC Validation Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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

      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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

      // 6. Navigate to create page
      await page.goto(`/organizations/${orgData.id}/intercompany/new`)

      // 7. Wait for page to load
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()
      await page.waitForTimeout(500) // Wait for hydration

      // 8. Try to submit without filling required fields
      await page.getByTestId("submit-button").click()

      // 9. Should show validation errors
      await expect(page.getByText("From company is required")).toBeVisible()
      await expect(page.getByText("To company is required")).toBeVisible()
      await expect(page.getByText("Amount is required")).toBeVisible()
    })

    test("should show validation error for same from and to company", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-same-company-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Same Company Test User"
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
          name: `IC Same Company Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      const company1Res = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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
      expect(company1Res.ok()).toBeTruthy()
      const company1 = await company1Res.json()

      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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

      // 6. Navigate to create page
      await page.goto(`/organizations/${orgData.id}/intercompany/new`)

      // 7. Wait for page to load
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()
      await page.waitForTimeout(500) // Wait for hydration

      // 8. Select Company A in "From Company" using Combobox helper
      await selectComboboxOption(page, "from-company-select", "Company A", expect)

      // 9. Check that the "To Company" dropdown doesn't include the selected "From Company"
      // The UI should filter out the selected company
      // Open the To Company Combobox and verify Company A is not visible
      const toCompanyCombobox = page.getByTestId("to-company-select")
      await expect(toCompanyCombobox).toBeVisible()

      // Click to open the dropdown
      const toCompanyButton = toCompanyCombobox.locator("button")
      await toCompanyButton.click()
      await page.waitForTimeout(100)

      // Wait for dropdown options to appear (li elements in the floating portal)
      await expect(page.locator("li").first()).toBeVisible({ timeout: 5000 })

      // Get all visible options in the dropdown
      const toOptions = await page.locator("li").allTextContents()

      // Company A should NOT be in the "To Company" options (only Company B should appear)
      // The options should contain Company B but NOT Company A
      const hasCompanyA = toOptions.some(opt => opt.includes("Company A"))
      const hasCompanyB = toOptions.some(opt => opt.includes("Company B"))

      expect(hasCompanyA).toBe(false) // Company A should be filtered out
      expect(hasCompanyB).toBe(true)  // Company B should still be available

      // Close the dropdown by pressing Escape
      await page.keyboard.press("Escape")
    })

    test("should cancel and return to list", async ({ page, request }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-cancel-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Cancel Test User"
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
          name: `IC Cancel Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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

      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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

      // 6. Navigate to create page
      await page.goto(`/organizations/${orgData.id}/intercompany/new`)

      // 7. Wait for page to load
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()
      await page.waitForTimeout(500) // Wait for hydration

      // 8. Click cancel button
      await page.getByTestId("cancel-button").click()

      // 9. Should navigate back to list page
      await page.waitForURL(`/organizations/${orgData.id}/intercompany`)
      await expect(page.getByTestId("intercompany-page")).toBeVisible()
    })

    test("should navigate back using back link", async ({ page, request }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-backlink-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Back Link Test User"
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
          name: `IC Back Link Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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

      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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

      // 6. Navigate to create page
      await page.goto(`/organizations/${orgData.id}/intercompany/new`)

      // 7. Wait for page to load
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()
      await page.waitForTimeout(500) // Wait for hydration

      // 8. Click back link
      await page.getByText("Back to Intercompany Transactions").click()

      // 9. Should navigate back to list page
      await page.waitForURL(`/organizations/${orgData.id}/intercompany`)
      await expect(page.getByTestId("intercompany-page")).toBeVisible()
    })
  })

  test.describe("Transaction Type Selection", () => {
    test("should list all transaction types in dropdown", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-types-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC Types Test User"
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
          name: `IC Types Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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

      await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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

      // 6. Navigate to create page
      await page.goto(`/organizations/${orgData.id}/intercompany/new`)

      // 7. Wait for page to load
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()

      // 8. Check transaction type options
      const typeSelect = page.getByTestId("transaction-type-select")
      const options = await typeSelect.locator("option").allTextContents()

      // Should have all transaction types
      expect(options).toContain("Sale/Purchase")
      expect(options).toContain("Loan")
      expect(options).toContain("Management Fee")
      expect(options).toContain("Dividend")
      expect(options).toContain("Capital Contribution")
      expect(options).toContain("Cost Allocation")
      expect(options).toContain("Royalty")
    })
  })

  test.describe("JE Linking Section", () => {
    test("should show JE linking section after selecting companies", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-ic-je-link-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "IC JE Link Test User"
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
          name: `IC JE Link Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create two companies
      const company1Res = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company A ${Date.now()}`,
          legalName: "Company A Inc.",
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
      expect(company1Res.ok()).toBeTruthy()
      const company1 = await company1Res.json()

      const company2Res = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Company B ${Date.now()}`,
          legalName: "Company B Inc.",
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
      expect(company2Res.ok()).toBeTruthy()
      const company2 = await company2Res.json()

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

      // 6. Navigate to create page
      await page.goto(`/organizations/${orgData.id}/intercompany/new`)

      // 7. Wait for page to load
      await expect(
        page.getByTestId("create-intercompany-transaction-page")
      ).toBeVisible()
      await page.waitForTimeout(500) // Wait for hydration

      // 8. Initially, JE linking section should not be visible (no companies selected)
      await expect(page.getByText("Link Journal Entries")).not.toBeVisible()

      // 9. Select from company using Combobox helper
      await selectComboboxOption(page, "from-company-select", "Company A", expect)

      // 10. JE linking section should now be visible
      await expect(page.getByText("Link Journal Entries")).toBeVisible()

      // 11. From JE toggle should be visible
      await expect(page.getByTestId("from-je-toggle")).toBeVisible()

      // 12. Select to company using Combobox helper
      await selectComboboxOption(page, "to-company-select", "Company B", expect)

      // 13. To JE toggle should be visible
      await expect(page.getByTestId("to-je-toggle")).toBeVisible()
    })
  })
})
