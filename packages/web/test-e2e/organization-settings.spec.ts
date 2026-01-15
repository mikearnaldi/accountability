/**
 * Organization Settings Page E2E Tests
 *
 * Tests for organization settings page:
 * - Route: /organizations/:organizationId/settings
 * - Accessible from sidebar Settings link
 * - General Settings section (name, currency, created)
 * - Defaults section (locale, timezone, fiscal year, decimal places)
 * - Save changes functionality
 * - Danger zone: Delete organization with confirmation
 */

import { test, expect } from "@playwright/test"

test.describe("Organization Settings Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // Navigate to settings without authentication
    await page.goto("/organizations/some-org-id/settings")

    // Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toContain("/settings")
  })

  test("should display organization settings page", async ({ page, request }) => {
    // Register a test user
    const testUser = {
      email: `test-settings-display-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Settings Display Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API
    const orgName = `Settings Test Org ${Date.now()}`
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: orgName,
        reportingCurrency: "USD",
        settings: {
          defaultLocale: "en-US",
          defaultTimezone: "UTC",
          useFiscalYear: true,
          defaultDecimalPlaces: 2
        }
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // Set session cookie
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

    // Navigate to organization settings page
    await page.goto(`/organizations/${orgData.id}/settings`)

    // Should be on settings page
    expect(page.url()).toContain(`/organizations/${orgData.id}/settings`)

    // Should show page title
    await expect(page.getByTestId("org-settings-title")).toContainText("Organization Settings")

    // Should show General Settings section
    await expect(page.getByTestId("org-settings-general")).toBeVisible()

    // Should show organization name input
    await expect(page.getByTestId("org-settings-name-input")).toHaveValue(orgName)

    // Should show reporting currency (read-only)
    await expect(page.getByTestId("org-settings-currency")).toContainText("USD")

    // Should show created date
    await expect(page.getByTestId("org-settings-created")).toBeVisible()

    // Should show Defaults section
    await expect(page.getByTestId("org-settings-defaults")).toBeVisible()

    // Should show Danger Zone section
    await expect(page.getByTestId("org-settings-danger-zone")).toBeVisible()
  })

  test("should edit organization name", async ({ page, request }) => {
    // Register a test user
    const testUser = {
      email: `test-edit-name-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Edit Name Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API
    const orgName = `Edit Name Test Org ${Date.now()}`
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: orgName,
        reportingCurrency: "EUR",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // Set session cookie
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

    // Navigate to organization settings page
    await page.goto(`/organizations/${orgData.id}/settings`)

    // Wait for settings page to load
    await expect(page.getByTestId("org-settings-name-input")).toBeVisible()

    // Update organization name
    const newOrgName = `Updated Org Name ${Date.now()}`
    await page.getByTestId("org-settings-name-input").fill(newOrgName)

    // Click save button
    await page.getByTestId("org-settings-save-general").click()

    // Should show success message
    await expect(page.getByTestId("org-settings-success")).toBeVisible()
    await expect(page.getByTestId("org-settings-success")).toContainText("updated")

    // Verify via API that name was updated
    const getOrgRes = await request.get(`/api/v1/organizations/${orgData.id}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(getOrgRes.ok()).toBeTruthy()
    const updatedOrg = await getOrgRes.json()
    expect(updatedOrg.name).toBe(newOrgName)
  })

  test("should update organization defaults", async ({ page, request }) => {
    // Register a test user
    const testUser = {
      email: `test-update-defaults-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Update Defaults Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Defaults Test Org ${Date.now()}`,
        reportingCurrency: "GBP",
        settings: {
          defaultLocale: "en-US",
          defaultTimezone: "UTC",
          useFiscalYear: true,
          defaultDecimalPlaces: 2
        }
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // Set session cookie
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

    // Navigate to organization settings page
    await page.goto(`/organizations/${orgData.id}/settings`)

    // Wait for the settings page to fully load and hydrate
    await expect(page.getByTestId("org-settings-page")).toBeVisible()
    await expect(page.getByTestId("org-settings-defaults")).toBeVisible()

    // Wait for the locale select to be visible and have its initial value
    const localeSelect = page.getByTestId("org-settings-locale-select")
    await expect(localeSelect).toBeVisible()
    // Verify initial value is loaded (ensures React hydration is complete)
    await expect(localeSelect).toHaveValue("en-US")

    // Update locale
    await localeSelect.selectOption("de-DE")
    // Verify the selection was applied
    await expect(localeSelect).toHaveValue("de-DE")

    // Update timezone
    await page.getByTestId("org-settings-timezone-select").selectOption("Europe/Berlin")

    // Toggle fiscal year
    await page.getByTestId("org-settings-fiscal-year-checkbox").uncheck()

    // Update decimal places
    await page.getByTestId("org-settings-decimal-places-select").selectOption("4")

    // Click save defaults button
    await page.getByTestId("org-settings-save-defaults").click()

    // Should show success message
    await expect(page.getByTestId("org-defaults-success")).toBeVisible()

    // Wait for button to be enabled again (save complete)
    await expect(page.getByTestId("org-settings-save-defaults")).toBeEnabled()

    // Wait a moment for the backend to fully persist the data
    await page.waitForTimeout(500)

    // Verify via API that settings were updated
    const getOrgRes = await request.get(`/api/v1/organizations/${orgData.id}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(getOrgRes.ok()).toBeTruthy()
    const updatedOrg = await getOrgRes.json()
    expect(updatedOrg.settings.defaultLocale).toBe("de-DE")
    expect(updatedOrg.settings.defaultTimezone).toBe("Europe/Berlin")
    expect(updatedOrg.settings.useFiscalYear).toBe(false)
    expect(updatedOrg.settings.defaultDecimalPlaces).toBe(4)
  })

  test("should navigate to settings from sidebar", async ({ page, request }) => {
    // Register a test user
    const testUser = {
      email: `test-nav-settings-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Nav Settings Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Nav Settings Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // Set session cookie
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

    // Navigate to organization dashboard (where sidebar is visible)
    await page.goto(`/organizations/${orgData.id}/dashboard`)

    // Click Settings link in sidebar
    await page.getByTestId("nav-org-settings").click()

    // Should be on settings page
    await page.waitForURL(/\/settings/)
    expect(page.url()).toContain(`/organizations/${orgData.id}/settings`)

    // Should show settings page
    await expect(page.getByTestId("org-settings-page")).toBeVisible()
  })

  test("should show validation error for empty name", async ({ page, request }) => {
    // Register a test user
    const testUser = {
      email: `test-validation-name-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Validation Name Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API
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

    // Set session cookie
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

    // Navigate to organization settings page
    await page.goto(`/organizations/${orgData.id}/settings`)

    // Clear organization name
    await page.getByTestId("org-settings-name-input").fill("   ")

    // Click save button
    await page.getByTestId("org-settings-save-general").click()

    // Should show validation error
    await expect(page.getByTestId("org-settings-error")).toBeVisible()
    await expect(page.getByTestId("org-settings-error")).toContainText("required")
  })

  test("should delete organization with confirmation", async ({ page, request }) => {
    // Register a test user
    const testUser = {
      email: `test-delete-org-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Delete Org Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API (no companies, so it can be deleted)
    const orgName = `Delete Test Org ${Date.now()}`
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

    // Set session cookie
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

    // Navigate to organization settings page
    await page.goto(`/organizations/${orgData.id}/settings`)

    // Click delete button in danger zone
    await page.getByTestId("org-settings-delete-button").click()

    // Should show confirmation input
    await expect(page.getByTestId("org-delete-confirm-input")).toBeVisible()

    // Type wrong name - button should be disabled
    await page.getByTestId("org-delete-confirm-input").fill("wrong name")
    await expect(page.getByTestId("org-delete-confirm-button")).toBeDisabled()

    // Type correct organization name
    await page.getByTestId("org-delete-confirm-input").fill(orgName)

    // Delete button should be enabled
    await expect(page.getByTestId("org-delete-confirm-button")).toBeEnabled()

    // Click delete confirmation button
    await page.getByTestId("org-delete-confirm-button").click()

    // Should redirect to organizations list
    await page.waitForURL("/organizations")

    // Verify via API that organization was deleted
    const getOrgRes = await request.get(`/api/v1/organizations/${orgData.id}`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })
    expect(getOrgRes.status()).toBe(404)
  })

  test("should cancel delete confirmation", async ({ page, request }) => {
    // Register a test user
    const testUser = {
      email: `test-cancel-delete-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Cancel Delete Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Cancel Delete Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    // Set session cookie
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

    // Navigate to organization settings page
    await page.goto(`/organizations/${orgData.id}/settings`)

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("org-settings-page")).toBeVisible()
    await expect(page.getByTestId("org-settings-danger-zone")).toBeVisible()

    // Wait for delete button to be visible and enabled
    const deleteButton = page.getByTestId("org-settings-delete-button")
    await expect(deleteButton).toBeVisible()
    await expect(deleteButton).toBeEnabled()

    // Click delete button
    await deleteButton.click()

    // Should show confirmation UI (wait for React state update)
    await expect(page.getByTestId("org-delete-confirm-input")).toBeVisible({ timeout: 10000 })

    // Click cancel button
    await page.getByTestId("org-delete-cancel-button").click()

    // Confirmation UI should be hidden
    await expect(page.getByTestId("org-delete-confirm-input")).not.toBeVisible()

    // Delete button should be visible again
    await expect(page.getByTestId("org-settings-delete-button")).toBeVisible()
  })

  test("should show error when deleting organization with companies", async ({
    page,
    request
  }) => {
    // Register a test user
    const testUser = {
      email: `test-delete-error-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Delete Error Test User"
    }

    const registerRes = await request.post("/api/auth/register", { data: testUser })
    expect(registerRes.ok()).toBeTruthy()

    // Login to get session token
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

    // Create an organization via API
    const orgName = `Delete Error Test Org ${Date.now()}`
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

    // Create a company within the organization (prevents deletion)
    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Test Company ${Date.now()}`,
        legalName: "Test Company Inc.",
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

    // Set session cookie
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

    // Navigate to organization settings page
    await page.goto(`/organizations/${orgData.id}/settings`)

    // Wait for settings page to fully load (React hydration)
    await expect(page.getByTestId("org-settings-page")).toBeVisible()
    await expect(page.getByTestId("org-settings-danger-zone")).toBeVisible()

    // Wait for delete button to be visible and clickable
    const deleteButton = page.getByTestId("org-settings-delete-button")
    await expect(deleteButton).toBeVisible()
    await expect(deleteButton).toBeEnabled()

    // Click delete button
    await deleteButton.click()

    // Wait for delete confirmation UI to appear (increase timeout for React state update)
    await expect(page.getByTestId("org-delete-confirm-input")).toBeVisible({ timeout: 10000 })

    // Type correct organization name
    await page.getByTestId("org-delete-confirm-input").fill(orgName)

    // Click delete confirmation button
    await page.getByTestId("org-delete-confirm-button").click()

    // Should show error message (organizations with companies cannot be deleted)
    await expect(page.getByTestId("org-delete-error")).toBeVisible({ timeout: 10000 })
  })
})
