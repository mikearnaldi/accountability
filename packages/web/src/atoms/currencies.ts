/**
 * Currencies Atoms - State management for currency data
 *
 * Provides atoms for accessing currency metadata including symbols,
 * decimal places, and formatting information. Uses static currency
 * data from @accountability/core for fast, synchronous access.
 *
 * @module currencies
 */

import * as Atom from "@effect-atom/atom/Atom"
import {
  COMMON_CURRENCIES,
  CURRENCIES_BY_CODE,
  type Currency
} from "@accountability/core/Domains/Currency"
import type { CurrencyCode } from "@accountability/core/Domains/CurrencyCode"

// =============================================================================
// Currencies List Atom
// =============================================================================

/**
 * All available currencies atom
 *
 * Returns the list of all common currencies. This is synchronous
 * since currencies are static data loaded from the core package.
 */
export const currenciesAtom = Atom.make(COMMON_CURRENCIES)

// =============================================================================
// Currency by Code Atom Family
// =============================================================================

/**
 * Currency by code atom family
 *
 * Creates a memoized atom for each currency code. Multiple calls with
 * the same code return the same atom instance.
 *
 * Returns undefined if the currency code is not found.
 */
export const currencyAtom = Atom.family((code: CurrencyCode) =>
  Atom.make(CURRENCIES_BY_CODE.get(code))
)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get currency metadata by code synchronously
 *
 * This is a convenience function for synchronous access to currency data.
 * Use this when you don't need reactive updates.
 */
export const getCurrency = (code: CurrencyCode): Currency | undefined => {
  return CURRENCIES_BY_CODE.get(code)
}

/**
 * Get all available currencies synchronously
 */
export const getAllCurrencies = (): ReadonlyArray<Currency> => {
  return COMMON_CURRENCIES
}
