/**
 * CurrencyInputUtils - Utility functions for currency input formatting
 *
 * Provides functions for formatting and parsing currency values with
 * proper decimal handling, thousand separators, and locale support.
 *
 * @module CurrencyInputUtils
 */

import type { Currency, DecimalPlaces } from "@accountability/core/Domains/Currency"

// =============================================================================
// Types
// =============================================================================

/**
 * Locale configuration for currency formatting
 */
export interface LocaleConfig {
  /**
   * Thousands separator character
   */
  readonly thousandsSeparator: string

  /**
   * Decimal separator character
   */
  readonly decimalSeparator: string

  /**
   * Whether currency symbol should appear before the number
   */
  readonly symbolPosition: "prefix" | "suffix"

  /**
   * Space between symbol and number
   */
  readonly symbolSpacing: string
}

/**
 * Common locale configurations
 */
export const LOCALES: Record<string, LocaleConfig> = {
  "en-US": {
    thousandsSeparator: ",",
    decimalSeparator: ".",
    symbolPosition: "prefix",
    symbolSpacing: ""
  },
  "en-GB": {
    thousandsSeparator: ",",
    decimalSeparator: ".",
    symbolPosition: "prefix",
    symbolSpacing: ""
  },
  "de-DE": {
    thousandsSeparator: ".",
    decimalSeparator: ",",
    symbolPosition: "suffix",
    symbolSpacing: " "
  },
  "fr-FR": {
    thousandsSeparator: " ",
    decimalSeparator: ",",
    symbolPosition: "suffix",
    symbolSpacing: " "
  },
  "ja-JP": {
    thousandsSeparator: ",",
    decimalSeparator: ".",
    symbolPosition: "prefix",
    symbolSpacing: ""
  },
  "zh-CN": {
    thousandsSeparator: ",",
    decimalSeparator: ".",
    symbolPosition: "prefix",
    symbolSpacing: ""
  }
}

/**
 * Default locale configuration (en-US)
 */
export const DEFAULT_LOCALE: LocaleConfig = LOCALES["en-US"]

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Parse a formatted currency string to a raw numeric string
 *
 * Removes formatting characters (thousands separators, currency symbols)
 * and normalizes the decimal separator to a period.
 *
 * @param value - The formatted input value
 * @param locale - The locale configuration
 * @returns A raw numeric string suitable for BigDecimal parsing (e.g., "-1234.56")
 */
export const parseFormattedValue = (
  value: string,
  locale: LocaleConfig = DEFAULT_LOCALE
): string => {
  if (value === "" || value === "-") {
    return value
  }

  // Remove currency symbols and extra whitespace
  let parsed = value.trim()

  // Remove thousands separators
  const escapedThousands = escapeRegex(locale.thousandsSeparator)
  parsed = parsed.replace(new RegExp(escapedThousands, "g"), "")

  // Handle negative numbers
  const isNegative = parsed.startsWith("-") || parsed.startsWith("(") || parsed.endsWith("-")
  parsed = parsed.replace(/[()-]/g, "")

  // Normalize decimal separator to period
  if (locale.decimalSeparator !== ".") {
    const escapedDecimal = escapeRegex(locale.decimalSeparator)
    parsed = parsed.replace(new RegExp(escapedDecimal), ".")
  }

  // Remove any remaining non-numeric characters except decimal point
  parsed = parsed.replace(/[^\d.]/g, "")

  // Ensure only one decimal point
  const parts = parsed.split(".")
  if (parts.length > 2) {
    parsed = parts[0] + "." + parts.slice(1).join("")
  }

  // Add negative sign back
  if (isNegative && parsed !== "" && parsed !== ".") {
    parsed = "-" + parsed
  }

  return parsed
}

/**
 * Escape special regex characters in a string
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format a raw numeric string for display
 *
 * Adds thousands separators and formats according to locale.
 *
 * @param value - Raw numeric string (e.g., "-1234.56")
 * @param decimalPlaces - Number of decimal places
 * @param locale - The locale configuration
 * @returns Formatted string without currency symbol
 */
export const formatNumericValue = (
  value: string,
  decimalPlaces: DecimalPlaces,
  locale: LocaleConfig = DEFAULT_LOCALE
): string => {
  if (value === "" || value === "-") {
    return value
  }

  // Parse the value
  const parsed = parseFloat(value)
  if (isNaN(parsed)) {
    return ""
  }

  const isNegative = parsed < 0
  const absValue = Math.abs(parsed)

  // Split into integer and decimal parts
  const [intPart, decPart] = absValue.toString().split(".")

  // Format integer part with thousands separators
  const formattedInt = formatWithThousandsSeparators(intPart, locale.thousandsSeparator)

  // Format decimal part
  let formattedDec = ""
  if (decimalPlaces > 0) {
    if (decPart !== undefined) {
      // Pad or truncate decimal part
      formattedDec = decPart.substring(0, decimalPlaces).padEnd(decimalPlaces, "0")
    } else {
      formattedDec = "0".repeat(decimalPlaces)
    }
    formattedDec = locale.decimalSeparator + formattedDec
  }

  const formatted = formattedInt + formattedDec
  return isNegative ? `-${formatted}` : formatted
}

/**
 * Format a value with currency symbol for display
 *
 * @param value - Raw numeric string
 * @param currency - Currency object with symbol and decimal places
 * @param locale - Locale configuration
 * @returns Formatted string with currency symbol
 */
export const formatWithSymbol = (
  value: string,
  currency: Currency,
  locale: LocaleConfig = DEFAULT_LOCALE
): string => {
  const formatted = formatNumericValue(value, currency.decimalPlaces, locale)
  if (formatted === "" || formatted === "-") {
    return formatted
  }

  if (locale.symbolPosition === "prefix") {
    return currency.symbol + locale.symbolSpacing + formatted
  } else {
    return formatted + locale.symbolSpacing + currency.symbol
  }
}

/**
 * Format a number with thousands separators
 */
const formatWithThousandsSeparators = (
  value: string,
  separator: string
): string => {
  // Handle empty string
  if (value === "") {
    return "0"
  }

  // Add thousands separators from right to left
  const chars = value.split("")
  const result: string[] = []
  let count = 0

  for (let i = chars.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      result.unshift(separator)
    }
    result.unshift(chars[i])
    count++
  }

  return result.join("")
}

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Check if a character is valid for currency input
 *
 * @param char - The character to check
 * @param locale - Locale configuration
 * @param allowNegative - Whether negative numbers are allowed
 * @returns true if the character is valid
 */
export const isValidInputChar = (
  char: string,
  locale: LocaleConfig = DEFAULT_LOCALE,
  allowNegative: boolean = true
): boolean => {
  // Allow digits
  if (/\d/.test(char)) {
    return true
  }

  // Allow decimal separator
  if (char === locale.decimalSeparator) {
    return true
  }

  // Allow minus sign (for negative numbers)
  if (allowNegative && char === "-") {
    return true
  }

  // Allow backspace, delete, arrow keys, tab
  return false
}

/**
 * Validate and fix decimal places in input
 *
 * Ensures the value doesn't have more decimal places than allowed.
 *
 * @param value - Raw numeric string
 * @param decimalPlaces - Maximum allowed decimal places
 * @returns Validated string
 */
export const validateDecimalPlaces = (
  value: string,
  decimalPlaces: DecimalPlaces
): string => {
  if (value === "" || value === "-") {
    return value
  }

  const dotIndex = value.indexOf(".")
  if (dotIndex === -1) {
    return value
  }

  // If we have more decimal places than allowed, truncate
  const decPart = value.substring(dotIndex + 1)
  if (decPart.length > decimalPlaces) {
    return value.substring(0, dotIndex + 1 + decimalPlaces)
  }

  return value
}

// =============================================================================
// Cursor Position Helpers
// =============================================================================

/**
 * Calculate cursor position after formatting
 *
 * When we reformat the input value, the cursor position changes.
 * This function calculates where the cursor should be after formatting.
 *
 * @param oldValue - Value before change
 * @param newValue - Value after change
 * @param oldCursor - Cursor position before change
 * @param locale - Locale configuration
 * @returns New cursor position
 */
export const calculateCursorPosition = (
  oldValue: string,
  newValue: string,
  oldCursor: number,
  _locale: LocaleConfig = DEFAULT_LOCALE
): number => {
  // Count digits before cursor in old value
  const oldDigitsBefore = countDigitsBefore(oldValue, oldCursor)

  // Find position in new value where we have the same number of digits
  let newCursor = 0
  let digitCount = 0

  for (let i = 0; i < newValue.length && digitCount < oldDigitsBefore; i++) {
    if (/\d/.test(newValue[i])) {
      digitCount++
    }
    newCursor = i + 1
  }

  return newCursor
}

/**
 * Count digits before a position in a string
 */
const countDigitsBefore = (value: string, position: number): number => {
  let count = 0
  for (let i = 0; i < Math.min(position, value.length); i++) {
    if (/\d/.test(value[i])) {
      count++
    }
  }
  return count
}

// =============================================================================
// BigDecimal Compatibility
// =============================================================================

/**
 * Convert a formatted value to a BigDecimal-compatible string
 *
 * Returns a normalized numeric string that can be parsed by BigDecimal.
 * Returns empty string for invalid/empty inputs.
 *
 * @param value - The formatted input value
 * @param locale - Locale configuration
 * @returns BigDecimal-compatible string (e.g., "-1234.56")
 */
export const toBigDecimalString = (
  value: string,
  locale: LocaleConfig = DEFAULT_LOCALE
): string => {
  const parsed = parseFormattedValue(value, locale)

  // Validate it's a valid number
  if (parsed === "" || parsed === "-" || parsed === ".") {
    return ""
  }

  // Ensure it's a valid numeric string
  const num = parseFloat(parsed)
  if (isNaN(num)) {
    return ""
  }

  return parsed
}
