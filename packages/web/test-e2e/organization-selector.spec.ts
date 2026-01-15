/**
 * OrganizationSelector E2E Tests
 *
 * Tests for:
 * - Direct navigation to /organizations/new works correctly
 * - OrganizationSelector dropdown on /organizations page
 * - "Create New Organization" link navigates to /organizations/new
 * - "View All Organizations" link navigates to /organizations
 */

import { test, expect } from "@playwright/test"

import type { Page, APIRequestContext } from "@playwright/test"

/**
 * Helper to setup authenticated user with an organization
 */
async function setupUserWithOrganization(
  page: Page,
  request: APIRequestContext
): Promise<{ token: string; organizationId: string; organizationName: string }> {
  // Register user
  const testUser = {
    email: `test-org-selector-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: "TestPassword123",
    displayName: "OrgSelector Test User"
  }

  await request.post("/api/auth/register", { data: testUser })

  // Login to get session
  const loginRes = await request.post("/api/auth/login", {
    data: {
      provider: "local",
      credentials: {
        email: testUser.email,
        password: testUser.password
      }
    }
  })

  const loginData = await loginRes.json()
  const token = loginData.token

  // Set session cookie
  await page.context().addCookies([
    {
      name: "accountability_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax"
    }
  ])

  // Create an organization
  const orgName = `Test Org ${Date.now()}`
  const orgRes = await request.post("/api/v1/organizations", {
    headers: {
      Authorization: `Bearer ${token}`
    },
    data: {
      name: orgName,
      reportingCurrency: "USD",
      settings: null
    }
  })

  if (!orgRes.ok()) {
    const errorText = await orgRes.text()
    throw new Error(`Failed to create organization: ${orgRes.status()} - ${errorText}`)
  }

  const orgData = await orgRes.json()

  if (!orgData.id) {
    throw new Error(`Organization response missing id: ${JSON.stringify(orgData)}`)
  }

  return { token, organizationId: orgData.id, organizationName: orgName }
}

test.describe("Create Organization Route", () => {
  test("should directly navigate to /organizations/new without routing conflict", async ({
    page,
    request
  }) => {
    // Setup authenticated user
    await setupUserWithOrganization(page, request)

    // Navigate directly to /organizations/new
    await page.goto("/organizations/new")

    // Wait for page to load
    await page.waitForTimeout(500)

    // Verify we're on the create organization page (not redirected elsewhere)
    expect(page.url()).toContain("/organizations/new")

    // Verify the create organization page content is visible
    await expect(page.getByTestId("create-organization-page")).toBeVisible()

    // Verify the form is present
    await expect(page.locator("#org-name")).toBeVisible()
  })

  test("should navigate to /organizations/new via Link from organizations page", async ({
    page,
    request
  }) => {
    // Setup authenticated user with an organization
    await setupUserWithOrganization(page, request)

    // Navigate to organizations page
    await page.goto("/organizations")

    // Wait for page to load
    await page.waitForTimeout(500)

    // Click the "New Organization" button on the organizations page
    await page.getByTestId("new-organization-button").click()

    // Wait for navigation
    await page.waitForURL("/organizations/new", { timeout: 10000 })

    // Verify we're on the create organization page
    await expect(page.getByTestId("create-organization-page")).toBeVisible()
  })
})

test.describe("Organization Selector on Organizations Page", () => {
  let organizationId: string

  test.beforeEach(async ({ page, request }) => {
    const result = await setupUserWithOrganization(page, request)
    organizationId = result.organizationId
  })

  test("should navigate to organization detail when clicking org card", async ({ page }) => {
    // Navigate to organizations page
    await page.goto("/organizations")

    // Wait for page to load
    await page.waitForTimeout(500)

    // Click on the organization card
    await page.getByTestId(`organization-card-${organizationId}`).click()

    // Verify navigation to the organization's dashboard or detail page
    await page.waitForURL(new RegExp(`/organizations/${organizationId}`), {
      timeout: 10000
    })
  })
})
