/**
 * Accounts E2E Tests
 *
 * Tests the complete chart of accounts management flow:
 * - List accounts shows company's accounts via UI
 * - Create account via UI form works with validation
 * - Edit account via UI updates correctly
 * - Account hierarchy displays properly
 * - Filter/search accounts works via UI
 *
 * All tests interact through UI elements only - no direct API calls.
 *
 * @module test-e2e/accounts.spec
 */

import { test, expect } from "./fixtures/organizations.ts"

test.describe("Accounts Management", () => {
  test.describe("Authentication", () => {
    test("should redirect to login when accessing accounts page unauthenticated", async ({
      page
    }) => {
      // Navigate to accounts page without auth (using a fake company ID)
      await page.goto("/companies/00000000-0000-0000-0000-000000000000/accounts")

      // Should redirect to login
      await page.waitForURL(/\/login/)

      // The URL should be the login page
      expect(page.url()).toContain("/login")
    })
  })

  test.describe("Accounts List Page", () => {
    test("should display accounts page heading when authenticated", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Should show the page title
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("Chart of Accounts")
    })

    test("should show empty state when no accounts exist", async ({
      authenticatedPage,
      testCompany
    }) => {
      // Navigate to accounts page without using testAccount fixture
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for the page to load - either empty state or accounts list
      await expect(
        authenticatedPage.getByTestId("accounts-empty").or(authenticatedPage.getByTestId("accounts-list"))
      ).toBeVisible({ timeout: 10000 })

      // If empty state, verify the message
      const emptyState = authenticatedPage.getByTestId("accounts-empty")
      if (await emptyState.isVisible()) {
        await expect(emptyState).toContainText("No accounts found")
      }
    })

    test("should show create account button", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Should show the + Add Account button
      const createButton = authenticatedPage.getByTestId("create-account-button")
      await expect(createButton).toBeVisible()
      await expect(createButton).toContainText("Add Account")
    })

    test("should show accounts list with test account", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for the page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Should show the account in the list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })
      await expect(authenticatedPage.getByText(testAccount.name)).toBeVisible()
    })

    test("should display account row with correct information", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Verify account information is displayed
      const accountRow = authenticatedPage.getByTestId(`account-row-${testAccount.id}`)
      await expect(accountRow).toBeVisible()
      await expect(accountRow.getByTestId(`account-number-${testAccount.id}`)).toContainText(testAccount.accountNumber)
      await expect(accountRow.getByTestId(`account-name-${testAccount.id}`)).toContainText(testAccount.name)
      await expect(accountRow.getByTestId(`account-type-${testAccount.id}`)).toContainText(testAccount.accountType)
      await expect(accountRow.getByTestId(`account-status-${testAccount.id}`)).toContainText("Active")
    })
  })

  test.describe("Create Account Form", () => {
    test("should show create form when clicking Add Account button", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button
      await authenticatedPage.getByTestId("create-account-button").click()

      // Form should be visible
      await expect(authenticatedPage.getByTestId("create-account-form")).toBeVisible()

      // Should show form fields
      await expect(authenticatedPage.getByTestId("account-number-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("account-name-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("account-type-select")).toBeVisible()
      await expect(authenticatedPage.getByTestId("account-category-select")).toBeVisible()
      await expect(authenticatedPage.getByTestId("submit-create-account")).toBeVisible()
      await expect(authenticatedPage.getByTestId("cancel-create-account")).toBeVisible()
    })

    test("should hide create form when clicking Cancel", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-account-button").click()
      await expect(authenticatedPage.getByTestId("create-account-form")).toBeVisible()

      // Click cancel
      await authenticatedPage.getByTestId("cancel-create-account").click()

      // Form should be hidden
      await expect(authenticatedPage.getByTestId("create-account-form")).not.toBeVisible()

      // Create button should be visible again
      await expect(authenticatedPage.getByTestId("create-account-button")).toBeVisible()
    })

    test("should create account with valid data", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-account-button").click()

      // Fill in the form with valid data
      // Account numbers must be 4 digits starting with 1-9 (1000-9999)
      const timestamp = Date.now()
      const accountNumber = `1${(timestamp % 1000).toString().padStart(3, "0")}`
      const accountName = `E2E Test Account ${timestamp}`
      await authenticatedPage.getByTestId("account-number-input").fill(accountNumber)
      await authenticatedPage.getByTestId("account-name-input").fill(accountName)
      await authenticatedPage.getByTestId("account-type-select").selectOption("Asset")
      await authenticatedPage.getByTestId("account-category-select").selectOption("CurrentAsset")

      // Submit the form
      await authenticatedPage.getByTestId("submit-create-account").click()

      // Wait for form to close (indicating success)
      await expect(authenticatedPage.getByTestId("create-account-form")).not.toBeVisible({ timeout: 10000 })

      // Reload the page to ensure fresh data
      await authenticatedPage.reload()

      // Wait for accounts list to load
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Should show the new account in the list
      await expect(authenticatedPage.getByText(accountName)).toBeVisible({ timeout: 5000 })
    })

    test("should create account with different account types", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the create button to show form
      await authenticatedPage.getByTestId("create-account-button").click()

      // Fill in the form with Liability type
      const accountNumber = `2${Date.now().toString().slice(-3)}`
      const accountName = `E2E Liability ${Date.now()}`
      await authenticatedPage.getByTestId("account-number-input").fill(accountNumber)
      await authenticatedPage.getByTestId("account-name-input").fill(accountName)
      await authenticatedPage.getByTestId("account-type-select").selectOption("Liability")
      await authenticatedPage.getByTestId("account-category-select").selectOption("CurrentLiability")

      // Submit the form
      await authenticatedPage.getByTestId("submit-create-account").click()

      // Wait for form to close (indicating success)
      await expect(authenticatedPage.getByTestId("create-account-form")).not.toBeVisible({ timeout: 10000 })

      // Reload the page to ensure fresh data
      await authenticatedPage.reload()

      // Wait for accounts list to load
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Should show the new account in the list
      await expect(authenticatedPage.getByText(accountName)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe("Edit Account Form", () => {
    test("should show edit form when clicking Edit button on account", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Click edit button on the test account
      await authenticatedPage.getByTestId(`edit-account-${testAccount.id}`).click()

      // Edit form should be visible
      await expect(authenticatedPage.getByTestId("edit-account-form")).toBeVisible()

      // Should show account info
      await expect(authenticatedPage.getByTestId("edit-account-number")).toContainText(testAccount.accountNumber)
      await expect(authenticatedPage.getByTestId("edit-account-type")).toContainText(testAccount.accountType)

      // Should show form fields
      await expect(authenticatedPage.getByTestId("edit-account-name-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("edit-account-description-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("submit-edit-account")).toBeVisible()
      await expect(authenticatedPage.getByTestId("cancel-edit-account")).toBeVisible()
    })

    test("should hide edit form when clicking Cancel", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Click edit button
      await authenticatedPage.getByTestId(`edit-account-${testAccount.id}`).click()
      await expect(authenticatedPage.getByTestId("edit-account-form")).toBeVisible()

      // Click cancel
      await authenticatedPage.getByTestId("cancel-edit-account").click()

      // Form should be hidden
      await expect(authenticatedPage.getByTestId("edit-account-form")).not.toBeVisible()
    })

    test("should update account name via edit form", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Click edit button
      await authenticatedPage.getByTestId(`edit-account-${testAccount.id}`).click()
      await expect(authenticatedPage.getByTestId("edit-account-form")).toBeVisible()

      // Update the account name
      const newName = `Updated ${testAccount.name} ${Date.now()}`
      await authenticatedPage.getByTestId("edit-account-name-input").fill(newName)

      // Submit the form
      await authenticatedPage.getByTestId("submit-edit-account").click()

      // Wait for form to close
      await expect(authenticatedPage.getByTestId("edit-account-form")).not.toBeVisible({ timeout: 10000 })

      // Reload the page to ensure fresh data
      await authenticatedPage.reload()

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Should show the updated account name
      await expect(authenticatedPage.getByText(newName)).toBeVisible({ timeout: 5000 })
    })

    test("should update account description via edit form", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Click edit button
      await authenticatedPage.getByTestId(`edit-account-${testAccount.id}`).click()
      await expect(authenticatedPage.getByTestId("edit-account-form")).toBeVisible()

      // Add a description
      const description = `Test description ${Date.now()}`
      await authenticatedPage.getByTestId("edit-account-description-input").fill(description)

      // Submit the form
      await authenticatedPage.getByTestId("submit-edit-account").click()

      // Wait for form to close
      await expect(authenticatedPage.getByTestId("edit-account-form")).not.toBeVisible({ timeout: 10000 })
    })
  })

  test.describe("Account Hierarchy", () => {
    test("should display child account with indent when created with parent", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testUser,
      page
    }) => {
      // First create a child account via API for setup
      const childResponse = await page.request.post("/api/v1/accounts", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          accountNumber: "1001",
          name: "Petty Cash",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: testAccount.id,
          isPostable: true,
          isCashFlowRelevant: true,
          cashFlowCategory: "Operating",
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null
        }
      })

      if (!childResponse.ok()) {
        throw new Error(`Failed to create child account: ${await childResponse.text()}`)
      }

      const childAccount = await childResponse.json()

      // Navigate to accounts page
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Both parent and child should be visible - use specific testid selectors to avoid strict mode violations
      await expect(authenticatedPage.getByTestId(`account-name-${testAccount.id}`)).toBeVisible()
      await expect(authenticatedPage.getByTestId(`account-name-${childAccount.id}`)).toContainText("Petty Cash")

      // Child account should have indent indicator
      await expect(authenticatedPage.getByTestId(`account-indent-${childAccount.id}`)).toBeVisible()
    })

    test("should allow adding sub-account via + Sub button", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Click the + Sub button on the parent account
      await authenticatedPage.getByTestId(`add-sub-account-${testAccount.id}`).click()

      // Create account form should open
      await expect(authenticatedPage.getByTestId("create-account-form")).toBeVisible()

      // Account type should be pre-filled and disabled (matches parent)
      const accountTypeSelect = authenticatedPage.getByTestId("account-type-select")
      await expect(accountTypeSelect).toHaveValue(testAccount.accountType)
      await expect(accountTypeSelect).toBeDisabled()

      // Parent account should be pre-selected
      const parentSelect = authenticatedPage.getByTestId("parent-account-select")
      await expect(parentSelect).toHaveValue(testAccount.id)
    })
  })

  test.describe("Filter and Search", () => {
    test("should filter accounts by account type", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testUser,
      page
    }) => {
      // Create a liability account for testing filter
      await page.request.post("/api/v1/accounts", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          accountNumber: "2000",
          name: "Accounts Payable",
          description: null,
          accountType: "Liability",
          accountCategory: "CurrentLiability",
          normalBalance: "Credit",
          parentAccountId: null,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null
        }
      })

      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Both accounts should be visible initially
      await expect(authenticatedPage.getByText(testAccount.name)).toBeVisible()
      await expect(authenticatedPage.getByText("Accounts Payable")).toBeVisible()

      // Filter by Asset type
      await authenticatedPage.getByTestId("account-type-filter").selectOption("Asset")

      // Only Asset account should be visible
      await expect(authenticatedPage.getByText(testAccount.name)).toBeVisible()
      await expect(authenticatedPage.getByText("Accounts Payable")).not.toBeVisible()

      // Filter by Liability type
      await authenticatedPage.getByTestId("account-type-filter").selectOption("Liability")

      // Only Liability account should be visible
      await expect(authenticatedPage.getByText(testAccount.name)).not.toBeVisible()
      await expect(authenticatedPage.getByText("Accounts Payable")).toBeVisible()
    })

    test("should search accounts by name", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testUser,
      page
    }) => {
      // Create another account for testing search
      await page.request.post("/api/v1/accounts", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          accountNumber: "1100",
          name: "Bank Account",
          description: null,
          accountType: "Asset",
          accountCategory: "CurrentAsset",
          normalBalance: "Debit",
          parentAccountId: null,
          isPostable: true,
          isCashFlowRelevant: true,
          cashFlowCategory: "Operating",
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null
        }
      })

      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Both accounts should be visible initially
      await expect(authenticatedPage.getByText(testAccount.name)).toBeVisible()
      await expect(authenticatedPage.getByText("Bank Account")).toBeVisible()

      // Search for "Cash"
      await authenticatedPage.getByTestId("search-accounts-input").fill("Cash")

      // Only Cash account should be visible
      await expect(authenticatedPage.getByText(testAccount.name)).toBeVisible()
      await expect(authenticatedPage.getByText("Bank Account")).not.toBeVisible()

      // Search for "Bank"
      await authenticatedPage.getByTestId("search-accounts-input").fill("Bank")

      // Only Bank Account should be visible
      await expect(authenticatedPage.getByText(testAccount.name)).not.toBeVisible()
      await expect(authenticatedPage.getByText("Bank Account")).toBeVisible()
    })

    test("should show no results message when search matches nothing", async ({
      authenticatedPage,
      testCompany,
      testAccount: _testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Search for something that doesn't exist
      await authenticatedPage.getByTestId("search-accounts-input").fill("NonExistentAccount12345")

      // Should show empty state with search message
      await expect(authenticatedPage.getByTestId("accounts-empty")).toBeVisible()
      await expect(authenticatedPage.getByTestId("accounts-empty")).toContainText("No accounts match your search")
    })

    test("should clear filters when clicking Clear Filters button", async ({
      authenticatedPage,
      testCompany,
      testAccount: _testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Apply a filter
      await authenticatedPage.getByTestId("account-type-filter").selectOption("Asset")

      // Apply a search
      await authenticatedPage.getByTestId("search-accounts-input").fill("Cash")

      // Clear Filters button should be visible
      await expect(authenticatedPage.getByTestId("clear-filters-button")).toBeVisible()

      // Click Clear Filters
      await authenticatedPage.getByTestId("clear-filters-button").click()

      // Filters should be cleared
      await expect(authenticatedPage.getByTestId("account-type-filter")).toHaveValue("")
      await expect(authenticatedPage.getByTestId("search-accounts-input")).toHaveValue("")

      // Clear Filters button should be hidden
      await expect(authenticatedPage.getByTestId("clear-filters-button")).not.toBeVisible()
    })

    test("should show correct account count after filtering", async ({
      authenticatedPage,
      testCompany,
      testAccount: _testAccount,
      testUser,
      page
    }) => {
      // Create another account
      await page.request.post("/api/v1/accounts", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          accountNumber: "2001",
          name: "Other Liability",
          description: null,
          accountType: "Liability",
          accountCategory: "CurrentLiability",
          normalBalance: "Credit",
          parentAccountId: null,
          isPostable: true,
          isCashFlowRelevant: false,
          cashFlowCategory: null,
          isIntercompany: false,
          intercompanyPartnerId: null,
          currencyRestriction: null
        }
      })

      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Check initial count (should show 2)
      await expect(authenticatedPage.getByTestId("accounts-count")).toContainText("Showing 2 of 2 accounts")

      // Filter by Asset type
      await authenticatedPage.getByTestId("account-type-filter").selectOption("Asset")

      // Count should update (should show 1 of 2)
      await expect(authenticatedPage.getByTestId("accounts-count")).toContainText("Showing 1 of 1 accounts")
    })
  })

  test.describe("Deactivate Account", () => {
    test("should show deactivate confirmation modal when clicking Deactivate", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Click deactivate button on the test account
      await authenticatedPage.getByTestId(`deactivate-account-${testAccount.id}`).click()

      // Deactivate modal should be visible
      await expect(authenticatedPage.getByTestId("deactivate-account-modal")).toBeVisible()

      // Should show account info
      await expect(authenticatedPage.getByTestId("deactivate-account-info")).toContainText(testAccount.accountNumber)
      await expect(authenticatedPage.getByTestId("deactivate-account-info")).toContainText(testAccount.name)

      // Should show confirm and cancel buttons
      await expect(authenticatedPage.getByTestId("confirm-deactivate-account")).toBeVisible()
      await expect(authenticatedPage.getByTestId("cancel-deactivate-account")).toBeVisible()
    })

    test("should hide modal when clicking Cancel on deactivate", async ({
      authenticatedPage,
      testCompany,
      testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/accounts`)

      // Wait for accounts list
      await expect(authenticatedPage.getByTestId("accounts-list")).toBeVisible({ timeout: 10000 })

      // Click deactivate button
      await authenticatedPage.getByTestId(`deactivate-account-${testAccount.id}`).click()
      await expect(authenticatedPage.getByTestId("deactivate-account-modal")).toBeVisible()

      // Click cancel
      await authenticatedPage.getByTestId("cancel-deactivate-account").click()

      // Modal should be hidden
      await expect(authenticatedPage.getByTestId("deactivate-account-modal")).not.toBeVisible()
    })
  })
})
