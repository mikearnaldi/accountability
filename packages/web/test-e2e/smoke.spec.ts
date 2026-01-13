import { test, expect } from "@playwright/test"

test.describe("Smoke Tests", () => {
  test("home page loads successfully", async ({ page }) => {
    await page.goto("/")

    // Check page title
    await expect(page).toHaveTitle(/Accountability/)

    // Check main heading is visible
    await expect(page.getByRole("heading", { name: "Welcome to Accountability" })).toBeVisible()

    // Check navigation is present
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
  })

  test("login page loads successfully", async ({ page }) => {
    await page.goto("/login")

    // Check login form elements are present
    await expect(page.getByRole("heading", { name: /Sign in|Login/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in|login/i })).toBeVisible()
  })

  test("register page loads successfully", async ({ page }) => {
    await page.goto("/register")

    // Check registration form elements are present
    await expect(page.getByRole("heading", { name: /register|sign up|create account/i })).toBeVisible()
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i).first()).toBeVisible()
  })

  test("navigation works correctly", async ({ page }) => {
    await page.goto("/")

    // Click sign in link
    await page.getByRole("link", { name: "Sign in" }).click()

    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/)

    // Click home link to go back
    await page.getByRole("link", { name: "Home" }).click()

    // Should be back on home page
    await expect(page).toHaveURL("/")
  })

  test("API health check - server responds", async ({ request }) => {
    // Simple check that the server is responding
    const response = await request.get("/")
    expect(response.ok()).toBeTruthy()
    expect(response.status()).toBe(200)
  })
})
