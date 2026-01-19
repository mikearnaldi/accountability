/**
 * Currency - Re-export from canonical location
 *
 * This file re-exports from the canonical location for backward compatibility.
 * New code should import from @accountability/core/currency/Currency
 *
 * @deprecated Import from @accountability/core/currency/Currency instead
 * @module Domains/Currency
 */

export {
  DecimalPlaces,
  isDecimalPlaces,
  Currency,
  isCurrency,

  // Predefined currencies
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
  CLF_CURRENCY,

  // Collections and lookup
  COMMON_CURRENCIES,
  CURRENCIES_BY_CODE,
  getCurrencyByCode
} from "../currency/Currency.ts"
