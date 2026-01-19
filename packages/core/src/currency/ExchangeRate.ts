/**
 * ExchangeRate - Re-export from canonical location
 *
 * This file provides the new import path for ExchangeRate domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module currency/ExchangeRate
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
} from "../Domains/ExchangeRate.ts"
