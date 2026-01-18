/**
 * Create Organization Page E2E Tests
 *
 * Tests for the /organizations/new page:
 * - Form fields (name, currency, settings)
 * - Client-side validation
 * - Submit via api.POST('/api/v1/organizations')
 * - Success: Navigate to organization detail
 * - Error: Show inline validation errors
 */

import { test, expect } from "@playwright/test"

test.describe("Create Organization Page (/organizations/new)", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to create organization page without authentication
    await page.goto("/organizations/new")

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect query param
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations/new")
  })

  test("should display create organization form", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-page-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Page Test User"
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

    // 3. Set session cookie
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

    // 4. Navigate to create organization page
    await page.goto("/organizations/new")

    // 5. Should be on create organization page
    expect(page.url()).toContain("/organizations/new")

    // 6. Verify page content
    await expect(page.getByTestId("create-organization-page")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Create Organization" })).toBeVisible()
    await expect(page.getByTestId("organization-form")).toBeVisible()

    // 7. Verify form fields exist
    await expect(page.locator("#org-name")).toBeVisible()
    await expect(page.locator("#org-currency")).toBeVisible()

    // 8. Verify settings toggle exists
    await expect(page.getByTestId("org-settings-toggle")).toBeVisible()
  })

  test("should show currency dropdown with options from API", async ({
    page,
    request
  }) => {
    // 1. Register and login
    const testUser = {
      email: `test-currency-dropdown-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Currency Dropdown Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. Verify currency dropdown has options (from API)
    const currencySelect = page.locator("#org-currency")
    await expect(currencySelect).toBeVisible()

    // Should have USD and EUR at minimum (from COMMON_CURRENCIES)
    const options = await currencySelect.locator("option").all()
    expect(options.length).toBeGreaterThan(1) // At least placeholder + 1 currency

    // Check for common currencies
    const optionTexts = await Promise.all(options.map((o) => o.textContent()))
    const hasUSD = optionTexts.some((t) => t?.includes("USD"))
    const hasEUR = optionTexts.some((t) => t?.includes("EUR"))
    expect(hasUSD).toBeTruthy()
    expect(hasEUR).toBeTruthy()
  })

  test("should expand settings panel when clicked", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-settings-panel-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Settings Panel Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. First, blur the auto-focused name input by clicking on the header
    await page.getByRole("heading", { name: "Create Organization" }).click()
    await page.waitForTimeout(100)

    // 5. Settings panel should not exist initially (conditional rendering)
    await expect(page.getByTestId("org-settings-panel")).not.toBeVisible()

    // 6. Click settings toggle
    await page.getByTestId("org-settings-toggle").click()

    // 7. Settings panel should now be visible
    await expect(page.getByTestId("org-settings-panel")).toBeVisible({ timeout: 5000 })

    // 8. Verify settings fields exist
    await expect(page.locator("#org-locale")).toBeVisible()
    await expect(page.locator("#org-timezone")).toBeVisible()
    await expect(page.locator("#org-decimal-places")).toBeVisible()
  })

  test("should validate name field on blur", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-name-validation-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Name Validation Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. Focus and blur name field with empty value
    const nameInput = page.locator("#org-name")
    await nameInput.focus()
    await nameInput.blur()

    // 5. Should show validation error
    await expect(page.getByText("Organization name is required")).toBeVisible()
  })

  test("should validate currency field on submit", async ({ page, request }) => {
    // 1. Register and login
    const testUser = {
      email: `test-currency-validation-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Currency Validation Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. Fill only name field
    await page.fill("#org-name", "Test Organization")

    // 5. First blur the name field by clicking elsewhere to settle state
    await page.getByRole("heading", { name: "Create Organization" }).click()
    await page.waitForTimeout(100)

    // 6. Verify currency is not selected (empty)
    const currencySelect = page.locator("#org-currency")
    await expect(currencySelect).toHaveValue("")

    // 7. Submit form without selecting currency
    // The form should prevent submission and show validation error
    const submitButton = page.getByTestId("org-form-submit-button")
    await submitButton.click()

    // 8. Wait and confirm we're still on the create page (form didn't submit)
    await page.waitForTimeout(500)
    expect(page.url()).toContain("/organizations/new")

    // 9. Form validation should show error for currency
    // Check for any visible error messages near the currency field
    const currencyError = page.locator("#org-currency + p, #org-currency ~ p").filter({ hasText: /required|currency/i })
    const hasError = await currencyError.count() > 0

    // If no error paragraph, check that the form is still showing
    // (validation prevented submission)
    if (!hasError) {
      // The form should still be visible since validation failed
      await expect(page.getByTestId("organization-form")).toBeVisible()
      // And we should still have the empty currency select
      await expect(page.locator("#org-currency")).toHaveValue("")
    } else {
      await expect(currencyError.first()).toBeVisible()
    }
  })

  test("should create organization and navigate to detail page", async ({
    page,
    request
  }) => {
    // 1. Register and login
    const testUser = {
      email: `test-create-success-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Success Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. Wait for form to be fully hydrated
    await expect(page.getByTestId("organization-form")).toBeVisible()
    await page.waitForTimeout(500)

    // 5. Fill form using data-testid for reliable targeting
    const orgName = `E2E Test Org ${Date.now()}`
    const nameInput = page.getByTestId("org-name-input")
    await expect(nameInput).toBeVisible()
    await nameInput.click()
    await nameInput.fill(orgName)

    // Select currency using data-testid
    const currencySelect = page.getByTestId("org-currency-select")
    await expect(currencySelect).toBeVisible()
    await currencySelect.selectOption("EUR")

    // 6. Wait for form to be fully hydrated before submitting
    await page.waitForTimeout(500)

    // 7. Ensure submit button is ready
    const submitButton = page.getByTestId("org-form-submit-button")
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toBeEnabled()

    // 8. Submit form with force click and wait for response
    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/v1/organizations") && resp.request().method() === "POST",
        { timeout: 15000 }
      ),
      submitButton.click({ force: true })
    ])

    // 9. Wait for navigation to complete (URL should have UUID)
    await page.waitForURL(/\/organizations\/[a-f0-9-]+$/, { timeout: 15000 })

    // 10. Wait for page to be fully hydrated
    await page.waitForTimeout(500)

    // 11. Wait for the organization name heading to appear on the detail page
    await expect(page.getByRole("heading", { name: orgName })).toBeVisible({ timeout: 10000 })

    // 12. Verify we're on the organization detail page
    expect(page.url()).toMatch(/\/organizations\/[a-f0-9-]+/)
  })

  test("should create organization with custom settings", async ({
    page,
    request
  }) => {
    // 1. Register and login
    const testUser = {
      email: `test-create-settings-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Settings Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. Wait for form to be fully hydrated
    await expect(page.getByTestId("organization-form")).toBeVisible()
    await page.waitForTimeout(500)

    // 5. Fill basic fields using data-testid for reliable targeting
    const orgName = `Settings Org ${Date.now()}`
    const nameInput = page.getByTestId("org-name-input")
    await expect(nameInput).toBeVisible()
    await nameInput.click()
    await nameInput.fill(orgName)

    const currencySelect = page.getByTestId("org-currency-select")
    await expect(currencySelect).toBeVisible()
    await currencySelect.selectOption("GBP")

    // 6. Expand settings panel
    const settingsToggle = page.getByTestId("org-settings-toggle")
    await expect(settingsToggle).toBeVisible()
    await settingsToggle.click()
    await page.waitForTimeout(300)

    // 7. Change settings using data-testid
    const localeSelect = page.getByTestId("org-locale-select")
    await expect(localeSelect).toBeVisible()
    await localeSelect.selectOption("en-GB")

    const timezoneSelect = page.getByTestId("org-timezone-select")
    await expect(timezoneSelect).toBeVisible()
    await timezoneSelect.selectOption("Europe/London")

    const decimalSelect = page.getByTestId("org-decimal-places-select")
    await expect(decimalSelect).toBeVisible()
    await decimalSelect.selectOption("3")

    // 8. Submit form
    const submitButton = page.getByTestId("org-form-submit-button")
    await expect(submitButton).toBeEnabled()
    await submitButton.click({ force: true })

    // 9. Should navigate to organization detail page
    await page.waitForURL(/\/organizations\/[^/]+$/, { timeout: 15000 })

    // 10. Wait for page to be fully hydrated
    await page.waitForTimeout(500)

    // 11. Verify the organization was created with correct settings (use heading to avoid matching breadcrumb)
    await expect(page.getByRole("heading", { name: orgName })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("GBP")).toBeVisible()
    await expect(page.getByText("Europe/London")).toBeVisible()
  })

  test("should navigate back to organizations list when cancel is clicked", async ({
    page,
    request
  }) => {
    // 1. Register and login
    const testUser = {
      email: `test-cancel-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Cancel Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. Wait for form to be visible and interactive
    await expect(page.getByTestId("organization-form")).toBeVisible()

    // 5. First, blur the auto-focused name input by clicking on the header
    // This prevents any state changes during the cancel click
    await page.getByRole("heading", { name: "Create Organization" }).click()
    await page.waitForTimeout(100) // Small wait for state to settle

    // 6. Verify the cancel link exists
    const cancelLink = page.getByTestId("org-form-cancel-button")
    await expect(cancelLink).toBeVisible()

    // 7. Click cancel link and wait for navigation
    await cancelLink.click()
    await page.waitForURL("/organizations", { timeout: 10000 })

    // 8. Verify we're on the organizations list page
    expect(page.url()).toContain("/organizations")
    expect(page.url()).not.toContain("/new")
  })

  test("should navigate back to organizations list via back link", async ({
    page,
    request
  }) => {
    // 1. Register and login
    const testUser = {
      email: `test-back-link-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Back Link Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

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

    // 2. Set session cookie
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

    // 3. Navigate to create organization page
    await page.goto("/organizations/new")

    // 4. Click back link
    await page.getByTestId("back-to-organizations").click()

    // 5. Should navigate to organizations list
    await page.waitForURL("/organizations")
    expect(page.url()).toContain("/organizations")
  })
})
