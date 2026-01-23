/**
 * Journal Entry Workflow E2E Tests
 *
 * Tests for the journal entry detail page and approval workflow:
 * - Display entry header, metadata, and line items
 * - Workflow actions: Submit, Approve, Reject, Post, Reverse
 * - Complete workflow from Draft to Posted
 */

import { test, expect, type APIRequestContext } from "@playwright/test"

/**
 * Helper to create a fiscal year with open periods for testing.
 * This is required because journal entry creation now requires fiscal periods to exist.
 * Note: Periods are created with "Open" status by default, so no need to call /open endpoint.
 */
async function createFiscalYearWithOpenPeriods(
  request: APIRequestContext,
  sessionToken: string,
  organizationId: string,
  companyId: string,
  year: number
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
    throw new Error(`Failed to create fiscal year: ${await createFiscalYearRes.text()}`)
  }
  const fiscalYearData = await createFiscalYearRes.json()
  const fiscalYearId = fiscalYearData.id

  // Get periods to find period 1 (January)
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
  const period1 = periodsData.periods.find((p: { periodNumber: number }) => p.periodNumber === 1)
  if (!period1) {
    throw new Error("Period 1 not found")
  }

  return { fiscalYearId, openPeriodId: period1.id }
}

test.describe("Journal Entry Detail and Workflow", () => {
  test("should complete approval workflow: Draft -> PendingApproval -> Approved -> Posted", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-workflow-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Workflow Test User"
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
        name: `Workflow Test Org ${Date.now()}`,
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
        name: `Workflow Test Company ${Date.now()}`,
        legalName: "Workflow Test Company Inc.",
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
    const account1Data = await createAccount1Res.json()

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
    const account2Data = await createAccount2Res.json()

    // Create fiscal year with open periods (required for journal entry creation)
    await createFiscalYearWithOpenPeriods(request, sessionToken, orgData.id, companyData.id, 2026)

    // 6. Create a journal entry via API
    const createJournalEntryRes = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        description: "Workflow test entry",
        transactionDate: "2026-01-15",
        documentDate: null,
        fiscalPeriod: { year: 2026, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: "WF-001",
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
    expect(createJournalEntryRes.ok()).toBeTruthy()
    const entryData = await createJournalEntryRes.json()

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

    // 9. Navigate to journal entry detail page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/${entryData.entry.id}`
    )

    // 10. Verify we're on the detail page and entry is Draft
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Draft")
    await expect(page.locator('[data-testid="journal-entry-description"]')).toContainText("Workflow test entry")

    // 11. Verify line items are displayed
    await expect(page.locator('[data-testid="line-items-table"]')).toBeVisible()
    await expect(page.locator('[data-testid="line-account-1"]')).toContainText("1000 - Cash")
    await expect(page.locator('[data-testid="line-debit-1"]')).toContainText("$1,000.00")
    await expect(page.locator('[data-testid="line-account-2"]')).toContainText("4000 - Revenue")
    await expect(page.locator('[data-testid="line-credit-2"]')).toContainText("$1,000.00")

    // 12. Verify totals are balanced
    await expect(page.locator('[data-testid="total-debits"]')).toContainText("$1,000.00")
    await expect(page.locator('[data-testid="total-credits"]')).toContainText("$1,000.00")

    // 13. Submit for approval
    await page.locator('[data-testid="submit-button"]').click()
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Pending Approval")

    // 14. Approve the entry
    await page.locator('[data-testid="approve-button"]').click()
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Approved")

    // 15. Post the entry
    await page.locator('[data-testid="post-button"]').click()
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Posted")

    // 16. Verify Posted metadata appears
    await expect(page.locator('[data-testid="posted-by"]')).toBeVisible()
    await expect(page.locator('[data-testid="posted-at"]')).toBeVisible()
  })

  test("should reject entry and return to draft status", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-reject-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Reject Test User"
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
        name: `Reject Test Org ${Date.now()}`,
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
        name: `Reject Test Company ${Date.now()}`,
        legalName: "Reject Test Company Inc.",
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

    // 5. Create accounts
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

    // Create fiscal year with open periods (required for journal entry creation)
    await createFiscalYearWithOpenPeriods(request, sessionToken, orgData.id, companyData.id, 2026)

    // 6. Create a journal entry and submit it via API
    const createJournalEntryRes = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        description: "Entry to be rejected",
        transactionDate: "2026-01-20",
        documentDate: null,
        fiscalPeriod: { year: 2026, period: 1 },
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
    expect(createJournalEntryRes.ok()).toBeTruthy()
    const entryData = await createJournalEntryRes.json()

    // 8. Submit the entry via API
    const submitRes = await request.post(`/api/v1/journal-entries/${entryData.entry.id}/submit?organizationId=${orgData.id}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(submitRes.ok()).toBeTruthy()

    // 9. Set session cookie
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

    // 10. Navigate to journal entry detail page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/${entryData.entry.id}`
    )

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("journal-entry-header")).toBeVisible()

    // 11. Verify entry is pending approval
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Pending Approval")

    // Wait for reject button to be visible and enabled
    const rejectButton = page.locator('[data-testid="reject-button"]')
    await expect(rejectButton).toBeVisible()
    await expect(rejectButton).toBeEnabled()

    // Wait for hydration before clicking
    await page.waitForTimeout(500)

    // 12. Click reject button with force to ensure registration
    await rejectButton.click({ force: true })

    // 13. Reject modal should appear (wait for React state update)
    await expect(page.locator('[data-testid="reject-modal"]')).toBeVisible({ timeout: 15000 })

    // 14. Enter rejection reason
    await page.locator('[data-testid="reject-reason-input"]').fill("Incorrect account classification")

    // 15. Confirm rejection
    await page.locator('[data-testid="reject-confirm-button"]').click()

    // 16. Verify entry is back to draft
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Draft")
  })

  test("should reverse posted entry and create reversal", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-reverse-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Reverse Test User"
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
    const userId = loginData.user.id

    // 3. Create an organization
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Reverse Test Org ${Date.now()}`,
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
        name: `Reverse Test Company ${Date.now()}`,
        legalName: "Reverse Test Company Inc.",
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

    // 5. Create accounts
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

    // Create fiscal year with open periods (required for journal entry creation)
    await createFiscalYearWithOpenPeriods(request, sessionToken, orgData.id, companyData.id, 2026)

    // 6. Create journal entry
    const createJournalEntryRes = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        description: "Entry to be reversed",
        transactionDate: "2026-01-10",
        documentDate: null,
        fiscalPeriod: { year: 2026, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: null,
        sourceDocumentRef: null,
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "750.00", currency: "USD" },
            creditAmount: null,
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "750.00", currency: "USD" },
            memo: null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })
    expect(createJournalEntryRes.ok()).toBeTruthy()
    const entryData = await createJournalEntryRes.json()

    // 8. Submit, approve, and post the entry via API
    await request.post(`/api/v1/journal-entries/${entryData.entry.id}/submit?organizationId=${orgData.id}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    await request.post(`/api/v1/journal-entries/${entryData.entry.id}/approve?organizationId=${orgData.id}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    const postRes = await request.post(`/api/v1/journal-entries/${entryData.entry.id}/post`, {
      headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
      data: { organizationId: orgData.id, postedBy: userId, postingDate: null }
    })
    expect(postRes.ok()).toBeTruthy()

    // 9. Set session cookie
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

    // 10. Navigate to journal entry detail page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/${entryData.entry.id}`
    )

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("journal-entry-header")).toBeVisible()

    // 11. Verify entry is posted
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Posted")

    // Wait for reverse button to be visible and enabled
    const reverseButton = page.locator('[data-testid="reverse-button"]')
    await expect(reverseButton).toBeVisible()
    await expect(reverseButton).toBeEnabled()

    // Wait for React hydration to complete before clicking
    await page.waitForTimeout(500)

    // 12. Click reverse button with force to ensure it registers
    await reverseButton.click({ force: true })

    // 13. Confirm dialog should appear (wait for React state update)
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible({ timeout: 15000 })

    // 14. Confirm reversal
    await page.locator('[data-testid="confirm-button"]').click()

    // 15. Should navigate to the new reversal entry
    await page.waitForURL(/\/journal-entries\/[a-f0-9-]+/)

    // 16. The new entry should be a reversal entry (with reversal info)
    await expect(page.locator('[data-testid="reversal-info"]')).toBeVisible()
  })

  test("should display entry detail page with all metadata", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-detail-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Detail Test User"
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
        name: `Detail Test Org ${Date.now()}`,
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
        name: `Detail Test Company ${Date.now()}`,
        legalName: "Detail Test Company Inc.",
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

    // 5. Create accounts
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

    // Create fiscal year with open periods (required for journal entry creation)
    await createFiscalYearWithOpenPeriods(request, sessionToken, orgData.id, companyData.id, 2026)

    // 6. Create journal entry with all metadata
    const createJournalEntryRes = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        description: "Detailed test entry",
        transactionDate: "2026-01-15",
        documentDate: "2026-01-14",
        fiscalPeriod: { year: 2026, period: 1 },
        entryType: "Adjusting",
        sourceModule: "GeneralLedger",
        referenceNumber: "ADJ-2026-001",
        sourceDocumentRef: "INV-12345",
        lines: [
          {
            accountId: account1Data.id,
            debitAmount: { amount: "250.00", currency: "USD" },
            creditAmount: null,
            memo: "Debit line memo",
            dimensions: null,
            intercompanyPartnerId: null
          },
          {
            accountId: account2Data.id,
            debitAmount: null,
            creditAmount: { amount: "250.00", currency: "USD" },
            memo: "Credit line memo",
            dimensions: null,
            intercompanyPartnerId: null
          }
        ]
      }
    })
    expect(createJournalEntryRes.ok()).toBeTruthy()
    const entryData = await createJournalEntryRes.json()

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

    // 9. Navigate to journal entry detail page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries/${entryData.entry.id}`
    )

    // 10. Verify header information
    await expect(page.locator('[data-testid="journal-entry-header"]')).toBeVisible()
    await expect(page.locator('[data-testid="journal-entry-description"]')).toContainText("Detailed test entry")
    await expect(page.locator('[data-testid="status-badge"]')).toContainText("Draft")
    await expect(page.locator('[data-testid="entry-type-badge"]')).toContainText("Adjusting")

    // 11. Verify metadata
    await expect(page.locator('[data-testid="journal-entry-reference"]')).toContainText("ADJ-2026-001")
    await expect(page.locator('[data-testid="journal-entry-date"]')).toContainText("Jan 15, 2026")
    await expect(page.locator('[data-testid="journal-entry-type-display"]')).toContainText("Adjusting")
    await expect(page.locator('[data-testid="journal-entry-period"]')).toContainText("2026 P1")

    // 12. Verify detailed metadata card
    await expect(page.locator('[data-testid="journal-entry-metadata"]')).toBeVisible()
    await expect(page.locator('[data-testid="created-by"]')).toBeVisible()
    await expect(page.locator('[data-testid="created-at"]')).toBeVisible()
    await expect(page.locator('[data-testid="source-module"]')).toContainText("GeneralLedger")
    await expect(page.locator('[data-testid="source-document-ref"]')).toContainText("INV-12345")
    await expect(page.locator('[data-testid="document-date"]')).toContainText("Jan 14, 2026")

    // 13. Verify line items with memos
    await expect(page.locator('[data-testid="line-memo-1"]')).toContainText("Debit line memo")
    await expect(page.locator('[data-testid="line-memo-2"]')).toContainText("Credit line memo")
  })

  test("should navigate from list to detail page", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-nav-detail-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Nav Detail Test User"
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
        name: `Nav Detail Test Org ${Date.now()}`,
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
        name: `Nav Detail Test Company ${Date.now()}`,
        legalName: "Nav Detail Test Company Inc.",
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

    // 5. Create accounts
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

    // Create fiscal year with open periods (required for journal entry creation)
    await createFiscalYearWithOpenPeriods(request, sessionToken, orgData.id, companyData.id, 2026)

    // 6. Create journal entry
    const createJournalEntryRes = await request.post("/api/v1/journal-entries", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        companyId: companyData.id,
        description: "Navigation test entry",
        transactionDate: "2026-01-15",
        documentDate: null,
        fiscalPeriod: { year: 2026, period: 1 },
        entryType: "Standard",
        sourceModule: "GeneralLedger",
        referenceNumber: "NAV-001",
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
    expect(createJournalEntryRes.ok()).toBeTruthy()
    const entryData = await createJournalEntryRes.json()

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

    // 9. Navigate to journal entries list
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/journal-entries`
    )

    // 10. Click on the journal entry row
    await page.locator('[data-testid="journal-entry-row-NAV-001"]').click()

    // 11. Should navigate to detail page
    await page.waitForURL(new RegExp(`/journal-entries/${entryData.entry.id}`))

    // 12. Verify we're on the detail page
    await expect(page.locator('[data-testid="journal-entry-description"]')).toContainText("Navigation test entry")
    await expect(page.locator('[data-testid="journal-entry-header"]')).toBeVisible()
  })
})
