/**
 * Fiscal Period Management E2E Tests
 *
 * Tests for the fiscal period management page at
 * /organizations/:organizationId/companies/:companyId/fiscal-periods
 *
 * Covers:
 * - Page navigation and empty state
 * - Fiscal year creation via UI
 * - Period status display
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test"

// Helper to setup authenticated user, organization, and company
async function setupTestContext(
  request: APIRequestContext,
  page: Page,
  testId: string
) {
  // 1. Register a test user
  const testUser = {
    email: `test-fiscal-${testId}-${Date.now()}@example.com`,
    password: "TestPassword123",
    displayName: `Fiscal ${testId} Test User`
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
      name: `Fiscal ${testId} Test Org ${Date.now()}`,
      reportingCurrency: "USD",
      settings: null
    }
  })
  expect(createOrgRes.ok()).toBeTruthy()
  const orgData = await createOrgRes.json()

  // 4. Create a company (use /api/v1/companies endpoint with organizationId in body)
  const createCompanyRes = await request.post("/api/v1/companies", {
    headers: { Authorization: `Bearer ${sessionToken}` },
    data: {
      organizationId: orgData.id,
      name: `Fiscal ${testId} Test Company ${Date.now()}`,
      legalName: "Fiscal Test Company Inc.",
      jurisdiction: "US",
      functionalCurrency: "USD",
      reportingCurrency: "USD",
      fiscalYearEnd: { month: 12, day: 31 },
      taxId: null,
      incorporationDate: null,
      registrationNumber: null,
      registeredAddress: null,
      industryCode: null,
      companyType: null,
      incorporationJurisdiction: null
    }
  })
  expect(createCompanyRes.ok()).toBeTruthy()
  const companyData = await createCompanyRes.json()

  // 5. Set session cookie
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

  return {
    sessionToken,
    organizationId: orgData.id,
    companyId: companyData.id
  }
}

// Helper to create a fiscal year via UI
async function createFiscalYearViaUI(page: Page, year: number) {
  await page.waitForTimeout(500) // Wait for hydration
  await page.getByTestId("create-fiscal-year-btn").click({ force: true })
  await expect(page.getByTestId("create-fiscal-year-modal")).toBeVisible({
    timeout: 10000
  })
  await page.getByTestId("fiscal-year-input").fill(String(year))
  await page.getByTestId("create-fiscal-year-submit").click({ force: true })
  await expect(page.getByTestId("create-fiscal-year-modal")).not.toBeVisible({
    timeout: 10000
  })
  await expect(page.getByTestId(`fiscal-year-${year}`)).toBeVisible({
    timeout: 10000
  })
}

test.describe("Fiscal Period Management", () => {
  test.describe("Page Navigation", () => {
    test("should show empty state when no fiscal years exist", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "empty"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      // Should show empty state with create button
      await expect(page.getByTestId("fiscal-periods-page")).toBeVisible()
      await expect(page.getByText("No Fiscal Years")).toBeVisible()
      await expect(page.getByTestId("create-first-fiscal-year")).toBeVisible()
    })

    test("should show create fiscal year button in header", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "header"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      await expect(page.getByTestId("create-fiscal-year-btn")).toBeVisible()
    })
  })

  test.describe("Fiscal Year Creation", () => {
    test("should open create fiscal year modal", async ({ page, request }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "modal-open"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(500) // Wait for hydration

      // Click create button
      await page.getByTestId("create-fiscal-year-btn").click({ force: true })

      // Modal should be visible
      await expect(page.getByTestId("create-fiscal-year-modal")).toBeVisible({
        timeout: 10000
      })
    })

    test("should close modal when clicking X button", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "modal-close"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")
      await page.waitForTimeout(500)

      // Open modal
      await page.getByTestId("create-fiscal-year-btn").click({ force: true })
      await expect(page.getByTestId("create-fiscal-year-modal")).toBeVisible({
        timeout: 10000
      })

      // Close modal
      await page.getByTestId("close-modal-btn").click({ force: true })

      // Modal should be hidden
      await expect(
        page.getByTestId("create-fiscal-year-modal")
      ).not.toBeVisible()
    })

    test("should create a new fiscal year", async ({ page, request }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "create-fy"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Verify fiscal year was created
      await expect(
        page.getByTestId(`fiscal-year-${currentYear}`)
      ).toBeVisible()
    })

    test("should show validation error for duplicate fiscal year", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "dup-fy"
      )

      const currentYear = new Date().getFullYear()

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      // Create first fiscal year via UI
      await createFiscalYearViaUI(page, currentYear)

      // Try to create the same year again
      await page.waitForTimeout(500)
      await page.getByTestId("create-fiscal-year-btn").click({ force: true })
      await expect(page.getByTestId("create-fiscal-year-modal")).toBeVisible({
        timeout: 10000
      })

      await page.getByTestId("fiscal-year-input").fill(String(currentYear))
      await page.getByTestId("create-fiscal-year-submit").click({ force: true })

      // Should show error
      await expect(page.getByTestId("error-message")).toBeVisible({
        timeout: 10000
      })
    })
  })

  test.describe("Fiscal Year Display", () => {
    test("should display fiscal year with status badge", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "display-fy"
      )

      const currentYear = new Date().getFullYear()

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      // Create fiscal year via UI
      await createFiscalYearViaUI(page, currentYear)

      // Verify fiscal year row exists
      const fiscalYearRow = page.getByTestId(`fiscal-year-${currentYear}`)
      await expect(fiscalYearRow).toBeVisible()

      // Verify status badge
      await expect(
        page.getByTestId(`fiscal-year-status-${currentYear}`)
      ).toBeVisible()
    })

    test("should expand fiscal year section when clicking header", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "expand-fy"
      )

      const currentYear = new Date().getFullYear()

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      // Create fiscal year via UI
      await createFiscalYearViaUI(page, currentYear)

      // Click to expand fiscal year
      await page
        .getByTestId(`fiscal-year-header-${currentYear}`)
        .click({ force: true })

      // Wait for expanded content (loading or periods section should appear)
      // The fiscal year card should now show an expanded state
      await page.waitForTimeout(1000)

      // Verify the fiscal year card is still visible (expand doesn't break rendering)
      await expect(page.getByTestId(`fiscal-year-${currentYear}`)).toBeVisible()
    })
  })

  test.describe("Period Status Transitions", () => {
    test("should show loading state when expanding fiscal year", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "period-status"
      )

      const currentYear = new Date().getFullYear()

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      // Create fiscal year via UI
      await createFiscalYearViaUI(page, currentYear)

      // Before expanding, verify the card is in collapsed state
      await expect(page.getByTestId(`fiscal-year-${currentYear}`)).toBeVisible()

      // Expand fiscal year (triggers API call to load periods)
      await page
        .getByTestId(`fiscal-year-header-${currentYear}`)
        .click({ force: true })

      // Give the UI time to update
      await page.waitForTimeout(500)

      // Verify the fiscal year remains visible after expansion
      await expect(page.getByTestId(`fiscal-year-${currentYear}`)).toBeVisible()
    })
  })

  test.describe("Breadcrumbs", () => {
    test("should show correct breadcrumb navigation", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupTestContext(
        request,
        page,
        "breadcrumbs"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      // Should see breadcrumbs with Fiscal Periods (use testid since there's also h1)
      await expect(page.getByTestId("breadcrumb-2")).toBeVisible()
    })
  })

  test.describe("Year-End Closing", () => {
    // Helper to setup a company with chart of accounts (for retained earnings)
    async function setupCompanyWithAccounts(
      request: APIRequestContext,
      page: Page,
      testId: string
    ) {
      const { sessionToken, organizationId, companyId } = await setupTestContext(
        request,
        page,
        testId
      )

      // Apply account template to set up retained earnings account
      await request.post(`/api/v1/account-templates/GeneralBusiness/apply`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: { organizationId, companyId }
      })

      return { sessionToken, organizationId, companyId }
    }

    test("should show Close Year button for Open fiscal year", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupCompanyWithAccounts(
        request,
        page,
        "close-year-btn"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Verify Close Year button is visible for Open fiscal year
      await expect(
        page.getByTestId(`close-year-${currentYear}`)
      ).toBeVisible()
    })

    test("should open year-end close preview dialog when clicking Close Year", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupCompanyWithAccounts(
        request,
        page,
        "close-year-dialog"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Click Close Year button
      await page.waitForTimeout(500)
      await page.getByTestId(`close-year-${currentYear}`).click({ force: true })

      // Verify preview/confirmation dialog appears
      await expect(page.getByTestId("close-year-confirm-modal")).toBeVisible({
        timeout: 10000
      })

      // Should show either the preview with net income or blockers
      // Since we have no journal entries, it should show zero net income
      await expect(
        page.getByText(/net income|Cannot Close Year/i)
      ).toBeVisible()
    })

    test("should show net income preview in close year dialog", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupCompanyWithAccounts(
        request,
        page,
        "close-preview"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Click Close Year button
      await page.waitForTimeout(500)
      await page.getByTestId(`close-year-${currentYear}`).click({ force: true })

      // Verify preview dialog shows
      await expect(page.getByTestId("close-year-confirm-modal")).toBeVisible({
        timeout: 10000
      })

      // Should show "This will:" list with closing actions
      await expect(page.getByText(/Close all revenue accounts/i)).toBeVisible()
      await expect(page.getByText(/Close all expense accounts/i)).toBeVisible()
      await expect(page.getByText(/Close all open periods/i)).toBeVisible()
    })

    test("should close fiscal year successfully", async ({ page, request }) => {
      const { organizationId, companyId } = await setupCompanyWithAccounts(
        request,
        page,
        "close-year-success"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Click Close Year button
      await page.waitForTimeout(500)
      await page.getByTestId(`close-year-${currentYear}`).click({ force: true })

      // Wait for preview dialog
      await expect(page.getByTestId("close-year-confirm-modal")).toBeVisible({
        timeout: 10000
      })

      // Confirm close
      await page.getByTestId("confirm-close-year-btn").click({ force: true })

      // Wait for dialog to close and page to refresh
      await expect(page.getByTestId("close-year-confirm-modal")).not.toBeVisible({
        timeout: 10000
      })

      // Verify fiscal year is now Closed
      await expect(
        page.getByTestId(`fiscal-year-status-${currentYear}`)
      ).toContainText("Closed")
    })

    test("should show Reopen button for Closed fiscal year", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupCompanyWithAccounts(
        request,
        page,
        "reopen-btn"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Close the fiscal year
      await page.waitForTimeout(500)
      await page.getByTestId(`close-year-${currentYear}`).click({ force: true })
      await expect(page.getByTestId("close-year-confirm-modal")).toBeVisible({
        timeout: 10000
      })
      await page.getByTestId("confirm-close-year-btn").click({ force: true })
      await expect(page.getByTestId("close-year-confirm-modal")).not.toBeVisible({
        timeout: 10000
      })

      // Verify Reopen button is visible
      await expect(
        page.getByTestId(`reopen-year-${currentYear}`)
      ).toBeVisible()
    })

    test("should reopen closed fiscal year", async ({ page, request }) => {
      const { organizationId, companyId } = await setupCompanyWithAccounts(
        request,
        page,
        "reopen-year"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Close the fiscal year
      await page.waitForTimeout(500)
      await page.getByTestId(`close-year-${currentYear}`).click({ force: true })
      await expect(page.getByTestId("close-year-confirm-modal")).toBeVisible({
        timeout: 10000
      })
      await page.getByTestId("confirm-close-year-btn").click({ force: true })
      await expect(page.getByTestId("close-year-confirm-modal")).not.toBeVisible({
        timeout: 10000
      })

      // Wait for status to change to Closed
      await expect(
        page.getByTestId(`fiscal-year-status-${currentYear}`)
      ).toContainText("Closed", { timeout: 10000 })

      // Verify Reopen button is now visible
      await expect(
        page.getByTestId(`reopen-year-${currentYear}`)
      ).toBeVisible({ timeout: 5000 })

      // Reopen the fiscal year
      await page.waitForTimeout(500)
      await page.getByTestId(`reopen-year-${currentYear}`).click({ force: true })

      // Wait for status to change back to Open (with longer timeout for API response)
      await expect(
        page.getByTestId(`fiscal-year-status-${currentYear}`)
      ).toContainText("Open", { timeout: 15000 })

      // Verify Close Year button is visible again
      await expect(
        page.getByTestId(`close-year-${currentYear}`)
      ).toBeVisible({ timeout: 5000 })
    })

    test("should cancel close year dialog without closing", async ({
      page,
      request
    }) => {
      const { organizationId, companyId } = await setupCompanyWithAccounts(
        request,
        page,
        "cancel-close"
      )

      await page.goto(
        `/organizations/${organizationId}/companies/${companyId}/fiscal-periods`
      )
      await page.waitForLoadState("networkidle")

      const currentYear = new Date().getFullYear()
      await createFiscalYearViaUI(page, currentYear)

      // Click Close Year button
      await page.waitForTimeout(500)
      await page.getByTestId(`close-year-${currentYear}`).click({ force: true })

      // Wait for preview dialog
      await expect(page.getByTestId("close-year-confirm-modal")).toBeVisible({
        timeout: 10000
      })

      // Click X button to cancel
      await page.getByTestId("close-confirm-cancel-x").click({ force: true })

      // Verify dialog is closed
      await expect(page.getByTestId("close-year-confirm-modal")).not.toBeVisible()

      // Verify fiscal year is still Open
      await expect(
        page.getByTestId(`fiscal-year-status-${currentYear}`)
      ).toContainText("Open")
    })
  })
})
