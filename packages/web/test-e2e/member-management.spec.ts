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
): Promise<{ email: string; password: string; displayName: string; token: string; userId: string }> {
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

  return { ...testUser, token: loginData.token, userId: loginData.user.id }
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

test.describe("Member Management - Removal and Reinstatement", () => {
  test("should remove a member and show in inactive section", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-remove")
    const org = await createOrganization(request, owner.token, `Remove Member Org ${Date.now()}`)

    // Create a member to be removed
    const memberUser = await createAuthenticatedUser(request, "member-to-remove")

    // Invite and accept as member
    await inviteAndAcceptMember(request, owner.token, memberUser.token, org.id, memberUser.email, "member")

    // Set session and navigate to members page as owner
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load and show the member
    await expect(page.getByTestId("members-page")).toBeVisible()
    await expect(page.getByText(memberUser.displayName)).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(500)

    // Find the member's row (not the owner)
    const memberRow = page.locator("tr").filter({ hasText: memberUser.email })
    await expect(memberRow).toBeVisible()

    // Click the action menu
    const actionButton = memberRow.locator("button").last()
    await actionButton.click({ force: true })

    // Set up dialog handler to accept confirm dialogs
    page.on("dialog", (dialog) => dialog.accept())

    // Click remove and wait for API call to complete
    const removeResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/members/") && resp.request().method() === "DELETE"
    )
    await page.getByTestId("member-remove").click()
    await removeResponsePromise

    // Wait for refresh and reload to ensure member list is updated
    await page.waitForTimeout(500)
    await page.reload()
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // The member should now appear in the inactive section
    await expect(page.getByText("Inactive Members")).toBeVisible({ timeout: 10000 })

    // Expand the inactive section if needed
    const inactiveSection = page.locator("[data-testid='inactive-members-section']")
    if (await inactiveSection.isVisible()) {
      // Member should be visible in inactive section
      const inactiveRow = inactiveSection.locator("tr").filter({ hasText: memberUser.email })
      await expect(inactiveRow).toBeVisible()
      await expect(inactiveRow.getByText("Removed")).toBeVisible()
    }
  })

  test("should reinstate a removed member via UI", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-reinstate")
    const org = await createOrganization(request, owner.token, `Reinstate Member Org ${Date.now()}`)

    // Create a member to be removed and reinstated
    const memberUser = await createAuthenticatedUser(request, "member-to-reinstate")

    // Invite and accept as member
    await inviteAndAcceptMember(request, owner.token, memberUser.token, org.id, memberUser.email, "member")

    // Remove the member via API (using userId, not email)
    const removeRes = await request.delete(`/api/v1/organizations/${org.id}/members/${memberUser.userId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { reason: "Testing removal" }
    })
    expect(removeRes.ok()).toBeTruthy()

    // Set session and navigate to members page as owner
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // The member should be in the inactive section
    await expect(page.getByText("Inactive Members")).toBeVisible({ timeout: 10000 })

    // Find the inactive member's row
    const inactiveSection = page.locator("[data-testid='inactive-members-section']")
    await expect(inactiveSection).toBeVisible()
    const memberRow = inactiveSection.locator("tr").filter({ hasText: memberUser.email })
    await expect(memberRow).toBeVisible()

    // Click the action menu for the inactive member
    const actionButton = memberRow.locator("button").last()
    await actionButton.click({ force: true })

    // Click reinstate
    await page.getByTestId("member-reinstate").click()

    // Wait for success and reload
    await page.waitForTimeout(1000)
    await page.reload()
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // The member should now be back in the active members section
    const activeMembersSection = page.locator("[data-testid='active-members-section']")
    const reactiveMemberRow = activeMembersSection.locator("tr").filter({ hasText: memberUser.email })
    await expect(reactiveMemberRow).toBeVisible({ timeout: 10000 })
  })

  test("should suspend a member and show in inactive section", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-suspend")
    const org = await createOrganization(request, owner.token, `Suspend Member Org ${Date.now()}`)

    // Create a member to be suspended
    const memberUser = await createAuthenticatedUser(request, "member-to-suspend")

    // Invite and accept as member
    await inviteAndAcceptMember(request, owner.token, memberUser.token, org.id, memberUser.email, "member")

    // Set session and navigate to members page as owner
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load and show the member
    await expect(page.getByTestId("members-page")).toBeVisible()
    await expect(page.getByText(memberUser.displayName)).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(500)

    // Find the member's row (not the owner)
    const memberRow = page.locator("tr").filter({ hasText: memberUser.email })
    await expect(memberRow).toBeVisible()

    // Click the action menu
    const actionButton = memberRow.locator("button").last()
    await actionButton.click({ force: true })

    // Set up dialog handler to accept confirm dialogs
    page.on("dialog", (dialog) => dialog.accept())

    // Click suspend and wait for API call to complete
    const suspendResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/suspend") && resp.request().method() === "POST"
    )
    await page.getByTestId("member-suspend").click()
    await suspendResponsePromise

    // Wait for refresh and reload to ensure member list is updated
    await page.waitForTimeout(500)
    await page.reload()
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // The member should now appear in the inactive section
    await expect(page.getByText("Inactive Members")).toBeVisible({ timeout: 10000 })

    // Find the suspended member
    const inactiveSection = page.locator("[data-testid='inactive-members-section']")
    await expect(inactiveSection).toBeVisible()
    const suspendedRow = inactiveSection.locator("tr").filter({ hasText: memberUser.email })
    await expect(suspendedRow).toBeVisible()
    await expect(suspendedRow.getByText("Suspended")).toBeVisible()
  })

  test("should unsuspend a member via UI", async ({ page, request }) => {
    // Create owner and organization
    const owner = await createAuthenticatedUser(request, "owner-unsuspend")
    const org = await createOrganization(request, owner.token, `Unsuspend Member Org ${Date.now()}`)

    // Create a member to be suspended and unsuspended
    const memberUser = await createAuthenticatedUser(request, "member-to-unsuspend")

    // Invite and accept as member
    await inviteAndAcceptMember(request, owner.token, memberUser.token, org.id, memberUser.email, "member")

    // Suspend the member via API (using userId, not email)
    const suspendRes = await request.post(`/api/v1/organizations/${org.id}/members/${memberUser.userId}/suspend`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { reason: null }
    })
    expect(suspendRes.ok()).toBeTruthy()

    // Set session and navigate to members page as owner
    await setSessionCookie(page, owner.token)
    await page.goto(`/organizations/${org.id}/settings/members`)

    // Wait for page to load
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // The member should be in the inactive section
    await expect(page.getByText("Inactive Members")).toBeVisible({ timeout: 10000 })

    // Find the suspended member's row
    const inactiveSection = page.locator("[data-testid='inactive-members-section']")
    await expect(inactiveSection).toBeVisible()
    const memberRow = inactiveSection.locator("tr").filter({ hasText: memberUser.email })
    await expect(memberRow).toBeVisible()

    // Click the action menu
    const actionButton = memberRow.locator("button").last()
    await actionButton.click({ force: true })

    // Click unsuspend
    await page.getByTestId("member-unsuspend").click()

    // Wait for success and reload
    await page.waitForTimeout(1000)
    await page.reload()
    await expect(page.getByTestId("members-page")).toBeVisible()
    await page.waitForTimeout(500)

    // The member should now be back in the active members section
    const activeMembersSection = page.locator("[data-testid='active-members-section']")
    const reactiveMemberRow = activeMembersSection.locator("tr").filter({ hasText: memberUser.email })
    await expect(reactiveMemberRow).toBeVisible({ timeout: 10000 })
  })
})
