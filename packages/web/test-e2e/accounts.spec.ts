/**
 * Accounts E2E Tests
 *
 * Tests the accounts list page functionality:
 * - List displays accounts with hierarchy
 * - Filter by type works
 * - Search by name works
 * - Create account via UI works
 * - Navigate to account details
 * - Empty state for new companies
 */

import { test, expect } from "@playwright/test"

// Token storage key (must match tokenStorage.ts)
const AUTH_TOKEN_KEY = "auth_token"

// Test user credentials
interface TestUser {
  email: string
  password: string
  displayName: string
}

/**
 * Generate unique test credentials
 */
function generateTestCredentials(): TestUser {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return {
    email: `test-accounts-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Accounts Test ${random}`
  }
}

test.describe("Accounts List Page", () => {
  let testUser: TestUser
  let testOrgId: string
  let testOrgName: string
  let testCompanyId: string
  let testCompanyName: string

  test.beforeAll(async ({ request }) => {
    // Create a test user via API before running tests
    testUser = generateTestCredentials()
    testOrgName = `Accounts Test Org ${Date.now()}`
    testCompanyName = `Accounts Test Company ${Date.now()}`

    const response = await request.post("/api/auth/register", {
      data: {
        email: testUser.email,
        password: testUser.password,
        displayName: testUser.displayName
      }
    })

    if (!response.ok()) {
      console.error("Failed to register test user:", await response.text())
    }
    expect(response.ok()).toBe(true)

    // Login to get token
    const authResponse = await request.post("/api/auth/login", {
      headers: {
        "Content-Type": "application/json"
      },
      data: {
        provider: "local",
        credentials: {
          email: testUser.email,
          password: testUser.password
        }
      }
    })
    expect(authResponse.ok()).toBe(true)
    const { token } = await authResponse.json()

    // Create test organization
    const createOrgResponse = await request.post("/api/v1/organizations", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        name: testOrgName,
        reportingCurrency: "USD",
        settings: null
      }
    })
    if (!createOrgResponse.ok()) {
      console.error(`Failed to create organization: ${createOrgResponse.status()} - ${await createOrgResponse.text()}`)
    }
    expect(createOrgResponse.ok()).toBe(true)
    const org = await createOrgResponse.json()
    testOrgId = org.id

    // Create test company
    const createCompanyResponse = await request.post("/api/v1/companies", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        organizationId: testOrgId,
        name: testCompanyName,
        legalName: `${testCompanyName} Inc.`,
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
    if (!createCompanyResponse.ok()) {
      console.error(`Failed to create company: ${createCompanyResponse.status()} - ${await createCompanyResponse.text()}`)
    }
    expect(createCompanyResponse.ok()).toBe(true)
    const company = await createCompanyResponse.json()
    testCompanyId = company.id
  })

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await page.goto("/")
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Login the test user
    await page.goto("/login")
    await page.getByTestId("login-email").fill(testUser.email)
    await page.getByTestId("login-password").fill(testUser.password)
    await page.getByTestId("login-submit").click()
    await page.waitForURL("/")
  })

  test("should display accounts page when authenticated", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should be on the accounts page
    await expect(page).toHaveURL(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Page should have the correct heading
    await expect(page.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible()

    // Should show accounts page container
    await expect(page.getByTestId("accounts-page")).toBeVisible()
  })

  test("should show empty state for company with no accounts", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should show empty state
    await expect(page.getByTestId("accounts-empty")).toBeVisible()

    // Empty state should have call-to-action text
    await expect(page.getByRole("heading", { name: "No accounts yet" })).toBeVisible()
    await expect(page.getByTestId("accounts-empty-create")).toBeVisible()
    await expect(page.getByTestId("accounts-empty-create")).toContainText("Create your first account")
  })

  test("should have correct breadcrumb navigation", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should show breadcrumb
    await expect(page.getByTestId("breadcrumb")).toBeVisible()
    await expect(page.getByTestId("breadcrumb-organizations")).toContainText("Organizations")
    await expect(page.getByTestId("breadcrumb-organization")).toBeVisible()
    await expect(page.getByTestId("breadcrumb-companies")).toContainText("Companies")
    await expect(page.getByTestId("breadcrumb-company")).toBeVisible()
    await expect(page.getByTestId("breadcrumb-current")).toContainText("Accounts")
  })

  test("should open create account modal from empty state", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Click the create button in empty state
    await page.getByTestId("accounts-empty-create").click()

    // Modal should appear
    await expect(page.getByTestId("create-account-modal")).toBeVisible()

    // Modal should have title
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible()

    // Modal should have form inputs
    await expect(page.getByTestId("account-number-input")).toBeVisible()
    await expect(page.getByTestId("account-name-input")).toBeVisible()
    await expect(page.getByTestId("account-type-select")).toBeVisible()
    await expect(page.getByTestId("account-category-select")).toBeVisible()
    await expect(page.getByTestId("normal-balance-select")).toBeVisible()

    // Modal should have buttons
    await expect(page.getByTestId("create-account-cancel")).toBeVisible()
    await expect(page.getByTestId("create-account-submit")).toBeVisible()
  })

  test("should close create modal when clicking cancel", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Open the modal
    await page.getByTestId("accounts-empty-create").click()
    await expect(page.getByTestId("create-account-modal")).toBeVisible()

    // Click cancel
    await page.getByTestId("create-account-cancel").click()

    // Modal should close
    await expect(page.getByTestId("create-account-modal")).not.toBeVisible()
  })

  test("should close create modal when pressing Escape", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Open the modal
    await page.getByTestId("accounts-empty-create").click()
    await expect(page.getByTestId("create-account-modal")).toBeVisible()

    // Press Escape
    await page.keyboard.press("Escape")

    // Modal should close
    await expect(page.getByTestId("create-account-modal")).not.toBeVisible()
  })

  test("should show validation error for empty account number", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Open the modal
    await page.getByTestId("accounts-empty-create").click()
    await expect(page.getByTestId("create-account-modal")).toBeVisible()

    // Fill in name only
    await page.getByTestId("account-name-input").fill("Test Account")

    // Submit without account number
    await page.getByTestId("create-account-submit").click()

    // Should show error
    await expect(page.getByTestId("create-account-error")).toBeVisible()
    await expect(page.getByTestId("create-account-error")).toContainText("Account number is required")
  })

  test("should show validation error for empty account name", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Open the modal
    await page.getByTestId("accounts-empty-create").click()
    await expect(page.getByTestId("create-account-modal")).toBeVisible()

    // Fill in number only
    await page.getByTestId("account-number-input").fill("1000")

    // Submit without name
    await page.getByTestId("create-account-submit").click()

    // Should show error
    await expect(page.getByTestId("create-account-error")).toBeVisible()
    await expect(page.getByTestId("create-account-error")).toContainText("Account name is required")
  })

  test("should create account successfully", async ({ page }) => {
    // Generate 4-digit numeric account number (1000-9999 range)
    const accountNumber = `${1000 + Math.floor(Math.random() * 9000)}`
    const accountName = `Test Cash Account ${Date.now()}`

    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Open the modal - either from empty state or header button depending on existing data
    const emptyCreateBtn = page.getByTestId("accounts-empty-create")
    const headerCreateBtn = page.getByTestId("accounts-create-button")

    await page.waitForLoadState("networkidle")
    if (await emptyCreateBtn.isVisible()) {
      await emptyCreateBtn.click()
    } else {
      await headerCreateBtn.click()
    }
    await expect(page.getByTestId("create-account-modal")).toBeVisible()

    // Fill in the form
    await page.getByTestId("account-number-input").fill(accountNumber)
    await page.getByTestId("account-name-input").fill(accountName)
    await page.getByTestId("account-type-select").selectOption("Asset")
    await page.getByTestId("account-category-select").selectOption("CurrentAsset")

    // Submit
    await page.getByTestId("create-account-submit").click()

    // Wait for API call to complete and modal to close (increased timeout)
    await expect(page.getByTestId("create-account-modal")).not.toBeVisible({ timeout: 15000 })

    // Account should appear in the list
    await expect(page.getByTestId("accounts-tree")).toBeVisible({ timeout: 10000 })
    // Find the row that contains this account
    await expect(page.locator(`[data-testid^="account-row-"]`).filter({
      has: page.locator(`text=${accountName}`)
    })).toBeVisible()
  })

  test("should display accounts with hierarchy", async ({ page, request }) => {
    // Generate 4-digit numeric account numbers in the same range (e.g., 1xxx for Assets)
    const baseNum = Math.floor(Math.random() * 900) + 100 // 100-999
    const parentAccountNumber = `1${baseNum}`  // e.g., "1234" - parent in Asset range
    const childAccountNumber = `1${baseNum + 1}` // e.g., "1235" - child in Asset range
    const uniqueId = Date.now()
    const parentAccountName = `Parent Account ${uniqueId}`
    const childAccountName = `Child Account ${uniqueId}`

    // Login to get token
    const authResponse = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    expect(authResponse.ok()).toBe(true)
    const { token } = await authResponse.json()

    // Create parent account (summary - non-postable)
    const createParentResponse = await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: parentAccountNumber,
        name: parentAccountName,
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: null,
        isPostable: false, // Summary account
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    if (!createParentResponse.ok()) {
      const errorText = await createParentResponse.text()
      console.error(`Failed to create parent account: ${createParentResponse.status()} - ${errorText}`)
    }
    expect(createParentResponse.ok()).toBe(true)
    const parentAccount = await createParentResponse.json()

    // Create child account
    const createChildResponse = await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: childAccountNumber,
        name: childAccountName,
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: parentAccount.id,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    if (!createChildResponse.ok()) {
      const errorText = await createChildResponse.text()
      console.error(`Failed to create child account: ${createChildResponse.status()} - ${errorText}`)
    }
    expect(createChildResponse.ok()).toBe(true)
    const childAccount = await createChildResponse.json()

    // Visit accounts page
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should show tree view
    await expect(page.getByTestId("accounts-tree")).toBeVisible()

    // Parent should be visible
    await expect(page.getByTestId(`account-row-${parentAccount.id}`)).toBeVisible()
    await expect(page.getByTestId(`account-name-${parentAccount.id}`)).toContainText(parentAccountName)

    // Child should be visible (default expanded)
    await expect(page.getByTestId(`account-row-${childAccount.id}`)).toBeVisible()
    await expect(page.getByTestId(`account-name-${childAccount.id}`)).toContainText(childAccountName)

    // Toggle to collapse parent
    await page.getByTestId(`toggle-${parentAccount.id}`).click()

    // Child should not be visible now
    await expect(page.getByTestId(`account-row-${childAccount.id}`)).not.toBeVisible()

    // Toggle to expand again
    await page.getByTestId(`toggle-${parentAccount.id}`).click()

    // Child should be visible again
    await expect(page.getByTestId(`account-row-${childAccount.id}`)).toBeVisible()
  })

  test("should filter accounts by type", async ({ page, request }) => {
    // Login to get token
    const authResponse = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    expect(authResponse.ok()).toBe(true)
    const { token } = await authResponse.json()

    // Create asset account
    const assetAccountNumber = `${1000 + Math.floor(Math.random() * 900)}`
    const assetAccountName = `Filter Asset ${Date.now()}`
    await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: assetAccountNumber,
        name: assetAccountName,
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

    // Create liability account
    const liabilityAccountNumber = `${2000 + Math.floor(Math.random() * 900)}`
    const liabilityAccountName = `Filter Liability ${Date.now()}`
    await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: liabilityAccountNumber,
        name: liabilityAccountName,
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

    // Visit accounts page
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should show filter bar
    await expect(page.getByTestId("accounts-filter-bar")).toBeVisible()

    // Filter by Asset
    await page.getByTestId("accounts-type-filter").selectOption("Asset")

    // Asset account should be visible
    await expect(page.locator(`[data-testid^="account-row-"]`).filter({
      has: page.locator(`text=${assetAccountName}`)
    })).toBeVisible()

    // Liability account should NOT be visible
    await expect(page.locator(`[data-testid^="account-row-"]`).filter({
      has: page.locator(`text=${liabilityAccountName}`)
    })).not.toBeVisible()

    // Filter by Liability
    await page.getByTestId("accounts-type-filter").selectOption("Liability")

    // Liability account should be visible
    await expect(page.locator(`[data-testid^="account-row-"]`).filter({
      has: page.locator(`text=${liabilityAccountName}`)
    })).toBeVisible()

    // Asset account should NOT be visible
    await expect(page.locator(`[data-testid^="account-row-"]`).filter({
      has: page.locator(`text=${assetAccountName}`)
    })).not.toBeVisible()
  })

  test("should search accounts by name", async ({ page, request }) => {
    // Login to get token
    const authResponse = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    expect(authResponse.ok()).toBe(true)
    const { token } = await authResponse.json()

    // Create a uniquely named account
    const searchableAccountNumber = `${5000 + Math.floor(Math.random() * 900)}`
    const searchableAccountName = `UniqueSearchable${Date.now()}`
    await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: searchableAccountNumber,
        name: searchableAccountName,
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

    // Visit accounts page
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should show search input
    await expect(page.getByTestId("accounts-search-input")).toBeVisible()

    // Search for the unique name
    await page.getByTestId("accounts-search-input").fill("UniqueSearchable")

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // The searchable account should be visible
    await expect(page.locator(`[data-testid^="account-row-"]`).filter({
      has: page.locator(`text=${searchableAccountName}`)
    })).toBeVisible()

    // Clear search
    await page.getByTestId("accounts-search-input").clear()

    // Search for something that doesn't exist
    await page.getByTestId("accounts-search-input").fill("ZZZNotExisting123")

    // Wait for filter to apply
    await page.waitForTimeout(500)

    // Should show no results message
    await expect(page.getByTestId("accounts-no-results")).toBeVisible()
  })

  test("should require authentication to access accounts page", async ({ page }) => {
    // Clear the auth token
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Try to access accounts page
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should be redirected to login
    await page.waitForURL(/\/login/)
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
  })

  test("should navigate back to company via breadcrumb", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Click on company breadcrumb
    await page.getByTestId("breadcrumb-company").click()

    // Should navigate to company details
    await expect(page).toHaveURL(`/organizations/${testOrgId}/companies/${testCompanyId}`)
  })

  test("should navigate back to companies list via breadcrumb", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Click on Companies breadcrumb
    await page.getByTestId("breadcrumb-companies").click()

    // Should navigate to companies list
    await expect(page).toHaveURL(`/organizations/${testOrgId}/companies`)
  })

  test("should show create button in header when accounts exist", async ({ page, request }) => {
    // Ensure we have at least one account
    const authResponse = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    expect(authResponse.ok()).toBe(true)
    const { token } = await authResponse.json()

    // Create an account
    const headerAccountNumber = `${1000 + Math.floor(Math.random() * 900)}`
    await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: headerAccountNumber,
        name: `Header Button Test ${Date.now()}`,
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

    // Visit accounts page
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should show create button in header
    await expect(page.getByTestId("accounts-create-button")).toBeVisible()
  })

  test("should expand and collapse all accounts", async ({ page, request }) => {
    // Login to get token
    const authResponse = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: {
        provider: "local",
        credentials: { email: testUser.email, password: testUser.password }
      }
    })
    expect(authResponse.ok()).toBe(true)
    const { token } = await authResponse.json()

    // Create parent account (summary) - 4-digit numeric
    const baseNum2 = Math.floor(Math.random() * 800) + 100 // 100-899
    const parentAccountNumber = `1${baseNum2}`  // e.g., "1234"
    const parentAccountName = `Expand All Parent ${Date.now()}`
    const createParentResponse = await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: parentAccountNumber,
        name: parentAccountName,
        description: null,
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
    expect(createParentResponse.ok()).toBe(true)
    const parentAccount = await createParentResponse.json()

    // Create child account - 4-digit numeric
    const childAccountNumber = `1${baseNum2 + 1}` // e.g., "1235" - child in Asset range
    const childAccountName = `Expand All Child ${Date.now()}`
    const createChildResponse = await request.post("/api/v1/accounts", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        companyId: testCompanyId,
        accountNumber: childAccountNumber,
        name: childAccountName,
        description: null,
        accountType: "Asset",
        accountCategory: "CurrentAsset",
        normalBalance: "Debit",
        parentAccountId: parentAccount.id,
        isPostable: true,
        isCashFlowRelevant: false,
        cashFlowCategory: null,
        isIntercompany: false,
        intercompanyPartnerId: null,
        currencyRestriction: null
      }
    })
    expect(createChildResponse.ok()).toBe(true)
    const childAccount = await createChildResponse.json()

    // Visit accounts page
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}/accounts`)

    // Should show expand/collapse all buttons
    await expect(page.getByTestId("expand-all")).toBeVisible()
    await expect(page.getByTestId("collapse-all")).toBeVisible()

    // Click collapse all
    await page.getByTestId("collapse-all").click()

    // Child should not be visible
    await expect(page.getByTestId(`account-row-${childAccount.id}`)).not.toBeVisible()

    // Click expand all
    await page.getByTestId("expand-all").click()

    // Child should be visible
    await expect(page.getByTestId(`account-row-${childAccount.id}`)).toBeVisible()
  })
})
