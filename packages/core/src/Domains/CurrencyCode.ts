/**
 * CurrencyCode - Re-export for backward compatibility
 *
 * This file re-exports from the new canonical location in currency.
 * Use '@accountability/core/currency/CurrencyCode' for new imports.
 *
 * @deprecated Import from '@accountability/core/currency/CurrencyCode' instead
 * @module Domains/CurrencyCode
 */

export {
  CurrencyCode,
  isCurrencyCode,

  // Common currency codes
  USD,
  EUR,
  GBP,
  JPY,
  CHF,
  CAD,
  AUD,
  CNY,
  HKD,
  SGD
} from "../currency/CurrencyCode.ts"
