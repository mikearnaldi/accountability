/**
 * CurrencyCode - Re-export from canonical location
 *
 * This file provides the new import path for CurrencyCode value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module currency/CurrencyCode
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
} from "../Domains/CurrencyCode.ts"
