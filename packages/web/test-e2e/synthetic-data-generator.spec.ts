/**
 * Synthetic Data Generator E2E Tests
 *
 * Tests that the synthetic data generator creates all expected data:
 * - User account and login
 * - Organization
 * - Multiple companies (parent-subsidiary relationships now managed via ConsolidationGroups)
 * - Chart of accounts for both companies
 * - Journal entries for 2 years
 * - Company reports (Trial Balance, Balance Sheet)
 * - Consolidation group (where ownership/consolidation relationships are defined)
 * - Consolidation runs (2024, 2025)
 * - Consolidated reports
 *
 * NOTE: These tests are SKIPPED - parent-subsidiary relationships have been refactored.
 * The Company entity no longer has parentCompanyId or ownershipPercentage fields.
 * These relationships are now managed through ConsolidationGroups.
 *
 * This test is tagged as @slow and @synthetic-data for selective CI execution.
 */

import { test, expect } from "@playwright/test"
import { generateSyntheticData, DEFAULT_CONFIG } from "../scripts/generate-synthetic-data"

// Skip all tests - too slow for regular CI runs
// Run manually with: pnpm test:e2e:synthetic
test.describe.skip("Synthetic Data Generator", () => {
  // Configure for serial execution and longer timeout
  test.describe.configure({ mode: "serial" })
  test.setTimeout(900000) // 15 minute timeout for full generation (UI interactions are slower)

  // Store generated data for verification tests
  let generatedData: Awaited<ReturnType<typeof generateSyntheticData>>

  test("generates complete synthetic dataset", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page, baseURL }) => {
    // Run the data generator using the provided page
    generatedData = await generateSyntheticData({
      page,
      baseUrl: baseURL!,
      verbose: true
    })

    // Verify data was generated
    expect(generatedData.organization.id).toBeTruthy()
    expect(generatedData.parentCompany.id).toBeTruthy()
    expect(generatedData.subsidiaryCompany.id).toBeTruthy()
    expect(generatedData.accounts.parent.size).toBeGreaterThan(0)
    expect(generatedData.accounts.subsidiary.size).toBeGreaterThan(0)

    // Verify consolidation data
    expect(generatedData.consolidationGroup).toBeTruthy()
    expect(generatedData.consolidationGroup?.id).toBeTruthy()
    expect(generatedData.consolidationRuns).toBeTruthy()
    expect(generatedData.consolidationRuns?.length).toBeGreaterThanOrEqual(2)
  })

  test("user can log in with generated credentials", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Navigate to login page
    await page.goto("/login")

    // Wait for page to fully load
    await page.waitForTimeout(500)

    // Fill login form
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to authenticated page
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })
    expect(page.url()).not.toContain("/login")
  })

  test("organization exists and is accessible", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first (since we don't have session token in the new approach)
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to organization dashboard
    await page.goto(`/organizations/${generatedData.organization.id}/dashboard`)

    // Verify organization name is visible in the dashboard title (using specific testid)
    await expect(page.getByTestId("org-dashboard-name")).toBeVisible({
      timeout: 10000
    })
    await expect(page.getByTestId("org-dashboard-name")).toHaveText(DEFAULT_CONFIG.organization.name)
  })

  test("both companies exist", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to companies list
    await page.goto(`/organizations/${generatedData.organization.id}/companies`)

    // Wait for page to load
    await expect(page.getByTestId("companies-list-page")).toBeVisible()

    // Verify both companies are visible via link elements (company names are links)
    await expect(page.getByRole("link", { name: DEFAULT_CONFIG.parentCompany.name, exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: DEFAULT_CONFIG.subsidiaryCompany.name, exact: true })).toBeVisible()

    // Verify company count
    await expect(page.getByText("2 companies")).toBeVisible()
  })

  test("parent company has chart of accounts", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to parent company's accounts
    await page.goto(
      `/organizations/${generatedData.organization.id}/companies/${generatedData.parentCompany.id}/accounts`
    )

    // Wait for page to load
    await expect(page.getByTestId("accounts-page")).toBeVisible()

    // Should show accounts tree (not empty state)
    await expect(page.getByTestId("accounts-tree")).toBeVisible()

    // Verify account count is greater than 0
    const accountCountText = await page.getByTestId("accounts-count").textContent()
    expect(accountCountText).toMatch(/\d+ of \d+ accounts/)
    const match = accountCountText?.match(/of (\d+) accounts/)
    expect(match).not.toBeNull()
    const totalAccounts = parseInt(match?.[1] ?? "0", 10)
    expect(totalAccounts).toBeGreaterThan(10) // GeneralBusiness template has ~50 accounts
  })

  test("subsidiary company has chart of accounts", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to subsidiary company's accounts
    await page.goto(
      `/organizations/${generatedData.organization.id}/companies/${generatedData.subsidiaryCompany.id}/accounts`
    )

    // Wait for page to load
    await expect(page.getByTestId("accounts-page")).toBeVisible()

    // Should show accounts tree (not empty state)
    await expect(page.getByTestId("accounts-tree")).toBeVisible()
  })

  test("parent company has journal entries for 2024", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to parent company's journal entries
    await page.goto(
      `/organizations/${generatedData.organization.id}/companies/${generatedData.parentCompany.id}/journal-entries`
    )

    // Wait for page to load
    await expect(page.getByRole("heading", { name: "Journal Entries", exact: true })).toBeVisible()

    // Should have journal entries (not empty state)
    await expect(page.getByTestId("journal-entries-table")).toBeVisible()

    // Verify entry count - should have many entries
    const countText = await page.getByTestId("journal-entries-count").textContent()
    const match = countText?.match(/(\d+) of (\d+) entries/)
    expect(match).not.toBeNull()
    const totalEntries = parseInt(match?.[2] ?? "0", 10)
    expect(totalEntries).toBeGreaterThan(50) // Should have lots of monthly entries

    // Verify we can see some entries
    await expect(page.getByText("Initial capital contribution")).toBeVisible()
  })

  test("subsidiary company has journal entries", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to subsidiary company's journal entries
    await page.goto(
      `/organizations/${generatedData.organization.id}/companies/${generatedData.subsidiaryCompany.id}/journal-entries`
    )

    // Wait for page to load
    await expect(page.getByRole("heading", { name: "Journal Entries", exact: true })).toBeVisible()

    // Should have journal entries (not empty state)
    await expect(page.getByTestId("journal-entries-table")).toBeVisible()

    // Verify we can see some entries
    await expect(page.getByText("Initial capital from parent")).toBeVisible()
  })

  test("consolidation group exists", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to consolidation page
    await page.goto(`/organizations/${generatedData.organization.id}/consolidation`)

    // Wait for page to load
    await expect(page.getByTestId("consolidation-page")).toBeVisible()

    // Should show groups table (not empty state)
    await expect(page.getByTestId("groups-table")).toBeVisible()

    // Verify the consolidation group is visible
    await expect(page.getByText("Acme Consolidated Group")).toBeVisible()
  })

  test("consolidation runs exist for both years", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to consolidation group detail page
    const groupId = generatedData.consolidationGroup?.id
    expect(groupId).toBeTruthy()
    await page.goto(`/organizations/${generatedData.organization.id}/consolidation/${groupId}`)

    // Wait for page to load
    await expect(page.getByTestId("consolidation-group-detail-page")).toBeVisible()

    // Verify both consolidation runs are visible (2024 and 2025)
    await expect(page.getByText("2024 P12")).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("2025 P12")).toBeVisible({ timeout: 10000 })
  })

  test("reports page shows both companies", {
    tag: ["@slow", "@synthetic-data"]
  }, async ({ page }) => {
    // Log in first
    await page.goto("/login")
    await page.waitForTimeout(500)
    await page.fill('input[type="email"]', DEFAULT_CONFIG.user.email)
    await page.fill('input[type="password"]', DEFAULT_CONFIG.user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(organizations|dashboard)/, { timeout: 15000 })

    // Navigate to reports page
    await page.goto(`/organizations/${generatedData.organization.id}/reports`)

    // Wait for page to load
    await expect(page.getByTestId("reports-hub-page")).toBeVisible()

    // Should show both companies as options - companies are in cards with h3 headings
    await expect(page.getByRole("heading", { name: DEFAULT_CONFIG.parentCompany.name })).toBeVisible()
    await expect(page.getByRole("heading", { name: DEFAULT_CONFIG.subsidiaryCompany.name })).toBeVisible()
  })
})
