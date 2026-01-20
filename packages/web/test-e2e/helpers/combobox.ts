/**
 * E2E Test Helpers for Combobox Components
 *
 * These helpers work with the Combobox component which is used by:
 * - CurrencySelect
 * - JurisdictionSelect
 * - Account Select (in journal entries)
 *
 * The Combobox is a div-based searchable dropdown, not a native <select>.
 */

import type { Page, expect as Expect } from "@playwright/test"

/**
 * Helper to select an option from a Combobox component.
 * Uses @floating-ui/react which handles click on the container div, not the button.
 *
 * @param page - Playwright page
 * @param testId - The data-testid of the combobox
 * @param searchText - Text to search for (partial match)
 * @param expect - Playwright expect function (required for visibility assertions)
 */
export async function selectComboboxOption(
  page: Page,
  testId: string,
  searchText: string,
  expect: typeof Expect
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)

  // Wait for combobox to be ready
  await expect(combobox).toBeVisible({ timeout: 5000 })

  // Get the button inside (to verify state before/after click)
  const button = combobox.locator("button")
  await expect(button).toBeVisible({ timeout: 5000 })

  // Click the button to trigger the dropdown open
  // The floating-ui useClick hook is on the parent div, but the button click bubbles up
  await button.click()

  // Wait a moment for React state to update
  await page.waitForTimeout(100)

  // Wait for dropdown to open - the combobox shows input when open
  const input = combobox.locator("input")

  // If input is not visible yet, the click might not have triggered - try clicking again
  const inputVisible = await input.isVisible().catch(() => false)
  if (!inputVisible) {
    // Try clicking the container div directly with force
    await combobox.click({ force: true })
    await page.waitForTimeout(100)
  }

  await expect(input).toBeVisible({ timeout: 5000 })

  // Type to filter options
  await input.fill(searchText)

  // Wait for dropdown list to appear (rendered in FloatingPortal)
  await expect(page.locator("li").first()).toBeVisible({ timeout: 5000 })

  // Click the first matching option in the dropdown
  const option = page.locator(`li:has-text("${searchText}")`).first()
  await expect(option).toBeVisible({ timeout: 5000 })
  await option.click()

  // Wait for dropdown to close and state to update
  await page.waitForTimeout(200)
}

/**
 * Helper to verify a Combobox has a specific value selected.
 * Since Combobox is not a native select, we check the displayed text.
 *
 * @param page - Playwright page
 * @param testId - The data-testid of the combobox
 * @param expectedText - Text that should be displayed (partial match)
 * @param expect - Playwright expect function
 */
export async function expectComboboxValue(
  page: Page,
  testId: string,
  expectedText: string,
  expect: typeof Expect
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)
  const displayButton = combobox.locator("button")
  await expect(displayButton).toContainText(expectedText)
}

/**
 * Helper to verify a Combobox is visible and ready for interaction.
 *
 * @param page - Playwright page
 * @param testId - The data-testid of the combobox
 * @param expect - Playwright expect function
 */
export async function expectComboboxVisible(
  page: Page,
  testId: string,
  expect: typeof Expect
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)
  await expect(combobox).toBeVisible()
}

/**
 * Helper to get the currently displayed value of a Combobox.
 *
 * @param page - Playwright page
 * @param testId - The data-testid of the combobox
 * @returns The text displayed in the combobox button
 */
export async function getComboboxDisplayValue(
  page: Page,
  testId: string
): Promise<string | null> {
  const combobox = page.locator(`[data-testid="${testId}"]`)
  const displayButton = combobox.locator("button")
  return displayButton.textContent()
}

/**
 * Helper to check if a Combobox shows a placeholder (no value selected).
 *
 * @param page - Playwright page
 * @param testId - The data-testid of the combobox
 * @param placeholderText - Expected placeholder text
 * @param expect - Playwright expect function
 */
export async function expectComboboxHasPlaceholder(
  page: Page,
  testId: string,
  placeholderText: string,
  expect: typeof Expect
): Promise<void> {
  const combobox = page.locator(`[data-testid="${testId}"]`)
  const displayButton = combobox.locator("button")
  await expect(displayButton).toContainText(placeholderText)
}
