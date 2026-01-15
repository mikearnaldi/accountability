/**
 * Journal Entries List E2E Tests
 *
 * Tests for the journal entries list page with SSR:
 * - loader fetches journal entries for company with pagination
 * - Display entry list: date, reference, description, type, period, status
 * - Filter by status (Draft, PendingApproval, Approved, Posted, Reversed)
 * - Filter by entry type (Standard, Adjusting, Closing, Opening, Reversing, etc.)
 * - Filter by date range
 * - Filter by fiscal period
 * - Search by description/reference
 * - New Entry button (disabled - detail/create pages coming soon)
 * - Breadcrumb navigation
 */

import { test, expect } from "@playwright/test"

test.describe("Journal Entries List Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to journal entries page without authentication
    await page.goto(
      "/organizations/some-org-id/companies/some-company-id/journal-entries"
    )

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations")
  })

  test("should display journal entries list (SSR - no loading spinner)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-journal-entries-page-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Journal Entries Page Test User"
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
        name: `Journal Entries Test Org ${Date.now()}`,
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
        name: `Journal Entries Test Company ${Date.now()}`,
        legalName: "Journal Entries Test Company Inc.",
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

    // 5. Create accounts for journal entry lines
    const createAccount1Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
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
    expect(createAccount1Res.ok()).toBeTruthy()
    const account1Data = await createAccount1Res.json()

    const createAccount2Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "4000",
        name: "Revenue",
        description: "Sales revenue",
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
    expect(createAccount2Res.ok()).toBeTruthy()
    const account2Data = await createAccount2Res.json()

    // 6. Create a fiscal year for the journal entries
    const createFiscalYearRes = await request.post("/api/v1/fiscal/fiscal-years", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        name: "FY2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        includePeriod13: false
      }
    })
    expect(createFiscalYearRes.ok()).toBeTruthy()

    // 7. Create journal entries via API
    const createJournalEntry1Res = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Cash sale to customer",
        transactionDate: "2025-01-15",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: "INV-001",
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "1000.00", currency: "USD" },
            creditAmount: null,
            memo: "Cash received",
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "1000.00", currency: "USD" },
            memo: "Revenue earned",
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })
    expect(createJournalEntry1Res.ok()).toBeTruthy()

    const createJournalEntry2Res = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Adjusting entry",
        transactionDate: "2025-01-31",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Adjusting",
        sourceModule: "GeneralLedger",
        referenceNumber: "ADJ-001",
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "500.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "500.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })
    expect(createJournalEntry2Res.ok()).toBeTruthy()

    // 8. Set session cookie
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

    // 9. Navigate to journal entries page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 10. Should be on journal entries page
    expect(page.url()).toContain(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 11. Should show "Journal Entries" heading in breadcrumb
    await expect(
      page.getByRole("heading", { name: "Journal Entries", exact: true })
    ).toBeVisible()

    // 12. Should show entry count
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")

    // 13. Should show journal entries table
    await expect(page.locator('[data-testid="journal-entries-table"]')).toBeVisible()

    // 14. Should show first journal entry by reference number
    await expect(page.locator('[data-testid="journal-entry-row-INV-001"]')).toBeVisible()
    await expect(page.locator('[data-testid="journal-entry-description-INV-001"]')).toContainText("Cash sale to customer")

    // 15. Should show second journal entry
    await expect(page.locator('[data-testid="journal-entry-row-ADJ-001"]')).toBeVisible()
    await expect(page.locator('[data-testid="journal-entry-description-ADJ-001"]')).toContainText("Adjusting entry")
  })

  test("should display empty state when no journal entries", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-journal-entries-empty-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Journal Entries Empty Test User"
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

    // 3. Create org and company (no journal entries)
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Journal Entries Empty Test Org ${Date.now()}`,
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
        name: `Empty Journal Entries Company ${Date.now()}`,
        legalName: "Empty Journal Entries Company Inc.",
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

    // 5. Navigate to journal entries page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 6. Should show empty state
    await expect(page.locator('[data-testid="journal-entries-empty-state"]')).toBeVisible()
    await expect(page.locator('[data-testid="journal-entries-empty-state"]')).toContainText("No journal entries yet")

    // 7. Should show enabled create button that navigates to new entry form
    await expect(page.locator('[data-testid="create-journal-entry-empty-button"]')).toBeVisible()

    // 8. Click the Create Journal Entry button
    await page.locator('[data-testid="create-journal-entry-empty-button"]').click()

    // 9. Should navigate to new journal entry page
    await page.waitForURL(/\/journal-entries\/new/)
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`)
  })

  test("should filter journal entries by status", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-filter-status-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Filter Status Test User"
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

    // 3. Create org, company, accounts, fiscal year
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Filter Status Test Org ${Date.now()}`,
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
        name: `Filter Status Company ${Date.now()}`,
        legalName: "Filter Status Company Inc.",
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

    // Create accounts
    const createAccount1Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Cash",
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
    expect(createAccount1Res.ok()).toBeTruthy()
    const account1Data = await createAccount1Res.json()

    const createAccount2Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "4000",
        name: "Revenue",
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
    expect(createAccount2Res.ok()).toBeTruthy()
    const account2Data = await createAccount2Res.json()

    // Create fiscal year
    const createFiscalYearRes = await request.post("/api/v1/fiscal/fiscal-years", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        name: "FY2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        includePeriod13: false
      }
    })
    expect(createFiscalYearRes.ok()).toBeTruthy()

    // 4. Create journal entries (will all be Draft status)
    await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Draft Entry 1",
        transactionDate: "2025-01-15",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: null,
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "100.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "100.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })

    await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Draft Entry 2",
        transactionDate: "2025-01-20",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: null,
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "200.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "200.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
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

    // 6. Navigate to journal entries page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 7. Should show all entries initially
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")
    await expect(page.getByText("Draft Entry 1")).toBeVisible()
    await expect(page.getByText("Draft Entry 2")).toBeVisible()

    // 8. Filter by Draft status
    await page.locator('[data-testid="journal-entries-filter-status"]').selectOption("Draft")

    // 9. Should still show both entries (both are Draft)
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")

    // 10. Filter by Posted status (no entries should match)
    await page.locator('[data-testid="journal-entries-filter-status"]').selectOption("Posted")

    // 11. Should show no entries message
    await expect(page.locator('[data-testid="journal-entries-no-results"]')).toBeVisible()
    await expect(page.locator('[data-testid="journal-entries-no-results"]')).toContainText("No journal entries match")

    // 12. Clear filters (use exact match to get toolbar button)
    await page.locator('[data-testid="journal-entries-clear-filters"]').click()

    // 13. Should show all entries again
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")
  })

  test("should filter journal entries by type", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-filter-type-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Filter Type Test User"
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

    // 3. Create org, company, accounts, fiscal year
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Filter Type Test Org ${Date.now()}`,
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
        name: `Filter Type Company ${Date.now()}`,
        legalName: "Filter Type Company Inc.",
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

    // Create accounts
    const createAccount1Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Cash",
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
    expect(createAccount1Res.ok()).toBeTruthy()
    const account1Data = await createAccount1Res.json()

    const createAccount2Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "4000",
        name: "Revenue",
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
    expect(createAccount2Res.ok()).toBeTruthy()
    const account2Data = await createAccount2Res.json()

    // Create fiscal year
    await request.post("/api/v1/fiscal/fiscal-years", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        name: "FY2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        includePeriod13: false
      }
    })

    // 4. Create journal entries of different types
    await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Standard Entry",
        transactionDate: "2025-01-15",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: null,
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "100.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "100.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })

    await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Adjusting Entry",
        transactionDate: "2025-01-31",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Adjusting",
        sourceModule: "GeneralLedger",
        referenceNumber: null,
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "50.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "50.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
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

    // 6. Navigate to journal entries page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 7. Should show all entries initially
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")
    await expect(page.getByText("Standard Entry")).toBeVisible()
    await expect(page.getByText("Adjusting Entry")).toBeVisible()

    // 8. Filter by Standard type using data-testid
    await page.locator('[data-testid="journal-entries-filter-type"]').selectOption("Standard")

    // 9. Should only show Standard entry
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("1 of 2 entries")
    await expect(page.getByText("Standard Entry")).toBeVisible()
    await expect(page.getByText("Adjusting Entry")).not.toBeVisible()

    // 10. Filter by Adjusting type
    await page.locator('[data-testid="journal-entries-filter-type"]').selectOption("Adjusting")

    // 11. Should only show Adjusting entry
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("1 of 2 entries")
    await expect(page.getByText("Adjusting Entry")).toBeVisible()
    await expect(page.getByText("Standard Entry")).not.toBeVisible()

    // 12. Reset filter
    await page.locator('[data-testid="journal-entries-filter-type"]').selectOption("All")
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")
  })

  test("should navigate to new journal entry form when clicking New Entry button", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-new-entry-button-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "New Entry Button Test User"
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
        name: `New Entry Button Test Org ${Date.now()}`,
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
        name: `New Entry Button Company ${Date.now()}`,
        legalName: "New Entry Button Company Inc.",
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

    // 5. Navigate to journal entries page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 6. Should show enabled New Entry button
    const newEntryButton = page.locator('[data-testid="create-journal-entry-button"]')
    await expect(newEntryButton).toBeVisible()

    // 7. Click the New Entry button
    await newEntryButton.click()

    // 8. Should navigate to new journal entry page
    await page.waitForURL(/\/journal-entries\/new/)
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`)

    // 9. Should show Create Journal Entry heading
    await expect(page.getByRole("heading", { name: "Create Journal Entry" })).toBeVisible()
  })

  test("should create a balanced journal entry", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-journal-entry-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Journal Entry Test User"
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

    // 3. Create org, company, accounts, fiscal year
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Create JE Test Org ${Date.now()}`,
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
        name: `Create JE Company ${Date.now()}`,
        legalName: "Create JE Company Inc.",
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

    // Create accounts
    const createAccount1Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
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
    expect(createAccount1Res.ok()).toBeTruthy()

    const createAccount2Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "4000",
        name: "Revenue",
        description: "Sales revenue",
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
    expect(createAccount2Res.ok()).toBeTruthy()

    // Create fiscal year
    await request.post("/api/v1/fiscal/fiscal-years", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        name: "FY2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        includePeriod13: false
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

    // 5. Navigate to new journal entry page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`
    )

    // 6. Should show the journal entry form
    await expect(page.locator('[data-testid="journal-entry-form"]')).toBeVisible()
    await expect(page.getByRole("heading", { name: "Create Journal Entry" })).toBeVisible()

    // 7. Fill in entry details
    await page.locator('[data-testid="journal-entry-description"]').fill("E2E Test - Cash sale transaction")
    await page.locator('[data-testid="journal-entry-reference"]').fill("E2E-TEST-001")

    // 8. Fill in first line (Debit to Cash)
    await page.locator('[data-testid="journal-entry-line-account-0"]').selectOption({ label: "1000 - Cash" })
    await page.locator('[data-testid="journal-entry-line-debit-0"]').fill("500.00")

    // 9. Fill in second line (Credit to Revenue)
    await page.locator('[data-testid="journal-entry-line-account-1"]').selectOption({ label: "4000 - Revenue" })
    await page.locator('[data-testid="journal-entry-line-credit-1"]').fill("500.00")

    // 10. Should show balance indicator as balanced (green) - allow time for UI update
    await expect(page.locator('[data-testid="balance-indicator-balanced"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="total-debits"]')).toContainText("500.00", { timeout: 10000 })
    await expect(page.locator('[data-testid="total-credits"]')).toContainText("500.00", { timeout: 10000 })

    // 11. Submit button should be enabled when balanced
    await expect(page.locator('[data-testid="journal-entry-submit"]')).toBeEnabled()

    // 12. Click Save as Draft
    await page.locator('[data-testid="journal-entry-save-draft"]').click()

    // 13. Should navigate back to journal entries list
    await page.waitForURL(/\/journal-entries$/)
    expect(page.url()).toContain(`/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`)
    expect(page.url()).not.toContain("/new")

    // 14. Should show the new entry in the list
    await expect(page.getByText("E2E Test - Cash sale transaction")).toBeVisible()
    await expect(page.getByText("E2E-TEST-001")).toBeVisible()
  })

  test("should show unbalanced indicator when debits do not equal credits", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-unbalanced-entry-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Unbalanced Entry Test User"
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

    // 3. Create org, company, accounts
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Unbalanced Test Org ${Date.now()}`,
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
        name: `Unbalanced Test Company ${Date.now()}`,
        legalName: "Unbalanced Test Company Inc.",
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

    // Create accounts
    await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Cash",
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
        companyId: companyData.id,
        accountNumber: "4000",
        name: "Revenue",
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

    // Create fiscal year
    await request.post("/api/v1/fiscal/fiscal-years", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        name: "FY2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        includePeriod13: false
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

    // 5. Navigate to new journal entry page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`
    )

    // 6. Fill in entry details
    await page.locator('[data-testid="journal-entry-description"]').fill("Unbalanced entry test")

    // 7. Fill in first line (Debit to Cash)
    await page.locator('[data-testid="journal-entry-line-account-0"]').selectOption({ label: "1000 - Cash" })
    await page.locator('[data-testid="journal-entry-line-debit-0"]').fill("1000.00")

    // 8. Fill in second line with DIFFERENT amount (Credit to Revenue)
    await page.locator('[data-testid="journal-entry-line-account-1"]').selectOption({ label: "4000 - Revenue" })
    await page.locator('[data-testid="journal-entry-line-credit-1"]').fill("500.00")

    // 9. Should show balance indicator as unbalanced (red)
    await expect(page.locator('[data-testid="balance-indicator-unbalanced"]')).toBeVisible()
    await expect(page.locator('[data-testid="balance-difference"]')).toContainText("500.00")

    // 10. Submit for Approval button should be disabled when unbalanced
    await expect(page.locator('[data-testid="journal-entry-submit"]')).toBeDisabled()

    // 11. Save as Draft button should still be enabled
    await expect(page.locator('[data-testid="journal-entry-save-draft"]')).toBeEnabled()
  })

  test("should navigate from company details to journal entries", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-nav-journal-entries-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Nav Journal Entries Test User"
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
        name: `Nav Journal Entries Test Org ${Date.now()}`,
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
        name: `Nav Journal Entries Company ${Date.now()}`,
        legalName: "Nav Journal Entries Company Inc.",
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

    // 6. Should see "View Entries" link
    await expect(page.getByText("View Entries")).toBeVisible()

    // 7. Click on the Journal Entries card
    await page.getByText("View Entries").click()

    // 8. Should be on journal entries page
    await page.waitForURL(/\/journal-entries/)
    expect(page.url()).toContain(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 9. Should show Journal Entries heading
    await expect(
      page.getByRole("heading", { name: "Journal Entries", exact: true })
    ).toBeVisible()
  })

  test("should show breadcrumb navigation", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-journal-entries-breadcrumb-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Journal Entries Breadcrumb Test User"
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
    const orgName = `Breadcrumb JE Test Org ${Date.now()}`
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

    const companyName = `Breadcrumb JE Test Company ${Date.now()}`
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: companyName,
        legalName: "Breadcrumb JE Test Company Inc.",
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

    // 5. Navigate to journal entries page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
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
    expect(page.url()).not.toContain("/journal-entries")
  })

  test("should search journal entries by description", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-search-journal-entries-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Search Journal Entries Test User"
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

    // 3. Create org, company, accounts, fiscal year
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Search JE Test Org ${Date.now()}`,
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
        name: `Search JE Company ${Date.now()}`,
        legalName: "Search JE Company Inc.",
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

    // Create accounts
    const createAccount1Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "1000",
        name: "Cash",
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
    expect(createAccount1Res.ok()).toBeTruthy()
    const account1Data = await createAccount1Res.json()

    const createAccount2Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        accountNumber: "4000",
        name: "Revenue",
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
    expect(createAccount2Res.ok()).toBeTruthy()
    const account2Data = await createAccount2Res.json()

    // Create fiscal year
    await request.post("/api/v1/fiscal/fiscal-years", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        name: "FY2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        includePeriod13: false
      }
    })

    // 4. Create journal entries
    await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Office supplies purchase",
        transactionDate: "2025-01-15",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: null,
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "100.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "100.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })

    await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        companyId: companyData.id,
        description: "Customer payment received",
        transactionDate: "2025-01-20",
        documentDate: null,
        fiscalPeriod: { year: 2025, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: null,
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "500.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "500.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
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

    // 6. Navigate to journal entries page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 7. Should show all entries initially
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")

    // 8. Search by description using data-testid
    await page.locator('[data-testid="journal-entries-search-input"]').fill("Office")

    // 9. Should only show matching entry
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("1 of 2 entries")
    await expect(page.getByText("Office supplies purchase")).toBeVisible()
    await expect(page.getByText("Customer payment received")).not.toBeVisible()

    // 10. Clear search
    await page.locator('[data-testid="journal-entries-search-input"]').fill("")
    await expect(page.locator('[data-testid="journal-entries-count"]')).toContainText("2 of 2 entries")
  })
})
