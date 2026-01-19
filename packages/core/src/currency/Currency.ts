/**
 * Currency - Re-export from canonical location
 *
 * This file provides the new import path for Currency domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module currency/Currency
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
} from "../Domains/Currency.ts"
