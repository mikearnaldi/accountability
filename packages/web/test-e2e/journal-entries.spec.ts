/**
 * Journal Entries E2E Tests
 *
 * Tests the complete journal entry workflow:
 * - Create journal entry with lines via UI
 * - Validation UI shows debits must equal credits
 * - Submit for approval workflow via UI
 * - Approve/reject workflow via UI
 * - Post entry workflow via UI
 * - View entry history via UI
 *
 * All tests interact through UI elements only - no direct API calls
 * except for fixture setup.
 *
 * @module test-e2e/journal-entries.spec
 */

import { test, expect } from "./fixtures/organizations.ts"

test.describe("Journal Entries Management", () => {
  test.describe("Authentication", () => {
    test("should redirect to login when accessing journal entries page unauthenticated", async ({
      page
    }) => {
      // Navigate to journal entries page without auth (using a fake company ID)
      await page.goto("/companies/00000000-0000-0000-0000-000000000000/journal-entries")

      // Should redirect to login
      await page.waitForURL(/\/login/)

      // The URL should be the login page
      expect(page.url()).toContain("/login")
    })
  })

  test.describe("Journal Entries List Page", () => {
    test("should display journal entries page heading when authenticated", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)

      // Should show the page title
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("Journal Entries")
    })

    test("should show empty state when no entries exist", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)

      // Wait for the page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Should show empty state or entries list
      const emptyState = authenticatedPage.getByTestId("entries-empty")
      const entriesList = authenticatedPage.getByTestId("entries-list")

      // Either empty state or list should be visible
      await expect(emptyState.or(entriesList)).toBeVisible({ timeout: 10000 })

      // If empty state, verify the message
      if (await emptyState.isVisible()) {
        await expect(emptyState).toContainText("No journal entries found")
      }
    })

    test("should show create entry button", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Should show the + New Entry button
      const createButton = authenticatedPage.getByTestId("create-journal-entry-button")
      await expect(createButton).toBeVisible()
      await expect(createButton).toContainText("New Entry")
    })

    test("should navigate to new entry form when clicking New Entry", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Click the New Entry button
      await authenticatedPage.getByTestId("create-journal-entry-button").click()

      // Should navigate to the new entry page
      await authenticatedPage.waitForURL(`/companies/${testCompany.id}/journal-entries/new`)

      // Should show new entry page title
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")
    })

    test("should filter entries by status", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Status filter should be visible
      const statusFilter = authenticatedPage.getByTestId("status-filter")
      await expect(statusFilter).toBeVisible()

      // Select Draft status
      await statusFilter.selectOption("Draft")

      // Clear filters button should appear
      await expect(authenticatedPage.getByTestId("clear-filters-button")).toBeVisible()
    })

    test("should filter entries by type", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Type filter should be visible
      const typeFilter = authenticatedPage.getByTestId("type-filter")
      await expect(typeFilter).toBeVisible()

      // Select Adjusting type
      await typeFilter.selectOption("Adjusting")

      // Clear filters button should appear
      await expect(authenticatedPage.getByTestId("clear-filters-button")).toBeVisible()
    })

    test("should clear filters when clicking Clear Filters", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toBeVisible()

      // Apply a filter
      await authenticatedPage.getByTestId("status-filter").selectOption("Draft")

      // Clear Filters button should be visible
      await expect(authenticatedPage.getByTestId("clear-filters-button")).toBeVisible()

      // Click Clear Filters
      await authenticatedPage.getByTestId("clear-filters-button").click()

      // Filters should be cleared
      await expect(authenticatedPage.getByTestId("status-filter")).toHaveValue("")

      // Clear Filters button should be hidden
      await expect(authenticatedPage.getByTestId("clear-filters-button")).not.toBeVisible()
    })
  })

  test.describe("Create Journal Entry", () => {
    test("should display the new journal entry form", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries/new`)

      // Wait for page to load
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")

      // Entry details section should be visible
      await expect(authenticatedPage.getByTestId("entry-details-section")).toBeVisible()

      // Form fields should be visible
      await expect(authenticatedPage.getByTestId("description-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("transaction-date-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("fiscal-year-input")).toBeVisible()
      await expect(authenticatedPage.getByTestId("fiscal-period-select")).toBeVisible()
      await expect(authenticatedPage.getByTestId("entry-type-select")).toBeVisible()

      // Journal lines section should be visible
      await expect(authenticatedPage.getByTestId("journal-lines-section")).toBeVisible()

      // Should have at least 2 lines by default
      await expect(authenticatedPage.getByTestId("journal-line-1")).toBeVisible()
      await expect(authenticatedPage.getByTestId("journal-line-2")).toBeVisible()

      // Running balance should be visible
      await expect(authenticatedPage.getByTestId("running-balance")).toBeVisible()
    })

    test("should create journal entry with valid balanced lines", async ({
      authenticatedPage,
      testCompany,
      testAccount: _testAccount,
      testFiscalYear: _testFiscalYear,
      testUser,
      page
    }) => {
      // First create a second account via API for the credit side
      const creditAccountResponse = await page.request.post("/api/v1/accounts", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          accountNumber: "4000",
          name: "Revenue",
          description: null,
          accountType: "Revenue",
          accountCategory: "OperatingRevenue",
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

      if (!creditAccountResponse.ok()) {
        throw new Error(`Failed to create credit account: ${await creditAccountResponse.text()}`)
      }

      // Navigate to new entry form
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries/new`)
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")

      // Fill in the description
      const description = `E2E Test Entry ${Date.now()}`
      await authenticatedPage.getByTestId("description-input").fill(description)

      // Select accounts and enter amounts
      // Line 1: Debit Cash account
      await authenticatedPage.getByTestId("line-account-1").click()
      await authenticatedPage.keyboard.type("Cash")
      await authenticatedPage.keyboard.press("Enter")

      // Enter debit amount
      await authenticatedPage.getByTestId("line-debit-1").click()
      await authenticatedPage.keyboard.type("100.00")

      // Line 2: Credit Revenue account
      await authenticatedPage.getByTestId("line-account-2").click()
      await authenticatedPage.keyboard.type("Revenue")
      await authenticatedPage.keyboard.press("Enter")

      // Enter credit amount
      await authenticatedPage.getByTestId("line-credit-2").click()
      await authenticatedPage.keyboard.type("100.00")

      // Verify balance shows as balanced
      await expect(authenticatedPage.getByTestId("balance-difference")).toContainText("Balanced")

      // Click Save as Draft
      await authenticatedPage.getByTestId("save-draft-button").click()

      // Should navigate away from form (indicates success)
      await authenticatedPage.waitForURL(/\/companies\/.*\/journal-entries(?:\/)?$/)
    })

    test("should add and remove journal lines", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries/new`)
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")

      // Initially should have 2 lines
      await expect(authenticatedPage.getByTestId("journal-line-1")).toBeVisible()
      await expect(authenticatedPage.getByTestId("journal-line-2")).toBeVisible()

      // Add a new line
      await authenticatedPage.getByTestId("add-line-button").click()

      // Should now have 3 lines
      await expect(authenticatedPage.getByTestId("journal-line-3")).toBeVisible()

      // Remove buttons should be visible (since we have more than 2 lines)
      await expect(authenticatedPage.getByTestId("remove-line-3")).toBeVisible()

      // Remove the third line
      await authenticatedPage.getByTestId("remove-line-3").click()

      // Should be back to 2 lines
      await expect(authenticatedPage.getByTestId("journal-line-3")).not.toBeVisible()
    })
  })

  test.describe("Validation - Balance Requirement", () => {
    test("should show error when debits do not equal credits", async ({
      authenticatedPage,
      testCompany,
      testAccount: _testAccount
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries/new`)
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")

      // Fill in description
      await authenticatedPage.getByTestId("description-input").fill("Unbalanced Entry Test")

      // Select account for line 1 and enter debit
      await authenticatedPage.getByTestId("line-account-1").click()
      await authenticatedPage.keyboard.type("Cash")
      await authenticatedPage.keyboard.press("Enter")
      await authenticatedPage.getByTestId("line-debit-1").click()
      await authenticatedPage.keyboard.type("100.00")

      // Select account for line 2 with different credit amount
      await authenticatedPage.getByTestId("line-account-2").click()
      await authenticatedPage.keyboard.type("Cash")
      await authenticatedPage.keyboard.press("Enter")
      await authenticatedPage.getByTestId("line-credit-2").click()
      await authenticatedPage.keyboard.type("50.00")

      // Balance difference should show the imbalance
      await expect(authenticatedPage.getByTestId("balance-difference")).not.toContainText("Balanced")

      // Try to save
      await authenticatedPage.getByTestId("save-draft-button").click()

      // Balance error should be shown
      await expect(authenticatedPage.getByTestId("balance-error")).toBeVisible()
      await expect(authenticatedPage.getByTestId("balance-error")).toContainText("not balanced")
    })

    test("should show running balance totals", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries/new`)
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")

      // Enter debit amount on line 1
      await authenticatedPage.getByTestId("line-debit-1").click()
      await authenticatedPage.keyboard.type("250.00")

      // Enter credit amount on line 2
      await authenticatedPage.getByTestId("line-credit-2").click()
      await authenticatedPage.keyboard.type("150.00")

      // Total debits should show 250
      await expect(authenticatedPage.getByTestId("total-debits")).toContainText("250")

      // Total credits should show 150
      await expect(authenticatedPage.getByTestId("total-credits")).toContainText("150")

      // Difference should show 100 (or the net amount)
      const balanceDiff = authenticatedPage.getByTestId("balance-difference")
      await expect(balanceDiff).not.toContainText("Balanced")
    })

    test("should show required field validation errors", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries/new`)
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")

      // Leave description empty and try to save
      await authenticatedPage.getByTestId("description-input").clear()
      await authenticatedPage.getByTestId("save-draft-button").click()

      // Description error should be shown
      await expect(authenticatedPage.getByTestId("description-error")).toBeVisible()
      await expect(authenticatedPage.getByTestId("description-error")).toContainText("required")
    })

    test("should require account selection for lines", async ({
      authenticatedPage,
      testCompany
    }) => {
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries/new`)
      await expect(authenticatedPage.getByTestId("page-title")).toContainText("New Journal Entry")

      // Fill description
      await authenticatedPage.getByTestId("description-input").fill("Test Entry")

      // Enter amounts without selecting accounts
      await authenticatedPage.getByTestId("line-debit-1").click()
      await authenticatedPage.keyboard.type("100.00")

      await authenticatedPage.getByTestId("line-credit-2").click()
      await authenticatedPage.keyboard.type("100.00")

      // Try to save
      await authenticatedPage.getByTestId("save-draft-button").click()

      // Line account error should be shown
      await expect(authenticatedPage.getByTestId("line-account-error-1")).toBeVisible()
      await expect(authenticatedPage.getByTestId("line-account-error-2")).toBeVisible()
    })
  })

  test.describe("Approval Workflow", () => {
    test("should submit entry for approval via Submit button", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create a second account for balanced entry
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

      // Create a draft entry via API for testing the submit workflow
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Test Entry for Submit",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "100.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id, // Using same account for simplicity
              debitAmount: null,
              creditAmount: { amount: "100.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Find the Submit button for our entry
      const submitButton = authenticatedPage.getByTestId(`submit-for-approval-${entry.id}`)
      await expect(submitButton).toBeVisible()

      // Click Submit
      await submitButton.click()

      // Wait for page reload and status to change
      await authenticatedPage.waitForLoadState("load")
      await expect(authenticatedPage.getByTestId(`entry-status-${entry.id}`)).toContainText("PendingApproval", { timeout: 15000 })
    })

    test("should show approve and reject buttons for pending entries", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create and submit a draft entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Test Entry for Approve/Reject",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "200.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "200.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Submit for approval via API
      await page.request.post(`/api/v1/journal-entries/${entry.id}/submit`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Approve and Reject buttons should be visible
      await expect(authenticatedPage.getByTestId(`approve-entry-${entry.id}`)).toBeVisible()
      await expect(authenticatedPage.getByTestId(`reject-entry-${entry.id}`)).toBeVisible()

      // Submit button should NOT be visible (already submitted)
      await expect(authenticatedPage.getByTestId(`submit-for-approval-${entry.id}`)).not.toBeVisible()
    })

    test("should approve pending entry via Approve button", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create and submit a draft entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Test Entry for Approve",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "300.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "300.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Submit for approval via API
      await page.request.post(`/api/v1/journal-entries/${entry.id}/submit`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Click Approve button
      await authenticatedPage.getByTestId(`approve-entry-${entry.id}`).click()

      // Wait for page reload and status to change
      await authenticatedPage.waitForLoadState("load")
      await expect(authenticatedPage.getByTestId(`entry-status-${entry.id}`)).toContainText("Approved", { timeout: 15000 })
    })

    test("should reject pending entry via Reject button", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create and submit a draft entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Test Entry for Reject",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "400.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "400.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Submit for approval via API
      await page.request.post(`/api/v1/journal-entries/${entry.id}/submit`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Click Reject button
      await authenticatedPage.getByTestId(`reject-entry-${entry.id}`).click()

      // Reject modal should appear
      await expect(authenticatedPage.getByTestId("reject-entry-modal")).toBeVisible()

      // Enter rejection reason
      await authenticatedPage.getByTestId("reject-reason-input").fill("Missing supporting documentation")

      // Confirm rejection
      await authenticatedPage.getByTestId("confirm-reject-entry").click()

      // Wait for page reload and status to change
      await authenticatedPage.waitForLoadState("load")
      await expect(authenticatedPage.getByTestId(`entry-status-${entry.id}`)).toContainText("Draft", { timeout: 15000 })
    })
  })

  test.describe("Post Entry Workflow", () => {
    test("should show Post button for approved entries", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create, submit, and approve an entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Test Entry for Post",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "500.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "500.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Submit for approval
      await page.request.post(`/api/v1/journal-entries/${entry.id}/submit`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })

      // Approve the entry
      await page.request.post(`/api/v1/journal-entries/${entry.id}/approve`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Post button should be visible for approved entry
      await expect(authenticatedPage.getByTestId(`post-entry-${entry.id}`)).toBeVisible()
    })

    test("should post approved entry via Post button", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create, submit, and approve an entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Test Entry to Post",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "600.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "600.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Submit and approve
      await page.request.post(`/api/v1/journal-entries/${entry.id}/submit`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })
      await page.request.post(`/api/v1/journal-entries/${entry.id}/approve`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Click Post button
      await authenticatedPage.getByTestId(`post-entry-${entry.id}`).click()

      // Post modal should appear
      await expect(authenticatedPage.getByTestId("post-entry-modal")).toBeVisible()

      // Confirm posting (leave date empty for default)
      await authenticatedPage.getByTestId("confirm-post-entry").click()

      // Wait for page reload and status to change
      await authenticatedPage.waitForLoadState("load")
      await expect(authenticatedPage.getByTestId(`entry-status-${entry.id}`)).toContainText("Posted", { timeout: 15000 })
    })
  })

  test.describe("View Entry Details", () => {
    test("should navigate to entry edit/view page when clicking entry link", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create a draft entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Test Entry for View",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "700.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "700.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Click the entry link
      await authenticatedPage.getByTestId(`entry-link-${entry.id}`).click()

      // Should navigate to the edit page
      await authenticatedPage.waitForURL(`/companies/${testCompany.id}/journal-entries/${entry.id}/edit`)
    })

    test("should show View button for posted entries", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create, submit, approve, and post an entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Posted Entry for View Test",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "800.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "800.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Submit, approve, and post
      await page.request.post(`/api/v1/journal-entries/${entry.id}/submit`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })
      await page.request.post(`/api/v1/journal-entries/${entry.id}/approve`, {
        headers: { Authorization: `Bearer ${testUser.token}` }
      })
      await page.request.post(`/api/v1/journal-entries/${entry.id}/post`, {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          postedBy: testUser.id,
          postingDate: null
        }
      })

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // View button should be visible for posted entry
      await expect(authenticatedPage.getByTestId(`view-entry-${entry.id}`)).toBeVisible()

      // Edit button should NOT be visible
      await expect(authenticatedPage.getByTestId(`edit-entry-${entry.id}`)).not.toBeVisible()
    })
  })

  test.describe("Delete Entry", () => {
    test("should show delete button only for draft entries", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create a draft entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Draft Entry for Delete Test",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "900.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "900.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Delete button should be visible for draft entry
      await expect(authenticatedPage.getByTestId(`delete-entry-${entry.id}`)).toBeVisible()
    })

    test("should delete draft entry via Delete button", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create a draft entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Entry to Delete",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "1000.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "1000.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Click Delete button
      await authenticatedPage.getByTestId(`delete-entry-${entry.id}`).click()

      // Delete modal should appear
      await expect(authenticatedPage.getByTestId("delete-entry-modal")).toBeVisible()
      await expect(authenticatedPage.getByTestId("delete-entry-info")).toContainText("Entry to Delete")

      // Confirm deletion
      await authenticatedPage.getByTestId("confirm-delete-entry").click()

      // Wait for page to reload
      await authenticatedPage.waitForLoadState("networkidle")

      // Entry should no longer be visible
      await authenticatedPage.reload()
      await expect(authenticatedPage.getByTestId(`entry-row-${entry.id}`)).not.toBeVisible()
    })

    test("should cancel delete via Cancel button", async ({
      authenticatedPage,
      testCompany,
      testAccount,
      testFiscalYear,
      testUser,
      page
    }) => {
      // Create a draft entry via API
      const createResponse = await page.request.post("/api/v1/journal-entries", {
        headers: { Authorization: `Bearer ${testUser.token}` },
        data: {
          companyId: testCompany.id,
          description: "Entry NOT to Delete",
          transactionDate: { year: testFiscalYear.year, month: 1, day: 13 },
          documentDate: null,
          fiscalPeriod: { year: testFiscalYear.year, period: 1 },
          entryType: "Standard",
          sourceModule: "GeneralLedger",
          referenceNumber: null,
          sourceDocumentRef: null,
          lines: [
            {
              accountId: testAccount.id,
              debitAmount: { amount: "1100.00", currency: "USD" },
              creditAmount: null,
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            },
            {
              accountId: testAccount.id,
              debitAmount: null,
              creditAmount: { amount: "1100.00", currency: "USD" },
              memo: null,
              dimensions: null,
              intercompanyPartnerId: null
            }
          ]
        }
      })

      if (!createResponse.ok()) {
        throw new Error(`Failed to create journal entry: ${await createResponse.text()}`)
      }

      const { entry } = await createResponse.json()

      // Navigate to journal entries list
      await authenticatedPage.goto(`/companies/${testCompany.id}/journal-entries`)
      await expect(authenticatedPage.getByTestId("entries-list")).toBeVisible({ timeout: 10000 })

      // Click Delete button
      await authenticatedPage.getByTestId(`delete-entry-${entry.id}`).click()

      // Delete modal should appear
      await expect(authenticatedPage.getByTestId("delete-entry-modal")).toBeVisible()

      // Click Cancel
      await authenticatedPage.getByTestId("cancel-delete-entry").click()

      // Modal should close
      await expect(authenticatedPage.getByTestId("delete-entry-modal")).not.toBeVisible()

      // Entry should still be visible
      await expect(authenticatedPage.getByTestId(`entry-row-${entry.id}`)).toBeVisible()
    })
  })
})
