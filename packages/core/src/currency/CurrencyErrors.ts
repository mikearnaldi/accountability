/**
 * CurrencyErrors - Domain errors for Currency domain
 *
 * These errors are used for Currency and ExchangeRate-related operations
 * and include HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * @module currency/CurrencyErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404)
// =============================================================================

/**
 * ExchangeRateNotFoundError - Exchange rate does not exist
 */
export class ExchangeRateNotFoundError extends Schema.TaggedError<ExchangeRateNotFoundError>()(
  "ExchangeRateNotFoundError",
  {
    rateId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Exchange rate not found: ${this.rateId}`
  }
}

export const isExchangeRateNotFoundError = Schema.is(ExchangeRateNotFoundError)

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * SameCurrencyExchangeRateError - Cannot create exchange rate between same currencies
 */
export class SameCurrencyExchangeRateError extends Schema.TaggedError<SameCurrencyExchangeRateError>()(
  "SameCurrencyExchangeRateError",
  {
    currency: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Cannot create exchange rate between same currency: ${this.currency}`
  }
}

export const isSameCurrencyExchangeRateError = Schema.is(SameCurrencyExchangeRateError)

/**
 * InvalidExchangeRateError - Invalid exchange rate value
 */
export class InvalidExchangeRateError extends Schema.TaggedError<InvalidExchangeRateError>()(
  "InvalidExchangeRateError",
  {
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid exchange rate: ${this.reason}`
  }
}

export const isInvalidExchangeRateError = Schema.is(InvalidExchangeRateError)

// =============================================================================
// Conflict Errors (409)
// =============================================================================

/**
 * ExchangeRateAlreadyExistsError - Exchange rate for this currency pair already exists
 */
export class ExchangeRateAlreadyExistsError extends Schema.TaggedError<ExchangeRateAlreadyExistsError>()(
  "ExchangeRateAlreadyExistsError",
  {
    fromCurrency: Schema.String,
    toCurrency: Schema.String,
    effectiveDate: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Exchange rate from ${this.fromCurrency} to ${this.toCurrency} already exists for ${this.effectiveDate}`
  }
}

export const isExchangeRateAlreadyExistsError = Schema.is(ExchangeRateAlreadyExistsError)
