/**
 * Companies E2E Tests
 *
 * Tests the complete company management flow within organizations:
 * - List companies shows org's companies via UI
 * - Create company via UI form works
 * - Company details page displays correctly
 * - Companies require organization context
 *
 * All tests interact through UI elements only - no direct API calls.
 *
 * @module test-e2e/companies.spec
 */

import { test, expect } from "./fixtures/organizations.ts"

test.describe("Companies Management", () => {
  test.describe("Authentication", () => {
    test("should redirect to login when accessing companies page unauthenticated", async ({
      page
    }) => {
      // Navigate to companies page without auth (using a fake org ID)
      await page.goto("/organizations/00000000-0000-0000-0000-000000000000/companies")

      // Should redirect to login
      await page.waitForURL(/\/login/)

      // The URL should be the login page
      expect(page.url()).toContain("/login")
    })

    test("should redirect to login when accessing company details unauthenticated", async ({
      page
    }) => {
      // Navigate to a specific company details page without auth
      await page.goto("/organizations/00000000-0000-0000-0000-000000000000/companies/00000000-0000-0000-0000-000000000001")

      // Should redirect to login
      await page.waitForURL(/\/login/)
    })
  })

  test.describe("Companies List Page", () => {
    test("should display companies page heading when authenticated", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Should show the page title
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("Companies")
    })

    test("should show empty state when no companies exist", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for the page to load - either empty state or companies list
      await expect(
        authenticatedPage.getByTestId("companies-empty").or(authenticatedPage.getByTestId("companies-list"))
      ).toBeVisible({ timeout: 10000 })

      // If empty state, verify the message
      const emptyState = authenticatedPage.getByTestId("companies-empty")
      if (await emptyState.isVisible()) {
        await expect(emptyState).toContainText("No companies found")
      }
    })

    test("should show create company button", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Should show the New Company button
      const createButton = authenticatedPage.getByTestId("create-company-button")
      await expect(createButton).toBeVisible()
      await expect(createButton).toContainText("New Company")
    })

    test("should show companies list with test company", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for the page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Should show the company in the list
      await expect(authenticatedPage.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })
      // Use first() to avoid strict mode violation since name appears in both title and legal name
      await expect(authenticatedPage.getByText(testCompany.name).first()).toBeVisible()
    })

    test("should display company card with correct information", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for the company card
      const companyCard = authenticatedPage.getByTestId(`company-card-${testCompany.id}`)
      await expect(companyCard).toBeVisible({ timeout: 10000 })

      // Verify company information is displayed
      await expect(companyCard.getByTestId("company-name")).toContainText(testCompany.name)
      await expect(companyCard.getByTestId("company-legal-name")).toContainText(testCompany.legalName)
      await expect(companyCard.getByTestId("company-status")).toContainText("Active")
      await expect(companyCard.getByTestId("company-jurisdiction")).toContainText(testCompany.jurisdiction)
      await expect(companyCard.getByTestId("company-functional-currency")).toContainText(testCompany.functionalCurrency)
    })
  })

  test.describe("Create Company Form", () => {
    test("should show create form when clicking New Company button", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button
      await authenticatedPage.getByTestId("create-company-button").click()

      // Form should be visible
      await expect(authenticatedPage.getByTestId("create-company-form")).toBeVisible()

      // Should show form fields
      await expect(authenticatedPage.getByTestId("company-name-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("legal-name-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("jurisdiction-select")).toBeVisible()
      await expect(authenticatedPage.getByTestId("functional-currency-select")).toBeVisible()
      await expect(authenticatedPage.getByTestId("submit-create-company")).toBeVisible()
      await expect(authenticatedPage.getByTestId("cancel-create-company")).toBeVisible()
    })

    test("should hide create form when clicking Cancel", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-company-button").click()
      await expect(authenticatedPage.getByTestId("create-company-form")).toBeVisible()

      // Click cancel
      await authenticatedPage.getByTestId("cancel-create-company").click()

      // Form should be hidden
      await expect(authenticatedPage.getByTestId("create-company-form")).not.toBeVisible()

      // Create button should be visible again
      await expect(authenticatedPage.getByTestId("create-company-button")).toBeVisible()
    })

    test("should show error when submitting empty company name", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-company-button").click()

      // Fill only legal name, leave company name empty
      await authenticatedPage.getByTestId("legal-name-input").fill("Test Legal Name Inc.")

      // Try to submit with empty company name
      await authenticatedPage.getByTestId("submit-create-company").click()

      // Should show error
      await expect(authenticatedPage.getByTestId("form-error")).toBeVisible()
      await expect(authenticatedPage.getByTestId("form-error")).toContainText("Company name is required")
    })

    test("should show error when submitting empty legal name", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-company-button").click()

      // Fill only company name, leave legal name empty
      await authenticatedPage.getByTestId("company-name-input").fill("Test Company")

      // Try to submit with empty legal name
      await authenticatedPage.getByTestId("submit-create-company").click()

      // Should show error
      await expect(authenticatedPage.getByTestId("form-error")).toBeVisible()
      await expect(authenticatedPage.getByTestId("form-error")).toContainText("Legal name is required")
    })

    test("should create company with valid data", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-company-button").click()

      // Fill in the form with valid data
      const companyName = `E2E Test Company ${Date.now()}`
      const legalName = `${companyName} Inc.`
      await authenticatedPage.getByTestId("company-name-input").fill(companyName)
      await authenticatedPage.getByTestId("legal-name-input").fill(legalName)
      await authenticatedPage.getByTestId("jurisdiction-select").selectOption("US")
      await authenticatedPage.getByTestId("functional-currency-select").selectOption("USD")
      await authenticatedPage.getByTestId("reporting-currency-select").selectOption("USD")

      // Submit the form
      await authenticatedPage.getByTestId("submit-create-company").click()

      // Wait for form to close (indicating success)
      await expect(authenticatedPage.getByTestId("create-company-form")).not.toBeVisible({ timeout: 10000 })

      // Reload the page to ensure fresh data
      await authenticatedPage.reload()

      // Wait for companies list to load
      await expect(authenticatedPage.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })

      // Should show the new company in the list (use first() since name appears in both title and legal name)
      await expect(authenticatedPage.getByText(companyName).first()).toBeVisible({ timeout: 5000 })
    })

    test("should create company with non-USD currencies", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-company-button").click()

      // Fill in the form with EUR currency
      const companyName = `E2E EUR Company ${Date.now()}`
      await authenticatedPage.getByTestId("company-name-input").fill(companyName)
      await authenticatedPage.getByTestId("legal-name-input").fill(`${companyName} GmbH`)
      await authenticatedPage.getByTestId("jurisdiction-select").selectOption("DE")
      await authenticatedPage.getByTestId("functional-currency-select").selectOption("EUR")
      await authenticatedPage.getByTestId("reporting-currency-select").selectOption("EUR")

      // Submit the form
      await authenticatedPage.getByTestId("submit-create-company").click()

      // Wait for form to close (indicating success)
      await expect(authenticatedPage.getByTestId("create-company-form")).not.toBeVisible({ timeout: 10000 })

      // Reload the page to ensure fresh data
      await authenticatedPage.reload()

      // Wait for companies list to load
      await expect(authenticatedPage.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })

      // Should show the new company in the list (use first() since name appears in both title and legal name)
      await expect(authenticatedPage.getByText(companyName).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe("Company Details Page", () => {
    test("should display company details correctly", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      // Navigate directly to company details page
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies/${testCompany.id}`)

      // Wait for the page to load
      await expect(authenticatedPage.getByTestId("company-details-page")).toBeVisible({ timeout: 10000 })

      // Should show company name in heading
      await expect(authenticatedPage.getByTestId("company-name")).toContainText(testCompany.name)

      // Should show legal name
      await expect(authenticatedPage.getByTestId("company-legal-name")).toContainText(testCompany.legalName)

      // Should show status badge
      await expect(authenticatedPage.getByTestId("company-status")).toContainText("Active")

      // Should show company info section
      await expect(authenticatedPage.getByTestId("company-info")).toBeVisible()
      await expect(authenticatedPage.getByTestId("company-jurisdiction")).toContainText(testCompany.jurisdiction)

      // Should show financial settings section
      await expect(authenticatedPage.getByTestId("financial-settings")).toBeVisible()
      await expect(authenticatedPage.getByTestId("company-functional-currency")).toContainText(testCompany.functionalCurrency)
      await expect(authenticatedPage.getByTestId("company-reporting-currency")).toContainText(testCompany.reportingCurrency)
    })

    test("should show breadcrumb navigation on details page", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies/${testCompany.id}`)

      // Wait for details page to load
      await expect(authenticatedPage.getByTestId("company-details-page")).toBeVisible({ timeout: 10000 })

      // Should show breadcrumb with Organizations link
      const breadcrumbOrgLink = authenticatedPage.getByTestId("company-details-page").getByRole("link", { name: "Organizations" })
      await expect(breadcrumbOrgLink).toBeVisible()

      // Should show breadcrumb with Companies link (using specific test-id)
      const breadcrumbCompaniesLink = authenticatedPage.getByTestId("breadcrumb-companies-link")
      await expect(breadcrumbCompaniesLink).toBeVisible()
    })

    test("should navigate to companies list from breadcrumb", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies/${testCompany.id}`)

      // Wait for details page to load
      await expect(authenticatedPage.getByTestId("company-details-page")).toBeVisible({ timeout: 10000 })

      // Click Companies breadcrumb to go back (using specific test-id)
      const breadcrumbCompaniesLink = authenticatedPage.getByTestId("breadcrumb-companies-link")
      await breadcrumbCompaniesLink.click()

      // Should be back on companies list
      await authenticatedPage.waitForURL(/\/organizations\/.*\/companies/)
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("Companies")
    })

    test("should show quick action links", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies/${testCompany.id}`)

      // Wait for details page to load
      await expect(authenticatedPage.getByTestId("company-details-page")).toBeVisible({ timeout: 10000 })

      // Should show quick action links
      await expect(authenticatedPage.getByTestId("view-accounts-link")).toBeVisible()
      await expect(authenticatedPage.getByTestId("new-journal-entry-link")).toBeVisible()
      await expect(authenticatedPage.getByTestId("view-reports-link")).toBeVisible()
      await expect(authenticatedPage.getByTestId("back-to-companies-link")).toBeVisible()
    })

    test("should navigate to chart of accounts from quick actions", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies/${testCompany.id}`)

      // Wait for details page to load
      await expect(authenticatedPage.getByTestId("company-details-page")).toBeVisible({ timeout: 10000 })

      // Click Chart of Accounts link
      await authenticatedPage.getByTestId("view-accounts-link").click()

      // Should navigate to accounts page
      await authenticatedPage.waitForURL(/\/companies\/.*\/accounts/)
    })

    test("should show error for non-existent company", async ({
      authenticatedPage,
      testOrg
    }) => {
      // Navigate to a non-existent company
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies/00000000-0000-0000-0000-000000000000`)

      // Should show error message
      await expect(authenticatedPage.getByTestId("company-error")).toBeVisible({ timeout: 10000 })
      await expect(authenticatedPage.getByTestId("company-error")).toContainText("not found")
    })
  })

  test.describe("Navigation", () => {
    test("should navigate from organization details to companies list", async ({
      authenticatedPage,
      testOrg
    }) => {
      // Start at organization details
      await authenticatedPage.goto(`/organizations/${testOrg.id}`)

      // Wait for organization details page
      await expect(authenticatedPage.getByTestId("organization-details-page")).toBeVisible({ timeout: 10000 })

      // Navigate to companies via URL
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Should show companies list page
      await expect(authenticatedPage.getByTestId("companies-list-page")).toBeVisible({ timeout: 10000 })
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("Companies")
    })

    test("should navigate from companies list to company details via View Details link", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for companies list
      await expect(authenticatedPage.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })

      // Click View Details link on the company card
      await authenticatedPage.getByTestId(`view-company-${testCompany.id}`).click()

      // Should navigate to company details
      await authenticatedPage.waitForURL(/\/organizations\/.*\/companies\/.*/)
      await expect(authenticatedPage.getByTestId("company-details-page")).toBeVisible({ timeout: 10000 })
      await expect(authenticatedPage.getByTestId("company-name")).toContainText(testCompany.name)
    })

    test("should navigate from companies list to chart of accounts via link", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for companies list
      await expect(authenticatedPage.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })

      // Click Chart of Accounts link on the company card
      await authenticatedPage.getByTestId(`view-accounts-${testCompany.id}`).click()

      // Should navigate to accounts page
      await authenticatedPage.waitForURL(/\/companies\/.*\/accounts/)
    })
  })

  test.describe("Organization Context", () => {
    test("should show companies only for the selected organization", async ({
      authenticatedPage,
      testOrg,
      testCompany
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for companies list
      await expect(authenticatedPage.getByTestId("companies-list")).toBeVisible({ timeout: 10000 })

      // Should show the test company (use first() to avoid matching both name and legal name)
      await expect(authenticatedPage.getByText(testCompany.name).first()).toBeVisible()

      // The company should belong to the organization shown in breadcrumbs
      const breadcrumb = authenticatedPage.getByRole("link", { name: testOrg.name })
      await expect(breadcrumb).toBeVisible()
    })

    test("should show organization name in page description", async ({
      authenticatedPage,
      testOrg
    }) => {
      await authenticatedPage.goto(`/organizations/${testOrg.id}/companies`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Should show organization name in the description
      await expect(authenticatedPage.getByText(`Manage companies for ${testOrg.name}`)).toBeVisible()
    })

    test("should show error when accessing companies for invalid organization", async ({
      authenticatedPage
    }) => {
      // Navigate to companies for a non-existent organization
      await authenticatedPage.goto("/organizations/00000000-0000-0000-0000-000000000000/companies")

      // Should show error message
      await expect(authenticatedPage.getByTestId("organization-error")).toBeVisible({ timeout: 10000 })
      await expect(authenticatedPage.getByTestId("organization-error")).toContainText("not found")
    })
  })
})
