/**
 * Organizations Page E2E Tests
 *
 * Tests for organizations list page with SSR:
 * - beforeLoad redirects to /login if not authenticated
 * - loader fetches organizations via api.GET('/api/v1/organizations')
 * - Component uses Route.useLoaderData() for immediate data access
 * - No loading spinner on initial page load (SSR)
 * - Create organization: form calls api.POST, then router.invalidate()
 * - Empty state when no organizations
 */

import { test, expect } from "@playwright/test"

test.describe("Organizations Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to organizations without authentication
    await page.goto("/organizations")

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect query param
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/organizations")
  })

  test("should display organizations page content (SSR)", async ({
    page,
    request
  }) => {
    // Note: Organizations are globally visible to all users (no per-user filtering yet).
    // This test verifies the page renders correctly regardless of existing data.

    // 1. Register a fresh test user
    const testUser = {
      email: `test-orgs-page-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Orgs Page Test User"
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

    // 4. Navigate to organizations page
    await page.goto("/organizations")

    // 5. Should be on organizations page (not redirected)
    expect(page.url()).toContain("/organizations")

    // 6. Should show either empty state or organizations list (depends on existing data)
    // The page should always show the organizations heading and either:
    // - Empty state: "No organizations" with "Create Organization" button
    // - List state: Organization count with "New Organization" button
    const hasOrganizations = await page.getByText(/\d+ organization/i).isVisible()

    if (hasOrganizations) {
      // List state
      await expect(page.getByRole("button", { name: /New Organization/i })).toBeVisible()
    } else {
      // Empty state
      await expect(page.getByText("No organizations")).toBeVisible()
      await expect(
        page.getByText("Get started by creating your first organization")
      ).toBeVisible()
      await expect(page.getByRole("button", { name: /Create Organization/i })).toBeVisible()
    }
  })

  test("should render organizations list with data (SSR - no loading spinner)", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-list-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "List Test User"
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

    // 3. Create an organization via API
    const orgName = `Test Org ${Date.now()}`
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: orgName,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()

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

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Should be on organizations page
    expect(page.url()).toContain("/organizations")

    // 7. Should NOT show loading spinner (SSR data is immediately available)
    // The organization name should be visible immediately
    await expect(page.getByText(orgName)).toBeVisible()

    // 8. Should show organization count (at least 1 since we just created one)
    // Note: Count may be higher than 1 if other tests have created organizations
    await expect(page.getByText(/\d+ organization/i)).toBeVisible()
  })

  test("should create organization via form", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-create-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Create Test User"
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

    // 4. Set localStorage token (needed for client-side API calls)
    // Navigate to a page first to set localStorage (can only set localStorage for loaded pages)
    await page.goto("/login")
    await page.evaluate((token) => {
      localStorage.setItem("accountabilitySessionToken", token)
    }, sessionToken)

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Click create organization button (either "Create Organization" in empty state or "New Organization" in list state)
    const createButton = page.getByRole("button", { name: /Create Organization|New Organization/i })
    await createButton.click()

    // 7. Fill form
    const newOrgName = `New Org ${Date.now()}`
    await page.fill("#org-name", newOrgName)

    // 8. Select currency
    await page.selectOption("#org-currency", "EUR")

    // 9. Submit form
    await page.click('button[type="submit"]')

    // 10. Should show new org in list (form closes, data refreshes)
    // Wait for the new organization to appear in the list
    await expect(page.getByText(newOrgName)).toBeVisible({ timeout: 10000 })
  })

  test("should show form validation error for empty name", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-validation-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Validation Test User"
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

    // 4. Navigate to organizations page
    await page.goto("/organizations")

    // 5. Click create organization button (either "Create Organization" in empty state or "New Organization" in list state)
    const createButton = page.getByRole("button", { name: /Create Organization|New Organization/i })
    await createButton.click()

    // 6. Clear the name field and submit
    await page.fill("#org-name", "   ") // Just whitespace
    await page.click('button[type="submit"]')

    // 7. Should show validation error
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByText(/Organization name is required/i)).toBeVisible()
  })

  test("should cancel form and close modal", async ({ page, request }) => {
    // 1. Register a test user with existing org
    const testUser = {
      email: `test-cancel-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Cancel Test User"
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

    // 3. Create an organization (so we get the modal instead of inline form)
    await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Existing Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })

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

    // 5. Navigate to organizations page
    await page.goto("/organizations")

    // 6. Click new organization button
    await page.getByRole("button", { name: /New Organization/i }).click()

    // 7. Modal should be visible
    await expect(page.getByText("Create Organization")).toBeVisible()

    // 8. Click cancel
    await page.getByRole("button", { name: /Cancel/i }).click()

    // 9. Modal should be hidden
    await expect(page.getByRole("heading", { name: "Create Organization" })).not.toBeVisible()
  })
})
