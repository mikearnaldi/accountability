/**
 * Organizations E2E Tests
 *
 * Tests the complete organization management flow:
 * - List organizations shows user's orgs via UI
 * - Create organization via UI form works
 * - Organization details page displays correctly
 * - Unauthenticated access redirects to login
 *
 * All tests interact through UI elements only - no direct API calls.
 *
 * @module test-e2e/organizations.spec
 */

import { test, expect } from "./fixtures/auth.ts"

test.describe("Organizations Management", () => {
  test.describe("Authentication", () => {
    test("should redirect to login when accessing organizations page unauthenticated", async ({
      page
    }) => {
      // Navigate to organizations page without auth
      await page.goto("/organizations")

      // Should redirect to login with redirect param
      await page.waitForURL(/\/login\?redirect=/)

      // Verify redirect parameter is set
      const url = new URL(page.url())
      expect(url.searchParams.get("redirect")).toBe("/organizations")
    })

    test("should redirect to login when accessing organization details unauthenticated", async ({
      page
    }) => {
      // Navigate to a specific organization details page without auth
      await page.goto("/organizations/some-org-id")

      // Should redirect to login
      await page.waitForURL(/\/login/)
    })
  })

  test.describe("Organizations List Page", () => {
    test("should display organizations page heading when authenticated", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/organizations")

      // Should show the page heading
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Should show the page description
      await expect(authenticatedPage.getByText("Manage your organizations and their settings.")).toBeVisible()
    })

    test("should show empty state when no organizations exist", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/organizations")

      // Wait for the page to load - either empty state or organizations list
      await expect(
        authenticatedPage.getByTestId("organizations-empty").or(authenticatedPage.getByTestId("organizations-list"))
      ).toBeVisible({ timeout: 10000 })

      // If empty state, verify the message
      const emptyState = authenticatedPage.getByTestId("organizations-empty")
      if (await emptyState.isVisible()) {
        await expect(emptyState).toContainText("No organizations found")
      }
    })

    test("should show create organization button", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/organizations")

      // Wait for page to load
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Should show the New Organization button
      const createButton = authenticatedPage.getByTestId("create-organization-button")
      await expect(createButton).toBeVisible()
      await expect(createButton).toContainText("New Organization")
    })

    test("should show organizations list after creating one", async ({
      authenticatedPage
    }) => {
      // First create an organization via the UI
      await authenticatedPage.goto("/organizations")

      // Wait for page to load
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Click create button
      await authenticatedPage.getByTestId("create-organization-button").click()

      // Fill in the form
      const orgName = `Test Org ${Date.now()}`
      await authenticatedPage.getByTestId("org-name-input").fill(orgName)
      await authenticatedPage.getByTestId("reporting-currency-select").selectOption("USD")

      // Submit the form
      await authenticatedPage.getByTestId("submit-create-org").click()

      // Wait for page to reload and show the new organization
      await authenticatedPage.waitForURL("/organizations")

      // Should show the organization in the list
      await expect(authenticatedPage.getByText(orgName)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe("Create Organization Form", () => {
    test("should show create form when clicking New Organization button", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/organizations")

      // Wait for page to load
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Click the create button
      await authenticatedPage.getByTestId("create-organization-button").click()

      // Form should be visible
      await expect(authenticatedPage.getByTestId("create-organization-form")).toBeVisible()

      // Should show form fields
      await expect(authenticatedPage.getByTestId("org-name-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("reporting-currency-select")).toBeVisible()
      await expect(authenticatedPage.getByTestId("submit-create-org")).toBeVisible()
      await expect(authenticatedPage.getByTestId("cancel-create-org")).toBeVisible()
    })

    test("should hide create form when clicking Cancel", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/organizations")

      // Wait for page to load
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-organization-button").click()
      await expect(authenticatedPage.getByTestId("create-organization-form")).toBeVisible()

      // Click cancel
      await authenticatedPage.getByTestId("cancel-create-org").click()

      // Form should be hidden
      await expect(authenticatedPage.getByTestId("create-organization-form")).not.toBeVisible()

      // Create button should be visible again
      await expect(authenticatedPage.getByTestId("create-organization-button")).toBeVisible()
    })

    test("should show error when submitting empty name", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/organizations")

      // Wait for page to load
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-organization-button").click()

      // Try to submit with empty name
      await authenticatedPage.getByTestId("submit-create-org").click()

      // Should show error
      await expect(authenticatedPage.getByTestId("form-error")).toBeVisible()
      await expect(authenticatedPage.getByTestId("form-error")).toContainText("Organization name is required")
    })

    test("should create organization with valid data", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/organizations")

      // Wait for page to load
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-organization-button").click()

      // Fill in the form with valid data
      const orgName = `E2E Test Org ${Date.now()}`
      await authenticatedPage.getByTestId("org-name-input").fill(orgName)
      await authenticatedPage.getByTestId("reporting-currency-select").selectOption("EUR")

      // Submit the form
      await authenticatedPage.getByTestId("submit-create-org").click()

      // Wait for page to reload
      await authenticatedPage.waitForURL("/organizations")

      // Should show the new organization
      await expect(authenticatedPage.getByText(orgName)).toBeVisible({ timeout: 10000 })

      // Should show EUR as the reporting currency
      await expect(authenticatedPage.getByText("Reporting Currency: EUR")).toBeVisible()
    })
  })

  test.describe("Organization Details Page", () => {
    test("should display organization details correctly", async ({
      authenticatedPage
    }) => {
      // First create an organization
      await authenticatedPage.goto("/organizations")
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      // Click create button and fill form
      await authenticatedPage.getByTestId("create-organization-button").click()
      const orgName = `Details Test Org ${Date.now()}`
      await authenticatedPage.getByTestId("org-name-input").fill(orgName)
      await authenticatedPage.getByTestId("submit-create-org").click()

      // Wait for page to reload and show the org
      await authenticatedPage.waitForURL("/organizations")
      await expect(authenticatedPage.getByText(orgName)).toBeVisible({ timeout: 10000 })

      // Click on View Details link
      const viewDetailsButton = authenticatedPage.getByRole("link", { name: "View Details" }).first()
      await viewDetailsButton.click()

      // Wait for details page to load
      await expect(authenticatedPage.getByTestId("organization-details-page")).toBeVisible({ timeout: 10000 })

      // Should show organization name in heading
      await expect(authenticatedPage.getByTestId("organization-name")).toContainText(orgName)

      // Should show organization details section
      await expect(authenticatedPage.getByTestId("organization-info")).toBeVisible()
      await expect(authenticatedPage.getByTestId("org-currency")).toContainText("USD")

      // Should show settings section
      await expect(authenticatedPage.getByTestId("organization-settings")).toBeVisible()
      await expect(authenticatedPage.getByTestId("org-locale")).toContainText("en-US")
      await expect(authenticatedPage.getByTestId("org-timezone")).toContainText("UTC")
    })

    test("should show breadcrumb navigation on details page", async ({
      authenticatedPage
    }) => {
      // First create an organization
      await authenticatedPage.goto("/organizations")
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      await authenticatedPage.getByTestId("create-organization-button").click()
      const orgName = `Breadcrumb Test Org ${Date.now()}`
      await authenticatedPage.getByTestId("org-name-input").fill(orgName)
      await authenticatedPage.getByTestId("submit-create-org").click()

      await authenticatedPage.waitForURL("/organizations")
      await expect(authenticatedPage.getByText(orgName)).toBeVisible({ timeout: 10000 })

      // Navigate to details page
      const viewDetailsButton = authenticatedPage.getByRole("link", { name: "View Details" }).first()
      await viewDetailsButton.click()

      await expect(authenticatedPage.getByTestId("organization-details-page")).toBeVisible({ timeout: 10000 })

      // Should show breadcrumb with Organizations link (use the one in the details page, not nav)
      const breadcrumbLink = authenticatedPage.getByTestId("organization-details-page").getByRole("link", { name: "Organizations" })
      await expect(breadcrumbLink).toBeVisible()

      // Click breadcrumb to go back
      await breadcrumbLink.click()

      // Should be back on organizations list
      await authenticatedPage.waitForURL("/organizations")
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()
    })

    test("should show no companies message when organization has no companies", async ({
      authenticatedPage
    }) => {
      // First create an organization
      await authenticatedPage.goto("/organizations")
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()

      await authenticatedPage.getByTestId("create-organization-button").click()
      const orgName = `No Companies Test Org ${Date.now()}`
      await authenticatedPage.getByTestId("org-name-input").fill(orgName)
      await authenticatedPage.getByTestId("submit-create-org").click()

      await authenticatedPage.waitForURL("/organizations")
      await expect(authenticatedPage.getByText(orgName)).toBeVisible({ timeout: 10000 })

      // Navigate to details page
      const viewDetailsButton = authenticatedPage.getByRole("link", { name: "View Details" }).first()
      await viewDetailsButton.click()

      await expect(authenticatedPage.getByTestId("organization-details-page")).toBeVisible({ timeout: 10000 })

      // Should show no companies message
      await expect(authenticatedPage.getByTestId("no-companies-message")).toBeVisible()
      await expect(authenticatedPage.getByTestId("no-companies-message")).toContainText("No companies found")
    })

    test("should show error for non-existent organization", async ({
      authenticatedPage
    }) => {
      // Navigate to a non-existent organization
      await authenticatedPage.goto("/organizations/00000000-0000-0000-0000-000000000000")

      // Should show error message
      await expect(authenticatedPage.getByTestId("organization-error")).toBeVisible({ timeout: 10000 })
      await expect(authenticatedPage.getByTestId("organization-error")).toContainText("not found")
    })
  })

  test.describe("Navigation", () => {
    test("should show Organizations link in navigation when authenticated", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/")

      // Wait for navigation to be visible
      await expect(authenticatedPage.getByRole("navigation")).toBeVisible()

      // Should have Organizations link
      const orgLink = authenticatedPage.getByRole("link", { name: "Organizations" })
      await expect(orgLink).toBeVisible()
    })

    test("should navigate to organizations page from navigation link", async ({
      authenticatedPage
    }) => {
      await authenticatedPage.goto("/")

      // Wait for navigation to be visible
      await expect(authenticatedPage.getByRole("navigation")).toBeVisible()

      // Click on Organizations link
      await authenticatedPage.getByRole("link", { name: "Organizations" }).click()

      // Should navigate to organizations page
      await authenticatedPage.waitForURL("/organizations")
      await expect(authenticatedPage.getByRole("heading", { name: "Organizations" })).toBeVisible()
    })
  })
})
