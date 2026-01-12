/**
 * Tests for currencies atoms
 *
 * Tests the currency state management atoms.
 *
 * @module currencies.test
 */

import { describe, expect, it } from "@effect/vitest"
import { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"
import {
  COMMON_CURRENCIES,
  USD_CURRENCY,
  EUR_CURRENCY,
  JPY_CURRENCY,
  KWD_CURRENCY,
  CLF_CURRENCY
} from "@accountability/core/Domains/Currency"
import {
  getCurrency,
  getAllCurrencies
} from "../src/atoms/currencies.ts"

// =============================================================================
// getCurrency Tests
// =============================================================================

describe("getCurrency", () => {
  it("returns USD currency for USD code", () => {
    const currency = getCurrency(CurrencyCode.make("USD"))
    expect(currency).toBeDefined()
    expect(currency?.code).toBe("USD")
    expect(currency?.symbol).toBe("$")
    expect(currency?.decimalPlaces).toBe(2)
  })

  it("returns EUR currency for EUR code", () => {
    const currency = getCurrency(CurrencyCode.make("EUR"))
    expect(currency).toBeDefined()
    expect(currency?.code).toBe("EUR")
    expect(currency?.symbol).toBe("€")
    expect(currency?.decimalPlaces).toBe(2)
  })

  it("returns JPY currency with 0 decimal places", () => {
    const currency = getCurrency(CurrencyCode.make("JPY"))
    expect(currency).toBeDefined()
    expect(currency?.code).toBe("JPY")
    expect(currency?.symbol).toBe("¥")
    expect(currency?.decimalPlaces).toBe(0)
  })

  it("returns KWD currency with 3 decimal places", () => {
    const currency = getCurrency(CurrencyCode.make("KWD"))
    expect(currency).toBeDefined()
    expect(currency?.code).toBe("KWD")
    expect(currency?.decimalPlaces).toBe(3)
  })

  it("returns CLF currency with 4 decimal places", () => {
    const currency = getCurrency(CurrencyCode.make("CLF"))
    expect(currency).toBeDefined()
    expect(currency?.code).toBe("CLF")
    expect(currency?.decimalPlaces).toBe(4)
  })

  it("returns undefined for unknown currency code", () => {
    const currency = getCurrency(CurrencyCode.make("XXX"))
    expect(currency).toBeUndefined()
  })
})

// =============================================================================
// getAllCurrencies Tests
// =============================================================================

describe("getAllCurrencies", () => {
  it("returns all common currencies", () => {
    const currencies = getAllCurrencies()
    expect(currencies).toEqual(COMMON_CURRENCIES)
  })

  it("includes major currencies", () => {
    const currencies = getAllCurrencies()
    const codes = currencies.map(c => c.code)

    expect(codes).toContain("USD")
    expect(codes).toContain("EUR")
    expect(codes).toContain("GBP")
    expect(codes).toContain("JPY")
    expect(codes).toContain("CHF")
    expect(codes).toContain("CAD")
    expect(codes).toContain("AUD")
  })

  it("includes currencies with different decimal places", () => {
    const currencies = getAllCurrencies()

    // 0 decimal places
    const jpy = currencies.find(c => c.code === "JPY")
    expect(jpy?.decimalPlaces).toBe(0)

    // 2 decimal places
    const usd = currencies.find(c => c.code === "USD")
    expect(usd?.decimalPlaces).toBe(2)

    // 3 decimal places
    const kwd = currencies.find(c => c.code === "KWD")
    expect(kwd?.decimalPlaces).toBe(3)

    // 4 decimal places
    const clf = currencies.find(c => c.code === "CLF")
    expect(clf?.decimalPlaces).toBe(4)
  })

  it("returns immutable array", () => {
    const currencies1 = getAllCurrencies()
    const currencies2 = getAllCurrencies()
    expect(currencies1).toBe(currencies2) // Same reference
  })
})

// =============================================================================
// Currency Data Integrity Tests
// =============================================================================

describe("Currency data integrity", () => {
  it("all currencies have valid codes (3 uppercase letters)", () => {
    const currencies = getAllCurrencies()
    for (const currency of currencies) {
      expect(currency.code).toMatch(/^[A-Z]{3}$/)
    }
  })

  it("all currencies have non-empty names", () => {
    const currencies = getAllCurrencies()
    for (const currency of currencies) {
      expect(currency.name.length).toBeGreaterThan(0)
    }
  })

  it("all currencies have non-empty symbols", () => {
    const currencies = getAllCurrencies()
    for (const currency of currencies) {
      expect(currency.symbol.length).toBeGreaterThan(0)
    }
  })

  it("all currencies have valid decimal places (0, 2, 3, or 4)", () => {
    const currencies = getAllCurrencies()
    for (const currency of currencies) {
      expect([0, 2, 3, 4]).toContain(currency.decimalPlaces)
    }
  })

  it("all currencies are active", () => {
    const currencies = getAllCurrencies()
    for (const currency of currencies) {
      expect(currency.isActive).toBe(true)
    }
  })

  it("predefined constants match map lookup", () => {
    expect(getCurrency(CurrencyCode.make("USD"))).toEqual(USD_CURRENCY)
    expect(getCurrency(CurrencyCode.make("EUR"))).toEqual(EUR_CURRENCY)
    expect(getCurrency(CurrencyCode.make("JPY"))).toEqual(JPY_CURRENCY)
    expect(getCurrency(CurrencyCode.make("KWD"))).toEqual(KWD_CURRENCY)
    expect(getCurrency(CurrencyCode.make("CLF"))).toEqual(CLF_CURRENCY)
  })
})
