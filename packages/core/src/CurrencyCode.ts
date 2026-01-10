/**
 * CurrencyCode - ISO 4217 currency code value object
 *
 * A branded type representing a valid ISO 4217 currency code (3 uppercase letters).
 * Uses Schema.brand for compile-time type safety.
 *
 * @module CurrencyCode
 */

import * as Schema from "effect/Schema"

/**
 * Schema for a valid ISO 4217 currency code.
 * Must be exactly 3 uppercase ASCII letters.
 */
export const CurrencyCode = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{3}$/),
  Schema.brand("CurrencyCode"),
  Schema.annotations({
    identifier: "CurrencyCode",
    title: "Currency Code",
    description: "An ISO 4217 currency code (3 uppercase letters)"
  })
)

/**
 * The branded CurrencyCode type
 */
export type CurrencyCode = typeof CurrencyCode.Type

/**
 * Constructor that bypasses validation (for internal use with known-valid codes)
 */
export const make = (code: string): CurrencyCode => code as CurrencyCode

/**
 * Type guard for CurrencyCode using Schema.is
 */
export const isCurrencyCode = Schema.is(CurrencyCode)

/**
 * Common ISO 4217 currency codes
 */
export const USD: CurrencyCode = make("USD")
export const EUR: CurrencyCode = make("EUR")
export const GBP: CurrencyCode = make("GBP")
export const JPY: CurrencyCode = make("JPY")
export const CHF: CurrencyCode = make("CHF")
export const CAD: CurrencyCode = make("CAD")
export const AUD: CurrencyCode = make("AUD")
export const CNY: CurrencyCode = make("CNY")
export const HKD: CurrencyCode = make("HKD")
export const SGD: CurrencyCode = make("SGD")
