/**
 * Exchange Rates E2E Tests
 *
 * Tests for the exchange rates management:
 * - Exchange rate list page (empty state)
 * - Navigation to exchange rates page
 * - Navigation to new exchange rate page from sidebar
 * - New exchange rate page UI
 *
 * Note: Rate creation tests are skipped because the backend has a bug where
 * the ExchangeRate domain entity is missing organizationId but the database
 * requires it (organization_id NOT NULL). This causes SQL errors when trying
 * to insert rates. Once the backend is fixed, these tests should be enabled.
 */

import { test, expect } from "@playwright/test"

test.describe("Exchange Rates", () => {
  test.describe("Exchange Rates List Page", () => {
    test("should redirect to login if not authenticated", async ({ page }) => {
      // Navigate to exchange rates page without authentication
      await page.goto("/organizations/some-org-id/exchange-rates")

      // Should redirect to login with redirect param
      await page.waitForURL(/\/login/)
      const url = new URL(page.url())
      expect(url.pathname).toBe("/login")
    })

    test("should display empty state when no exchange rates", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-rates-empty-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Exchange Rates Empty Test User"
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
          name: `Exchange Rates Empty Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to exchange rates page
      await page.goto(`/organizations/${orgData.id}/exchange-rates`)

      // 6. Should show exchange rates page
      await expect(page.getByTestId("exchange-rates-page")).toBeVisible()

      // 7. Should show empty state
      await expect(page.getByTestId("empty-state")).toBeVisible()
      await expect(page.getByText(/No exchange rates yet/i)).toBeVisible()

      // 8. Should show create button in empty state
      await expect(
        page.getByTestId("empty-state-create-button")
      ).toBeVisible()
    })

    test("should navigate to exchange rates via sidebar", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-rates-sidebar-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Exchange Rates Sidebar Test User"
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
          name: `Exchange Rates Sidebar Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to organization dashboard
      await page.goto(`/organizations/${orgData.id}/dashboard`)

      // 6. Wait for page to load
      await expect(page.getByTestId("app-layout")).toBeVisible()
      await page.waitForTimeout(500)

      // 7. Click on Exchange Rates in sidebar navigation
      await page.getByTestId("nav-exchange-rates").click()

      // 8. Should navigate to exchange rates page
      await page.waitForURL(/\/exchange-rates$/)
      await expect(page.getByTestId("exchange-rates-page")).toBeVisible()
    })
  })

  test.describe("New Exchange Rate Page", () => {
    test("should display new exchange rate form", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-new-rate-form-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "New Rate Form Test User"
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
          name: `New Rate Form Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to new exchange rate page
      await page.goto(`/organizations/${orgData.id}/exchange-rates/new`)

      // 6. Should show new rate page with form
      await expect(page.getByTestId("new-exchange-rate-page")).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("Add Exchange Rate")

      // 7. Verify form fields are present
      await expect(page.getByTestId("form-from-currency")).toBeVisible()
      await expect(page.getByTestId("form-to-currency")).toBeVisible()
      await expect(page.getByTestId("form-rate")).toBeVisible()
      await expect(page.getByTestId("form-effective-date")).toBeVisible()
      await expect(page.getByTestId("form-rate-type")).toBeVisible()

      // 8. Verify buttons are present
      await expect(page.getByTestId("cancel-button")).toBeVisible()
      await expect(page.getByTestId("submit-button")).toBeVisible()
    })

    test("should cancel and return to list", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-cancel-rate-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Cancel Rate Test User"
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
          name: `Cancel Rate Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to new exchange rate page
      await page.goto(`/organizations/${orgData.id}/exchange-rates/new`)

      // 6. Should show new rate page
      await expect(page.getByTestId("new-exchange-rate-page")).toBeVisible()

      // 7. Click cancel button
      await page.getByTestId("cancel-button").click()

      // 8. Should redirect to exchange rates list
      await page.waitForURL(/\/exchange-rates($|\?)/, { timeout: 15000 })
      await expect(page.getByTestId("exchange-rates-page")).toBeVisible()
    })

    test("should use back link to return to list", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-back-link-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Back Link Test User"
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
          name: `Back Link Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to new exchange rate page
      await page.goto(`/organizations/${orgData.id}/exchange-rates/new`)

      // 6. Should show new rate page
      await expect(page.getByTestId("new-exchange-rate-page")).toBeVisible()

      // 7. Click back link
      await page.getByTestId("back-link").click()

      // 8. Should redirect to exchange rates list
      await page.waitForURL(/\/exchange-rates$/)
      await expect(page.getByTestId("exchange-rates-page")).toBeVisible()
    })

    test("should navigate to new rate page from sidebar quick actions", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-rate-nav-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Rate Nav Test User"
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
          name: `Rate Nav Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to organization dashboard
      await page.goto(`/organizations/${orgData.id}/dashboard`)

      // 6. Wait for page to load
      await expect(page.getByTestId("app-layout")).toBeVisible()
      await page.waitForTimeout(500)

      // 7. Click the "+ New" dropdown button
      const newButton = page.getByTestId("quick-action-button")
      await expect(newButton).toBeVisible({ timeout: 10000 })
      await newButton.click({ force: true })

      // 8. Wait for dropdown to appear and click on Exchange Rate
      await expect(page.getByTestId("quick-action-menu")).toBeVisible({ timeout: 5000 })
      await page.getByTestId("quick-action-exchange-rate").click()

      // 9. Should navigate to new exchange rate page
      await page.waitForURL(/\/exchange-rates\/new/)
      await expect(page.getByTestId("new-exchange-rate-page")).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("Add Exchange Rate")
    })
  })

  test.describe("Create Rate Modal", () => {
    test("should open create rate modal from empty state", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-modal-open-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Modal Open Test User"
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
          name: `Modal Open Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to exchange rates page
      await page.goto(`/organizations/${orgData.id}/exchange-rates`)

      // 6. Wait for page to load
      await expect(page.getByTestId("exchange-rates-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 7. Click "Add First Exchange Rate" in empty state
      await page.getByTestId("empty-state-create-button").click({ force: true })

      // 8. Should show create rate modal with form
      await expect(page.getByTestId("create-rate-modal")).toBeVisible({ timeout: 10000 })
      await expect(page.getByText("Add Exchange Rate")).toBeVisible()

      // 9. Verify form fields in modal
      await expect(page.getByTestId("form-from-currency")).toBeVisible()
      await expect(page.getByTestId("form-to-currency")).toBeVisible()
      await expect(page.getByTestId("form-rate")).toBeVisible()
      await expect(page.getByTestId("form-effective-date")).toBeVisible()
      await expect(page.getByTestId("form-rate-type")).toBeVisible()
    })

    test("should close modal on cancel", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-modal-cancel-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Modal Cancel Test User"
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
          name: `Modal Cancel Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to exchange rates page
      await page.goto(`/organizations/${orgData.id}/exchange-rates`)

      // 6. Wait for page to load
      await expect(page.getByTestId("exchange-rates-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 7. Open the modal
      await page.getByTestId("empty-state-create-button").click({ force: true })
      await expect(page.getByTestId("create-rate-modal")).toBeVisible({ timeout: 10000 })

      // 8. Click cancel button (scoped to modal to avoid matching other buttons)
      await page.getByTestId("create-rate-modal").getByRole("button", { name: "Cancel" }).click({ force: true })

      // 9. Modal should close
      await expect(page.getByTestId("create-rate-modal")).not.toBeVisible({ timeout: 5000 })

      // 10. Page should still show empty state
      await expect(page.getByTestId("empty-state")).toBeVisible()
    })

    test("should show client-side validation error for same currencies", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-rate-validation-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Rate Validation Test User"
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
          name: `Rate Validation Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

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

      // 5. Navigate to exchange rates page
      await page.goto(`/organizations/${orgData.id}/exchange-rates`)

      // 6. Wait for page to load
      await expect(page.getByTestId("exchange-rates-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 7. Open the modal
      await page.getByTestId("empty-state-create-button").click({ force: true })
      await expect(page.getByTestId("create-rate-modal")).toBeVisible({ timeout: 10000 })

      // 8. Select same currency for both fields
      await page.getByTestId("form-from-currency").selectOption("USD")
      await page.getByTestId("form-to-currency").selectOption("USD")
      await page.getByTestId("form-rate").fill("1.0000")

      // 9. Submit form
      await page.getByTestId("submit-rate-button").click({ force: true })

      // 10. Should show validation error (client-side)
      await expect(page.getByText("From and To currencies must be different")).toBeVisible({ timeout: 10000 })
    })
  })
})
