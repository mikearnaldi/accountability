/**
 * Journal Entry Past Dates E2E Tests
 *
 * Tests to verify that journal entries can be created with past dates:
 * - Creating entries with dates from previous years (2024, 2025 relative to 2026)
 * - Creating entries on fiscal year boundaries (Dec 31, Jan 1)
 * - Verifying fiscal period computation for past dates
 * - Testing entries far in the past (1900, 2000)
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test"

/**
 * Helper to select an option from a Combobox component.
 * The Combobox is a div-based searchable dropdown, not a native select.
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

  // Click to open the combobox dropdown
  await combobox.click()

  // Wait for dropdown to open and input to be visible
  await page.waitForTimeout(100)

  // Type to filter options
  const input = combobox.locator("input")
  await input.fill(searchText)

  // Wait for filtering to complete
  await page.waitForTimeout(100)

  // Click the first matching option in the dropdown
  // The dropdown is rendered in a FloatingPortal, so we need to look for it globally
  const option = page.locator(`li:has-text("${searchText}")`).first()
  await option.click()

  // Wait for dropdown to close
  await page.waitForTimeout(100)
}

/**
 * Helper to create a fiscal year with a specific period opened for testing.
 * This is required because journal entry creation now requires fiscal periods to exist.
 * Note: Periods are created with "Open" status by default, so no need to call /open endpoint.
 */
async function createFiscalYearWithOpenPeriod(
  request: APIRequestContext,
  sessionToken: string,
  organizationId: string,
  companyId: string,
  year: number,
  periodNumber: number
): Promise<{ fiscalYearId: string; openPeriodId: string }> {
  // Create fiscal year
  const createFiscalYearRes = await request.post(
    `/api/v1/organizations/${organizationId}/companies/${companyId}/fiscal-years`,
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        year,
        name: `FY ${year}`,
        startDate: { year, month: 1, day: 1 },
        endDate: { year, month: 12, day: 31 },
        includeAdjustmentPeriod: null
      }
    }
  )
  if (!createFiscalYearRes.ok()) {
    throw new Error(`Failed to create fiscal year ${year}: ${await createFiscalYearRes.text()}`)
  }
  const fiscalYearData = await createFiscalYearRes.json()
  const fiscalYearId = fiscalYearData.id

  // Get periods to find the requested period
  // Note: Periods are automatically created with "Open" status, no need to open them
  const listPeriodsRes = await request.get(
    `/api/v1/organizations/${organizationId}/companies/${companyId}/fiscal-years/${fiscalYearId}/periods`,
    {
      headers: { Authorization: `Bearer ${sessionToken}` }
    }
  )
  if (!listPeriodsRes.ok()) {
    throw new Error(`Failed to list periods: ${await listPeriodsRes.text()}`)
  }
  const periodsData = await listPeriodsRes.json()
  const period = periodsData.periods.find((p: { periodNumber: number }) => p.periodNumber === periodNumber)
  if (!period) {
    throw new Error(`Period ${periodNumber} not found`)
  }

  return { fiscalYearId, openPeriodId: period.id }
}

test.describe("Journal Entry Past Dates", () => {
  test("can create journal entry with date from previous year (2024)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-past-date-2024-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Past Date 2024 Test User"
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
        name: `Past Date 2024 Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // 4. Create a company with calendar year fiscal year end
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Past Date 2024 Test Company ${Date.now()}`,
        legalName: "Past Date 2024 Test Company Inc.",
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

    // 5. Create accounts for journal entry lines
    const createAccount1Res = await request.post("/api/v1/accounts", {
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
    expect(createAccount1Res.ok()).toBeTruthy()

    const createAccount2Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
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

    // 6. Create fiscal year 2024 with period 1 (January) open
    await createFiscalYearWithOpenPeriod(request, sessionToken, orgData.id, companyData.id, 2024, 1)

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

    // 8. Navigate to new journal entry page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`
    )

    // 8. Wait for form to be ready
    await expect(page.locator('[data-testid="journal-entry-form"]')).toBeVisible()

    // 9. Set past date (January 15, 2024 - 2 years ago relative to 2026)
    // Note: PeriodDatePicker wraps the input, so we need to target the -input suffix
    const dateInput = page.locator('[data-testid="journal-entry-date-input"]')
    await dateInput.click()
    await dateInput.fill("2024-01-15")
    // Blur the input to trigger state update
    await dateInput.blur()
    await expect(dateInput).toHaveValue("2024-01-15")

    // 10. Verify fiscal period computed correctly for 2024 (wait for React state update)
    await expect(page.locator('[data-testid="computed-fiscal-period"]')).toContainText(
      "P1 FY2024",
      { timeout: 10000 }
    )

    // 11. Fill in entry details
    const descriptionInput = page.locator('[data-testid="journal-entry-description"]')
    await descriptionInput.click()
    await descriptionInput.fill("Historical entry from 2024")
    await expect(descriptionInput).toHaveValue("Historical entry from 2024")

    await page.locator('[data-testid="journal-entry-reference"]').fill("HIST-2024-001")

    // 12. Fill in first line (Debit to Cash)
    await selectComboboxOption(page, "journal-entry-line-account-0", "1000 - Cash")
    const debitInput0 = page.locator('[data-testid="journal-entry-line-debit-0"]')
    await debitInput0.click()
    await debitInput0.fill("1000.00")

    // 13. Fill in second line (Credit to Revenue)
    await selectComboboxOption(page, "journal-entry-line-account-1", "4000 - Revenue")
    const creditInput1 = page.locator('[data-testid="journal-entry-line-credit-1"]')
    await creditInput1.click()
    await creditInput1.fill("1000.00")

    // 14. Should be balanced
    await expect(page.locator('[data-testid="balance-indicator-balanced"]')).toBeVisible({ timeout: 10000 })

    // 15. Click Save as Draft
    await page.locator('[data-testid="journal-entry-save-draft"]').click()

    // 16. Should navigate back to journal entries list
    await page.waitForURL(/\/journal-entries$/)
    expect(page.url()).not.toContain("/new")

    // 17. Should show the new entry with 2024 date in the list
    await expect(page.getByText("Historical entry from 2024")).toBeVisible()
    await expect(page.getByText("HIST-2024-001")).toBeVisible()
    // Verify the date column shows 2024
    await expect(page.getByText("Jan 15, 2024")).toBeVisible()
  })

  test("can create journal entry with date from 2 years ago via API", async ({
    request
  }) => {
    // This test verifies the API directly accepts past dates

    // 1. Register a test user
    const testUser = {
      email: `test-api-past-date-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "API Past Date Test User"
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
        name: `API Past Date Test Org ${Date.now()}`,
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
        name: `API Past Date Company ${Date.now()}`,
        legalName: "API Past Date Company Inc.",
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
    const createAccount1Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
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
        organizationId: orgData.id,
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

    // 5. Create fiscal year 2024 with period 6 (June) open
    await createFiscalYearWithOpenPeriod(request, sessionToken, orgData.id, companyData.id, 2024, 6)

    // 6. Create journal entry with 2024 date via API
    const createJERes = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        description: "API test entry from 2024",
        transactionDate: "2024-06-15",
        documentDate: null,
        fiscalPeriod: { year: 2024, period: 6 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: "API-2024-001",
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "500.00", currency: "USD" },
            creditAmount: null,
            memo: "Cash received",
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "500.00", currency: "USD" },
            memo: "Revenue earned",
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })

    // 6. Should succeed - API accepts past dates
    expect(createJERes.ok()).toBeTruthy()
    const jeData = await createJERes.json()
    // Response format is { entry: JournalEntry, lines: [] }
    // transactionDate is returned as object {year, month, day}
    expect(jeData.entry.transactionDate).toEqual({ year: 2024, month: 6, day: 15 })
    expect(jeData.entry.description).toBe("API test entry from 2024")
  })

  test("can create journal entry on fiscal year boundary (Dec 31)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-fy-boundary-dec31-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "FY Boundary Dec 31 Test User"
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
        name: `FY Boundary Dec 31 Test Org ${Date.now()}`,
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
        name: `FY Boundary Dec 31 Company ${Date.now()}`,
        legalName: "FY Boundary Dec 31 Company Inc.",
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
        organizationId: orgData.id,
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

    // 5. Create fiscal year 2024 with period 12 (December) open
    await createFiscalYearWithOpenPeriod(request, sessionToken, orgData.id, companyData.id, 2024, 12)

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

    // 7. Navigate to new journal entry page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`
    )

    // 8. Wait for form
    await expect(page.locator('[data-testid="journal-entry-form"]')).toBeVisible()

    // 9. Set date to Dec 31, 2024 (last day of fiscal year)
    // Note: PeriodDatePicker wraps the input, so we need to target the -input suffix
    const dateInput = page.locator('[data-testid="journal-entry-date-input"]')
    await dateInput.click()
    await dateInput.fill("2024-12-31")
    // Blur the input to trigger state update
    await dateInput.blur()
    await expect(dateInput).toHaveValue("2024-12-31")

    // 9. Verify fiscal period is P12 FY2024 (wait for React state update)
    await expect(page.locator('[data-testid="computed-fiscal-period"]')).toContainText(
      "P12 FY2024",
      { timeout: 10000 }
    )

    // 10. Fill in entry
    await page.locator('[data-testid="journal-entry-description"]').fill("Year-end closing entry 2024")
    await selectComboboxOption(page, "journal-entry-line-account-0", "1000 - Cash")
    await page.locator('[data-testid="journal-entry-line-debit-0"]').fill("2000.00")
    await selectComboboxOption(page, "journal-entry-line-account-1", "4000 - Revenue")
    await page.locator('[data-testid="journal-entry-line-credit-1"]').fill("2000.00")

    // 11. Should be balanced
    await expect(page.locator('[data-testid="balance-indicator-balanced"]')).toBeVisible({ timeout: 10000 })

    // 12. Save
    await page.locator('[data-testid="journal-entry-save-draft"]').click()

    // 13. Should succeed
    await page.waitForURL(/\/journal-entries$/)
    await expect(page.getByText("Year-end closing entry 2024")).toBeVisible()
  })

  test("can create journal entry on fiscal year boundary (Jan 1)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-fy-boundary-jan1-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "FY Boundary Jan 1 Test User"
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
        name: `FY Boundary Jan 1 Test Org ${Date.now()}`,
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
        name: `FY Boundary Jan 1 Company ${Date.now()}`,
        legalName: "FY Boundary Jan 1 Company Inc.",
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
        organizationId: orgData.id,
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

    // 5. Create fiscal year 2025 with period 1 (January) open
    await createFiscalYearWithOpenPeriod(request, sessionToken, orgData.id, companyData.id, 2025, 1)

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

    // 7. Navigate to new journal entry page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`
    )

    // 8. Wait for form
    await expect(page.locator('[data-testid="journal-entry-form"]')).toBeVisible()

    // 9. Set date to Jan 1, 2025 (first day of new fiscal year)
    // Note: PeriodDatePicker wraps the input, so we need to target the -input suffix
    const dateInput = page.locator('[data-testid="journal-entry-date-input"]')
    await dateInput.click()
    await dateInput.fill("2025-01-01")
    await expect(dateInput).toHaveValue("2025-01-01")

    // 9. Verify fiscal period is P1 FY2025 (new fiscal year)
    await expect(page.locator('[data-testid="computed-fiscal-period"]')).toContainText(
      "P1 FY2025",
      { timeout: 5000 }
    )

    // 10. Fill in entry
    await page.locator('[data-testid="journal-entry-description"]').fill("Opening entry 2025")
    await selectComboboxOption(page, "journal-entry-line-account-0", "1000 - Cash")
    await page.locator('[data-testid="journal-entry-line-debit-0"]').fill("3000.00")
    await selectComboboxOption(page, "journal-entry-line-account-1", "4000 - Revenue")
    await page.locator('[data-testid="journal-entry-line-credit-1"]').fill("3000.00")

    // 11. Should be balanced
    await expect(page.locator('[data-testid="balance-indicator-balanced"]')).toBeVisible({ timeout: 10000 })

    // 12. Save
    await page.locator('[data-testid="journal-entry-save-draft"]').click()

    // 13. Should succeed
    await page.waitForURL(/\/journal-entries$/)
    await expect(page.getByText("Opening entry 2025")).toBeVisible()
  })

  test("fiscal period displays correctly for various past dates", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-fiscal-period-display-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Fiscal Period Display Test User"
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

    // 3. Create org and company with June fiscal year end (non-calendar year)
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Fiscal Period Display Test Org ${Date.now()}`,
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
        name: `Fiscal Period Display Company ${Date.now()}`,
        legalName: "Fiscal Period Display Company Inc.",
        jurisdiction: "US",
        functionalCurrency: "USD",
        reportingCurrency: "USD",
        fiscalYearEnd: { month: 6, day: 30 }, // Non-calendar fiscal year
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
        organizationId: orgData.id,
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

    // 5. Create fiscal years for testing (June 30 fiscal year end)
    // For a June 30 FY end:
    // - FY2024 spans July 1, 2023 - June 30, 2024
    // - FY2025 spans July 1, 2024 - June 30, 2025
    // We need both FY2024 and FY2025 for our test dates

    // Create FY2024 (July 1, 2023 - June 30, 2024)
    const createFY2024Res = await request.post(
      `/api/v1/organizations/${orgData.id}/companies/${companyData.id}/fiscal-years`,
      {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          year: 2024,
          name: "FY 2024",
          startDate: { year: 2023, month: 7, day: 1 },
          endDate: { year: 2024, month: 6, day: 30 },
          includeAdjustmentPeriod: null
        }
      }
    )
    expect(createFY2024Res.ok()).toBeTruthy()

    // Create FY2025 (July 1, 2024 - June 30, 2025)
    const createFY2025Res = await request.post(
      `/api/v1/organizations/${orgData.id}/companies/${companyData.id}/fiscal-years`,
      {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          year: 2025,
          name: "FY 2025",
          startDate: { year: 2024, month: 7, day: 1 },
          endDate: { year: 2025, month: 6, day: 30 },
          includeAdjustmentPeriod: null
        }
      }
    )
    expect(createFY2025Res.ok()).toBeTruthy()

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

    // 7. Navigate to new journal entry page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/new`
    )
    await expect(page.locator('[data-testid="journal-entry-form"]')).toBeVisible()

    // Note: PeriodDatePicker wraps the input, so we need to target the -input suffix
    const dateInput = page.locator('[data-testid="journal-entry-date-input"]')

    // Helper function to set date and wait for fiscal period update
    const setDateAndVerify = async (date: string, expectedPeriod: string) => {
      // Clear and fill the date input
      await dateInput.click()
      await dateInput.clear()
      await page.waitForTimeout(100)
      await dateInput.fill(date)
      // Trigger blur to ensure React state update
      await dateInput.blur()
      await page.waitForTimeout(300)
      // Verify the computed fiscal period
      await expect(page.locator('[data-testid="computed-fiscal-period"]')).toContainText(
        expectedPeriod,
        { timeout: 10000 }
      )
    }

    // Test 1: July 1, 2024 should be P1 FY2025 (start of FY2025)
    await setDateAndVerify("2024-07-01", "P1 FY2025")

    // Test 2: December 15, 2024 should be P6 FY2025
    await setDateAndVerify("2024-12-15", "P6 FY2025")

    // Test 3: June 30, 2024 should be P12 FY2024 (end of FY2024)
    await setDateAndVerify("2024-06-30", "P12 FY2024")

    // Test 4: January 1, 2024 should be P7 FY2024
    await setDateAndVerify("2024-01-01", "P7 FY2024")
  })

  test("can create journal entry with very old date (year 2000)", async ({
    request
  }) => {
    // This test verifies the API accepts dates far in the past

    // 1. Register a test user
    const testUser = {
      email: `test-year-2000-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Year 2000 Test User"
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
        name: `Year 2000 Test Org ${Date.now()}`,
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
        name: `Year 2000 Company ${Date.now()}`,
        legalName: "Year 2000 Company Inc.",
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
    const createAccount1Res = await request.post("/api/v1/accounts", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
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
        organizationId: orgData.id,
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

    // 5. Create fiscal year 2000 with period 1 (January) open
    await createFiscalYearWithOpenPeriod(request, sessionToken, orgData.id, companyData.id, 2000, 1)

    // 6. Create journal entry with year 2000 date
    const createJERes = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        description: "Y2K historical entry",
        transactionDate: "2000-01-01",
        documentDate: null,
        fiscalPeriod: { year: 2000, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: "Y2K-001",
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "10000.00", currency: "USD" },
            creditAmount: null,
            memo: "Y2K transaction",
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "10000.00", currency: "USD" },
            memo: "Y2K revenue",
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })

    // Should succeed - API accepts dates far in the past
    expect(createJERes.ok()).toBeTruthy()
    const jeData = await createJERes.json()
    // Response format is { entry: JournalEntry, lines: [] }
    // transactionDate is returned as object {year, month, day}
    expect(jeData.entry.transactionDate).toEqual({ year: 2000, month: 1, day: 1 })
    expect(jeData.entry.description).toBe("Y2K historical entry")
  })
})
