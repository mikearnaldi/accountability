/**
 * ExchangeRate - Re-export from canonical location
 *
 * This file re-exports from the canonical location for backward compatibility.
 * New code should import from @accountability/core/currency/ExchangeRate
 *
 * @deprecated Import from @accountability/core/currency/ExchangeRate instead
 * @module Domains/ExchangeRate
 */

export {
  ExchangeRateId,
  isExchangeRateId,
  RateType,
  isRateType,
  RateSource,
  isRateSource,
  Rate,
  isRate,
  ExchangeRate,
  isExchangeRate,
  convertAmount,
  getInverseRate,
  createInverse
} from "../currency/ExchangeRate.ts"
