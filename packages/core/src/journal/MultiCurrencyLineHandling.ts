/**
 * MultiCurrencyLineHandling - Multi-currency journal entry line handling
 *
 * Provides logic for handling journal entry lines in different currencies,
 * converting transaction amounts to functional currency per ASC 830.
 *
 * Per specs/ACCOUNTING_RESEARCH.md (Multi-Currency Support):
 * - Transaction Recording: Record in transaction currency, convert using spot rate
 * - Store both original and converted amounts
 * - Exchange rate must be provided when transaction currency differs from functional
 *
 * @module journal/MultiCurrencyLineHandling
 */

import { HttpApiSchema } from "@effect/platform"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { MonetaryAmount, multiply } from "../shared/values/MonetaryAmount.ts"

/**
 * MissingExchangeRateError - Error when exchange rate is not provided for currency conversion
 *
 * Thrown when a transaction in a foreign currency requires conversion to functional
 * currency but no exchange rate is provided.
 */
export class MissingExchangeRateError extends Schema.TaggedError<MissingExchangeRateError>()(
  "MissingExchangeRateError",
  {
    transactionCurrency: CurrencyCode,
    functionalCurrency: CurrencyCode
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Missing exchange rate for conversion from ${this.transactionCurrency} to ${this.functionalCurrency}`
  }
}

/**
 * Type guard for MissingExchangeRateError using Schema.is
 */
export const isMissingExchangeRateError = Schema.is(MissingExchangeRateError)

/**
 * Result of converting a transaction amount to functional currency.
 *
 * Contains both the original transaction amount and the converted
 * functional currency amount, along with the exchange rate used.
 */
export class MultiCurrencyConversionResult extends Schema.Class<MultiCurrencyConversionResult>(
  "MultiCurrencyConversionResult"
)({
  /**
   * Original amount in transaction currency
   */
  originalAmount: MonetaryAmount,

  /**
   * Converted amount in functional currency
   */
  functionalAmount: MonetaryAmount,

  /**
   * Exchange rate used for conversion (units of functional currency per unit of transaction currency)
   */
  exchangeRate: Schema.BigDecimal
}) {}

/**
 * Type guard for MultiCurrencyConversionResult using Schema.is
 */
export const isMultiCurrencyConversionResult = Schema.is(MultiCurrencyConversionResult)

/**
 * Convert a monetary amount to functional currency.
 *
 * Per ASC 830, when recording transactions in a currency other than
 * the functional currency:
 * 1. Record in transaction currency
 * 2. Convert amount using spot rate at transaction date
 * 3. Store both original and converted amounts
 *
 * The exchange rate represents units of functional currency per unit
 * of transaction currency (e.g., 1.25 USD/GBP means 1 GBP = 1.25 USD).
 *
 * @param amount - The monetary amount in transaction currency
 * @param rate - Exchange rate (functional currency per transaction currency)
 * @param functionalCurrency - The functional currency code
 * @returns The converted MonetaryAmount in functional currency
 */
export const convertToFunctional = (
  amount: MonetaryAmount,
  rate: BigDecimal.BigDecimal,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  // Multiply the amount by the exchange rate
  const convertedAmount = multiply(amount, rate)
  // Return a new MonetaryAmount with the functional currency
  return MonetaryAmount.fromBigDecimal(convertedAmount.amount, functionalCurrency)
}

/**
 * Validate and convert a transaction amount to functional currency.
 *
 * Validates that an exchange rate is provided when the transaction currency
 * differs from the functional currency. For same-currency transactions,
 * returns the original amount with an exchange rate of 1.
 *
 * @param amount - The monetary amount in transaction currency
 * @param exchangeRate - Optional exchange rate (required if currencies differ)
 * @param functionalCurrency - The functional currency code
 * @returns Effect containing MultiCurrencyConversionResult or MissingExchangeRateError
 */
export const validateAndConvertToFunctional = (
  amount: MonetaryAmount,
  exchangeRate: BigDecimal.BigDecimal | undefined,
  functionalCurrency: CurrencyCode
): Effect.Effect<MultiCurrencyConversionResult, MissingExchangeRateError> => {
  const transactionCurrency = amount.currency

  // Check if currencies are the same
  if (transactionCurrency === functionalCurrency) {
    // Same currency - use exchange rate of 1
    const unityRate = BigDecimal.fromBigInt(1n)
    return Effect.succeed(
      MultiCurrencyConversionResult.make({
        originalAmount: amount,
        functionalAmount: amount,
        exchangeRate: unityRate
      })
    )
  }

  // Different currencies - exchange rate is required
  if (exchangeRate === undefined) {
    return Effect.fail(
      new MissingExchangeRateError({
        transactionCurrency,
        functionalCurrency
      })
    )
  }

  // Convert to functional currency
  const functionalAmount = convertToFunctional(amount, exchangeRate, functionalCurrency)

  return Effect.succeed(
    MultiCurrencyConversionResult.make({
      originalAmount: amount,
      functionalAmount,
      exchangeRate
    })
  )
}

/**
 * Check if an exchange rate is required for the given currencies.
 *
 * @param transactionCurrency - The transaction currency
 * @param functionalCurrency - The functional currency
 * @returns true if exchange rate is required, false otherwise
 */
export const isExchangeRateRequired = (
  transactionCurrency: CurrencyCode,
  functionalCurrency: CurrencyCode
): boolean => {
  return transactionCurrency !== functionalCurrency
}

/**
 * Create a conversion result for same-currency transactions.
 *
 * When transaction and functional currencies are the same, no conversion
 * is needed. This helper creates the appropriate result with rate = 1.
 *
 * @param amount - The monetary amount (same currency for transaction and functional)
 * @returns MultiCurrencyConversionResult with rate of 1
 */
export const createSameCurrencyResult = (
  amount: MonetaryAmount
): MultiCurrencyConversionResult => {
  return MultiCurrencyConversionResult.make({
    originalAmount: amount,
    functionalAmount: amount,
    exchangeRate: BigDecimal.fromBigInt(1n)
  })
}

/**
 * Create a conversion result for different-currency transactions.
 *
 * @param amount - The transaction amount in original currency
 * @param rate - Exchange rate (functional currency per transaction currency)
 * @param functionalCurrency - The functional currency code
 * @returns MultiCurrencyConversionResult with converted amount
 */
export const createMultiCurrencyResult = (
  amount: MonetaryAmount,
  rate: BigDecimal.BigDecimal,
  functionalCurrency: CurrencyCode
): MultiCurrencyConversionResult => {
  const functionalAmount = convertToFunctional(amount, rate, functionalCurrency)
  return MultiCurrencyConversionResult.make({
    originalAmount: amount,
    functionalAmount,
    exchangeRate: rate
  })
}

/**
 * Validate exchange rate for a multi-currency transaction.
 *
 * Returns an Effect that succeeds with the rate if valid, or fails
 * with MissingExchangeRateError if rate is missing for cross-currency transaction.
 *
 * @param transactionCurrency - The transaction currency
 * @param functionalCurrency - The functional currency
 * @param exchangeRate - The exchange rate (may be undefined)
 * @returns Effect with validated exchange rate or error
 */
export const validateExchangeRate = (
  transactionCurrency: CurrencyCode,
  functionalCurrency: CurrencyCode,
  exchangeRate: BigDecimal.BigDecimal | undefined
): Effect.Effect<BigDecimal.BigDecimal, MissingExchangeRateError> => {
  // Same currency doesn't require an exchange rate
  if (transactionCurrency === functionalCurrency) {
    return Effect.succeed(exchangeRate ?? BigDecimal.fromBigInt(1n))
  }

  // Different currencies require an exchange rate
  if (exchangeRate === undefined) {
    return Effect.fail(
      new MissingExchangeRateError({
        transactionCurrency,
        functionalCurrency
      })
    )
  }

  return Effect.succeed(exchangeRate)
}
