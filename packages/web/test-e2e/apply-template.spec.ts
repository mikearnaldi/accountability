/**
 * Apply Account Template E2E Tests
 *
 * Tests for applying account templates to new companies:
 * - Show 'Apply Template' button on empty accounts page
 * - Template selection modal with list of available templates
 * - Preview of account count per template
 * - Confirmation before applying (warns this creates many accounts)
 * - Apply template via POST /api/v1/account-templates/:type/apply
 * - Show success with count of created accounts
 * - Refresh accounts list after apply
 */

import { test, expect } from "@playwright/test"

test.describe("Apply Account Template", () => {
  test("should show 'Apply Template' button on empty accounts page", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-template-btn-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Template Button Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company (no accounts)
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Template Btn Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Template Btn Test Company ${Date.now()}`,
        legalName: "Template Btn Test Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 6. Should show empty state with Apply Template button
    await expect(page.locator('[data-testid="accounts-empty-state"]')).toBeVisible()
    await expect(page.locator('[data-testid="apply-template-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="create-account-empty-button"]')).toBeVisible()
  })

  test("should open template selection modal with available templates", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-template-modal-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Template Modal Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Template Modal Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Template Modal Test Company ${Date.now()}`,
        legalName: "Template Modal Test Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 6. Wait for page to load
    await expect(page.getByTestId("accounts-page")).toBeVisible()
    const applyTemplateButton = page.locator('[data-testid="apply-template-button"]')
    await expect(applyTemplateButton).toBeVisible()
    await expect(applyTemplateButton).toBeEnabled()

    // Wait for full hydration before clicking
    await page.waitForTimeout(500)

    // 7. Click Apply Template button with force
    await applyTemplateButton.click({ force: true })

    // 8. Should show template selection modal (extended timeout for modal visibility)
    await expect(page.locator('[data-testid="apply-template-modal"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="apply-template-list"]')).toBeVisible()

    // 9. Should show all four template types
    await expect(page.locator('[data-testid="template-card-GeneralBusiness"]')).toBeVisible()
    await expect(page.locator('[data-testid="template-card-Manufacturing"]')).toBeVisible()
    await expect(page.locator('[data-testid="template-card-ServiceBusiness"]')).toBeVisible()
    await expect(page.locator('[data-testid="template-card-HoldingCompany"]')).toBeVisible()

    // 9. Should show account counts for each template
    await expect(page.locator('[data-testid="template-count-GeneralBusiness"]')).toContainText("accounts")
    await expect(page.locator('[data-testid="template-count-Manufacturing"]')).toContainText("accounts")
    await expect(page.locator('[data-testid="template-count-ServiceBusiness"]')).toContainText("accounts")
    await expect(page.locator('[data-testid="template-count-HoldingCompany"]')).toContainText("accounts")
  })

  test("should show confirmation before applying template", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-template-confirm-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Template Confirm Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Template Confirm Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Template Confirm Test Company ${Date.now()}`,
        legalName: "Template Confirm Test Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("accounts-page")).toBeVisible()

    // Wait for apply template button to be visible and enabled
    const applyTemplateButton = page.locator('[data-testid="apply-template-button"]')
    await expect(applyTemplateButton).toBeVisible()
    await expect(applyTemplateButton).toBeEnabled()
    // Small delay for React hydration
    await page.waitForTimeout(200)

    // 6. Open template modal
    await applyTemplateButton.click()
    await expect(page.locator('[data-testid="apply-template-modal"]')).toBeVisible({ timeout: 15000 })

    // 7. Select a template (General Business)
    await page.locator('[data-testid="template-card-GeneralBusiness"]').click()

    // 8. Should show confirmation view
    await expect(page.locator('[data-testid="apply-template-confirmation"]')).toBeVisible()

    // 9. Should show warning about creating many accounts
    await expect(page.getByText(/This action will create/i)).toBeVisible()
    await expect(page.getByText(/cannot be easily undone/i)).toBeVisible()

    // 10. Should show back and confirm buttons
    await expect(page.locator('[data-testid="apply-template-back-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="apply-template-confirm-button"]')).toBeVisible()

    // 11. Should be able to go back to selection
    await page.locator('[data-testid="apply-template-back-button"]').click()
    await expect(page.locator('[data-testid="apply-template-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="apply-template-confirmation"]')).not.toBeVisible()
  })

  test("should apply template to new company and show created accounts", async ({
    page,
    request
  }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-apply-template-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Apply Template Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Apply Template Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Apply Template Test Company ${Date.now()}`,
        legalName: "Apply Template Test Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 6. Wait for page to be fully hydrated
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()
    await page.waitForTimeout(500)

    // 7. Verify empty state
    await expect(page.locator('[data-testid="accounts-empty-state"]')).toBeVisible()

    // 8. Open template modal (with extended timeout for modal visibility)
    const applyTemplateButton = page.locator('[data-testid="apply-template-button"]')
    await expect(applyTemplateButton).toBeVisible()
    await applyTemplateButton.click({ force: true })
    await expect(page.locator('[data-testid="apply-template-modal"]')).toBeVisible({ timeout: 15000 })

    // 9. Select General Business template
    await page.locator('[data-testid="template-card-GeneralBusiness"]').click()

    // 10. Confirm application
    await expect(page.locator('[data-testid="apply-template-confirmation"]')).toBeVisible()
    await page.locator('[data-testid="apply-template-confirm-button"]').click()

    // 11. Should show success message
    await expect(page.locator('[data-testid="apply-template-success"]')).toBeVisible({
      timeout: 10000
    })
    // Check the success message contains both "Successfully created" and account count
    const successMessage = page.locator('[data-testid="apply-template-success"]')
    await expect(successMessage).toContainText(/Successfully created \d+ accounts/i)

    // 12. After modal closes, should show accounts in tree (data refreshed)
    await expect(page.locator('[data-testid="apply-template-modal"]')).not.toBeVisible({
      timeout: 10000
    })

    // 13. Should show accounts tree instead of empty state
    await expect(page.locator('[data-testid="accounts-empty-state"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="accounts-tree"]')).toBeVisible()

    // 14. Should show account count greater than 0
    const accountCountText = await page.locator('[data-testid="accounts-count"]').textContent()
    expect(accountCountText).toMatch(/\d+ of \d+ accounts/)
    // Extract the total count and verify it's greater than 0
    const match = accountCountText?.match(/of (\d+) accounts/)
    expect(match).not.toBeNull()
    const totalAccounts = parseInt(match?.[1] ?? "0", 10)
    expect(totalAccounts).toBeGreaterThan(0)
  })

  test("should close modal without applying", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-close-modal-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Close Modal Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Close Modal Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Close Modal Test Company ${Date.now()}`,
        legalName: "Close Modal Test Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // Wait for page to fully load (React hydration)
    await expect(page.getByTestId("accounts-page")).toBeVisible()

    // 6. Open template modal - wait for button to be ready
    const applyTemplateButton = page.locator('[data-testid="apply-template-button"]')
    await expect(applyTemplateButton).toBeVisible()
    await expect(applyTemplateButton).toBeEnabled()
    await page.waitForTimeout(200) // Small delay for React hydration
    await applyTemplateButton.click()
    await expect(page.locator('[data-testid="apply-template-modal"]')).toBeVisible({ timeout: 15000 })

    // 7. Close modal using X button
    await page.locator('[data-testid="apply-template-close-button"]').click()

    // 8. Modal should be closed
    await expect(page.locator('[data-testid="apply-template-modal"]')).not.toBeVisible()

    // 9. Should still show empty state (no accounts created)
    await expect(page.locator('[data-testid="accounts-empty-state"]')).toBeVisible()
  })

  test("should apply Service Business template", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-service-template-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Service Template Test User"
    }

    const registerRes = await request.post("/api/auth/register", {
      data: testUser
    })
    expect(registerRes.ok()).toBeTruthy()

    // 2. Login
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

    // 3. Create org and company
    const createOrgRes = await request.post("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        name: `Service Template Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }
    })
    expect(createOrgRes.ok()).toBeTruthy()
    const orgData = await createOrgRes.json()

    const createCompanyRes = await request.post("/api/v1/companies", {
      headers: { Authorization: `Bearer ${sessionToken}` },
      data: {
        organizationId: orgData.id,
        name: `Service Template Company ${Date.now()}`,
        legalName: "Service Template Company Inc.",
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

    // 5. Navigate to accounts page
    await page.goto(
      `/organizations/${orgData.id}/companies/${companyData.id}/accounts`
    )

    // 6. Open template modal and select Service Business
    await page.locator('[data-testid="apply-template-button"]').click()
    // Wait for modal to be visible before clicking template card
    await expect(page.locator('[data-testid="apply-template-modal"]')).toBeVisible({ timeout: 10000 })
    await page.locator('[data-testid="template-card-ServiceBusiness"]').click()

    // 7. Confirm and apply
    await page.locator('[data-testid="apply-template-confirm-button"]').click()

    // 8. Should show success
    await expect(page.locator('[data-testid="apply-template-success"]')).toBeVisible({
      timeout: 10000
    })
    await expect(page.getByText(/Service Business/i)).toBeVisible()

    // 9. Wait for modal to close and verify accounts
    await expect(page.locator('[data-testid="apply-template-modal"]')).not.toBeVisible({
      timeout: 10000
    })
    await expect(page.locator('[data-testid="accounts-tree"]')).toBeVisible()
  })
})
