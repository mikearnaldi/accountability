/**
 * Chart of Accounts E2E Tests
 *
 * Tests for the chart of accounts page with SSR:
 * - loader fetches accounts for company
 * - Tree view displaying account hierarchy
 * - Filter by account type
 * - Search by account name/number
 * - Create account: modal form, api.POST, router.invalidate()
 * - Edit account: modal form, api.PUT, router.invalidate()
 */

import { test, expect } from "@playwright/test"
import { selectComboboxOption } from "./helpers/combobox"

test.describe("Chart of Accounts Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to accounts page without authentication
    await page.goto(
      "/organizations/some-org-id/companies/some-company-id/accounts"
    )

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations")
  })

  test("should display accounts tree (SSR - no loading spinner)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-accounts-page-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Accounts Page Test User"
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
        name: `Accounts Test Org ${Date.now()}`,
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
        name: `Accounts Test Company ${Date.now()}`,
        legalName: "Accounts Test Company Inc.",
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

    // 5. Create some accounts via API
    const createAccountRes1 = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Cash",
        description: "Cash and cash equivalents",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: "Operating",
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    expect(createAccountRes1.ok()).toBeTruthy()

    const createAccountRes2 = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "2000",
        name: "Accounts Payable",
        description: null,
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    expect(createAccountRes2.ok()).toBeTruthy()

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

    // 7. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 8. Should be on accounts page
    expect(page.url()).toContain(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 9. Should show "Chart of Accounts" heading on page
    await expect(
      page.getByRole("heading", { name: "Chart of Accounts", exact: true })
    ).toBeVisible()

    // 10. Should show account count
    await expect(page.getByText(/2 of 2 accounts/i)).toBeVisible()

    // 11. Should show first account (use data-testid to avoid matching timestamps)
    await expect(page.getByTestId("account-number-1000")).toBeVisible()
    await expect(page.getByText("Cash")).toBeVisible()

    // 12. Should show second account (use data-testid to avoid matching org timestamps containing "2000")
    await expect(page.getByTestId("account-number-2000")).toBeVisible()
    await expect(page.getByText("Accounts Payable")).toBeVisible()
  })

  test("should display empty state when no accounts", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-accounts-empty-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Accounts Empty Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company (no accounts)
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Accounts Empty Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Empty Accounts Company ${Date.now()}`,
        legalName: "Empty Accounts Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 6. Should show empty state
    await expect(page.getByText(/No accounts yet/i)).toBeVisible()

    // 7. Should show create button
    await expect(
      page.getByRole("button", { name: /Create Account/i })
    ).toBeVisible()
  })

  test("should create account via form", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-account-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Account Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Create Account Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Create Account Company ${Date.now()}`,
        legalName: "Create Account Company Inc.",
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

    // 6. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 7. Click "Create Account" button in empty state (no accounts exist yet)
    await page.getByTestId("create-account-empty-button").click()

    // 8. Should show create account form modal
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).toBeVisible()

    // 9. Fill in account details
    await page.fill("#account-number", "1100")
    await page.fill("#account-name", "Petty Cash")
    await page.fill(
      "#account-description",
      "Small cash fund for minor expenses"
    )
    await page.selectOption("#account-type", "Asset")
    await page.selectOption("#account-category", "CurrentAsset")
    await page.selectOption("#account-normal-balance", "Debit")

    // 10. Submit form
    await page.click('button[type="submit"]')

    // 11. Should show new account in list (after invalidation)
    // Use specific data-testid to avoid matching timestamps in org/company names
    await expect(page.getByTestId("account-number-1100")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("account-name-1100").getByText("Petty Cash")).toBeVisible()

    // 12. Should show updated account count
    await expect(page.getByText(/1 of 1 accounts/i)).toBeVisible()
  })

  test("should edit account via form", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-edit-account-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Edit Account Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Edit Account Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Edit Account Company ${Date.now()}`,
        legalName: "Edit Account Company Inc.",
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

    // 4. Create an account to edit
    const createAccountRes = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "3000",
        name: "Original Name",
        description: "Original description",
        accountType: "Equity",
        accountCategory: "ContributedCapital",
        normalBalance: "Credit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    expect(createAccountRes.ok()).toBeTruthy()

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

    // 7. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 8. Should see the account
    await expect(page.getByText("Original Name")).toBeVisible()

    // 9. Click the edit button using aria-label
    await page.getByRole("button", { name: "Edit Original Name" }).click()

    // 10. Should show edit account form modal
    await expect(
      page.getByRole("heading", { name: "Edit Account" })
    ).toBeVisible()

    // 11. Update the account name
    await page.fill("#account-name", "Updated Name")
    await page.fill("#account-description", "Updated description")

    // 12. Submit form
    await page.click('button[type="submit"]')

    // 13. Should show updated account in list (after invalidation)
    await expect(page.getByText("Updated Name")).toBeVisible({ timeout: 10000 })

    // 14. Original name should no longer be visible
    await expect(page.getByText("Original Name")).not.toBeVisible()
  })

  test("should filter accounts by type", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-filter-accounts-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Filter Accounts Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Filter Accounts Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Filter Accounts Company ${Date.now()}`,
        legalName: "Filter Accounts Company Inc.",
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

    // 4. Create accounts of different types
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Cash Account",
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: "Operating",
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "4000",
        name: "Sales Revenue",
        description: null,
        accountType: "Revenue",
        accountCategory: "OperatingRevenue",
        normalBalance: "Credit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "5000",
        name: "Office Supplies",
        description: null,
        accountType: "Expense",
        accountCategory: "OperatingExpense",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
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

    // 6. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // Wait for page to be fully loaded (React hydration)
    await expect(page.getByTestId("accounts-page")).toBeVisible()

    // 7. Should show all 3 accounts initially
    await expect(page.getByText(/3 of 3 accounts/i)).toBeVisible()
    await expect(page.getByText("Cash Account")).toBeVisible()
    await expect(page.getByText("Sales Revenue")).toBeVisible()
    await expect(page.getByText("Office Supplies")).toBeVisible()

    // Get the type filter select by its specific testid
    const typeFilter = page.getByTestId("accounts-filter-type")
    await expect(typeFilter).toBeVisible()

    // Wait for full hydration before interacting with filter
    await page.waitForTimeout(500)

    // 8. Filter by Assets - wait for filter to be applied
    await typeFilter.selectOption("Asset")
    await expect(typeFilter).toHaveValue("Asset")

    // Wait a moment for React state to update
    await page.waitForTimeout(200)

    // 9. Should only show asset accounts - wait for filtering to complete
    await expect(page.getByText(/1 of 3 accounts/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Cash Account")).toBeVisible()
    await expect(page.getByText("Sales Revenue")).not.toBeVisible()
    await expect(page.getByText("Office Supplies")).not.toBeVisible()

    // 10. Filter by Revenue - wait for filter to be applied
    await typeFilter.selectOption("Revenue")
    await expect(typeFilter).toHaveValue("Revenue")

    // Wait a moment for React state to update
    await page.waitForTimeout(200)

    // 11. Should only show revenue accounts - wait for filtering to complete
    await expect(page.getByText(/1 of 3 accounts/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Cash Account")).not.toBeVisible()
    await expect(page.getByText("Sales Revenue")).toBeVisible()
    await expect(page.getByText("Office Supplies")).not.toBeVisible()

    // 12. Reset filter
    await typeFilter.selectOption("All")
    await expect(typeFilter).toHaveValue("All")
    await page.waitForTimeout(200)
    await expect(page.getByText(/3 of 3 accounts/i)).toBeVisible({ timeout: 10000 })
  })

  test("should search accounts by name and number", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-search-accounts-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Search Accounts Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Search Accounts Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Search Accounts Company ${Date.now()}`,
        legalName: "Search Accounts Company Inc.",
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

    // 4. Create accounts
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1100",
        name: "Bank Account - Checking",
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: "Operating",
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1200",
        name: "Accounts Receivable",
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "2100",
        name: "Accounts Payable",
        description: null,
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
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

    // 6. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 7. Should show all 3 accounts initially
    await expect(page.getByText(/3 of 3 accounts/i)).toBeVisible()

    // 8. Search by name - wait for search input to be ready first
    const searchInput = page.locator('input[placeholder="Search accounts..."]')
    await expect(searchInput).toBeVisible()

    // Clear and type to trigger onChange events properly
    await searchInput.clear()
    await searchInput.pressSequentially("Bank", { delay: 50 })

    // 9. Should only show matching account (wait for filter to apply)
    await expect(page.getByText(/1 of 3 accounts/i)).toBeVisible()
    await expect(page.getByText("Bank Account - Checking")).toBeVisible()
    await expect(page.getByText("Accounts Receivable")).not.toBeVisible()
    await expect(page.getByText("Accounts Payable")).not.toBeVisible()

    // 10. Search by account number
    await searchInput.clear()
    await searchInput.pressSequentially("21", { delay: 50 })

    // 11. Should only show matching account (wait for filter to apply)
    await expect(page.getByText(/1 of 3 accounts/i)).toBeVisible()
    await expect(page.getByText("Accounts Payable")).toBeVisible()
    await expect(page.getByText("Bank Account - Checking")).not.toBeVisible()

    // 12. Clear search
    await searchInput.clear()
    await expect(page.getByText(/3 of 3 accounts/i)).toBeVisible()
  })

  test("should show validation error for empty account name", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-account-validation-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Account Validation Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // Wait for page to fully load (React hydration)
    await page.waitForTimeout(500)
    await expect(page.getByTestId("accounts-page")).toBeVisible()

    // Wait for "Create Account" button in empty state (no accounts exist yet)
    const createAccountButton = page.getByTestId("create-account-empty-button")
    await expect(createAccountButton).toBeVisible()
    await expect(createAccountButton).toBeEnabled()

    // 6. Click "Create Account" button
    await createAccountButton.click({ force: true })

    // 7. Wait for modal to appear (wait for React state update)
    await expect(page.getByTestId("account-form-modal")).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).toBeVisible({ timeout: 10000 })

    // 8. Fill only account number, leave name empty (whitespace)
    await page.fill("#account-number", "1000")
    await page.fill("#account-name", "   ")

    // 9. Submit form
    await page.click('button[type="submit"]')

    // 10. Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText(/Account name is required/i)).toBeVisible()
  })

  test("should cancel create form and close modal", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-cancel-account-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Cancel Account Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Cancel Account Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Cancel Account Company ${Date.now()}`,
        legalName: "Cancel Account Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // Wait for page to be fully loaded (React hydration)
    await expect(page.getByTestId("accounts-page")).toBeVisible()

    // Wait for the "Create Account" button in empty state (no accounts exist yet)
    const createAccountButton = page.getByTestId("create-account-empty-button")
    await expect(createAccountButton).toBeVisible()
    await expect(createAccountButton).toBeEnabled()

    // Wait for full hydration before clicking
    await page.waitForTimeout(500)

    // 6. Click "Create Account" button with force
    await createAccountButton.click({ force: true })

    // 7. Modal should be visible (wait for React state update)
    await expect(page.getByTestId("account-form-modal")).toBeVisible({ timeout: 15000 })
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).toBeVisible({ timeout: 10000 })

    // 8. Click cancel
    await page.getByTestId("account-form-cancel-button").click()

    // 9. Modal should be hidden
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).not.toBeVisible()
  })

  test("should navigate from company details to accounts", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-nav-accounts-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Nav Accounts Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Nav Accounts Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Nav Accounts Company ${Date.now()}`,
        legalName: "Nav Accounts Company Inc.",
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

    // 5. Navigate to company details page
    await page.goto(`/organizations/${orgData.id}/companies/${companyData.id}`)

    // 6. Should see Chart of Accounts quick action link
    await expect(page.getByTestId("nav-accounts")).toBeVisible()

    // 7. Click on the Chart of Accounts link
    await page.getByTestId("nav-accounts").click()

    // 8. Should be on accounts page
    await page.waitForURL(/\/accounts/)
    expect(page.url()).toContain(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 9. Should show Chart of Accounts heading
    await expect(
      page.getByRole("heading", { name: "Chart of Accounts", exact: true })
    ).toBeVisible()
  })

  test("should display accounts tree with hierarchy and all columns", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-accounts-tree-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Accounts Tree Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Tree Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Tree Test Company ${Date.now()}`,
        legalName: "Tree Test Company Inc.",
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

    // 4. Create parent account
    const parentAccountRes = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Current Assets",
        description: "Parent account for current assets",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: false, // Not postable - parent account
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    expect(parentAccountRes.ok()).toBeTruthy()
    const parentAccount = await parentAccountRes.json()

    // 5. Create child account
    const childAccountRes = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1100",
        name: "Cash",
        description: "Cash and cash equivalents",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: parentAccount.id,
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: "Operating",
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    expect(childAccountRes.ok()).toBeTruthy()

    // 6. Create a liability account with credit normal balance
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "2000",
        name: "Accounts Payable",
        description: null,
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

    // 7. Set session cookie
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

    // 8. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 9. Should display accounts tree container
    await expect(page.locator('[data-testid="accounts-tree"]')).toBeVisible()

    // 10. Should show tree header with all columns
    await expect(page.locator('[data-testid="header-account"]')).toContainText("Account")
    await expect(page.locator('[data-testid="header-type"]')).toContainText("Type")
    await expect(page.locator('[data-testid="header-category"]')).toContainText("Category")
    await expect(page.locator('[data-testid="header-normal-balance"]')).toContainText("Normal")
    await expect(page.locator('[data-testid="header-postable"]')).toContainText("Postable")
    await expect(page.locator('[data-testid="header-status"]')).toContainText("Status")

    // 11. Verify parent account is displayed with correct columns
    await expect(page.locator('[data-testid="account-row-1000"]')).toBeVisible()
    await expect(page.locator('[data-testid="account-number-1000"]')).toContainText("1000")
    await expect(page.locator('[data-testid="account-type-1000"]')).toContainText("Asset")
    await expect(page.locator('[data-testid="account-normal-balance-1000"]')).toContainText("Dr")

    // 12. Verify liability account shows Credit normal balance
    await expect(page.locator('[data-testid="account-row-2000"]')).toBeVisible()
    await expect(page.locator('[data-testid="account-normal-balance-2000"]')).toContainText("Cr")

    // 13. Expand parent account to show child
    await page.locator('[data-testid="account-expand-1000"]').click()

    // 14. Verify child account is now visible
    await expect(page.locator('[data-testid="account-row-1100"]')).toBeVisible()
    await expect(page.locator('[data-testid="account-number-1100"]')).toContainText("1100")
  })

  test("should filter accounts by status (Active/Inactive)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-status-filter-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Status Filter Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Status Filter Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Status Filter Company ${Date.now()}`,
        legalName: "Status Filter Company Inc.",
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

    // 4. Create active account
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Active Cash Account",
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: true,
        cashFlowCategory: "Operating",
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

    // 5. Create another active account
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "2000",
        name: "Active Payables",
        description: null,
        accountType: "Liability",
        accountCategory: "CurrentLiability",
        normalBalance: "Credit",
        parentAccountId: null,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

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

    // 7. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 8. Wait for accounts tree to load
    await expect(page.locator('[data-testid="accounts-tree"]')).toBeVisible()

    // 9. Should show both accounts initially
    await expect(page.locator('[data-testid="accounts-count"]')).toContainText("2 of 2 accounts")
    await expect(page.getByText("Active Cash Account")).toBeVisible()
    await expect(page.getByText("Active Payables")).toBeVisible()

    // 10. Verify status filter dropdown exists
    await expect(page.locator('[data-testid="accounts-filter-status"]')).toBeVisible()

    // 11. Filter by Active - should show both
    await page.locator('[data-testid="accounts-filter-status"]').selectOption("Active")
    await expect(page.locator('[data-testid="accounts-count"]')).toContainText("2 of 2 accounts")

    // 12. Filter by Inactive - should show none
    await page.locator('[data-testid="accounts-filter-status"]').selectOption("Inactive")
    await expect(page.locator('[data-testid="accounts-count"]')).toContainText("0 of 2 accounts")

    // 13. Reset filter
    await page.locator('[data-testid="accounts-filter-status"]').selectOption("All")
    await expect(page.locator('[data-testid="accounts-count"]')).toContainText("2 of 2 accounts")
  })

  test("should filter accounts by postable only", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-postable-filter-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Postable Filter Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Postable Filter Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Postable Filter Company ${Date.now()}`,
        legalName: "Postable Filter Company Inc.",
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

    // 4. Create non-postable parent account
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Summary Account",
        description: "Non-postable parent",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: false, // NOT postable
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

    // 5. Create postable account
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1100",
        name: "Postable Cash",
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: true, // IS postable
        isCashFlowRelevant: true,
        cashFlowCategory: "Operating",
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })

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

    // 7. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 8. Wait for page to be fully hydrated
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()
    await page.waitForTimeout(500)

    // 9. Should show both accounts initially
    await expect(page.locator('[data-testid="accounts-count"]')).toContainText("2 of 2 accounts")
    await expect(page.getByText("Summary Account")).toBeVisible()
    await expect(page.getByText("Postable Cash")).toBeVisible()

    // 10. Check the postable only checkbox
    const postableCheckbox = page.locator('[data-testid="accounts-filter-postable"]')
    await expect(postableCheckbox).toBeVisible()
    await postableCheckbox.check({ force: true })

    // 11. Should only show postable account - wait for filter to apply
    await expect(page.locator('[data-testid="accounts-count"]')).toContainText("1 of 2 accounts", { timeout: 15000 })
    await expect(page.getByText("Postable Cash")).toBeVisible()
    await expect(page.getByText("Summary Account")).not.toBeVisible()

    // 12. Uncheck the postable only checkbox
    await page.locator('[data-testid="accounts-filter-postable"]').uncheck({ force: true })

    // 13. Should show both accounts again - wait for filter to apply
    await expect(page.locator('[data-testid="accounts-count"]')).toContainText("2 of 2 accounts", { timeout: 15000 })
  })

  test("should show breadcrumb navigation", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-accounts-breadcrumb-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Accounts Breadcrumb Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
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

    const companyName = `Breadcrumb Test Company ${Date.now()}`
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: companyName,
        legalName: "Breadcrumb Test Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 6. Should show breadcrumb with Accountability link
    await expect(
      page.getByRole("link", { name: "Accountability" })
    ).toBeVisible()

    // 7. Should show Organizations link
    await expect(
      page.getByRole("link", { name: "Organizations" })
    ).toBeVisible()

    // 8. Should show organization name link
    await expect(page.getByRole("link", { name: orgName })).toBeVisible()

    // 9. Should show Companies link in breadcrumb
    await expect(page.getByTestId("breadcrumbs").getByRole("link", { name: "Companies" })).toBeVisible()

    // 10. Should show company name link in breadcrumb
    await expect(page.getByTestId("breadcrumbs").getByRole("link", { name: companyName })).toBeVisible()

    // 11. Click company name link in breadcrumb to navigate back
    await page.getByTestId("breadcrumbs").getByRole("link", { name: companyName }).click()

    // 12. Should be on company details page
    await page.waitForURL(`/organizations/${orgData.id}/companies/${companyData.id}`)
    expect(page.url()).toContain(
      `/organizations/${orgData.id}/companies/${companyData.id}`
    )
    expect(page.url()).not.toContain("/accounts")
  })

  test("should create account in hierarchy via form", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-hierarchy-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Hierarchy Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Hierarchy Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Hierarchy Test Company ${Date.now()}`,
        legalName: "Hierarchy Test Company Inc.",
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

    // 4. Create a parent account via API
    const parentAccountRes = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Current Assets",
        description: "Parent account for current assets",
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: false,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    expect(parentAccountRes.ok()).toBeTruthy()
    const parentAccount = await parentAccountRes.json()

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

    // 7. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 8. Should show the parent account
    await expect(page.getByText("Current Assets")).toBeVisible()

    // 9. Click "New Account" button
    await page.getByRole("button", { name: /New Account/i }).click()

    // 10. Should show create account form modal
    await expect(
      page.getByRole("heading", { name: "Create Account" })
    ).toBeVisible()

    // 11. Fill in child account details
    await page.fill("#account-number", "1100")
    await page.fill("#account-name", "Cash and Cash Equivalents")
    await page.fill("#account-description", "Cash in bank accounts")
    await page.selectOption("#account-type", "Asset")
    await page.selectOption("#account-category", "CurrentAsset")
    await page.selectOption("#account-normal-balance", "Debit")

    // 12. Select parent account - use Combobox helper to search by account name
    await selectComboboxOption(page, "account-parent-select", "Current Assets", expect)

    // 13. Mark as postable and cash flow relevant
    await page.check("#account-is-postable")
    await page.check("#account-is-cash-flow-relevant")
    await page.selectOption("#account-cash-flow-category", "Operating")

    // 14. Submit form
    await page.click('button[type="submit"]')

    // 15. Should show updated account count (2 accounts) - wait for data refresh
    await expect(page.getByText(/2 of 2 accounts/i)).toBeVisible({
      timeout: 10000
    })

    // 16. Expand parent account to verify hierarchy (child is not visible until expanded)
    await page.locator('[data-testid="account-expand-1000"]').click()

    // 17. Should show new child account after expanding parent
    await expect(page.getByText("Cash and Cash Equivalents")).toBeVisible({
      timeout: 5000
    })

    // 18. Verify child account is nested under parent
    await expect(page.locator('[data-testid="account-row-1100"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="account-number-1100"]')
    ).toContainText("1100")

    // 19. Verify the child account shows as a child (indented in tree)
    // The child row should exist and have the parent relationship
    const childRow = page.locator('[data-testid="account-row-1100"]')
    await expect(childRow).toBeVisible()
  })
})
