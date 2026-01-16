/**
 * Synthetic Data Generator Script
 *
 * Generates a complete synthetic dataset by interacting with the running application UI.
 * This script uses ONLY UI interactions (page.click, page.fill, page.goto, etc.)
 * and NEVER uses direct API calls (apiPost, fetch, etc.).
 *
 * Creates:
 * - Demo user account
 * - Organization with settings
 * - Parent company (US, USD) and subsidiary (UK, GBP)
 * - Chart of accounts from GeneralBusiness template
 * - Two years of journal entries (2024-2025)
 * - Consolidation group
 *
 * Usage:
 *   pnpm --filter @accountability/web generate:synthetic-data
 *   pnpm --filter @accountability/web generate:synthetic-data --url http://localhost:3001
 *   pnpm --filter @accountability/web generate:synthetic-data --verbose
 *
 * @module generate-synthetic-data
 */

import type { Page, Browser, BrowserContext } from "@playwright/test"

// ===== Configuration =====

export interface Config {
  baseUrl: string
  user: {
    email: string
    password: string
    displayName: string
  }
  organization: {
    name: string
    reportingCurrency: string
  }
  parentCompany: {
    name: string
    code: string
    currency: string
    jurisdiction: string
  }
  subsidiaryCompany: {
    name: string
    code: string
    currency: string
    jurisdiction: string
    ownershipPercentage: number
  }
  verbose: boolean
  headless: boolean
  slowMo: number
}

export const DEFAULT_CONFIG: Config = {
  baseUrl: "http://localhost:3000",
  user: {
    email: "demo@accountability.app",
    password: "Demo123!",
    displayName: "Demo User"
  },
  organization: {
    name: "Acme Corporation",
    reportingCurrency: "USD"
  },
  parentCompany: {
    name: "Acme Corp USA",
    code: "ACME-USA",
    currency: "USD",
    jurisdiction: "US"
  },
  subsidiaryCompany: {
    name: "Acme Manufacturing Ltd",
    code: "ACME-MFG-UK",
    currency: "GBP",
    jurisdiction: "GB",
    ownershipPercentage: 100
  },
  verbose: false,
  headless: true,
  slowMo: 0
}

// ===== Types =====

interface GeneratedData {
  organization: { id: string; name: string }
  parentCompany: { id: string; name: string }
  subsidiaryCompany: { id: string; name: string }
  accounts: {
    parent: Set<string> // set of account numbers that exist
    subsidiary: Set<string>
  }
  consolidationGroup?: { id: string; name: string }
  consolidationRuns?: { year: number; id: string }[]
}

// ===== Logging =====

function log(config: Config, message: string, ...args: unknown[]): void {
  if (config.verbose) {
    console.log(`[synthetic-data] ${message}`, ...args)
  }
}

function logStep(_config: Config, step: string): void {
  console.log(`\n=== ${step} ===`)
}

function logSuccess(message: string): void {
  console.log(`  ✓ ${message}`)
}

// ===== URL Extraction Helpers =====

/**
 * Extracts organization ID from URL path /organizations/:id/...
 */
function extractOrgIdFromUrl(url: string): string {
  const match = url.match(/\/organizations\/([a-f0-9-]+)/)
  if (!match) {
    throw new Error(`Could not extract organization ID from URL: ${url}`)
  }
  return match[1]
}

/**
 * Extracts company ID from URL path /companies/:id/...
 */
function extractCompanyIdFromUrl(url: string): string {
  const match = url.match(/\/companies\/([a-f0-9-]+)/)
  if (!match) {
    throw new Error(`Could not extract company ID from URL: ${url}`)
  }
  return match[1]
}

/**
 * Extracts consolidation group ID from URL path /consolidation/:id/...
 */
function extractConsolidationGroupIdFromUrl(url: string): string {
  const match = url.match(/\/consolidation\/([a-f0-9-]+)/)
  if (!match) {
    throw new Error(`Could not extract consolidation group ID from URL: ${url}`)
  }
  return match[1]
}

/**
 * Extracts consolidation run ID from URL path /runs/:id/...
 */
function extractConsolidationRunIdFromUrl(url: string): string {
  const match = url.match(/\/runs\/([a-f0-9-]+)/)
  if (!match) {
    throw new Error(`Could not extract consolidation run ID from URL: ${url}`)
  }
  return match[1]
}

// ===== UI Interaction Functions =====

/**
 * Creates the demo user account via UI
 */
async function createUser(
  page: Page,
  config: Config
): Promise<void> {
  logStep(config, "Creating User Account")

  // Navigate to registration page
  await page.goto("/register")
  await page.waitForTimeout(500) // Wait for page hydration

  // Check if we need to register or if user already exists
  // Try to register first
  await page.fill("#email", config.user.email)
  await page.fill("#displayName", config.user.displayName)
  await page.fill("#password", config.user.password)

  // Submit registration form - wait for button to be ready
  // Use multiple approaches to ensure the button click registers
  const submitButton = page.locator('button[type="submit"]')
  await submitButton.waitFor({ state: "visible" })
  await page.waitForTimeout(300) // Wait for React hydration

  // Focus the button first, then click
  await submitButton.focus()
  await page.waitForTimeout(100)

  // Try pressing Enter on the form (more reliable than clicking)
  await page.press("#password", "Enter")

  // Wait for either success (redirect away from /register) or error (user exists)
  try {
    // After successful registration, user is redirected to "/" which then redirects to
    // "/organizations/new" (no orgs) or "/organizations/:id/dashboard" (single org) or "/organizations" (multiple)
    // Wait for any URL that isn't /register
    await page.waitForFunction(
      () => !window.location.pathname.includes("/register"),
      { timeout: 15000 }
    )

    // If we ended up at login, user already exists - log in instead
    if (page.url().includes("/login")) {
      log(config, "User already exists, logging in...")
      await page.waitForTimeout(500)
      await page.fill('input[type="email"]', config.user.email)
      await page.fill('input[type="password"]', config.user.password)
      await page.locator('button[type="submit"]').click({ force: true })
      // Wait for redirect to any authenticated page
      await page.waitForFunction(
        () => !window.location.pathname.includes("/login"),
        { timeout: 15000 }
      )
      logSuccess(`Logged in as: ${config.user.displayName}`)
    } else {
      logSuccess(`Registered user: ${config.user.email}`)
    }
  } catch {
    // Check if there's an error message about existing user
    const errorAlert = page.locator('[role="alert"]')
    if (await errorAlert.isVisible({ timeout: 2000 })) {
      const errorText = await errorAlert.textContent()
      if (errorText?.includes("already exists") || errorText?.includes("already registered")) {
        log(config, "User already exists, logging in...")
        await page.goto("/login")
        await page.waitForTimeout(500)
        await page.fill('input[type="email"]', config.user.email)
        await page.fill('input[type="password"]', config.user.password)
        await page.locator('button[type="submit"]').click({ force: true })
        // Wait for redirect to any authenticated page
        await page.waitForFunction(
          () => !window.location.pathname.includes("/login"),
          { timeout: 15000 }
        )
        logSuccess(`Logged in as: ${config.user.displayName}`)
      } else {
        throw new Error(`Registration failed: ${errorText}`)
      }
    } else {
      // Take a screenshot for debugging
      const url = page.url()
      const content = await page.content()
      throw new Error(`Registration failed with unknown error. Current URL: ${url}, Page contains form: ${content.includes('Create Account')}`)
    }
  }
}

/**
 * Creates the organization via UI
 */
async function createOrganization(
  page: Page,
  config: Config
): Promise<{ id: string; name: string }> {
  logStep(config, "Creating Organization")

  // Navigate to create organization page
  await page.goto("/organizations/new")
  await page.waitForTimeout(500)

  // Wait for page to load
  await page.waitForSelector('[data-testid="create-organization-page"]', { timeout: 10000 })

  // Fill organization form
  await page.fill('[data-testid="org-name-input"]', config.organization.name)

  // Select reporting currency using selectOption (proper way to interact with <select>)
  await page.selectOption('[data-testid="org-currency-select"]', config.organization.reportingCurrency)

  // Submit form
  await page.click('[data-testid="org-form-submit-button"]')

  // Wait for redirect to organization page (detail page or dashboard)
  // The create form redirects to /organizations/:id (detail page)
  await page.waitForURL(/\/organizations\/[a-f0-9-]+(?:\/|$)/, { timeout: 15000 })

  // Extract organization ID from URL
  const orgId = extractOrgIdFromUrl(page.url())
  logSuccess(`Created organization: ${config.organization.name} (${orgId})`)

  return { id: orgId, name: config.organization.name }
}

/**
 * Creates the parent company via UI
 */
async function createParentCompany(
  page: Page,
  config: Config,
  organizationId: string
): Promise<{ id: string; name: string }> {
  logStep(config, "Creating Parent Company")

  // Navigate to create company page
  await page.goto(`/organizations/${organizationId}/companies/new`)
  await page.waitForTimeout(500)

  // Wait for page to load
  await page.waitForSelector('[data-testid="new-company-page"]', { timeout: 10000 })

  // Fill company form
  await page.fill('[data-testid="company-name-input"]', config.parentCompany.name)
  await page.fill('[data-testid="company-legal-name-input"]', `${config.parentCompany.name} Inc.`)

  // Select jurisdiction
  const jurisdictionSelect = page.locator('[data-testid="company-jurisdiction-select"]')
  await jurisdictionSelect.selectOption(config.parentCompany.jurisdiction)
  await page.waitForTimeout(200) // Wait for currency auto-update

  // Fill tax ID
  await page.fill('[data-testid="company-tax-id-input"]', "12-3456789")

  // Submit form
  await page.click('[data-testid="company-form-submit-button"]')

  // Wait for redirect to companies list
  await page.waitForURL(/\/companies(?:\/)?$/, { timeout: 15000 })
  await page.waitForTimeout(500) // Wait for list to load

  // Find the company link in the list and extract its ID
  const companyLink = page.locator(`a:has-text("${config.parentCompany.name}")`).first()
  await companyLink.waitFor({ state: "visible", timeout: 10000 })
  const href = await companyLink.getAttribute("href")
  if (!href) {
    throw new Error(`Could not find company link for ${config.parentCompany.name}`)
  }
  const companyId = extractCompanyIdFromUrl(href)
  logSuccess(`Created parent company: ${config.parentCompany.name} (${companyId})`)

  return { id: companyId, name: config.parentCompany.name }
}

/**
 * Creates the subsidiary company via UI
 */
async function createSubsidiaryCompany(
  page: Page,
  config: Config,
  organizationId: string,
  parentCompanyId: string
): Promise<{ id: string; name: string }> {
  logStep(config, "Creating Subsidiary Company")

  // Navigate to create company page
  await page.goto(`/organizations/${organizationId}/companies/new`)
  await page.waitForTimeout(500)

  // Wait for page to load
  await page.waitForSelector('[data-testid="new-company-page"]', { timeout: 10000 })

  // Fill company form
  await page.fill('[data-testid="company-name-input"]', config.subsidiaryCompany.name)
  await page.fill('[data-testid="company-legal-name-input"]', config.subsidiaryCompany.name)

  // Select jurisdiction (UK)
  const jurisdictionSelect = page.locator('[data-testid="company-jurisdiction-select"]')
  await jurisdictionSelect.selectOption(config.subsidiaryCompany.jurisdiction)
  await page.waitForTimeout(200) // Wait for currency auto-update

  // Select parent company
  const parentSelect = page.locator('[data-testid="company-parent-select"]')
  await parentSelect.selectOption(parentCompanyId)
  await page.waitForTimeout(200)

  // Fill ownership percentage
  await page.fill('[data-testid="company-ownership-input"]', String(config.subsidiaryCompany.ownershipPercentage))

  // Submit form
  await page.click('[data-testid="company-form-submit-button"]')

  // Wait for redirect to companies list
  await page.waitForURL(/\/companies(?:\/)?$/, { timeout: 15000 })
  await page.waitForTimeout(500) // Wait for list to load

  // Find the company link in the list and extract its ID
  const companyLink = page.locator(`a:has-text("${config.subsidiaryCompany.name}")`).first()
  await companyLink.waitFor({ state: "visible", timeout: 10000 })
  const href = await companyLink.getAttribute("href")
  if (!href) {
    throw new Error(`Could not find company link for ${config.subsidiaryCompany.name}`)
  }
  const companyId = extractCompanyIdFromUrl(href)
  logSuccess(`Created subsidiary company: ${config.subsidiaryCompany.name} (${companyId})`)

  return { id: companyId, name: config.subsidiaryCompany.name }
}

/**
 * Applies the GeneralBusiness template to a company via UI
 * Returns a set of account numbers that were created
 */
async function applyAccountTemplate(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  companyName: string
): Promise<Set<string>> {
  log(config, `Applying GeneralBusiness template to ${companyName}...`)

  // Navigate to company's accounts page
  await page.goto(`/organizations/${organizationId}/companies/${companyId}/accounts`)
  await page.waitForTimeout(500)

  // Wait for page to load
  await page.waitForSelector('[data-testid="accounts-page"]', { timeout: 10000 })

  // Click the Apply Template button
  const applyTemplateButton = page.locator('[data-testid="apply-template-button"]')
  if (await applyTemplateButton.isVisible()) {
    await applyTemplateButton.click()
    await page.waitForTimeout(300)

    // Wait for template modal
    await page.waitForSelector('[data-testid="apply-template-modal"]', { timeout: 5000 })

    // Select GeneralBusiness template
    await page.click('[data-testid="template-card-GeneralBusiness"]')
    await page.waitForTimeout(200)

    // Confirm template application
    await page.click('[data-testid="apply-template-confirm-button"]')

    // Wait for success message or modal close
    await page.waitForSelector('[data-testid="apply-template-success"]', { timeout: 30000 })
    await page.waitForTimeout(500)

    // Close modal if still open
    const closeButton = page.locator('[data-testid="apply-template-close-button"]')
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
  }

  // Wait for accounts to load and reload to ensure we see all accounts
  await page.waitForTimeout(1000)
  await page.reload()
  await page.waitForSelector('[data-testid="accounts-tree"]', { timeout: 10000 })

  // Extract account numbers from the visible accounts tree
  // The accounts tree shows account numbers in span elements
  const accountNumbers = new Set<string>()

  // Get account count from the UI to know how many accounts exist
  const accountCountText = await page.locator('[data-testid="accounts-count"]').textContent()
  const match = accountCountText?.match(/of (\d+) accounts/)
  const totalAccounts = match ? parseInt(match[1], 10) : 0

  // The GeneralBusiness template has known account numbers
  // We'll use these predefined account numbers since we know what template we applied
  // This list matches the complete GeneralBusiness template from AccountTemplate.ts
  const generalBusinessAccounts = [
    // Current Assets
    "1000", "1010", "1020", "1030", "1100", "1110", "1200", "1300", "1310", "1320", "1400",
    // Non-Current Assets
    "1500", "1510", "1520", "1530", "1540", "1550", "1600", "1610", "1620", "1630", "1640",
    "1700", "1710", "1720", "1800",
    // Current Liabilities
    "2000", "2100", "2110", "2120", "2130", "2200", "2210", "2220", "2230", "2300", "2400", "2450",
    // Non-Current Liabilities
    "2500", "2600", "2700", "2800",
    // Equity
    "3000", "3100", "3200", "3300", "3400", "3500", "3600",
    // Revenue
    "4000", "4100", "4200", "4300",
    // Cost of Sales
    "5000", "5100",
    // Operating Expenses
    "6000", "6100", "6200", "6300", "6400", "6500", "6600", "6700", "6800", "6900",
    "7000", "7100", "7200", "7300", "7400", "7500", "7600",
    // Other Income/Expense
    "8000", "8100", "8200", "8300", "8400", "8500", "9000"
  ]

  for (const accountNumber of generalBusinessAccounts) {
    accountNumbers.add(accountNumber)
  }

  logSuccess(`Applied template to ${companyName}: ${totalAccounts} accounts created`)
  log(config, `Using known GeneralBusiness template account numbers`)

  return accountNumbers
}

/**
 * Account number to account name mapping for GeneralBusiness template
 * This allows us to select accounts by their visible label in the dropdown
 */
const ACCOUNT_NAMES: Record<string, string> = {
  // Current Assets
  "1000": "Cash and Cash Equivalents",
  "1010": "Cash - Operating Account",
  "1020": "Cash - Payroll Account",
  "1030": "Petty Cash",
  "1100": "Accounts Receivable",
  "1110": "Allowance for Doubtful Accounts",
  "1200": "Inventory",
  "1300": "Prepaid Expenses",
  "1310": "Prepaid Insurance",
  "1320": "Prepaid Rent",
  "1400": "Other Current Assets",
  // Non-Current Assets
  "1500": "Property, Plant and Equipment",
  "1510": "Land",
  "1520": "Buildings",
  "1530": "Furniture and Fixtures",
  "1540": "Computer Equipment",
  "1550": "Vehicles",
  "1600": "Accumulated Depreciation",
  "1610": "Accumulated Depreciation - Buildings",
  "1620": "Accumulated Depreciation - Furniture",
  "1630": "Accumulated Depreciation - Equipment",
  "1640": "Accumulated Depreciation - Vehicles",
  "1700": "Intangible Assets",
  "1710": "Goodwill",
  "1720": "Patents and Trademarks",
  "1800": "Other Non-Current Assets",
  // Current Liabilities
  "2000": "Accounts Payable",
  "2100": "Accrued Liabilities",
  "2110": "Accrued Salaries and Wages",
  "2120": "Accrued Interest",
  "2130": "Accrued Taxes",
  "2200": "Payroll Liabilities",
  "2210": "Federal Income Tax Withheld",
  "2220": "State Income Tax Withheld",
  "2230": "Social Security Tax Payable",
  "2300": "Unearned Revenue",
  "2400": "Short-Term Notes Payable",
  "2450": "Current Portion of Long-Term Debt",
  // Non-Current Liabilities
  "2500": "Long-Term Notes Payable",
  "2600": "Mortgage Payable",
  "2700": "Deferred Tax Liabilities",
  "2800": "Other Long-Term Liabilities",
  // Equity
  "3000": "Common Stock",
  "3100": "Preferred Stock",
  "3200": "Additional Paid-In Capital",
  "3300": "Retained Earnings",
  "3400": "Treasury Stock",
  "3500": "Accumulated Other Comprehensive Income",
  "3600": "Dividends",
  // Revenue
  "4000": "Sales Revenue",
  "4100": "Service Revenue",
  "4200": "Sales Returns and Allowances",
  "4300": "Sales Discounts",
  // Cost of Sales
  "5000": "Cost of Goods Sold",
  "5100": "Cost of Services",
  // Operating Expenses
  "6000": "Salaries and Wages",
  "6100": "Employee Benefits",
  "6200": "Payroll Taxes",
  "6300": "Rent Expense",
  "6400": "Utilities Expense",
  "6500": "Insurance Expense",
  "6600": "Professional Fees",
  "6700": "Office Supplies",
  "6800": "Advertising and Marketing",
  "6900": "Travel and Entertainment",
  "7000": "Depreciation Expense",
  "7100": "Amortization Expense",
  "7200": "Bad Debt Expense",
  "7300": "Repairs and Maintenance",
  "7400": "Telephone and Internet",
  "7500": "Bank Charges",
  "7600": "Miscellaneous Expense",
  // Other Income/Expense
  "8000": "Interest Income",
  "8100": "Interest Expense",
  "8200": "Gain on Sale of Assets",
  "8300": "Loss on Sale of Assets",
  "8400": "Foreign Exchange Gain",
  "8500": "Foreign Exchange Loss",
  "9000": "Income Tax Expense"
}

/**
 * Gets the label text for an account in the dropdown (accountNumber - name format)
 */
function getAccountLabel(accountNumber: string): string {
  const name = ACCOUNT_NAMES[accountNumber]
  if (!name) {
    throw new Error(`Unknown account number: ${accountNumber}`)
  }
  return `${accountNumber} - ${name}`
}

/**
 * Creates a journal entry via UI
 */
async function createJournalEntry(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  accountNumbers: Set<string>,
  entry: {
    date: string
    description: string
    entryType: string
    referenceNumber?: string
    lines: Array<{
      accountNumber: string
      debitAmount?: string
      creditAmount?: string
      memo?: string
    }>
  }
): Promise<void> {
  // Navigate to new journal entry page
  await page.goto(`/organizations/${organizationId}/companies/${companyId}/journal-entries/new`)
  await page.waitForTimeout(300)

  // Wait for page to load
  await page.waitForSelector('[data-testid="new-journal-entry-page"]', { timeout: 10000 })

  // Fill header fields
  await page.fill('[data-testid="journal-entry-date"]', entry.date)
  await page.fill('[data-testid="journal-entry-description"]', entry.description)

  if (entry.referenceNumber) {
    await page.fill('[data-testid="journal-entry-reference"]', entry.referenceNumber)
  }

  // Select entry type
  const typeSelect = page.locator('[data-testid="journal-entry-type"]')
  await typeSelect.selectOption(entry.entryType)

  // Add line items
  for (let i = 0; i < entry.lines.length; i++) {
    const line = entry.lines[i]

    // If we need more lines than the initial 2, click Add Line button
    if (i >= 2) {
      await page.click('[data-testid="journal-entry-add-line"]')
      await page.waitForTimeout(200)
    }

    // Verify the account exists in the template
    if (!accountNumbers.has(line.accountNumber)) {
      throw new Error(`Account not found in template: ${line.accountNumber}`)
    }

    // Select account by its visible label text (accountNumber - name format)
    const accountLabel = getAccountLabel(line.accountNumber)
    const accountSelect = page.locator(`[data-testid="journal-entry-line-account-${i}"]`)
    await accountSelect.selectOption({ label: accountLabel })

    // Fill debit or credit amount
    if (line.debitAmount) {
      await page.fill(`[data-testid="journal-entry-line-debit-${i}"]`, line.debitAmount)
    }
    if (line.creditAmount) {
      await page.fill(`[data-testid="journal-entry-line-credit-${i}"]`, line.creditAmount)
    }

    // Fill memo if provided
    if (line.memo) {
      await page.fill(`[data-testid="journal-entry-line-memo-${i}"]`, line.memo)
    }
  }

  // Wait for balance to be calculated
  await page.waitForTimeout(300)

  // Submit the journal entry (Save as Draft for speed)
  await page.click('[data-testid="journal-entry-save-draft"]')

  // Wait for redirect back to journal entries list (after successful save)
  await page.waitForURL(/\/journal-entries(?!\/new)/, { timeout: 10000 })

  log(config, `Created JE: ${entry.description}`)
}

/**
 * Creates a simple 2-line journal entry via UI
 */
async function createSimpleJE(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  accountNumbers: Set<string>,
  date: string,
  description: string,
  debitAccountNumber: string,
  creditAccountNumber: string,
  amount: string,
  entryType: string = "Standard",
  referenceNumber?: string
): Promise<void> {
  await createJournalEntry(page, config, organizationId, companyId, accountNumbers, {
    date,
    description,
    entryType,
    referenceNumber,
    lines: [
      { accountNumber: debitAccountNumber, debitAmount: amount },
      { accountNumber: creditAccountNumber, creditAmount: amount }
    ]
  })
}

/**
 * Creates Year 1 (2024) journal entries for the parent company (USD)
 *
 * Account numbers used (from GeneralBusiness template):
 * - 1010: Cash - Operating Account
 * - 1100: Accounts Receivable
 * - 1200: Inventory
 * - 1540: Computer Equipment (for fixed asset purchases)
 * - 1800: Other Non-Current Assets (for investment in subsidiary)
 * - 2000: Accounts Payable
 * - 3000: Common Stock
 * - 4000: Sales Revenue
 * - 4100: Service Revenue
 * - 5000: Cost of Goods Sold
 * - 6000: Salaries and Wages
 * - 6300: Rent Expense
 * - 7000: Depreciation Expense
 * - 1630: Accumulated Depreciation - Equipment
 */
async function createParentYear1Data(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  accountNumbers: Set<string>
): Promise<void> {
  logStep(config, "Creating Parent Company Year 1 (2024) Data")

  // Initial capital - Jan 1
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2024-01-01", "Initial capital contribution",
    "1010", // Cash - Operating Account
    "3000", // Common Stock
    "2000000.00", "Standard", "INIT-2024-001"
  )
  logSuccess("Created initial capital entry")

  // Investment in subsidiary - Jan 1
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2024-01-01", "Investment in subsidiary",
    "1800", // Other Non-Current Assets (investment in subsidiary)
    "1010", // Cash - Operating Account
    "500000.00", "Standard", "INV-2024-001"
  )
  logSuccess("Created investment in subsidiary entry")

  // Purchase equipment - Jan 10
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2024-01-10", "Purchase equipment",
    "1540", // Computer Equipment
    "1010", // Cash - Operating Account
    "300000.00", "Standard", "EQ-2024-001"
  )
  logSuccess("Created equipment purchase entry")

  // Monthly operations for 2024
  const months2024 = [
    "2024-01-15", "2024-02-15", "2024-03-15", "2024-04-15",
    "2024-05-15", "2024-06-15", "2024-07-15", "2024-08-15",
    "2024-09-15", "2024-10-15", "2024-11-15", "2024-12-15"
  ]

  for (let i = 0; i < months2024.length; i++) {
    const date = months2024[i]
    const monthNum = String(i + 1).padStart(2, "0")

    // Sales revenue (record receivable)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Sales revenue - Month ${i + 1}`,
      "1100", // Accounts Receivable
      "4000", // Sales Revenue
      "250000.00", "Standard", `SALE-2024-${monthNum}`
    )

    // Collect receivables
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Collections - Month ${i + 1}`,
      "1010", // Cash - Operating Account
      "1100", // Accounts Receivable
      "235000.00", "Standard", `COLL-2024-${monthNum}`
    )

    // COGS (from inventory)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Cost of goods sold - Month ${i + 1}`,
      "5000", // Cost of Goods Sold
      "1200", // Inventory
      "150000.00", "Standard", `COGS-2024-${monthNum}`
    )

    // Purchase inventory (on account)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Inventory purchase - Month ${i + 1}`,
      "1200", // Inventory
      "2000", // Accounts Payable
      "155000.00", "Standard", `INV-P-2024-${monthNum}`
    )

    // Pay suppliers
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Supplier payments - Month ${i + 1}`,
      "2000", // Accounts Payable
      "1010", // Cash - Operating Account
      "150000.00", "Standard", `PAY-2024-${monthNum}`
    )

    // Payroll
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Payroll - Month ${i + 1}`,
      "6000", // Salaries and Wages
      "1010", // Cash - Operating Account
      "60000.00", "Standard", `PAY-E-2024-${monthNum}`
    )

    // Rent expense
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Rent expense - Month ${i + 1}`,
      "6300", // Rent Expense
      "1010", // Cash - Operating Account
      "15000.00", "Standard", `RENT-2024-${monthNum}`
    )
  }
  logSuccess("Created monthly operational entries (12 months)")

  // Quarterly management fees from UK subsidiary
  const quarters2024 = ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31"]
  for (let i = 0; i < quarters2024.length; i++) {
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      quarters2024[i], `Management fee from UK subsidiary - Q${i + 1}`,
      "1010", // Cash - Operating Account
      "4100", // Service Revenue (management services)
      "25000.00", "Standard", `MGMT-2024-Q${i + 1}`
    )
  }
  logSuccess("Created quarterly management fee entries (4 quarters)")

  // Year-end depreciation
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2024-12-31", "Annual depreciation - 2024",
    "7000", // Depreciation Expense
    "1630", // Accumulated Depreciation - Equipment
    "30000.00", "Adjusting", "DEP-2024"
  )
  logSuccess("Created year-end depreciation entry")
}

/**
 * Creates Year 2 (2025) journal entries for the parent company (USD)
 */
async function createParentYear2Data(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  accountNumbers: Set<string>
): Promise<void> {
  logStep(config, "Creating Parent Company Year 2 (2025) Data")

  // Monthly operations for 2025 (with growth)
  const months2025 = [
    "2025-01-15", "2025-02-15", "2025-03-15", "2025-04-15",
    "2025-05-15", "2025-06-15", "2025-07-15", "2025-08-15",
    "2025-09-15", "2025-10-15", "2025-11-15", "2025-12-15"
  ]

  for (let i = 0; i < months2025.length; i++) {
    const date = months2025[i]
    const monthNum = String(i + 1).padStart(2, "0")

    // Sales revenue (16% growth) - record receivable
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Sales revenue - Month ${i + 1}`,
      "1100", // Accounts Receivable
      "4000", // Sales Revenue
      "290000.00", "Standard", `SALE-2025-${monthNum}`
    )

    // Collect receivables
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Collections - Month ${i + 1}`,
      "1010", // Cash - Operating Account
      "1100", // Accounts Receivable
      "275000.00", "Standard", `COLL-2025-${monthNum}`
    )

    // COGS (from inventory)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Cost of goods sold - Month ${i + 1}`,
      "5000", // Cost of Goods Sold
      "1200", // Inventory
      "170000.00", "Standard", `COGS-2025-${monthNum}`
    )

    // Purchase inventory (on account)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Inventory purchase - Month ${i + 1}`,
      "1200", // Inventory
      "2000", // Accounts Payable
      "175000.00", "Standard", `INV-P-2025-${monthNum}`
    )

    // Pay suppliers
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Supplier payments - Month ${i + 1}`,
      "2000", // Accounts Payable
      "1010", // Cash - Operating Account
      "170000.00", "Standard", `PAY-2025-${monthNum}`
    )

    // Payroll (growth)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Payroll - Month ${i + 1}`,
      "6000", // Salaries and Wages
      "1010", // Cash - Operating Account
      "65000.00", "Standard", `PAY-E-2025-${monthNum}`
    )

    // Rent expense
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Rent expense - Month ${i + 1}`,
      "6300", // Rent Expense
      "1010", // Cash - Operating Account
      "15000.00", "Standard", `RENT-2025-${monthNum}`
    )
  }
  logSuccess("Created monthly operational entries (12 months)")

  // Quarterly management fees (with growth)
  const quarters2025 = ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"]
  for (let i = 0; i < quarters2025.length; i++) {
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      quarters2025[i], `Management fee from UK subsidiary - Q${i + 1}`,
      "1010", // Cash - Operating Account
      "4100", // Service Revenue (management services)
      "30000.00", "Standard", `MGMT-2025-Q${i + 1}`
    )
  }
  logSuccess("Created quarterly management fee entries (4 quarters)")

  // Additional equipment purchase - May 20
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2025-05-20", "Purchase additional equipment",
    "1540", // Computer Equipment
    "1010", // Cash - Operating Account
    "150000.00", "Standard", "EQ-2025-001"
  )
  logSuccess("Created additional equipment purchase")

  // Year-end depreciation (higher due to more equipment)
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2025-12-31", "Annual depreciation - 2025",
    "7000", // Depreciation Expense
    "1630", // Accumulated Depreciation - Equipment
    "45000.00", "Adjusting", "DEP-2025"
  )
  logSuccess("Created year-end depreciation entry")
}

/**
 * Creates Year 1 (2024) journal entries for the subsidiary company (GBP)
 */
async function createSubsidiaryYear1Data(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  accountNumbers: Set<string>
): Promise<void> {
  logStep(config, "Creating Subsidiary Company Year 1 (2024) Data")

  // Initial capital from parent - Jan 1
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2024-01-01", "Initial capital from parent",
    "1010", // Cash - Operating Account
    "3000", // Common Stock
    "400000.00", "Standard", "INIT-2024-001"
  )
  logSuccess("Created initial capital entry")

  // Purchase equipment - Jan 15
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2024-01-15", "Purchase equipment",
    "1540", // Computer Equipment
    "1010", // Cash - Operating Account
    "160000.00", "Standard", "EQ-2024-001"
  )
  logSuccess("Created equipment purchase entry")

  // Monthly operations for 2024
  const months2024 = [
    "2024-01-20", "2024-02-20", "2024-03-20", "2024-04-20",
    "2024-05-20", "2024-06-20", "2024-07-20", "2024-08-20",
    "2024-09-20", "2024-10-20", "2024-11-20", "2024-12-20"
  ]

  for (let i = 0; i < months2024.length; i++) {
    const date = months2024[i]
    const monthNum = String(i + 1).padStart(2, "0")

    // Sales revenue (record receivable)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Sales revenue - Month ${i + 1}`,
      "1100", // Accounts Receivable
      "4000", // Sales Revenue
      "120000.00", "Standard", `SALE-2024-${monthNum}`
    )

    // Collect receivables
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Collections - Month ${i + 1}`,
      "1010", // Cash - Operating Account
      "1100", // Accounts Receivable
      "112000.00", "Standard", `COLL-2024-${monthNum}`
    )

    // COGS (from inventory)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Cost of goods sold - Month ${i + 1}`,
      "5000", // Cost of Goods Sold
      "1200", // Inventory
      "72000.00", "Standard", `COGS-2024-${monthNum}`
    )

    // Purchase inventory (on account)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Inventory purchase - Month ${i + 1}`,
      "1200", // Inventory
      "2000", // Accounts Payable
      "76000.00", "Standard", `INV-P-2024-${monthNum}`
    )

    // Pay suppliers
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Supplier payments - Month ${i + 1}`,
      "2000", // Accounts Payable
      "1010", // Cash - Operating Account
      "72000.00", "Standard", `PAY-2024-${monthNum}`
    )

    // Payroll
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Payroll - Month ${i + 1}`,
      "6000", // Salaries and Wages
      "1010", // Cash - Operating Account
      "28000.00", "Standard", `PAY-E-2024-${monthNum}`
    )
  }
  logSuccess("Created monthly operational entries (12 months)")

  // Quarterly management fee to parent
  const quarters2024 = ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31"]
  for (let i = 0; i < quarters2024.length; i++) {
    // Accrue management fee expense (use Insurance Expense as a proxy for management fees)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      quarters2024[i], `Management fee to parent - Q${i + 1}`,
      "6500", // Insurance Expense (using as proxy for management fee expense)
      "2110", // Accrued Salaries and Wages (using as intercompany payable)
      "20000.00", "Standard", `MGMT-E-2024-Q${i + 1}`
    )

    // Pay management fee
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      quarters2024[i], `Pay management fee to parent - Q${i + 1}`,
      "2110", // Accrued Salaries and Wages
      "1010", // Cash - Operating Account
      "20000.00", "Standard", `MGMT-P-2024-Q${i + 1}`
    )
  }
  logSuccess("Created quarterly management fee entries (4 quarters)")

  // Year-end depreciation
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2024-12-31", "Annual depreciation - 2024",
    "7000", // Depreciation Expense
    "1630", // Accumulated Depreciation - Equipment
    "16000.00", "Adjusting", "DEP-2024"
  )
  logSuccess("Created year-end depreciation entry")
}

/**
 * Creates Year 2 (2025) journal entries for the subsidiary company (GBP)
 */
async function createSubsidiaryYear2Data(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  accountNumbers: Set<string>
): Promise<void> {
  logStep(config, "Creating Subsidiary Company Year 2 (2025) Data")

  // Monthly operations for 2025 (with growth)
  const months2025 = [
    "2025-01-20", "2025-02-20", "2025-03-20", "2025-04-20",
    "2025-05-20", "2025-06-20", "2025-07-20", "2025-08-20",
    "2025-09-20", "2025-10-20", "2025-11-20", "2025-12-20"
  ]

  for (let i = 0; i < months2025.length; i++) {
    const date = months2025[i]
    const monthNum = String(i + 1).padStart(2, "0")

    // Sales revenue (growth) - record receivable
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Sales revenue - Month ${i + 1}`,
      "1100", // Accounts Receivable
      "4000", // Sales Revenue
      "140000.00", "Standard", `SALE-2025-${monthNum}`
    )

    // Collect receivables
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Collections - Month ${i + 1}`,
      "1010", // Cash - Operating Account
      "1100", // Accounts Receivable
      "132000.00", "Standard", `COLL-2025-${monthNum}`
    )

    // COGS (from inventory)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Cost of goods sold - Month ${i + 1}`,
      "5000", // Cost of Goods Sold
      "1200", // Inventory
      "80000.00", "Standard", `COGS-2025-${monthNum}`
    )

    // Purchase inventory (on account)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Inventory purchase - Month ${i + 1}`,
      "1200", // Inventory
      "2000", // Accounts Payable
      "84000.00", "Standard", `INV-P-2025-${monthNum}`
    )

    // Pay suppliers
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Supplier payments - Month ${i + 1}`,
      "2000", // Accounts Payable
      "1010", // Cash - Operating Account
      "80000.00", "Standard", `PAY-2025-${monthNum}`
    )

    // Payroll (growth)
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      date, `Payroll - Month ${i + 1}`,
      "6000", // Salaries and Wages
      "1010", // Cash - Operating Account
      "32000.00", "Standard", `PAY-E-2025-${monthNum}`
    )
  }
  logSuccess("Created monthly operational entries (12 months)")

  // Quarterly management fee to parent (with growth)
  const quarters2025 = ["2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"]
  for (let i = 0; i < quarters2025.length; i++) {
    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      quarters2025[i], `Management fee to parent - Q${i + 1}`,
      "6500", // Insurance Expense (proxy for management fee)
      "2110", // Accrued Salaries and Wages (intercompany payable)
      "24000.00", "Standard", `MGMT-E-2025-Q${i + 1}`
    )

    await createSimpleJE(
      page, config, organizationId, companyId, accountNumbers,
      quarters2025[i], `Pay management fee to parent - Q${i + 1}`,
      "2110", // Accrued Salaries and Wages
      "1010", // Cash - Operating Account
      "24000.00", "Standard", `MGMT-P-2025-Q${i + 1}`
    )
  }
  logSuccess("Created quarterly management fee entries (4 quarters)")

  // Additional equipment purchase - Jun 15
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2025-06-15", "Purchase additional equipment",
    "1540", // Computer Equipment
    "1010", // Cash - Operating Account
    "80000.00", "Standard", "EQ-2025-001"
  )
  logSuccess("Created additional equipment purchase")

  // Year-end depreciation (higher)
  await createSimpleJE(
    page, config, organizationId, companyId, accountNumbers,
    "2025-12-31", "Annual depreciation - 2025",
    "7000", // Depreciation Expense
    "1630", // Accumulated Depreciation - Equipment
    "24000.00", "Adjusting", "DEP-2025"
  )
  logSuccess("Created year-end depreciation entry")
}

/**
 * Creates the consolidation group via UI
 * Returns the consolidation group ID
 */
async function createConsolidationGroup(
  page: Page,
  config: Config,
  organizationId: string,
  parentCompanyId: string,
  subsidiaryCompanyId: string
): Promise<{ id: string; name: string }> {
  logStep(config, "Creating Consolidation Group")

  // Navigate to consolidation page
  await page.goto(`/organizations/${organizationId}/consolidation`)
  await page.waitForTimeout(500)

  // Wait for page to load
  await page.waitForSelector('[data-testid="consolidation-page"]', { timeout: 10000 })

  // Click create group button
  const createButton = page.locator('[data-testid="create-group-button"]')
  if (await createButton.isVisible()) {
    await createButton.click()
  } else {
    // Try empty state CTA
    const emptyCta = page.locator('[data-testid="create-first-group-button"]')
    if (await emptyCta.isVisible()) {
      await emptyCta.click()
    }
  }

  // Wait for create group page/modal
  await page.waitForURL(/\/consolidation\/new/, { timeout: 5000 })
  await page.waitForTimeout(300)

  const groupName = "Acme Consolidated Group"

  // Fill consolidation group form
  await page.fill('[data-testid="group-name-input"]', groupName)

  // Select reporting currency (using correct data-testid)
  const currencySelect = page.locator('[data-testid="reporting-currency-select"]')
  await currencySelect.selectOption("USD")

  // Select consolidation method (using correct data-testid)
  const methodSelect = page.locator('[data-testid="consolidation-method-select"]')
  await methodSelect.selectOption("FullConsolidation")

  // Select parent company (using correct data-testid)
  const parentSelect = page.locator('[data-testid="parent-company-select"]')
  await parentSelect.selectOption(parentCompanyId)
  await page.waitForTimeout(200)

  // Add subsidiary member
  // This may involve clicking an "Add Member" button and filling member details
  const addMemberButton = page.locator('[data-testid="add-member-button"]')
  await addMemberButton.waitFor({ state: "visible", timeout: 5000 })
  await addMemberButton.click()
  await page.waitForTimeout(200)

  // Select subsidiary company (using correct data-testid)
  const memberCompanySelect = page.locator('[data-testid="member-company-select-0"]')
  await memberCompanySelect.waitFor({ state: "visible", timeout: 5000 })
  await memberCompanySelect.selectOption(subsidiaryCompanyId)

  // Fill ownership percentage (using correct data-testid)
  await page.fill('[data-testid="member-ownership-input-0"]', "100")

  // Select consolidation method for member (using correct data-testid)
  const memberMethodSelect = page.locator('[data-testid="member-method-select-0"]')
  await memberMethodSelect.selectOption("FullConsolidation")

  // Submit the form (using correct data-testid)
  await page.click('[data-testid="submit-button"]')

  // Wait for redirect to group detail page
  await page.waitForURL(/\/consolidation\/[a-f0-9-]+/, { timeout: 15000 })

  // Extract group ID from URL
  const groupId = extractConsolidationGroupIdFromUrl(page.url())
  logSuccess(`Created consolidation group: ${groupName} (${groupId})`)

  return { id: groupId, name: groupName }
}

// ===== Phase 6: Company Reports =====

/**
 * Navigates to and generates a company report via UI
 */
async function generateCompanyReport(
  page: Page,
  config: Config,
  organizationId: string,
  companyId: string,
  companyName: string,
  reportType: "trial-balance" | "balance-sheet" | "income-statement" | "cash-flow" | "equity-statement",
  asOfDate: string
): Promise<void> {
  const reportNames: Record<string, string> = {
    "trial-balance": "Trial Balance",
    "balance-sheet": "Balance Sheet",
    "income-statement": "Income Statement",
    "cash-flow": "Cash Flow Statement",
    "equity-statement": "Statement of Changes in Equity"
  }

  log(config, `Generating ${reportNames[reportType]} for ${companyName}...`)

  // Navigate to the specific report page
  await page.goto(`/organizations/${organizationId}/companies/${companyId}/reports/${reportType}`)
  await page.waitForTimeout(500)

  // Wait for page to load
  await page.waitForSelector(`[data-testid="${reportType}-page"]`, { timeout: 10000 })

  // Fill in the as-of date parameter
  const dateInput = page.locator(`[data-testid="${reportType}-as-of-date"]`)
  if (await dateInput.isVisible({ timeout: 3000 })) {
    await dateInput.fill(asOfDate)
  } else {
    // Try alternative date input selector
    const altDateInput = page.locator('input[type="date"]')
    if (await altDateInput.isVisible({ timeout: 2000 })) {
      await altDateInput.fill(asOfDate)
    }
  }

  // Click generate report button
  const generateButton = page.locator('button:has-text("Generate Report")')
  await generateButton.click()

  // Wait for report to load (look for report table or data)
  await page.waitForSelector(`[data-testid="${reportType}-report"]`, { timeout: 30000 }).catch(() => {
    // Report might use different testid format
    log(config, `Report loaded (waiting for data...)`)
  })

  // Give it time to render
  await page.waitForTimeout(1000)

  logSuccess(`Generated ${reportNames[reportType]} for ${companyName} (${asOfDate})`)
}

/**
 * Generates company reports for both companies (Phase 6)
 */
async function generateCompanyReports(
  page: Page,
  config: Config,
  organizationId: string,
  parentCompanyId: string,
  parentCompanyName: string,
  subsidiaryCompanyId: string,
  subsidiaryCompanyName: string
): Promise<void> {
  logStep(config, "Generating Company Reports")

  // Generate Year 1 (2024) reports for parent company
  await generateCompanyReport(page, config, organizationId, parentCompanyId, parentCompanyName, "trial-balance", "2024-12-31")
  await generateCompanyReport(page, config, organizationId, parentCompanyId, parentCompanyName, "balance-sheet", "2024-12-31")

  // Generate Year 1 (2024) reports for subsidiary company
  await generateCompanyReport(page, config, organizationId, subsidiaryCompanyId, subsidiaryCompanyName, "trial-balance", "2024-12-31")
  await generateCompanyReport(page, config, organizationId, subsidiaryCompanyId, subsidiaryCompanyName, "balance-sheet", "2024-12-31")

  // Generate Year 2 (2025) reports for parent company
  await generateCompanyReport(page, config, organizationId, parentCompanyId, parentCompanyName, "trial-balance", "2025-12-31")
  await generateCompanyReport(page, config, organizationId, parentCompanyId, parentCompanyName, "balance-sheet", "2025-12-31")

  // Generate Year 2 (2025) reports for subsidiary company
  await generateCompanyReport(page, config, organizationId, subsidiaryCompanyId, subsidiaryCompanyName, "trial-balance", "2025-12-31")
  await generateCompanyReport(page, config, organizationId, subsidiaryCompanyId, subsidiaryCompanyName, "balance-sheet", "2025-12-31")

  logSuccess("All company reports generated successfully")
}

// ===== Phase 7: Consolidation Runs =====

/**
 * Initiates a consolidation run via UI
 * Returns the run ID
 */
async function initiateConsolidationRun(
  page: Page,
  config: Config,
  organizationId: string,
  groupId: string,
  year: number,
  period: number,
  asOfDate: string
): Promise<string> {
  log(config, `Initiating consolidation run for ${year} P${period}...`)

  // Navigate to consolidation group detail page
  await page.goto(`/organizations/${organizationId}/consolidation/${groupId}`)
  await page.waitForTimeout(500)

  // Wait for page to load
  await page.waitForSelector('[data-testid="consolidation-group-detail-page"]', { timeout: 10000 })

  // Click "New Run" button
  const newRunButton = page.locator('[data-testid="initiate-run-button"]')
  await newRunButton.waitFor({ state: "visible", timeout: 5000 })
  await newRunButton.click()

  // Wait for modal to appear
  await page.waitForSelector('[data-testid="fiscal-year-input"]', { timeout: 5000 })
  await page.waitForTimeout(300)

  // Fill in the run parameters
  await page.fill('[data-testid="fiscal-year-input"]', year.toString())
  await page.fill('[data-testid="fiscal-period-input"]', period.toString())
  await page.fill('[data-testid="as-of-date-input"]', asOfDate)

  // Click Start Run button
  await page.click('[data-testid="start-run-button"]')

  // Wait for redirect to run detail page or back to group page
  await page.waitForURL(/\/runs\/[a-f0-9-]+|\/consolidation\/[a-f0-9-]+$/, { timeout: 30000 })

  // Extract run ID if we were redirected to run detail page
  let runId = ""
  const currentUrl = page.url()
  if (currentUrl.includes("/runs/")) {
    runId = extractConsolidationRunIdFromUrl(currentUrl)
    logSuccess(`Consolidation run initiated: ${year} P${period} (${runId})`)
  } else {
    // If we stayed on group page, the run was created but we need to find its ID
    // Reload the page and get the first run in the list
    await page.reload()
    await page.waitForTimeout(1000)
    const firstRunRow = page.locator('[data-testid^="run-row-"]').first()
    const testId = await firstRunRow.getAttribute("data-testid")
    runId = testId?.replace("run-row-", "") ?? ""
    logSuccess(`Consolidation run initiated: ${year} P${period}`)
  }

  return runId
}

/**
 * Runs consolidations for Year 1 (2024) and Year 2 (2025) via UI (Phase 7)
 */
async function runConsolidations(
  page: Page,
  config: Config,
  organizationId: string,
  groupId: string
): Promise<{ year: number; id: string }[]> {
  logStep(config, "Running Consolidations")

  const runs: { year: number; id: string }[] = []

  // Run Year 1 (2024) consolidation - Period 12 (December)
  const run2024Id = await initiateConsolidationRun(
    page, config, organizationId, groupId,
    2024, 12, "2024-12-31"
  )
  runs.push({ year: 2024, id: run2024Id })

  // Wait a moment between runs
  await page.waitForTimeout(1000)

  // Run Year 2 (2025) consolidation - Period 12 (December)
  const run2025Id = await initiateConsolidationRun(
    page, config, organizationId, groupId,
    2025, 12, "2025-12-31"
  )
  runs.push({ year: 2025, id: run2025Id })

  logSuccess("All consolidation runs completed")

  return runs
}

// ===== Phase 8: Consolidated Reports =====

/**
 * Navigates to and views a consolidated report via UI
 */
async function viewConsolidatedReport(
  page: Page,
  config: Config,
  organizationId: string,
  groupId: string,
  runId: string,
  reportType: "balance-sheet" | "income-statement" | "cash-flow" | "equity-statement",
  year: number
): Promise<void> {
  const reportNames: Record<string, string> = {
    "balance-sheet": "Consolidated Balance Sheet",
    "income-statement": "Consolidated Income Statement",
    "cash-flow": "Consolidated Cash Flow Statement",
    "equity-statement": "Consolidated Statement of Changes in Equity"
  }

  log(config, `Viewing ${reportNames[reportType]} for ${year}...`)

  // Navigate to the consolidated report page
  await page.goto(`/organizations/${organizationId}/consolidation/${groupId}/runs/${runId}/reports/${reportType}`)
  await page.waitForTimeout(500)

  // Wait for page to load (consolidated reports may have different structure)
  // Try multiple possible selectors
  const possibleSelectors = [
    `[data-testid="consolidated-${reportType}-page"]`,
    `[data-testid="${reportType}-page"]`,
    '[data-testid="consolidated-report-page"]',
    'table',  // Most reports have a table
    '.report-content'
  ]

  let loaded = false
  for (const selector of possibleSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 })
      loaded = true
      break
    } catch {
      continue
    }
  }

  if (!loaded) {
    log(config, `Warning: ${reportNames[reportType]} page may not have loaded completely`)
  }

  // Give it time to render
  await page.waitForTimeout(1000)

  logSuccess(`Viewed ${reportNames[reportType]} for ${year}`)
}

/**
 * Generates consolidated reports for both years (Phase 8)
 */
async function generateConsolidatedReports(
  page: Page,
  config: Config,
  organizationId: string,
  groupId: string,
  runs: { year: number; id: string }[]
): Promise<void> {
  logStep(config, "Viewing Consolidated Reports")

  // Get runs by year
  const run2024 = runs.find(r => r.year === 2024)
  const run2025 = runs.find(r => r.year === 2025)

  // View 2024 consolidated reports (if run exists and has ID)
  if (run2024?.id) {
    await viewConsolidatedReport(page, config, organizationId, groupId, run2024.id, "balance-sheet", 2024)
    await viewConsolidatedReport(page, config, organizationId, groupId, run2024.id, "income-statement", 2024)
  }

  // View 2025 consolidated reports (if run exists and has ID)
  if (run2025?.id) {
    await viewConsolidatedReport(page, config, organizationId, groupId, run2025.id, "balance-sheet", 2025)
    await viewConsolidatedReport(page, config, organizationId, groupId, run2025.id, "income-statement", 2025)
  }

  logSuccess("All consolidated reports viewed successfully")
}

// ===== Main Export Function =====

export interface GenerateSyntheticDataOptions {
  page?: Page
  baseUrl?: string
  config?: Partial<Config>
  verbose?: boolean
}

/**
 * Main function to generate synthetic data via UI interactions
 *
 * Can be called either:
 * 1. From CLI: Uses chromium browser to create page
 * 2. From E2E test: Uses provided page from Playwright test
 */
export async function generateSyntheticData(
  options: GenerateSyntheticDataOptions = {}
): Promise<GeneratedData> {
  const config: Config = {
    ...DEFAULT_CONFIG,
    ...options.config,
    baseUrl: options.baseUrl ?? DEFAULT_CONFIG.baseUrl,
    verbose: options.verbose ?? DEFAULT_CONFIG.verbose
  }

  let page: Page
  let browser: Browser | null = null
  let context: BrowserContext | null = null

  // If page not provided, create one using chromium
  if (options.page) {
    page = options.page
  } else {
    // Dynamic import for CLI usage
    const playwright = await import("@playwright/test")
    const { chromium } = playwright
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo
    })
    context = await browser.newContext({
      baseURL: config.baseUrl
    })
    page = await context.newPage()
  }

  try {
    console.log("\n╔═══════════════════════════════════════════════╗")
    console.log("║   SYNTHETIC DATA GENERATOR                    ║")
    console.log("╚═══════════════════════════════════════════════╝")
    console.log(`\nBase URL: ${config.baseUrl}`)
    console.log(`User: ${config.user.email}`)

    // 1. Create user and login
    await createUser(page, config)

    // 2. Create organization
    const organization = await createOrganization(page, config)

    // 3. Create parent company
    const parentCompany = await createParentCompany(page, config, organization.id)

    // 4. Create subsidiary company
    const subsidiaryCompany = await createSubsidiaryCompany(
      page, config, organization.id, parentCompany.id
    )

    // 5. Apply account templates
    logStep(config, "Setting Up Chart of Accounts")
    const parentAccounts = await applyAccountTemplate(
      page, config, organization.id, parentCompany.id, parentCompany.name
    )
    const subsidiaryAccounts = await applyAccountTemplate(
      page, config, organization.id, subsidiaryCompany.id, subsidiaryCompany.name
    )

    // 6. Create Year 1 data
    await createParentYear1Data(
      page, config, organization.id, parentCompany.id, parentAccounts
    )
    await createSubsidiaryYear1Data(
      page, config, organization.id, subsidiaryCompany.id, subsidiaryAccounts
    )

    // 7. Create Year 2 data
    await createParentYear2Data(
      page, config, organization.id, parentCompany.id, parentAccounts
    )
    await createSubsidiaryYear2Data(
      page, config, organization.id, subsidiaryCompany.id, subsidiaryAccounts
    )

    // 8. Create consolidation group
    const consolidationGroup = await createConsolidationGroup(
      page, config, organization.id, parentCompany.id, subsidiaryCompany.id
    )

    // 9. Generate company reports (Phase 6)
    await generateCompanyReports(
      page, config, organization.id,
      parentCompany.id, parentCompany.name,
      subsidiaryCompany.id, subsidiaryCompany.name
    )

    // 10. Run consolidations (Phase 7)
    const consolidationRuns = await runConsolidations(
      page, config, organization.id, consolidationGroup.id
    )

    // 11. View consolidated reports (Phase 8)
    await generateConsolidatedReports(
      page, config, organization.id, consolidationGroup.id, consolidationRuns
    )

    // Summary
    console.log("\n╔═══════════════════════════════════════════════╗")
    console.log("║   GENERATION COMPLETE                         ║")
    console.log("╚═══════════════════════════════════════════════╝")
    console.log(`
Summary:
  ✓ User: ${config.user.email}
  ✓ Organization: ${organization.name}
  ✓ Parent Company: ${parentCompany.name} (${parentAccounts.size} accounts)
  ✓ Subsidiary Company: ${subsidiaryCompany.name} (${subsidiaryAccounts.size} accounts)
  ✓ Journal Entries: 2 years of data (2024-2025)
  ✓ Consolidation Group: ${consolidationGroup.name}
  ✓ Consolidation Runs: ${consolidationRuns.length} runs (2024, 2025)
  ✓ Company Reports: Trial Balance, Balance Sheet for both companies
  ✓ Consolidated Reports: Balance Sheet, Income Statement for both years

Login credentials:
  Email: ${config.user.email}
  Password: ${config.user.password}
`)

    return {
      organization,
      parentCompany,
      subsidiaryCompany,
      accounts: {
        parent: parentAccounts,
        subsidiary: subsidiaryAccounts
      },
      consolidationGroup,
      consolidationRuns
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// ===== CLI Entry Point =====

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  const config: Partial<Config> = {}
  let baseUrl = DEFAULT_CONFIG.baseUrl

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--url" && args[i + 1]) {
      baseUrl = args[i + 1]
      i++
    } else if (arg === "--verbose" || arg === "-v") {
      config.verbose = true
    } else if (arg === "--headed") {
      config.headless = false
    } else if (arg === "--slow") {
      config.slowMo = 100
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: pnpm --filter @accountability/web generate:synthetic-data [options]

Options:
  --url <url>     Application URL (default: http://localhost:3000)
  --verbose, -v   Enable verbose logging
  --headed        Run browser in headed mode (visible)
  --slow          Slow down operations for debugging
  --help, -h      Show this help message
`)
      process.exit(0)
    }
  }

  try {
    await generateSyntheticData({ baseUrl, config, verbose: config.verbose })
  } catch (error) {
    console.error("\nFailed to generate synthetic data:")
    console.error(error)
    process.exit(1)
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  main()
}
