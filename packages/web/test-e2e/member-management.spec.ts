/**
 * Member Management E2E Tests
 *
 * Tests for organization member management:
 * - Owner transfer flow
 * - Member invitation duplicate handling
 *
 * Note: Member removal/reinstatement/suspension tests are skipped pending
 * API changes to return all members (not just active ones).
 */

import { test, expect, APIRequestContext, Page } from "@playwright/test"

// Helper function to register and login a test user
async function createAuthenticatedUser(
  request: APIRequestContext,
  prefix: string
): Promise<{ email: string; password: string; displayName: string; token: string }> {
  const testUser = {
    email: `${prefix}-${Date.now()}@example.com`,
    password: "TestPassword123",
    displayName: `${prefix} User`
  }

  const registerRes = await request.post("/api/auth/register", { data: testUser })
  expect(registerRes.ok()).toBeTruthy()

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

  return { ...testUser, token: loginData.token }
}

// Helper function to create an organization
async function createOrganization(
  request: APIRequestContext,
  token: string,
  name: string
): Promise<{ id: string; name: string }> {
  const createOrgRes = await request.post("/api/v1/organizations", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      reportingCurrency: "USD",
      settings: null
    }
  })
  expect(createOrgRes.ok()).toBeTruthy()
  return await createOrgRes.json()
}

// Helper to set session cookie
async function setSessionCookie(
  page: Page,
  token: string
) {
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
}

// Helper to invite and accept an invitation
async function inviteAndAcceptMember(
  request: APIRequestContext,
  ownerToken: string,
  memberToken: string,
  orgId: string,
  email: string,
  role: "admin" | "member" | "viewer"
): Promise<void> {
  const inviteRes = await request.post(`/api/v1/organizations/${orgId}/members/invite`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: {
      email,
      role,
      functionalRoles: []
    }
  })
  expect(inviteRes.ok()).toBeTruthy()
  const inviteData = await inviteRes.json()

  const acceptRes = await request.post(`/api/v1/invitations/${inviteData.invitationToken}/accept`, {
    headers: { Authorization: `Bearer ${memberToken}` }
  })
  expect(acceptRes.ok()).toBeTruthy()
}

test.describe("Member Management - Owner Transfer", () => {
  test("should display transfer ownership option for owner", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-display")
    const org = await createOrganization(request, owner.token, `Transfer Display Org ${Date.now()}`)

    // Set session and navigate to members page
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // Find owner's action menu and click it
    // First find the row with "(You)" indicator and get its action button
    const ownerRow = page.locator("tr", { hasText: "(You)" })
    await expect(ownerRow).toBeVisible()

    const actionButton = ownerRow.locator("button").last()
    await actionButton.click({ force: true })

    // Should see transfer ownership option
    await expect(page.getByTestId("member-transfer-ownership")).toBeVisible({ timeout: 5000 })
  })

  test("should show no eligible members message when no admins exist", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-no-admins")
    const org = await createOrganization(request, owner.token, `No Admins Org ${Date.now()}`)

    // Set session and navigate to members page
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // Click owner's action menu
    const ownerRow = page.locator("tr", { hasText: "(You)" })
    const actionButton = ownerRow.locator("button").last()
    await actionButton.click({ force: true })

    // Click transfer ownership
    await page.getByTestId("member-transfer-ownership").click()

    // Should show the modal
    await expect(page.getByTestId("transfer-ownership-modal")).toBeVisible({ timeout: 5000 })

    // Should show message about no eligible members
    await expect(page.getByText("No eligible members")).toBeVisible()
  })

  test("should show member in list after accepting invitation", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-transfer")
    const org = await createOrganization(request, owner.token, `Transfer Test Org ${Date.now()}`)

    // Create a second user to become admin
    const adminUser = await createAuthenticatedUser(request, "admin-target")

    // Invite and accept as admin
    await inviteAndAcceptMember(request, owner.token, adminUser.token, org.id, adminUser.email, "admin")

    // Set session and navigate to members page as owner
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load and show both members
    await expect(page.getByTestId("members-page")).toBeVisible()

    // The admin user should now appear in the members list
    await expect(page.getByText(adminUser.displayName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(adminUser.email)).toBeVisible()
  })

  test("should transfer ownership to admin successfully", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-xfer")
    const org = await createOrganization(request, owner.token, `Xfer Test Org ${Date.now()}`)

    // Create a second user to become admin
    const adminUser = await createAuthenticatedUser(request, "admin-new-owner")

    // Invite and accept as admin
    await inviteAndAcceptMember(request, owner.token, adminUser.token, org.id, adminUser.email, "admin")

    // Set session and navigate to members page as owner
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load and show both members
    await expect(page.getByTestId("members-page")).toBeVisible()
    await expect(page.getByText(adminUser.displayName)).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(500)

    // Click owner's action menu
    const ownerRow = page.locator("tr", { hasText: "(You)" })
    const actionButton = ownerRow.locator("button").last()
    await actionButton.click({ force: true })

    // Click transfer ownership
    await page.getByTestId("member-transfer-ownership").click()

    // Should show the modal
    await expect(page.getByTestId("transfer-ownership-modal")).toBeVisible({ timeout: 5000 })

    // Select the new owner - use the index since the admin is the only option after "Select a member..."
    // The select has options: "Select a member...", "admin-new-owner User (email)"
    await page.getByTestId("transfer-target-select").selectOption({ index: 1 })

    // Click continue
    await page.getByTestId("transfer-continue-button").click()

    // Should show confirmation
    await expect(page.getByText("This action cannot be undone")).toBeVisible({ timeout: 5000 })

    // Click transfer
    await page.getByTestId("transfer-confirm-button").click()

    // Wait for page to refresh
    await page.waitForTimeout(1000)
    await page.reload()

    // Verify the new owner via API
    const membersRes = await request.get(`/api/v1/organizations/${org.id}/members`, {
      headers: { Authorization: `Bearer ${owner.token}` }
    })
    expect(membersRes.ok()).toBeTruthy()
    const membersData = await membersRes.json()

    const newOwner = membersData.members.find((m: { role: string }) => m.role === "owner")
    expect(newOwner.email).toBe(adminUser.email)
  })
})

test.describe("Member Management - Duplicate Invitation", () => {
  test("should show friendly error for duplicate invitation", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-dup-invite")
    const org = await createOrganization(request, owner.token, `Dup Invite Test Org ${Date.now()}`)

    // Create the email to invite
    const inviteEmail = `duplicate-test-${Date.now()}@example.com`

    // Create first invitation via API
    const inviteRes = await request.post(`/api/v1/organizations/${org.id}/members/invite`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: {
        email: inviteEmail,
        role: "member",
        functionalRoles: []
      }
    })
    expect(inviteRes.ok()).toBeTruthy()

    // Set session and navigate to members page
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // Click invite button
    await page.getByTestId("members-invite-button").click({ force: true })

    // Wait for modal to appear
    await expect(page.getByTestId("invite-member-modal")).toBeVisible({ timeout: 5000 })

    // Fill in the same email
    await page.getByTestId("invite-email-input").fill(inviteEmail)

    // Submit the form
    await page.getByTestId("invite-submit-button").click()

    // Should show the friendly duplicate error message (yellow warning)
    await expect(page.getByTestId("invite-error-message")).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Invitation already exists")).toBeVisible()

    // The button should now say "View Pending Invitations"
    await expect(page.getByTestId("invite-view-pending-button")).toBeVisible()
  })
})

// Note: The following tests are skipped because the API's listMembers endpoint
// only returns active members, but the UI expects to show inactive members too.
// These tests will work once the API is updated to return all members.
test.describe.skip("Member Management - Removal and Reinstatement (API FIX NEEDED)", () => {
  test("should show removed member in inactive section", async () => {
    // This test requires the API to return all members (including removed)
    // Currently listMembers only returns active members
  })

  test("should reinstate a removed member via UI", async () => {
    // This test requires the API to return all members (including removed)
  })

  test("should show suspended member in inactive section", async () => {
    // This test requires the API to return all members (including suspended)
  })
})
