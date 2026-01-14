/**
 * Organizations E2E Tests
 *
 * Tests the organizations list page functionality:
 * - List displays organizations
 * - Create organization via UI works
 * - Navigate to organization details
 * - Empty state for new users
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
    email: `test-org-${timestamp}-${random}@example.com`,
    password: `SecureP@ss${timestamp}!`,
    displayName: `Org Test ${random}`
  }
}

test.describe("Organizations List Page", () => {
  let testUser: TestUser

  test.beforeAll(async ({ request }) => {
    // Create a test user via API before running tests
    testUser = generateTestCredentials()

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

  test("should display organizations page when authenticated", async ({ page }) => {
    await page.goto("/organizations")

    // Should be on the organizations page
    await expect(page).toHaveURL("/organizations")

    // Page should have the correct heading (use exact match to avoid matching "No organizations yet")
    await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible()

    // Should show organizations page container
    await expect(page.getByTestId("organizations-page")).toBeVisible()
  })

  test("should show empty state for new user with no organizations", async ({ page }) => {
    await page.goto("/organizations")

    // Should show empty state
    await expect(page.getByTestId("organizations-empty")).toBeVisible()

    // Empty state should have call-to-action text
    await expect(page.getByRole("heading", { name: "No organizations yet" })).toBeVisible()
    // Check for the specific button that contains "Create your first organization" text
    await expect(page.getByTestId("organizations-empty-create")).toBeVisible()
    await expect(page.getByTestId("organizations-empty-create")).toContainText("Create your first organization")

    // Should have create button in empty state
    await expect(page.getByTestId("organizations-empty-create")).toBeVisible()
  })

  test("should open create organization modal from empty state", async ({ page }) => {
    await page.goto("/organizations")

    // Click the create button in empty state
    await page.getByTestId("organizations-empty-create").click()

    // Modal should appear
    await expect(page.getByTestId("create-organization-modal")).toBeVisible()

    // Modal should have title (use role to get the h2 specifically)
    await expect(page.getByRole("heading", { name: "Create Organization" })).toBeVisible()

    // Modal should have form inputs
    await expect(page.getByTestId("organization-name-input")).toBeVisible()
    await expect(page.getByTestId("organization-currency-select")).toBeVisible()

    // Modal should have buttons
    await expect(page.getByTestId("create-organization-cancel")).toBeVisible()
    await expect(page.getByTestId("create-organization-submit")).toBeVisible()
  })

  test("should close create modal when clicking cancel", async ({ page }) => {
    await page.goto("/organizations")

    // Open the modal
    await page.getByTestId("organizations-empty-create").click()
    await expect(page.getByTestId("create-organization-modal")).toBeVisible()

    // Click cancel
    await page.getByTestId("create-organization-cancel").click()

    // Modal should close
    await expect(page.getByTestId("create-organization-modal")).not.toBeVisible()
  })

  test("should close create modal when pressing Escape", async ({ page }) => {
    await page.goto("/organizations")

    // Open the modal
    await page.getByTestId("organizations-empty-create").click()
    await expect(page.getByTestId("create-organization-modal")).toBeVisible()

    // Press Escape
    await page.keyboard.press("Escape")

    // Modal should close
    await expect(page.getByTestId("create-organization-modal")).not.toBeVisible()
  })

  test("should show validation error for empty organization name", async ({ page }) => {
    await page.goto("/organizations")

    // Open the modal
    await page.getByTestId("organizations-empty-create").click()
    await expect(page.getByTestId("create-organization-modal")).toBeVisible()

    // Submit without filling name
    await page.getByTestId("create-organization-submit").click()

    // Should show error
    await expect(page.getByTestId("create-organization-error")).toBeVisible()
    await expect(page.getByTestId("create-organization-error")).toContainText("required")
  })

  test("should create organization successfully", async ({ page }) => {
    const orgName = `Test Org ${Date.now()}`

    await page.goto("/organizations")

    // Open the modal
    await page.getByTestId("organizations-empty-create").click()
    await expect(page.getByTestId("create-organization-modal")).toBeVisible()

    // Fill in the form
    await page.getByTestId("organization-name-input").fill(orgName)
    await page.getByTestId("organization-currency-select").selectOption("USD")

    // Submit
    await page.getByTestId("create-organization-submit").click()

    // Wait for API call to complete and modal to close (increased timeout)
    await expect(page.getByTestId("create-organization-modal")).not.toBeVisible({ timeout: 10000 })

    // Organization should appear in the list
    await expect(page.getByTestId("organizations-list")).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(orgName)).toBeVisible()
  })

  test("should display organization card with correct information", async ({ page, request }) => {
    const orgName = `Card Test Org ${Date.now()}`

    // Create organization via API first
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

    const createResponse = await request.post("/api/v1/organizations", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        name: orgName,
        reportingCurrency: "EUR",
        settings: null
      }
    })
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create organization: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)
    const org = await createResponse.json()

    // Visit organizations page
    await page.goto("/organizations")

    // Organization card should be visible
    const card = page.getByTestId(`organization-card-${org.id}`)
    await expect(card).toBeVisible()

    // Card should show name (scoped testID)
    await expect(page.getByTestId(`organization-name-${org.id}`)).toContainText(orgName)

    // Card should show currency (scoped testID)
    await expect(page.getByTestId(`organization-currency-${org.id}`)).toContainText("EUR")

    // Card should show company count badge (scoped to this card)
    await expect(card.getByTestId("organization-company-count")).toBeVisible()
  })

  test("should navigate to organization details when clicking card", async ({ page, request }) => {
    const orgName = `Navigate Test Org ${Date.now()}`

    // Create organization via API first
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

    const createResponse = await request.post("/api/v1/organizations", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        name: orgName,
        reportingCurrency: "USD",
        settings: null
      }
    })
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create organization: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)
    const org = await createResponse.json()

    // Visit organizations page
    await page.goto("/organizations")

    // Click the organization card
    const card = page.getByTestId(`organization-card-${org.id}`)
    await expect(card).toBeVisible()
    await card.click()

    // Should navigate to organization details
    await expect(page).toHaveURL(`/organizations/${org.id}`)
  })

  test("should show create button in header when organizations exist", async ({ page, request }) => {
    const orgName = `Header Button Test ${Date.now()}`

    // Create organization via API first
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

    const createResponse = await request.post("/api/v1/organizations", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        name: orgName,
        reportingCurrency: "USD",
        settings: null
      }
    })
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create organization: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)

    // Visit organizations page
    await page.goto("/organizations")

    // Should show create button in header
    await expect(page.getByTestId("organizations-create-button")).toBeVisible()
  })

  test("should create organization from header button", async ({ page, request }) => {
    // First, create an org so the header button shows
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

    const createResponse = await request.post("/api/v1/organizations", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      data: {
        name: `Initial Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    if (!createResponse.ok()) {
      const errorText = await createResponse.text()
      console.error(`Failed to create organization: ${createResponse.status()} - ${errorText}`)
    }
    expect(createResponse.ok()).toBe(true)

    // Visit organizations page
    await page.goto("/organizations")

    // Wait for organizations list to load and show create button
    await expect(page.getByTestId("organizations-list")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("organizations-create-button")).toBeVisible()

    // Click header create button
    await page.getByTestId("organizations-create-button").click()

    // Modal should open
    await expect(page.getByTestId("create-organization-modal")).toBeVisible()

    // Create another organization
    const newOrgName = `New Org ${Date.now()}`
    await page.getByTestId("organization-name-input").fill(newOrgName)
    await page.getByTestId("create-organization-submit").click()

    // Modal should close (with timeout for API call)
    await expect(page.getByTestId("create-organization-modal")).not.toBeVisible({ timeout: 10000 })

    // New organization should appear
    await expect(page.getByText(newOrgName)).toBeVisible()
  })

  test("should require authentication to access organizations page", async ({ page }) => {
    // Clear the auth token
    await page.evaluate((key) => {
      localStorage.removeItem(key)
    }, AUTH_TOKEN_KEY)

    // Try to access organizations page
    await page.goto("/organizations")

    // Should be redirected to login
    await page.waitForURL(/\/login/)
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
  })

  test("should create organization with EUR currency", async ({ page }) => {
    const orgName = `EUR Org ${Date.now()}`

    await page.goto("/organizations")

    // Open the modal - either from empty state or header button depending on existing data
    const emptyCreateBtn = page.getByTestId("organizations-empty-create")
    const headerCreateBtn = page.getByTestId("organizations-create-button")

    // Wait for page to load, then click whichever button is visible
    await page.waitForLoadState("networkidle")
    if (await emptyCreateBtn.isVisible()) {
      await emptyCreateBtn.click()
    } else {
      await headerCreateBtn.click()
    }

    // Fill in the form with EUR currency
    await page.getByTestId("organization-name-input").fill(orgName)
    await page.getByTestId("organization-currency-select").selectOption("EUR")

    // Submit
    await page.getByTestId("create-organization-submit").click()

    // Wait for modal to close and list to appear
    await expect(page.getByTestId("create-organization-modal")).not.toBeVisible()
    await expect(page.getByTestId("organizations-list")).toBeVisible()

    // Organization should appear with the name
    await expect(page.getByText(orgName)).toBeVisible()

    // Since the testIDs are now scoped by org.id, find the card that contains the org name
    // and check its currency text inside
    const card = page.locator('[data-testid^="organization-card-"]').filter({ hasText: orgName })
    await expect(card.locator('p[data-testid^="organization-currency-"]')).toContainText("EUR")
  })
})
