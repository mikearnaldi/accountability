/**
 * Currency - Entity representing a monetary currency
 *
 * Represents a monetary currency with ISO 4217 code, name, symbol,
 * decimal places, and active status.
 *
 * @module currency/Currency
 */

import * as Schema from "effect/Schema"
import { CurrencyCode } from "./CurrencyCode.ts"

/**
 * DecimalPlaces - Valid decimal places for currencies
 *
 * Most currencies use 2 decimal places, but some use 0 (JPY, KRW),
 * 3 (KWD, BHD, OMR), or 4 (CLF) decimal places.
 */
export const DecimalPlaces = Schema.Literal(0, 2, 3, 4).annotations({
  identifier: "DecimalPlaces",
  title: "Decimal Places",
  description: "Number of decimal places for the currency (0, 2, 3, or 4)"
})

/**
 * The DecimalPlaces type
 */
export type DecimalPlaces = typeof DecimalPlaces.Type

/**
 * Type guard for DecimalPlaces using Schema.is
 */
export const isDecimalPlaces = Schema.is(DecimalPlaces)

/**
 * Currency - Entity representing a monetary currency
 *
 * Contains the ISO 4217 code, display name, symbol, decimal places,
 * and active status for a currency.
 */
export class Currency extends Schema.Class<Currency>("Currency")({
  /**
   * ISO 4217 currency code (e.g., USD, EUR, GBP)
   */
  code: CurrencyCode,

  /**
   * Display name of the currency (e.g., "US Dollar")
   */
  name: Schema.NonEmptyTrimmedString.annotations({
    title: "Currency Name",
    description: "The display name of the currency"
  }),

  /**
   * Currency symbol for display (e.g., "$", "€", "£")
   */
  symbol: Schema.NonEmptyTrimmedString.annotations({
    title: "Currency Symbol",
    description: "The symbol used to display the currency"
  }),

  /**
   * Number of decimal places for the currency
   */
  decimalPlaces: DecimalPlaces,

  /**
   * Whether the currency is active for use
   */
  isActive: Schema.Boolean.annotations({
    title: "Is Active",
    description: "Whether the currency is currently active for use"
  })
}) {
  /**
   * Format an amount with the currency symbol
   */
  formatAmount(amount: number): string {
    const formatted = amount.toFixed(this.decimalPlaces)
    return `${this.symbol}${formatted}`
  }
}

/**
 * Type guard for Currency using Schema.is
 */
export const isCurrency = Schema.is(Currency)

// =============================================================================
// Predefined Common Currencies
// =============================================================================

/**
 * US Dollar
 */
export const USD_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("USD"),
  name: "US Dollar",
  symbol: "$",
  decimalPlaces: 2,
  isActive: true
})

/**
 * Euro
 */
export const EUR_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("EUR"),
  name: "Euro",
  symbol: "€",
  decimalPlaces: 2,
  isActive: true
})

/**
 * British Pound Sterling
 */
export const GBP_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("GBP"),
  name: "British Pound",
  symbol: "£",
  decimalPlaces: 2,
  isActive: true
})

/**
 * Japanese Yen (0 decimal places)
 */
export const JPY_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("JPY"),
  name: "Japanese Yen",
  symbol: "¥",
  decimalPlaces: 0,
  isActive: true
})

/**
 * Swiss Franc
 */
export const CHF_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("CHF"),
  name: "Swiss Franc",
  symbol: "CHF",
  decimalPlaces: 2,
  isActive: true
})

/**
 * Canadian Dollar
 */
export const CAD_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("CAD"),
  name: "Canadian Dollar",
  symbol: "C$",
  decimalPlaces: 2,
  isActive: true
})

/**
 * Australian Dollar
 */
export const AUD_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("AUD"),
  name: "Australian Dollar",
  symbol: "A$",
  decimalPlaces: 2,
  isActive: true
})

/**
 * Chinese Yuan
 */
export const CNY_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("CNY"),
  name: "Chinese Yuan",
  symbol: "¥",
  decimalPlaces: 2,
  isActive: true
})

/**
 * Hong Kong Dollar
 */
export const HKD_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("HKD"),
  name: "Hong Kong Dollar",
  symbol: "HK$",
  decimalPlaces: 2,
  isActive: true
})

/**
 * Singapore Dollar
 */
export const SGD_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("SGD"),
  name: "Singapore Dollar",
  symbol: "S$",
  decimalPlaces: 2,
  isActive: true
})

/**
 * South Korean Won (0 decimal places)
 */
export const KRW_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("KRW"),
  name: "South Korean Won",
  symbol: "₩",
  decimalPlaces: 0,
  isActive: true
})

/**
 * Kuwaiti Dinar (3 decimal places)
 */
export const KWD_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("KWD"),
  name: "Kuwaiti Dinar",
  symbol: "KD",
  decimalPlaces: 3,
  isActive: true
})

/**
 * Bahraini Dinar (3 decimal places)
 */
export const BHD_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("BHD"),
  name: "Bahraini Dinar",
  symbol: "BD",
  decimalPlaces: 3,
  isActive: true
})

/**
 * Omani Rial (3 decimal places)
 */
export const OMR_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("OMR"),
  name: "Omani Rial",
  symbol: "OMR",
  decimalPlaces: 3,
  isActive: true
})

/**
 * Chilean Unit of Account (UF) (4 decimal places)
 */
export const CLF_CURRENCY: Currency = Currency.make({
  code: CurrencyCode.make("CLF"),
  name: "Chilean Unit of Account (UF)",
  symbol: "CLF",
  decimalPlaces: 4,
  isActive: true
})

/**
 * Collection of all predefined currencies
 */
export const COMMON_CURRENCIES: ReadonlyArray<Currency> = [
  USD_CURRENCY,
  EUR_CURRENCY,
  GBP_CURRENCY,
  JPY_CURRENCY,
  CHF_CURRENCY,
  CAD_CURRENCY,
  AUD_CURRENCY,
  CNY_CURRENCY,
  HKD_CURRENCY,
  SGD_CURRENCY,
  KRW_CURRENCY,
  KWD_CURRENCY,
  BHD_CURRENCY,
  OMR_CURRENCY,
  CLF_CURRENCY
]

/**
 * Map of currency code to Currency entity for quick lookup
 */
export const CURRENCIES_BY_CODE: ReadonlyMap<CurrencyCode, Currency> = new Map(
  COMMON_CURRENCIES.map((currency) => [currency.code, currency])
)

/**
 * Get a currency by its code from the predefined currencies
 */
export const getCurrencyByCode = (code: CurrencyCode): Currency | undefined => {
  return CURRENCIES_BY_CODE.get(code)
}
