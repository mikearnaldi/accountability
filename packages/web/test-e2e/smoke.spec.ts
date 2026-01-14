/**
 * Smoke Test
 *
 * Basic tests to verify the application loads and essential infrastructure works.
 */

import { test, expect } from "@playwright/test"

test.describe("Smoke Tests", () => {
  test("should load the home page", async ({ page }) => {
    await page.goto("/")

    // Verify the page loads with the expected title
    await expect(page).toHaveTitle(/Accountability/)

    // Verify the main heading is visible (exact: true to avoid matching "Welcome to Accountability")
    await expect(page.getByRole("heading", { name: "Accountability", exact: true })).toBeVisible()
  })

  test("should return 404 for non-existent routes", async ({ page }) => {
    await page.goto("/non-existent-route")

    // Verify 404 page is shown
    await expect(page.getByText("404")).toBeVisible()
  })

  test("API health check - should respond to API requests", async ({ page }) => {
    // Test that the API route handler is working
    const response = await page.request.get("/api/health")

    // The health endpoint should respond (even if it returns an error, the handler is working)
    expect(response.status()).toBeLessThan(500)
  })
})
