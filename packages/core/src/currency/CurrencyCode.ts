/**
 * CurrencyCode - ISO 4217 currency code value object
 *
 * A branded type representing a valid ISO 4217 currency code (3 uppercase letters).
 * Uses Schema.brand for compile-time type safety.
 *
 * @module currency/CurrencyCode
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
 * Type guard for CurrencyCode using Schema.is
 */
export const isCurrencyCode = Schema.is(CurrencyCode)

/**
 * Common ISO 4217 currency codes
 * Using Schema's .make() constructor which validates by default
 */
export const USD: CurrencyCode = CurrencyCode.make("USD")
export const EUR: CurrencyCode = CurrencyCode.make("EUR")
export const GBP: CurrencyCode = CurrencyCode.make("GBP")
export const JPY: CurrencyCode = CurrencyCode.make("JPY")
export const CHF: CurrencyCode = CurrencyCode.make("CHF")
export const CAD: CurrencyCode = CurrencyCode.make("CAD")
export const AUD: CurrencyCode = CurrencyCode.make("AUD")
export const CNY: CurrencyCode = CurrencyCode.make("CNY")
export const HKD: CurrencyCode = CurrencyCode.make("HKD")
export const SGD: CurrencyCode = CurrencyCode.make("SGD")
