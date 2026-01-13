/**
 * Organization and Company Test Fixtures
 *
 * Provides reusable fixtures for E2E tests that need organizations, companies,
 * and accounts. Fixtures chain from auth fixtures: testUser -> testOrg -> testCompany -> testAccount
 *
 * @module test-e2e/fixtures/organizations
 */

import { test as authTest, expect } from "./auth.ts"
import type { Page } from "@playwright/test"

// =============================================================================
// Types
// =============================================================================

/**
 * Test organization created via API
 */
export interface TestOrganization {
  id: string
  name: string
  reportingCurrency: string
}

/**
 * Test company created via API
 */
export interface TestCompany {
  id: string
  organizationId: string
  name: string
  legalName: string
  jurisdiction: string
  functionalCurrency: string
  reportingCurrency: string
}

/**
 * Test account created via API
 */
export interface TestAccount {
  id: string
  companyId: string
  accountNumber: string
  name: string
  accountType: string
  accountCategory: string
  normalBalance: string
}

/**
 * Test fiscal year created via API
 */
export interface TestFiscalYear {
  id: string
  companyId: string
  year: number
  status: string
}

/**
 * Organization fixtures available in tests
 */
export interface OrgFixtures {
  /** Fresh test organization created via API */
  testOrg: TestOrganization
  /** Fresh test company within testOrg */
  testCompany: TestCompany
  /** Fresh test account (Cash) within testCompany */
  testAccount: TestAccount
  /** Fresh test fiscal year for testCompany (with auto-generated periods) */
  testFiscalYear: TestFiscalYear
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique organization name
 */
function generateOrgName(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `Org-${timestamp}-${random}`
}

/**
 * Generate unique company name
 */
function generateCompanyName(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `Company-${timestamp}-${random}`
}

/**
 * Create a test organization via the API
 *
 * @param page - Playwright page to use for API requests
 * @param token - Auth token for authentication
 * @param name - Optional custom name for the organization
 * @returns TestOrganization with id, name, and reporting currency
 * @throws Error if organization creation fails
 */
export async function createTestOrganization(
  page: Page,
  token: string,
  name?: string
): Promise<TestOrganization> {
  const orgName = name ?? generateOrgName()

  const response = await page.request.post("/api/v1/organizations", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: orgName,
      reportingCurrency: "USD",
      settings: null
    }
  })

  if (!response.ok()) {
    const errorText = await response.text()
    throw new Error(`Failed to create organization: ${response.status()} - ${errorText}`)
  }

  const org = await response.json()

  return {
    id: org.id,
    name: org.name,
    reportingCurrency: org.reportingCurrency
  }
}

/**
 * Create a test company via the API
 *
 * @param page - Playwright page to use for API requests
 * @param token - Auth token for authentication
 * @param organizationId - ID of the organization to create the company in
 * @param name - Optional custom name for the company
 * @returns TestCompany with all relevant properties
 * @throws Error if company creation fails
 */
export async function createTestCompany(
  page: Page,
  token: string,
  organizationId: string,
  name?: string
): Promise<TestCompany> {
  const companyName = name ?? generateCompanyName()

  const response = await page.request.post("/api/v1/companies", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      organizationId,
      name: companyName,
      legalName: `${companyName} Inc.`,
      jurisdiction: "US",
      taxId: null,
      functionalCurrency: "USD",
      reportingCurrency: "USD",
      fiscalYearEnd: { month: 12, day: 31 },
      parentCompanyId: null,
      ownershipPercentage: null,
      consolidationMethod: null
    }
  })

  if (!response.ok()) {
    const errorText = await response.text()
    throw new Error(`Failed to create company: ${response.status()} - ${errorText}`)
  }

  const company = await response.json()

  return {
    id: company.id,
    organizationId: company.organizationId,
    name: company.name,
    legalName: company.legalName,
    jurisdiction: company.jurisdiction,
    functionalCurrency: company.functionalCurrency,
    reportingCurrency: company.reportingCurrency
  }
}

/**
 * Create a test account via the API
 *
 * Creates a Cash account (Asset type) which is a common account needed for tests.
 *
 * @param page - Playwright page to use for API requests
 * @param token - Auth token for authentication
 * @param companyId - ID of the company to create the account in
 * @param accountNumber - Optional account number (defaults to "1000")
 * @param name - Optional account name (defaults to "Cash")
 * @returns TestAccount with all relevant properties
 * @throws Error if account creation fails
 */
export async function createTestAccount(
  page: Page,
  token: string,
  companyId: string,
  accountNumber?: string,
  name?: string
): Promise<TestAccount> {
  const response = await page.request.post("/api/v1/accounts", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      companyId,
      accountNumber: accountNumber ?? "1000",
      name: name ?? "Cash",
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

  if (!response.ok()) {
    const errorText = await response.text()
    throw new Error(`Failed to create account: ${response.status()} - ${errorText}`)
  }

  const account = await response.json()

  return {
    id: account.id,
    companyId: account.companyId,
    accountNumber: account.accountNumber,
    name: account.name,
    accountType: account.accountType,
    accountCategory: account.accountCategory,
    normalBalance: account.normalBalance
  }
}

/**
 * Create a test fiscal year via the API
 *
 * Creates a fiscal year for the current year with 12 monthly periods
 * and an optional adjusting period (period 13).
 *
 * @param page - Playwright page to use for API requests
 * @param token - Auth token for authentication
 * @param companyId - ID of the company to create the fiscal year for
 * @returns TestFiscalYear with id, companyId, year, and status
 * @throws Error if fiscal year creation fails
 */
export async function createTestFiscalYear(
  page: Page,
  token: string,
  companyId: string
): Promise<TestFiscalYear> {
  const currentYear = new Date().getFullYear()

  const response = await page.request.post("/api/v1/fiscal/fiscal-years", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      companyId,
      startDate: `${currentYear}-01-01`,
      includeAdjustmentPeriod: true
    }
  })

  if (!response.ok()) {
    const errorText = await response.text()
    throw new Error(`Failed to create fiscal year: ${response.status()} - ${errorText}`)
  }

  const result = await response.json()

  // Also open period 1 so journal entries can be created
  const period1 = result.periods.find((p: { periodNumber: number }) => p.periodNumber === 1)
  if (period1) {
    await page.request.post(`/api/v1/fiscal/fiscal-periods/${period1.id}/open`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  return {
    id: result.fiscalYear.id,
    companyId: result.fiscalYear.companyId,
    year: result.fiscalYear.year,
    status: result.fiscalYear.status
  }
}

// =============================================================================
// Fixtures
// =============================================================================

/**
 * Extended test with organization, company, and account fixtures
 *
 * Chains from auth fixtures: testUser -> testOrg -> testCompany -> testAccount
 *
 * Usage:
 * ```ts
 * import { test, expect } from "./fixtures/organizations"
 *
 * test("should display company accounts", async ({ authenticatedPage, testCompany, testAccount }) => {
 *   await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)
 *   await expect(authenticatedPage.getByText(testAccount.name)).toBeVisible()
 * })
 * ```
 */
export const test = authTest.extend<OrgFixtures>({
  /**
   * testOrg fixture - creates a fresh organization for each test
   *
   * Depends on testUser fixture for authentication.
   */
  testOrg: async ({ page, testUser }, use) => {
    const org = await createTestOrganization(page, testUser.token)
    await use(org)
    // Note: Organization cleanup is not implemented as it may contain
    // child resources. Tests rely on fresh database state between runs.
  },

  /**
   * testCompany fixture - creates a fresh company within testOrg
   *
   * Depends on testUser and testOrg fixtures.
   */
  testCompany: async ({ page, testUser, testOrg }, use) => {
    const company = await createTestCompany(page, testUser.token, testOrg.id)
    await use(company)
    // Note: Company cleanup is handled implicitly when test database is reset
  },

  /**
   * testAccount fixture - creates a Cash account within testCompany
   *
   * Depends on testUser and testCompany fixtures.
   * Creates a standard Cash account (Asset/CurrentAsset/Debit) for testing.
   */
  testAccount: async ({ page, testUser, testCompany }, use) => {
    const account = await createTestAccount(page, testUser.token, testCompany.id)
    await use(account)
    // Note: Account cleanup is handled implicitly when test database is reset
  },

  /**
   * testFiscalYear fixture - creates a fiscal year for testCompany
   *
   * Depends on testUser and testCompany fixtures.
   * Creates a fiscal year for the current year with 12 monthly periods
   * and opens period 1 for posting.
   */
  testFiscalYear: async ({ page, testUser, testCompany }, use) => {
    const fiscalYear = await createTestFiscalYear(page, testUser.token, testCompany.id)
    await use(fiscalYear)
    // Note: Fiscal year cleanup is handled implicitly when test database is reset
  }
})

/**
 * Re-export expect from auth for convenience
 */
export { expect }
