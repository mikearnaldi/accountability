/**
 * CurrencyErrors - Re-export from canonical location
 *
 * This file provides the new import path for Currency-related errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module currency/CurrencyErrors
 */

export {
  ExchangeRateNotFoundError,
  isExchangeRateNotFoundError,
  SameCurrencyExchangeRateError,
  isSameCurrencyExchangeRateError,
  InvalidExchangeRateError,
  isInvalidExchangeRateError,
  ExchangeRateAlreadyExistsError,
  isExchangeRateAlreadyExistsError
} from "../Errors/DomainErrors.ts"
