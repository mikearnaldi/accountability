/**
 * Companies E2E Tests
 *
 * Tests the companies list page functionality:
 * - List displays companies in organization
 * - Create company via UI works
 * - Navigate to company details
 * - Empty state for new organizations
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
    email: `test-company-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Company Test ${random}`
  }
}

test.describe("Companies List Page", () => {
  let testUser: TestUser
  let testOrgId: string
  let testOrgName: string

  test.beforeAll(async ({ request }) => {
    // Create a test user via API before running tests
    testUser = generateTestCredentials()
    testOrgName = `Companies Test Org ${Date.now()}`

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
    const createResponse = await request.post("/api/v1/organizations", {
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
    if (!createResponse.ok()) {
      console.error(`Failed to create organization: ${createResponse.status()} - ${await createResponse.text()}`)
    }
    expect(createResponse.ok()).toBe(true)
    const org = await createResponse.json()
    testOrgId = org.id
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

  test("should display companies page when authenticated", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Should be on the companies page
    await expect(page).toHaveURL(`/organizations/${testOrgId}/companies`)

    // Page should have the correct heading (use exact match to avoid "No companies yet" heading)
    await expect(page.getByRole("heading", { name: "Companies", exact: true })).toBeVisible()

    // Should show companies page container
    await expect(page.getByTestId("companies-page")).toBeVisible()
  })

  test("should show empty state for organization with no companies", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Should show empty state
    await expect(page.getByTestId("companies-empty")).toBeVisible()

    // Empty state should have call-to-action text
    await expect(page.getByRole("heading", { name: "No companies yet" })).toBeVisible()
    await expect(page.getByTestId("companies-empty-create")).toBeVisible()
    await expect(page.getByTestId("companies-empty-create")).toContainText("Create your first company")
  })

  test("should have correct breadcrumb navigation", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Should show breadcrumb
    await expect(page.getByTestId("breadcrumb")).toBeVisible()
    await expect(page.getByTestId("breadcrumb-organizations")).toContainText("Organizations")
    await expect(page.getByTestId("breadcrumb-organization")).toBeVisible()
    await expect(page.getByTestId("breadcrumb-current")).toContainText("Companies")
  })

  test("should open create company modal from empty state", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Click the create button in empty state
    await page.getByTestId("companies-empty-create").click()

    // Modal should appear
    await expect(page.getByTestId("create-company-modal")).toBeVisible()

    // Modal should have title
    await expect(page.getByRole("heading", { name: "Create Company" })).toBeVisible()

    // Modal should have form inputs
    await expect(page.getByTestId("company-name-input")).toBeVisible()
    await expect(page.getByTestId("company-legal-name-input")).toBeVisible()
    await expect(page.getByTestId("company-jurisdiction-select")).toBeVisible()
    await expect(page.getByTestId("company-functional-currency-select")).toBeVisible()
    await expect(page.getByTestId("company-reporting-currency-select")).toBeVisible()
    await expect(page.getByTestId("company-fiscal-year-end-select")).toBeVisible()

    // Modal should have buttons
    await expect(page.getByTestId("create-company-cancel")).toBeVisible()
    await expect(page.getByTestId("create-company-submit")).toBeVisible()
  })

  test("should close create modal when clicking cancel", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Open the modal
    await page.getByTestId("companies-empty-create").click()
    await expect(page.getByTestId("create-company-modal")).toBeVisible()

    // Click cancel
    await page.getByTestId("create-company-cancel").click()

    // Modal should close
    await expect(page.getByTestId("create-company-modal")).not.toBeVisible()
  })

  test("should close create modal when pressing Escape", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Open the modal
    await page.getByTestId("companies-empty-create").click()
    await expect(page.getByTestId("create-company-modal")).toBeVisible()

    // Press Escape
    await page.keyboard.press("Escape")

    // Modal should close
    await expect(page.getByTestId("create-company-modal")).not.toBeVisible()
  })

  test("should show validation error for empty company name", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Open the modal
    await page.getByTestId("companies-empty-create").click()
    await expect(page.getByTestId("create-company-modal")).toBeVisible()

    // Submit without filling name
    await page.getByTestId("create-company-submit").click()

    // Should show error
    await expect(page.getByTestId("create-company-error")).toBeVisible()
    await expect(page.getByTestId("create-company-error")).toContainText("required")
  })

  test("should show validation error for empty legal name", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Open the modal
    await page.getByTestId("companies-empty-create").click()
    await expect(page.getByTestId("create-company-modal")).toBeVisible()

    // Fill only company name
    await page.getByTestId("company-name-input").fill("Test Company")

    // Submit without legal name
    await page.getByTestId("create-company-submit").click()

    // Should show error
    await expect(page.getByTestId("create-company-error")).toBeVisible()
    await expect(page.getByTestId("create-company-error")).toContainText("Legal name is required")
  })

  test("should create company successfully", async ({ page }) => {
    const companyName = `Test Company ${Date.now()}`
    const legalName = `${companyName} Inc.`

    await page.goto(`/organizations/${testOrgId}/companies`)

    // Open the modal - either from empty state or header button depending on existing data
    const emptyCreateBtn = page.getByTestId("companies-empty-create")
    const headerCreateBtn = page.getByTestId("companies-create-button")

    await page.waitForLoadState("networkidle")
    if (await emptyCreateBtn.isVisible()) {
      await emptyCreateBtn.click()
    } else {
      await headerCreateBtn.click()
    }
    await expect(page.getByTestId("create-company-modal")).toBeVisible()

    // Fill in the form
    await page.getByTestId("company-name-input").fill(companyName)
    await page.getByTestId("company-legal-name-input").fill(legalName)
    await page.getByTestId("company-jurisdiction-select").selectOption("US")
    await page.getByTestId("company-functional-currency-select").selectOption("USD")
    await page.getByTestId("company-reporting-currency-select").selectOption("USD")

    // Submit
    await page.getByTestId("create-company-submit").click()

    // Wait for API call to complete and modal to close (increased timeout)
    await expect(page.getByTestId("create-company-modal")).not.toBeVisible({ timeout: 15000 })

    // Company should appear in the list - use a more specific selector for the company name element
    await expect(page.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })
    // Find the card that contains this company name (use the h3 title element)
    const card = page.locator('[data-testid^="company-card-"]').filter({
      has: page.locator('h3', { hasText: companyName })
    })
    await expect(card).toBeVisible()
  })

  test("should display company card with correct information", async ({ page, request }) => {
    const companyName = `Card Test Company ${Date.now()}`
    const legalName = `${companyName} Inc.`

    // Create company via API first
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

    const createResponse = await request.post("/api/v1/companies", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        organizationId: testOrgId,
        name: companyName,
        legalName: legalName,
        jurisdiction: "GB",
        taxId: null,
        functionalCurrency: "GBP",
        reportingCurrency: "GBP",
        fiscalYearEnd: { month: 12, day: 31 },
        parentCompanyId: null,
        ownershipPercentage: null,
        consolidationMethod: null
      }
    })
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create company: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)
    const company = await createResponse.json()

    // Visit companies page
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Company card should be visible
    const card = page.getByTestId(`company-card-${company.id}`)
    await expect(card).toBeVisible()

    // Card should show name
    await expect(page.getByTestId(`company-name-${company.id}`)).toContainText(companyName)

    // Card should show legal name
    await expect(page.getByTestId(`company-legal-name-${company.id}`)).toContainText(legalName)

    // Card should show currency
    await expect(page.getByTestId(`company-currency-${company.id}`)).toContainText("GBP")

    // Card should show jurisdiction
    await expect(page.getByTestId(`company-jurisdiction-${company.id}`)).toContainText("GB")

    // Card should show status
    await expect(page.getByTestId(`company-status-${company.id}`)).toContainText("Active")
  })

  test("should navigate to company details when clicking card", async ({ page, request }) => {
    const companyName = `Navigate Test Company ${Date.now()}`
    const legalName = `${companyName} Inc.`

    // Create company via API first
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

    const createResponse = await request.post("/api/v1/companies", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        organizationId: testOrgId,
        name: companyName,
        legalName: legalName,
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
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create company: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)
    const company = await createResponse.json()

    // Visit companies page
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Click the company card
    const card = page.getByTestId(`company-card-${company.id}`)
    await expect(card).toBeVisible()
    await card.click()

    // Should navigate to company details
    await expect(page).toHaveURL(`/organizations/${testOrgId}/companies/${company.id}`)
  })

  test("should show create button in header when companies exist", async ({ page, request }) => {
    const companyName = `Header Button Test ${Date.now()}`
    const legalName = `${companyName} Inc.`

    // Create company via API first
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

    const createResponse = await request.post("/api/v1/companies", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        organizationId: testOrgId,
        name: companyName,
        legalName: legalName,
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
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create company: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)

    // Visit companies page
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Should show create button in header
    await expect(page.getByTestId("companies-create-button")).toBeVisible()
  })

  test("should create company from header button", async ({ page, request }) => {
    // First, create a company so the header button shows
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

    const createResponse = await request.post("/api/v1/companies", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        organizationId: testOrgId,
        name: `Initial Company ${Date.now()}`,
        legalName: `Initial Company Inc.`,
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
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create company: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)

    // Visit companies page
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Wait for companies list to load and show create button
    await expect(page.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("companies-create-button")).toBeVisible()

    // Click header create button
    await page.getByTestId("companies-create-button").click()

    // Modal should open
    await expect(page.getByTestId("create-company-modal")).toBeVisible()

    // Create another company
    const newCompanyName = `New Company ${Date.now()}`
    await page.getByTestId("company-name-input").fill(newCompanyName)
    await page.getByTestId("company-legal-name-input").fill(`${newCompanyName} Inc.`)
    await page.getByTestId("create-company-submit").click()

    // Modal should close (with timeout for API call)
    await expect(page.getByTestId("create-company-modal")).not.toBeVisible({ timeout: 15000 })

    // New company should appear - use specific selector to avoid matching legal name
    const card = page.locator('[data-testid^="company-card-"]').filter({
      has: page.locator('h3', { hasText: newCompanyName })
    })
    await expect(card).toBeVisible()
  })

  test("should require authentication to access companies page", async ({ page }) => {
    // Clear the auth token
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Try to access companies page
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Should be redirected to login
    await page.waitForURL(/\/login/)
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
  })

  test("should navigate back to organization via breadcrumb", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Click on organization breadcrumb
    await page.getByTestId("breadcrumb-organization").click()

    // Should navigate to organization details
    await expect(page).toHaveURL(`/organizations/${testOrgId}`)
  })

  test("should navigate back to organizations list via breadcrumb", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies`)

    // Click on Organizations breadcrumb
    await page.getByTestId("breadcrumb-organizations").click()

    // Should navigate to organizations list
    await expect(page).toHaveURL("/organizations")
  })

  test("should create company with different currency", async ({ page }) => {
    const companyName = `EUR Company ${Date.now()}`
    const legalName = `${companyName} GmbH`

    await page.goto(`/organizations/${testOrgId}/companies`)

    // Open the modal - either from empty state or header button depending on existing data
    const emptyCreateBtn = page.getByTestId("companies-empty-create")
    const headerCreateBtn = page.getByTestId("companies-create-button")

    // Wait for page to load, then click whichever button is visible
    await page.waitForLoadState("networkidle")
    if (await emptyCreateBtn.isVisible()) {
      await emptyCreateBtn.click()
    } else {
      await headerCreateBtn.click()
    }

    // Fill in the form with EUR currency
    await page.getByTestId("company-name-input").fill(companyName)
    await page.getByTestId("company-legal-name-input").fill(legalName)
    await page.getByTestId("company-jurisdiction-select").selectOption("DE")
    await page.getByTestId("company-functional-currency-select").selectOption("EUR")
    await page.getByTestId("company-reporting-currency-select").selectOption("EUR")

    // Submit
    await page.getByTestId("create-company-submit").click()

    // Wait for modal to close and list to appear
    await expect(page.getByTestId("create-company-modal")).not.toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId("companies-list")).toBeVisible()

    // Company should appear with the name - use specific selector for h3 to avoid matching legal name
    const card = page.locator('[data-testid^="company-card-"]').filter({
      has: page.locator('h3', { hasText: companyName })
    })
    await expect(card).toBeVisible()

    // Check currency and jurisdiction on the card
    await expect(card.locator('[data-testid^="company-currency-"]')).toContainText("EUR")
    await expect(card.locator('[data-testid^="company-jurisdiction-"]')).toContainText("DE")
  })
})

// =============================================================================
// Company Details Page Tests
// =============================================================================

test.describe("Company Details Page", () => {
  let testUser: TestUser
  let testOrgId: string
  let testOrgName: string
  let testCompanyId: string
  let testCompanyName: string

  test.beforeAll(async ({ request }) => {
    // Create a test user via API before running tests
    testUser = generateTestCredentials()
    testOrgName = `Company Details Test Org ${Date.now()}`
    testCompanyName = `Test Company ${Date.now()}`

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
        taxId: "12-3456789",
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

  test("should display company details correctly", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Should be on the company details page
    await expect(page).toHaveURL(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Should show the company details page
    await expect(page.getByTestId("company-details-page")).toBeVisible()

    // Should show company name
    await expect(page.getByTestId("company-name")).toContainText(testCompanyName)

    // Should show legal name
    await expect(page.getByTestId("company-legal-name")).toContainText(`${testCompanyName} Inc.`)

    // Should show status
    await expect(page.getByTestId("company-status")).toContainText("Active")

    // Should show company details card
    await expect(page.getByTestId("company-details-card")).toBeVisible()

    // Should show jurisdiction
    await expect(page.getByTestId("company-jurisdiction")).toContainText("US")

    // Should show tax ID
    await expect(page.getByTestId("company-tax-id")).toContainText("12-3456789")

    // Should show functional currency
    await expect(page.getByTestId("company-functional-currency")).toContainText("USD")

    // Should show reporting currency
    await expect(page.getByTestId("company-reporting-currency")).toContainText("USD")

    // Should show fiscal year end
    await expect(page.getByTestId("company-fiscal-year-end")).toContainText("December 31")
  })

  test("should have correct breadcrumb navigation", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Should show breadcrumb
    await expect(page.getByTestId("breadcrumb")).toBeVisible()
    await expect(page.getByTestId("breadcrumb-organizations")).toContainText("Organizations")
    await expect(page.getByTestId("breadcrumb-organization")).toBeVisible()
    await expect(page.getByTestId("breadcrumb-companies")).toContainText("Companies")
    await expect(page.getByTestId("breadcrumb-current")).toContainText(testCompanyName)
  })

  test("should show navigation tabs", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Should show navigation section
    await expect(page.getByTestId("company-navigation")).toBeVisible()

    // Should show all navigation tabs
    await expect(page.getByTestId("nav-accounts")).toBeVisible()
    await expect(page.getByTestId("nav-accounts")).toContainText("Accounts")

    await expect(page.getByTestId("nav-journal-entries")).toBeVisible()
    await expect(page.getByTestId("nav-journal-entries")).toContainText("Journal Entries")

    await expect(page.getByTestId("nav-fiscal-periods")).toBeVisible()
    await expect(page.getByTestId("nav-fiscal-periods")).toContainText("Fiscal Periods")

    await expect(page.getByTestId("nav-reports")).toBeVisible()
    await expect(page.getByTestId("nav-reports")).toContainText("Reports")
  })

  test("should show edit button", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Should show edit button
    await expect(page.getByTestId("company-edit-button")).toBeVisible()
    await expect(page.getByTestId("company-edit-button")).toContainText("Edit")
  })

  test("should open edit modal when clicking edit button", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Click edit button
    await page.getByTestId("company-edit-button").click()

    // Modal should appear
    await expect(page.getByTestId("edit-company-modal")).toBeVisible()

    // Modal should have title
    await expect(page.getByRole("heading", { name: "Edit Company Settings" })).toBeVisible()

    // Modal should have form inputs pre-filled
    await expect(page.getByTestId("edit-company-name-input")).toHaveValue(testCompanyName)
    await expect(page.getByTestId("edit-company-legal-name-input")).toHaveValue(`${testCompanyName} Inc.`)
    await expect(page.getByTestId("edit-company-tax-id-input")).toHaveValue("12-3456789")
  })

  test("should close edit modal when clicking cancel", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Open the modal
    await page.getByTestId("company-edit-button").click()
    await expect(page.getByTestId("edit-company-modal")).toBeVisible()

    // Click cancel
    await page.getByTestId("edit-company-cancel").click()

    // Modal should close
    await expect(page.getByTestId("edit-company-modal")).not.toBeVisible()
  })

  test("should close edit modal when pressing Escape", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Open the modal
    await page.getByTestId("company-edit-button").click()
    await expect(page.getByTestId("edit-company-modal")).toBeVisible()

    // Press Escape
    await page.keyboard.press("Escape")

    // Modal should close
    await expect(page.getByTestId("edit-company-modal")).not.toBeVisible()
  })

  test("should update company name successfully", async ({ page }) => {
    const updatedName = `Updated Company ${Date.now()}`

    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Open the modal
    await page.getByTestId("company-edit-button").click()
    await expect(page.getByTestId("edit-company-modal")).toBeVisible()

    // Update the name
    await page.getByTestId("edit-company-name-input").clear()
    await page.getByTestId("edit-company-name-input").fill(updatedName)

    // Submit
    await page.getByTestId("edit-company-submit").click()

    // Modal should close
    await expect(page.getByTestId("edit-company-modal")).not.toBeVisible({ timeout: 15000 })

    // Company name should be updated on the page
    await expect(page.getByTestId("company-name")).toContainText(updatedName)
  })

  test("should show validation error for empty name", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Open the modal
    await page.getByTestId("company-edit-button").click()
    await expect(page.getByTestId("edit-company-modal")).toBeVisible()

    // Clear the name
    await page.getByTestId("edit-company-name-input").clear()

    // Submit
    await page.getByTestId("edit-company-submit").click()

    // Should show error
    await expect(page.getByTestId("edit-company-error")).toBeVisible()
    await expect(page.getByTestId("edit-company-error")).toContainText("required")
  })

  test("should navigate to companies list via breadcrumb", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Click on Companies breadcrumb
    await page.getByTestId("breadcrumb-companies").click()

    // Should navigate to companies list
    await expect(page).toHaveURL(`/organizations/${testOrgId}/companies`)
  })

  test("should navigate to organization via breadcrumb", async ({ page }) => {
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Click on organization breadcrumb
    await page.getByTestId("breadcrumb-organization").click()

    // Should navigate to organization details
    await expect(page).toHaveURL(`/organizations/${testOrgId}`)
  })

  test("should require authentication to access company details page", async ({ page }) => {
    // Clear the auth token
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Try to access company details page
    await page.goto(`/organizations/${testOrgId}/companies/${testCompanyId}`)

    // Should be redirected to login
    await page.waitForURL(/\/login/)
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
  })
})
