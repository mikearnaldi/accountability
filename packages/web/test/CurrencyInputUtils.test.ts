/**
 * Tests for CurrencyInputUtils
 *
 * Tests the pure utility functions used by the CurrencyInput component.
 *
 * @module CurrencyInputUtils.test
 */

import { describe, expect, it } from "@effect/vitest"
import {
  parseFormattedValue,
  formatNumericValue,
  formatWithSymbol,
  toBigDecimalString,
  validateDecimalPlaces,
  isValidInputChar,
  calculateCursorPosition,
  DEFAULT_LOCALE,
  LOCALES
} from "../src/components/CurrencyInputUtils.ts"
import { Currency, type DecimalPlaces } from "@accountability/core/Domains/Currency"
import { CurrencyCode as CurrencyCodeSchema } from "@accountability/core/Domains/CurrencyCode"

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock Currency for testing
 * Uses Currency.make() to properly construct the branded type
 */
const createMockCurrency = (overrides: {
  code: string
  symbol: string
  decimalPlaces: DecimalPlaces
}): Currency => Currency.make({
  code: CurrencyCodeSchema.make(overrides.code),
  name: "Test Currency",
  symbol: overrides.symbol,
  decimalPlaces: overrides.decimalPlaces,
  isActive: true
})

// =============================================================================
// parseFormattedValue Tests
// =============================================================================

describe("parseFormattedValue", () => {
  describe("with en-US locale", () => {
    it("parses simple number", () => {
      expect(parseFormattedValue("123")).toBe("123")
    })

    it("parses number with decimal", () => {
      expect(parseFormattedValue("123.45")).toBe("123.45")
    })

    it("parses number with thousands separator", () => {
      expect(parseFormattedValue("1,234.56")).toBe("1234.56")
    })

    it("parses large number with multiple thousands separators", () => {
      expect(parseFormattedValue("1,234,567.89")).toBe("1234567.89")
    })

    it("parses negative number", () => {
      expect(parseFormattedValue("-123.45")).toBe("-123.45")
    })

    it("parses negative number with thousands separator", () => {
      expect(parseFormattedValue("-1,234.56")).toBe("-1234.56")
    })

    it("returns empty string for empty input", () => {
      expect(parseFormattedValue("")).toBe("")
    })

    it("returns minus sign for just minus", () => {
      expect(parseFormattedValue("-")).toBe("-")
    })

    it("handles trailing decimal", () => {
      expect(parseFormattedValue("123.")).toBe("123.")
    })

    it("handles leading decimal", () => {
      expect(parseFormattedValue(".45")).toBe(".45")
    })

    it("handles whitespace", () => {
      expect(parseFormattedValue("  123.45  ")).toBe("123.45")
    })

    it("removes currency symbols", () => {
      expect(parseFormattedValue("$123.45")).toBe("123.45")
      expect(parseFormattedValue("€123.45")).toBe("123.45")
    })

    it("handles parentheses for negative numbers", () => {
      expect(parseFormattedValue("(123.45)")).toBe("-123.45")
    })

    it("handles trailing minus for negative numbers", () => {
      expect(parseFormattedValue("123.45-")).toBe("-123.45")
    })
  })

  describe("with de-DE locale (German)", () => {
    const germanLocale = LOCALES["de-DE"]

    it("parses number with German decimal separator", () => {
      expect(parseFormattedValue("123,45", germanLocale)).toBe("123.45")
    })

    it("parses number with German thousands separator", () => {
      expect(parseFormattedValue("1.234,56", germanLocale)).toBe("1234.56")
    })

    it("parses large German number", () => {
      expect(parseFormattedValue("1.234.567,89", germanLocale)).toBe("1234567.89")
    })

    it("parses negative German number", () => {
      expect(parseFormattedValue("-1.234,56", germanLocale)).toBe("-1234.56")
    })
  })

  describe("with fr-FR locale (French)", () => {
    const frenchLocale = LOCALES["fr-FR"]

    it("parses number with French decimal separator", () => {
      expect(parseFormattedValue("123,45", frenchLocale)).toBe("123.45")
    })

    it("parses number with French thousands separator (space)", () => {
      expect(parseFormattedValue("1 234,56", frenchLocale)).toBe("1234.56")
    })
  })
})

// =============================================================================
// formatNumericValue Tests
// =============================================================================

describe("formatNumericValue", () => {
  describe("with en-US locale", () => {
    it("formats simple number with 2 decimal places", () => {
      expect(formatNumericValue("123", 2)).toBe("123.00")
    })

    it("formats number with existing decimal", () => {
      expect(formatNumericValue("123.4", 2)).toBe("123.40")
    })

    it("formats number with exact decimal places", () => {
      expect(formatNumericValue("123.45", 2)).toBe("123.45")
    })

    it("adds thousands separator", () => {
      expect(formatNumericValue("1234.56", 2)).toBe("1,234.56")
    })

    it("adds multiple thousands separators", () => {
      expect(formatNumericValue("1234567.89", 2)).toBe("1,234,567.89")
    })

    it("formats negative number", () => {
      expect(formatNumericValue("-1234.56", 2)).toBe("-1,234.56")
    })

    it("returns empty string for empty input", () => {
      expect(formatNumericValue("", 2)).toBe("")
    })

    it("returns minus for minus input", () => {
      expect(formatNumericValue("-", 2)).toBe("-")
    })

    it("handles zero decimal places (JPY, KRW)", () => {
      expect(formatNumericValue("1234", 0)).toBe("1,234")
      expect(formatNumericValue("1234.56", 0)).toBe("1,234") // Truncates
    })

    it("handles 3 decimal places (KWD, BHD, OMR)", () => {
      expect(formatNumericValue("1234.5", 3)).toBe("1,234.500")
      expect(formatNumericValue("1234.567", 3)).toBe("1,234.567")
    })

    it("handles 4 decimal places (CLF)", () => {
      expect(formatNumericValue("1234.5", 4)).toBe("1,234.5000")
      expect(formatNumericValue("1234.5678", 4)).toBe("1,234.5678")
    })

    it("handles zero value", () => {
      expect(formatNumericValue("0", 2)).toBe("0.00")
    })

    it("handles small numbers", () => {
      expect(formatNumericValue("0.01", 2)).toBe("0.01")
      expect(formatNumericValue("0.1", 2)).toBe("0.10")
    })
  })

  describe("with de-DE locale (German)", () => {
    const germanLocale = LOCALES["de-DE"]

    it("uses German decimal separator", () => {
      expect(formatNumericValue("123.45", 2, germanLocale)).toBe("123,45")
    })

    it("uses German thousands separator", () => {
      expect(formatNumericValue("1234.56", 2, germanLocale)).toBe("1.234,56")
    })

    it("formats large number with German locale", () => {
      expect(formatNumericValue("1234567.89", 2, germanLocale)).toBe("1.234.567,89")
    })
  })

  describe("with fr-FR locale (French)", () => {
    const frenchLocale = LOCALES["fr-FR"]

    it("uses French decimal separator", () => {
      expect(formatNumericValue("123.45", 2, frenchLocale)).toBe("123,45")
    })

    it("uses French thousands separator (space)", () => {
      expect(formatNumericValue("1234.56", 2, frenchLocale)).toBe("1 234,56")
    })
  })
})

// =============================================================================
// formatWithSymbol Tests
// =============================================================================

describe("formatWithSymbol", () => {
  const usdCurrency = createMockCurrency({ code: "USD", symbol: "$", decimalPlaces: 2 })
  const eurCurrency = createMockCurrency({ code: "EUR", symbol: "€", decimalPlaces: 2 })
  const jpyCurrency = createMockCurrency({ code: "JPY", symbol: "¥", decimalPlaces: 0 })

  describe("with en-US locale (prefix)", () => {
    it("formats with USD symbol prefix", () => {
      expect(formatWithSymbol("1234.56", usdCurrency)).toBe("$1,234.56")
    })

    it("formats zero", () => {
      expect(formatWithSymbol("0", usdCurrency)).toBe("$0.00")
    })

    it("formats negative number", () => {
      expect(formatWithSymbol("-1234.56", usdCurrency)).toBe("$-1,234.56")
    })

    it("returns empty for empty input", () => {
      expect(formatWithSymbol("", usdCurrency)).toBe("")
    })

    it("returns minus for minus input", () => {
      expect(formatWithSymbol("-", usdCurrency)).toBe("-")
    })

    it("formats JPY with no decimals", () => {
      expect(formatWithSymbol("1234", jpyCurrency)).toBe("¥1,234")
    })
  })

  describe("with de-DE locale (suffix)", () => {
    const germanLocale = LOCALES["de-DE"]

    it("formats with EUR symbol suffix", () => {
      expect(formatWithSymbol("1234.56", eurCurrency, germanLocale)).toBe("1.234,56 €")
    })

    it("formats negative number with suffix symbol", () => {
      expect(formatWithSymbol("-1234.56", eurCurrency, germanLocale)).toBe("-1.234,56 €")
    })
  })
})

// =============================================================================
// toBigDecimalString Tests
// =============================================================================

describe("toBigDecimalString", () => {
  it("converts formatted value to BigDecimal string", () => {
    expect(toBigDecimalString("1,234.56")).toBe("1234.56")
  })

  it("handles negative values", () => {
    expect(toBigDecimalString("-1,234.56")).toBe("-1234.56")
  })

  it("handles values without formatting", () => {
    expect(toBigDecimalString("1234.56")).toBe("1234.56")
  })

  it("returns empty string for empty input", () => {
    expect(toBigDecimalString("")).toBe("")
  })

  it("returns empty string for minus only", () => {
    expect(toBigDecimalString("-")).toBe("")
  })

  it("returns empty string for invalid input", () => {
    expect(toBigDecimalString("abc")).toBe("")
    expect(toBigDecimalString(".")).toBe("")
  })

  it("handles German locale input", () => {
    const germanLocale = LOCALES["de-DE"]
    expect(toBigDecimalString("1.234,56", germanLocale)).toBe("1234.56")
  })

  it("handles integer values", () => {
    expect(toBigDecimalString("1,234")).toBe("1234")
  })

  it("handles decimal-only values", () => {
    expect(toBigDecimalString("0.56")).toBe("0.56")
  })
})

// =============================================================================
// validateDecimalPlaces Tests
// =============================================================================

describe("validateDecimalPlaces", () => {
  it("returns value unchanged if within limit", () => {
    expect(validateDecimalPlaces("123.45", 2)).toBe("123.45")
    expect(validateDecimalPlaces("123.4", 2)).toBe("123.4")
    expect(validateDecimalPlaces("123", 2)).toBe("123")
  })

  it("truncates value if too many decimal places", () => {
    expect(validateDecimalPlaces("123.456", 2)).toBe("123.45")
    expect(validateDecimalPlaces("123.4567", 2)).toBe("123.45")
  })

  it("handles 0 decimal places", () => {
    expect(validateDecimalPlaces("123", 0)).toBe("123")
    expect(validateDecimalPlaces("123.45", 0)).toBe("123.")
  })

  it("handles 3 decimal places", () => {
    expect(validateDecimalPlaces("123.4567", 3)).toBe("123.456")
    expect(validateDecimalPlaces("123.45", 3)).toBe("123.45")
  })

  it("handles 4 decimal places", () => {
    expect(validateDecimalPlaces("123.45678", 4)).toBe("123.4567")
    expect(validateDecimalPlaces("123.45", 4)).toBe("123.45")
  })

  it("returns empty string unchanged", () => {
    expect(validateDecimalPlaces("", 2)).toBe("")
  })

  it("returns minus unchanged", () => {
    expect(validateDecimalPlaces("-", 2)).toBe("-")
  })

  it("handles negative numbers", () => {
    expect(validateDecimalPlaces("-123.456", 2)).toBe("-123.45")
  })
})

// =============================================================================
// isValidInputChar Tests
// =============================================================================

describe("isValidInputChar", () => {
  it("allows digits", () => {
    expect(isValidInputChar("0")).toBe(true)
    expect(isValidInputChar("5")).toBe(true)
    expect(isValidInputChar("9")).toBe(true)
  })

  it("allows decimal separator for en-US", () => {
    expect(isValidInputChar(".", DEFAULT_LOCALE)).toBe(true)
  })

  it("allows decimal separator for de-DE", () => {
    expect(isValidInputChar(",", LOCALES["de-DE"])).toBe(true)
  })

  it("allows minus sign when negative allowed", () => {
    expect(isValidInputChar("-", DEFAULT_LOCALE, true)).toBe(true)
  })

  it("rejects minus sign when negative not allowed", () => {
    expect(isValidInputChar("-", DEFAULT_LOCALE, false)).toBe(false)
  })

  it("rejects letters", () => {
    expect(isValidInputChar("a")).toBe(false)
    expect(isValidInputChar("Z")).toBe(false)
  })

  it("rejects special characters", () => {
    expect(isValidInputChar("@")).toBe(false)
    expect(isValidInputChar("#")).toBe(false)
    expect(isValidInputChar("%")).toBe(false)
  })

  it("rejects space", () => {
    expect(isValidInputChar(" ")).toBe(false)
  })
})

// =============================================================================
// calculateCursorPosition Tests
// =============================================================================

describe("calculateCursorPosition", () => {
  it("maintains cursor after adding thousands separator", () => {
    // User types "1234" (cursor at end)
    // Formatted to "1,234"
    const newPos = calculateCursorPosition("1234", "1,234", 4)
    expect(newPos).toBe(5) // Cursor should be at end after comma
  })

  it("maintains cursor in middle of number", () => {
    // User editing "12|34" -> "12|,345"
    const newPos = calculateCursorPosition("1234", "12,345", 2)
    expect(newPos).toBe(2) // Cursor should stay after "12"
  })

  it("handles cursor at start", () => {
    const newPos = calculateCursorPosition("1,234", "1,234", 0)
    expect(newPos).toBe(0)
  })

  it("handles empty strings", () => {
    const newPos = calculateCursorPosition("", "1", 0)
    expect(newPos).toBe(0)
  })
})

// =============================================================================
// LOCALES Configuration Tests
// =============================================================================

describe("LOCALES", () => {
  it("has en-US locale", () => {
    expect(LOCALES["en-US"]).toBeDefined()
    expect(LOCALES["en-US"].thousandsSeparator).toBe(",")
    expect(LOCALES["en-US"].decimalSeparator).toBe(".")
    expect(LOCALES["en-US"].symbolPosition).toBe("prefix")
  })

  it("has de-DE locale", () => {
    expect(LOCALES["de-DE"]).toBeDefined()
    expect(LOCALES["de-DE"].thousandsSeparator).toBe(".")
    expect(LOCALES["de-DE"].decimalSeparator).toBe(",")
    expect(LOCALES["de-DE"].symbolPosition).toBe("suffix")
  })

  it("has fr-FR locale", () => {
    expect(LOCALES["fr-FR"]).toBeDefined()
    expect(LOCALES["fr-FR"].thousandsSeparator).toBe(" ")
    expect(LOCALES["fr-FR"].decimalSeparator).toBe(",")
    expect(LOCALES["fr-FR"].symbolPosition).toBe("suffix")
  })

  it("has ja-JP locale", () => {
    expect(LOCALES["ja-JP"]).toBeDefined()
    expect(LOCALES["ja-JP"].symbolPosition).toBe("prefix")
  })
})
