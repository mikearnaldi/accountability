/**
 * User Profile E2E Tests
 *
 * Tests for the user profile page:
 * - View profile information (email, provider)
 * - Update display name
 * - View linked identities
 * - View organization memberships with roles
 * - Navigation and breadcrumbs
 */

import { test, expect } from "@playwright/test"

test.describe("User Profile Page", () => {
  test("should redirect to login if not authenticated", async ({ page }) => {
    // 1. Navigate to profile page without authentication
    await page.goto("/profile")

    // 2. Should redirect to login with redirect param
    await page.waitForURL(/\/login/)

    // 3. Verify redirect
    const url = new URL(page.url())
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("redirect")).toBe("/profile")
  })

  test("should display user profile information", async ({ page, request }) => {
    // 1. Register a test user
    const displayName = `Profile Test User ${Date.now()}`
    const testUser = {
      email: `test-profile-view-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName
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

    // 3. Set session cookie
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

    // 4. Navigate to profile page
    await page.goto("/profile")

    // 5. Should be on profile page
    await expect(page.getByTestId("profile-page")).toBeVisible()

    // 6. Should show "Profile" heading
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true })
    ).toBeVisible()

    // 7. Should show user email (read-only)
    await expect(page.getByTestId("profile-email")).toContainText(testUser.email)

    // 8. Should show display name in input
    const displayNameInput = page.getByTestId("profile-display-name-input")
    await expect(displayNameInput).toHaveValue(displayName)

    // 9. Should show "Your Organizations" section (roles are shown per-organization, not globally)
    await expect(page.getByText("Your Organizations")).toBeVisible()

    // 10. Should show primary sign-in method
    await expect(page.getByTestId("profile-provider")).toContainText("Email & Password")

    // 11. Should show "Member Since" date
    await expect(page.getByTestId("profile-member-since")).toBeVisible()

    // 12. Should show linked identity for local provider
    await expect(page.getByTestId("profile-identity-local")).toBeVisible()
  })

  test("should update display name successfully", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-profile-update-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Original Name"
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

    // 3. Set session cookie
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

    // 4. Set localStorage token (needed for client-side API calls)
    await page.goto("/login")
    await page.evaluate((token) => {
      localStorage.setItem("accountabilitySessionToken", token)
    }, sessionToken)

    // 5. Navigate to profile page
    await page.goto("/profile")

    // 6. Wait for page to load
    await expect(page.getByTestId("profile-page")).toBeVisible()

    // 7. Verify initial display name
    const displayNameInput = page.getByTestId("profile-display-name-input")
    await expect(displayNameInput).toHaveValue("Original Name")

    // 8. Save button should be disabled when no changes
    const saveButton = page.getByTestId("profile-save-button")
    await expect(saveButton).toBeDisabled()

    // 9. Update display name
    await displayNameInput.clear()
    await displayNameInput.fill("Updated Name")

    // 10. Save button should now be enabled
    await expect(saveButton).toBeEnabled()

    // 11. Click save button
    await saveButton.click()

    // 12. Should show success message
    await expect(page.getByTestId("profile-save-success")).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId("profile-save-success")).toContainText("Profile updated successfully")

    // 13. Verify the change persisted by reloading
    await page.reload()
    await expect(page.getByTestId("profile-page")).toBeVisible()
    await expect(displayNameInput).toHaveValue("Updated Name")
  })

  test("should not save when display name is unchanged", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-profile-unchanged-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Test User Name"
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

    // 3. Set session cookie
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

    // 4. Navigate to profile page
    await page.goto("/profile")

    // 5. Wait for page to load
    await expect(page.getByTestId("profile-page")).toBeVisible()

    // 6. Save button should be disabled when no changes
    const saveButton = page.getByTestId("profile-save-button")
    await expect(saveButton).toBeDisabled()

    // 7. Type something then clear back to original
    const displayNameInput = page.getByTestId("profile-display-name-input")

    // Wait for input to be ready and hydrated
    await page.waitForTimeout(500)

    // Fill with a different value
    await displayNameInput.fill("Changed")

    // Wait for React state update
    await expect(saveButton).toBeEnabled({ timeout: 10000 })

    // 8. Revert to original value
    await displayNameInput.fill("Test User Name")
    await expect(saveButton).toBeDisabled({ timeout: 10000 })
  })

  test("should show delete account button as disabled", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-profile-delete-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Delete Test User"
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

    // 3. Set session cookie
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

    // 4. Navigate to profile page
    await page.goto("/profile")

    // 5. Wait for page to load
    await expect(page.getByTestId("profile-page")).toBeVisible()

    // 6. Should show Danger Zone section with disabled delete button
    await expect(page.getByText("Danger Zone")).toBeVisible()
    const deleteButton = page.getByTestId("profile-delete-button")
    await expect(deleteButton).toBeVisible()
    await expect(deleteButton).toBeDisabled()
  })

  test("should navigate back to organizations via back arrow", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-profile-nav-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Nav Test User"
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

    // 3. Set session cookie
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

    // 4. Navigate to profile page
    await page.goto("/profile")

    // 5. Wait for page to load
    await expect(page.getByTestId("profile-page")).toBeVisible()

    // 6. Click back arrow button (uses browser history or navigates to organizations)
    // Since we navigated directly to /profile, clicking back should go to /organizations
    await page.getByRole("button", { name: "Go back" }).click()

    // 7. Should navigate to organizations page (fallback when no history)
    await page.waitForURL("/organizations")
    expect(page.url()).toContain("/organizations")
  })

  test("should show account information card with correct sections", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-profile-sections-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Sections Test User"
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

    // 3. Set session cookie
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

    // 4. Navigate to profile page
    await page.goto("/profile")

    // 5. Wait for page to load
    await expect(page.getByTestId("profile-page")).toBeVisible()

    // 6. Should show Account Information card header
    await expect(page.getByText("Account Information")).toBeVisible()

    // 7. Should show Authentication card header
    await expect(page.getByText("Authentication")).toBeVisible()

    // 8. Should show Display Name label
    await expect(page.getByText("Display Name")).toBeVisible()

    // 9. Should show Email Address label with "cannot be changed" note
    await expect(page.getByText("Email Address")).toBeVisible()
    await expect(page.getByText("Email cannot be changed")).toBeVisible()

    // 10. Should show "Your Organizations" section (role is shown per-organization now)
    await expect(page.getByText("Your Organizations")).toBeVisible()
    await expect(page.getByText("Organizations you are a member of and your roles")).toBeVisible()

    // 11. Should show Primary Sign-in Method label
    await expect(page.getByText("Primary Sign-in Method")).toBeVisible()

    // 12. Should show Linked Accounts label
    await expect(page.getByText("Linked Accounts")).toBeVisible()

    // 13. Should show Member Since label
    await expect(page.getByText("Member Since")).toBeVisible()
  })

  test("should display breadcrumbs correctly", async ({ page, request }) => {
    // 1. Register a test user
    const testUser = {
      email: `test-profile-breadcrumbs-${Date.now()}@example.com`,
      password: "TestPassword123",
      displayName: "Breadcrumbs Test User"
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

    // 3. Set session cookie
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

    // 4. Navigate to profile page
    await page.goto("/profile")

    // 5. Wait for page to load
    await expect(page.getByTestId("profile-page")).toBeVisible()

    // 6. Should show breadcrumbs with Accountability link
    await expect(
      page.getByRole("link", { name: "Accountability" })
    ).toBeVisible()

    // 7. Should show Profile in breadcrumb (current page)
    await expect(page.getByTestId("breadcrumbs")).toContainText("Profile")
  })
})
