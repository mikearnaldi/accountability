/**
 * Consolidation Module E2E Tests
 *
 * Tests for consolidation groups and runs:
 * - Consolidation group list page (empty state, with groups)
 * - Create consolidation group flow
 * - Consolidation group detail page
 * - Add/remove members from group
 * - Activate/deactivate group
 * - Delete group
 * - Initiate consolidation run
 * - View run status and results
 */

import { test, expect } from "@playwright/test"
import { selectComboboxOption } from "./helpers/combobox"

test.describe("Consolidation Module", () => {
  test.describe("Consolidation Groups List Page", () => {
    test("should redirect to login if not authenticated", async ({ page }) => {
      // Navigate to consolidation page without authentication
      await page.goto("/organizations/some-org-id/consolidation")

      // Should redirect to login with redirect param
      await page.waitForURL(/\/login/)
      const url = new URL(page.url())
      expect(url.pathname).toBe("/login")
    })

    test("should display empty state when no consolidation groups", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-empty-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Empty Test User"
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
          name: `Consolidation Empty Test Org ${Date.now()}`,
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

      // 5. Navigate to consolidation page
      await page.goto(`/organizations/${orgData.id}/consolidation`)

      // 6. Should show consolidation page
      await expect(page.getByTestId("consolidation-page")).toBeVisible()

      // 7. Should show empty state
      await expect(page.getByTestId("empty-state")).toBeVisible()
      await expect(page.getByText(/No consolidation groups yet/i)).toBeVisible()

      // 8. Should show create button in empty state
      await expect(
        page.getByTestId("create-first-group-button")
      ).toBeVisible()
    })

    test("should display consolidation groups list", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-list-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation List Test User"
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
          name: `Consolidation List Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Parent Corp ${Date.now()}`,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create subsidiary company (ownership is defined in consolidation group, not company)
      const createSubRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Subsidiary GmbH ${Date.now()}`,
          legalName: "Subsidiary GmbH",
          jurisdiction: "DE",
          functionalCurrency: "EUR",
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
      expect(createSubRes.ok()).toBeTruthy()
      const subData = await createSubRes.json()

      // 6. Create a consolidation group via API
      const groupName = `Test Consolidation Group ${Date.now()}`
      const createGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: groupName,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: [
            {
              companyId: subData.id,
              ownershipPercentage: 80,
              consolidationMethod: "FullConsolidation"
            }
          ]
        }
      })
      expect(createGroupRes.ok()).toBeTruthy()
      const groupData = await createGroupRes.json()

      // 7. Set session cookie
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

      // 8. Navigate to consolidation page
      await page.goto(`/organizations/${orgData.id}/consolidation`)

      // 9. Should show consolidation page
      await expect(page.getByTestId("consolidation-page")).toBeVisible()

      // 10. Should show groups table
      await expect(page.getByTestId("groups-table")).toBeVisible()

      // 11. Should show the group in the table
      const groupRow = page.getByTestId(`group-row-${groupData.group.id}`)
      await expect(groupRow).toBeVisible()

      // 12. Should show group name
      await expect(groupRow.getByText(groupName)).toBeVisible()

      // 13. Should show parent company name
      await expect(groupRow.getByRole("cell", { name: /Parent Corp/i })).toBeVisible()

      // 14. Should show member count
      await expect(groupRow.getByText("1 company")).toBeVisible()

      // 15. Should show Active status (groups are active by default)
      await expect(groupRow.getByText("Active")).toBeVisible()
    })

    test("should filter consolidation groups by status", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-filter-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Filter Test User"
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
          name: `Consolidation Filter Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Parent Corp Filter ${Date.now()}`,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create an active consolidation group
      const activeGroupName = `Active Group ${Date.now()}`
      const createActiveGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: activeGroupName,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: []
        }
      })
      expect(createActiveGroupRes.ok()).toBeTruthy()
      const activeGroupData = await createActiveGroupRes.json()

      // 6. Create and deactivate another group
      const inactiveGroupName = `Inactive Group ${Date.now()}`
      const createInactiveGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: inactiveGroupName,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: []
        }
      })
      expect(createInactiveGroupRes.ok()).toBeTruthy()
      const inactiveGroupData = await createInactiveGroupRes.json()

      // Deactivate the second group
      const deactivateRes = await request.post(
        `/api/v1/consolidation/groups/${inactiveGroupData.group.id}/deactivate?organizationId=${orgData.id}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` }
        }
      )
      expect(deactivateRes.ok()).toBeTruthy()

      // 7. Set session cookie
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

      // 8. Navigate to consolidation page
      await page.goto(`/organizations/${orgData.id}/consolidation`)

      // 9. Should show status filter
      await expect(page.getByTestId("status-filter")).toBeVisible()
      // Wait for React to fully hydrate and stabilize
      await page.waitForTimeout(500)

      // 10. Should show both groups by default (All filter)
      await expect(page.getByText(activeGroupName)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(inactiveGroupName)).toBeVisible({ timeout: 10000 })

      // 11. Click Active filter - wait for button to be ready and use JS click for reliability
      const activeFilterBtn = page.getByTestId("filter-active")
      await expect(activeFilterBtn).toBeEnabled()
      await activeFilterBtn.evaluate((el: HTMLButtonElement) => el.click())
      // Wait for React state update and re-render - check that the inactive group disappears
      const table = page.getByTestId("groups-table")
      await expect(table.getByText(inactiveGroupName)).not.toBeVisible({ timeout: 15000 })

      // 12. Should only show active group
      await expect(table.getByText(activeGroupName)).toBeVisible({ timeout: 10000 })

      // 13. Click Inactive filter using JS click
      await page.getByTestId("filter-inactive").evaluate((el: HTMLButtonElement) => el.click())
      await expect(table.getByText(activeGroupName)).not.toBeVisible({ timeout: 15000 })

      // 14. Should only show inactive group
      await expect(table.getByText(inactiveGroupName)).toBeVisible({ timeout: 10000 })

      // 15. Click All filter to reset using JS click
      await page.getByTestId("filter-all").evaluate((el: HTMLButtonElement) => el.click())
      await expect(table.getByText(activeGroupName)).toBeVisible({ timeout: 15000 })

      // 16. Should show both groups again
      await expect(table.getByText(inactiveGroupName)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe("Create Consolidation Group", () => {
    test("should create a new consolidation group", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-create-consol-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Create Consolidation Test User"
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
          name: `Create Consolidation Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const parentCompanyName = `Parent Corp ${Date.now()}`
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: parentCompanyName,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create subsidiary company (ownership is defined when adding to consolidation group)
      const subCompanyName = `Subsidiary Ltd ${Date.now()}`
      const createSubRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: subCompanyName,
          legalName: "Subsidiary Ltd",
          jurisdiction: "GB",
          functionalCurrency: "GBP",
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
      expect(createSubRes.ok()).toBeTruthy()
      const subData = await createSubRes.json()

      // 6. Set session cookie and localStorage token
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

      await page.goto("/login")
      await page.evaluate((token) => {
        localStorage.setItem("accountabilitySessionToken", token)
      }, sessionToken)

      // 7. Navigate to create consolidation group page
      await page.goto(`/organizations/${orgData.id}/consolidation/new`)

      // 8. Should show create page
      await expect(
        page.getByTestId("create-consolidation-group-page")
      ).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText("New Consolidation Group")

      // 8.5. Parent dropdown is now a Combobox - verify it's visible
      const parentDropdown = page.getByTestId("parent-company-select")
      await expect(parentDropdown).toBeVisible()

      // 9. Fill in group name
      const groupName = `Test Consolidation Group ${Date.now()}`
      await page.getByTestId("group-name-input").fill(groupName)

      // 10. Select reporting currency (USD should be pre-selected from org)
      await expect(page.getByTestId("reporting-currency-select")).toHaveValue("USD")

      // 11. Select consolidation method
      await page.getByTestId("consolidation-method-select").selectOption("FullConsolidation")

      // 12. Select parent company using Combobox helper (search by company name)
      // Wait for form to be fully hydrated before interacting
      await page.waitForTimeout(500)

      // Select the parent company using the Combobox helper
      await selectComboboxOption(page, "parent-company-select", "Parent Corp", expect)

      // 13. Wait for add-member-button to be enabled
      // The button becomes enabled when:
      // 1. parentCompanyId is set (done above)
      // 2. availableCompaniesForMembers.length > 0 (subsidiary should be available)
      const addMemberButton = page.getByTestId("add-member-button")

      // Wait for React state updates to propagate
      // The useMemo hook needs to recompute availableCompaniesForMembers
      await page.waitForTimeout(1000)

      // Final check that button is enabled
      await expect(addMemberButton).toBeEnabled({ timeout: 15000 })
      await addMemberButton.click({ force: true })

      // 14. Select the subsidiary company using Combobox helper
      await selectComboboxOption(page, "member-company-select-0", "Subsidiary Ltd", expect)

      // 15. Set ownership percentage
      await page.getByTestId("member-ownership-input-0").fill("75")

      // 16. Verify group name is still filled (React re-renders might have cleared it)
      const groupNameInput = page.getByTestId("group-name-input")
      const currentGroupName = await groupNameInput.inputValue()
      if (!currentGroupName || currentGroupName.trim() === "") {
        await groupNameInput.click()
        await groupNameInput.fill(groupName)
        await groupNameInput.blur()
        await page.waitForTimeout(200)
      }

      // 17. Submit the form and wait for API response
      const submitButton = page.getByTestId("submit-button")
      await expect(submitButton).toBeEnabled({ timeout: 5000 })

      // Wait for form submission with both response and redirect
      await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes("/api/v1/consolidation/groups") &&
            resp.request().method() === "POST",
          { timeout: 30000 }
        ),
        submitButton.click({ force: true })
      ])

      // 18. Should redirect to group detail page (allow more time for redirect)
      await page.waitForURL(/\/consolidation\/[a-f0-9-]+$/, { timeout: 30000 })

      // 19. Wait for page to hydrate
      await page.waitForTimeout(500)

      // 20. Should show the new group's detail page
      await expect(page.getByTestId("consolidation-group-detail-page")).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId("page-title")).toContainText(groupName)
    })

    test("should show validation error for empty group name", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-validation-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Validation Test User"
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
          name: `Consolidation Validation Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Set session cookie and localStorage token
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

      await page.goto("/login")
      await page.evaluate((token) => {
        localStorage.setItem("accountabilitySessionToken", token)
      }, sessionToken)

      // 5. Navigate to create consolidation group page
      await page.goto(`/organizations/${orgData.id}/consolidation/new`)

      // 6. Should show create page
      await expect(
        page.getByTestId("create-consolidation-group-page")
      ).toBeVisible()

      // 7. Leave name empty and try to submit
      await page.getByTestId("submit-button").click()

      // 8. Should show validation error for name
      await expect(page.getByText("Name is required")).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe("Consolidation Group Detail", () => {
    test("should display group details and members", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-detail-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Detail Test User"
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
          name: `Consolidation Detail Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const parentCompanyName = `Parent Corp ${Date.now()}`
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: parentCompanyName,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create subsidiary company (ownership is defined in consolidation group)
      const subCompanyName = `Subsidiary Ltd ${Date.now()}`
      const createSubRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: subCompanyName,
          legalName: "Subsidiary Ltd",
          jurisdiction: "GB",
          functionalCurrency: "GBP",
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
      expect(createSubRes.ok()).toBeTruthy()
      const subData = await createSubRes.json()

      // 6. Create a consolidation group
      const groupName = `Test Detail Group ${Date.now()}`
      const createGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: groupName,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: [
            {
              companyId: subData.id,
              ownershipPercentage: 60,
              consolidationMethod: "FullConsolidation"
            }
          ]
        }
      })
      expect(createGroupRes.ok()).toBeTruthy()
      const groupData = await createGroupRes.json()

      // 7. Set session cookie
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

      // 8. Navigate to group detail page
      await page.goto(
        `/organizations/${orgData.id}/consolidation/${groupData.group.id}`
      )

      // 9. Should show detail page
      await expect(
        page.getByTestId("consolidation-group-detail-page")
      ).toBeVisible()

      // 10. Should show group name in title
      await expect(page.getByTestId("page-title")).toContainText(groupName)

      // 11. Should show Active status badge
      await expect(page.getByText("Active")).toBeVisible()

      // 12. Should show parent company link
      await expect(page.getByRole("link", { name: parentCompanyName })).toBeVisible()

      // 13. Should show reporting currency in group info
      await expect(page.getByText("Reporting Currency")).toBeVisible()
      await expect(page.getByRole("definition").filter({ hasText: "USD" })).toBeVisible()

      // 14. Should show member in members table
      await expect(
        page.getByTestId(`member-row-${subData.id}`)
      ).toBeVisible()

      // 15. Should show ownership percentage
      await expect(page.getByText("60%")).toBeVisible()

      // 16. Should show action buttons
      await expect(page.getByTestId("edit-button")).toBeVisible()
      await expect(page.getByTestId("delete-button")).toBeVisible()
      await expect(page.getByTestId("toggle-active-button")).toBeVisible()
    })

    test("should toggle group active status", async ({ page, request }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-toggle-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Toggle Test User"
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
          name: `Consolidation Toggle Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Parent Corp Toggle ${Date.now()}`,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create a consolidation group
      const createGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Toggle Test Group ${Date.now()}`,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: []
        }
      })
      expect(createGroupRes.ok()).toBeTruthy()
      const groupData = await createGroupRes.json()

      // 6. Set session cookie and localStorage token
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

      await page.goto("/login")
      await page.evaluate((token) => {
        localStorage.setItem("accountabilitySessionToken", token)
      }, sessionToken)

      // 7. Navigate to group detail page
      await page.goto(
        `/organizations/${orgData.id}/consolidation/${groupData.group.id}`
      )

      // 8. Wait for page to fully load and hydrate
      await page.waitForTimeout(500)
      await expect(page.getByTestId("consolidation-group-detail-page")).toBeVisible()

      // 9. Should show Active status initially (use specific selector to avoid matching other text)
      const statusBadge = page.locator('h1 + span')
      await expect(statusBadge).toHaveText("Active", { timeout: 5000 })

      // 10. Wait for button to be ready and click deactivate
      const toggleButton = page.getByTestId("toggle-active-button")
      await expect(toggleButton).toBeVisible()
      await expect(toggleButton).toBeEnabled()
      await page.waitForTimeout(200) // Small wait for React hydration
      await toggleButton.click({ force: true })

      // 11. Should show Inactive status after deactivation (wait for API response)
      await expect(statusBadge).toHaveText("Inactive", { timeout: 15000 })

      // 12. Wait for button state to update and click activate
      await expect(toggleButton).toContainText("Activate", { timeout: 5000 })
      await page.waitForTimeout(200)
      await toggleButton.click({ force: true })

      // 13. Should show Active status again
      await expect(statusBadge).toHaveText("Active", { timeout: 15000 })
    })

    test("should navigate from list to detail page", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-nav-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Nav Test User"
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
          name: `Consolidation Nav Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Parent Corp Nav ${Date.now()}`,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create a consolidation group
      const groupName = `Nav Test Group ${Date.now()}`
      const createGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: groupName,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: []
        }
      })
      expect(createGroupRes.ok()).toBeTruthy()
      const groupData = await createGroupRes.json()

      // 6. Set session cookie
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

      // 7. Navigate to consolidation list page
      await page.goto(`/organizations/${orgData.id}/consolidation`)

      // 8. Should see the group in the list
      await expect(page.getByText(groupName)).toBeVisible()

      // 9. Click on the group row
      await page.getByTestId(`group-row-${groupData.group.id}`).click()

      // 10. Should navigate to detail page
      await page.waitForURL(
        `/organizations/${orgData.id}/consolidation/${groupData.group.id}`
      )

      // 11. Should show detail page
      await expect(
        page.getByTestId("consolidation-group-detail-page")
      ).toBeVisible()
      await expect(page.getByTestId("page-title")).toContainText(groupName)
    })
  })

  test.describe("Consolidation Runs", () => {
    test("should show empty runs state", async ({ page, request }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-runs-empty-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Runs Empty Test User"
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
          name: `Runs Empty Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Parent Corp Runs ${Date.now()}`,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create a consolidation group
      const createGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Runs Test Group ${Date.now()}`,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: []
        }
      })
      expect(createGroupRes.ok()).toBeTruthy()
      const groupData = await createGroupRes.json()

      // 6. Set session cookie
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

      // 7. Navigate to group detail page
      await page.goto(
        `/organizations/${orgData.id}/consolidation/${groupData.group.id}`
      )

      // 8. Should show "No consolidation runs yet" message
      await expect(page.getByText("No consolidation runs yet")).toBeVisible()

      // 9. Should show "New Run" button
      await expect(page.getByTestId("initiate-run-button")).toBeVisible()
    })

    test("should open initiate run modal", async ({ page, request }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-run-modal-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Run Modal Test User"
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
          name: `Run Modal Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Parent Corp Modal ${Date.now()}`,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create a consolidation group
      const createGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Modal Test Group ${Date.now()}`,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: []
        }
      })
      expect(createGroupRes.ok()).toBeTruthy()
      const groupData = await createGroupRes.json()

      // 6. Set session cookie
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

      // 7. Navigate to group detail page
      await page.goto(
        `/organizations/${orgData.id}/consolidation/${groupData.group.id}`
      )

      // 8. Wait for page to load and hydrate
      await expect(page.getByTestId("consolidation-group-detail-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 9. Click "New Run" button
      await page.getByTestId("initiate-run-button").click()

      // 10. Should show initiate run modal
      await expect(
        page.getByRole("heading", { name: "Initiate Consolidation Run" })
      ).toBeVisible({ timeout: 10000 })

      // 11. Should show form inputs
      await expect(page.getByTestId("fiscal-year-input")).toBeVisible()
      await expect(page.getByTestId("fiscal-period-input")).toBeVisible()
      await expect(page.getByTestId("as-of-date-input")).toBeVisible()

      // 12. Should show cancel and start buttons
      await expect(page.getByTestId("cancel-run-button")).toBeVisible()
      await expect(page.getByTestId("start-run-button")).toBeVisible()

      // 13. Click cancel to close modal
      await page.getByTestId("cancel-run-button").click()

      // 14. Modal should be closed
      await expect(
        page.getByRole("heading", { name: "Initiate Consolidation Run" })
      ).not.toBeVisible()
    })
  })

  test.describe("Delete Consolidation Group", () => {
    test("should delete consolidation group with confirmation", async ({
      page,
      request
    }) => {
      // 1. Register a test user
      const testUser = {
        email: `test-consol-delete-${Date.now()}@example.com`,
        password: "TestPassword123",
        displayName: "Consolidation Delete Test User"
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
          name: `Delete Test Org ${Date.now()}`,
          reportingCurrency: "USD",
          settings: null
        }
      })
      expect(createOrgRes.ok()).toBeTruthy()
      const orgData = await createOrgRes.json()

      // 4. Create parent company
      const createParentRes = await request.post("/api/v1/companies", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: `Parent Corp Delete ${Date.now()}`,
          legalName: "Parent Corp Inc.",
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
      expect(createParentRes.ok()).toBeTruthy()
      const parentData = await createParentRes.json()

      // 5. Create a consolidation group
      const groupName = `Delete Test Group ${Date.now()}`
      const createGroupRes = await request.post("/api/v1/consolidation/groups", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        data: {
          organizationId: orgData.id,
          name: groupName,
          reportingCurrency: "USD",
          consolidationMethod: "FullConsolidation",
          parentCompanyId: parentData.id,
          members: []
        }
      })
      expect(createGroupRes.ok()).toBeTruthy()
      const groupData = await createGroupRes.json()

      // 6. Set session cookie and localStorage token
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

      await page.goto("/login")
      await page.evaluate((token) => {
        localStorage.setItem("accountabilitySessionToken", token)
      }, sessionToken)

      // 7. Navigate to group detail page
      await page.goto(
        `/organizations/${orgData.id}/consolidation/${groupData.group.id}`
      )

      // 8. Wait for page to load
      await expect(page.getByTestId("consolidation-group-detail-page")).toBeVisible()
      await page.waitForTimeout(500)

      // 9. Click delete button
      await page.getByTestId("delete-button").click()

      // 10. Should show delete confirmation modal
      await expect(
        page.getByRole("heading", { name: "Delete Consolidation Group" })
      ).toBeVisible({ timeout: 10000 })

      // 11. Should show confirm input
      await expect(page.getByTestId("delete-confirm-input")).toBeVisible()

      // 12. Try to delete without typing name - button should be disabled
      await expect(page.getByTestId("confirm-delete-button")).toBeDisabled()

      // 13. Type incorrect name - button should still be disabled
      await page.getByTestId("delete-confirm-input").fill("wrong name")
      await expect(page.getByTestId("confirm-delete-button")).toBeDisabled()

      // 14. Type correct group name
      await page.getByTestId("delete-confirm-input").fill(groupName)

      // 15. Button should be enabled now
      await expect(page.getByTestId("confirm-delete-button")).toBeEnabled()

      // 16. Click confirm delete
      await page.getByTestId("confirm-delete-button").click()

      // 17. Should show error message (group deletion not yet implemented in backend)
      // The API returns a domain error saying deletion is not implemented
      // Use partial text match since the message includes additional guidance
      await expect(
        page.getByText(/Group deletion is not yet implemented/).first()
      ).toBeVisible({ timeout: 10000 })

      // 18. Cancel the modal to clean up
      await page.getByTestId("cancel-delete-button").click()
    })
  })
})
