/**
 * ExchangeRateRepository - Repository interface for ExchangeRate entity persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module ExchangeRateRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type {
  ExchangeRate,
  ExchangeRateId,
  RateType
} from "@accountability/core/currency/ExchangeRate"
import type { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import type { LocalDate } from "@accountability/core/shared/values/LocalDate"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * ExchangeRateRepository - Service interface for ExchangeRate persistence
 *
 * Provides operations for ExchangeRate entities with typed error handling.
 */
export interface ExchangeRateRepositoryService {
  /**
   * Find an exchange rate for a specific currency pair, date, and rate type
   *
   * @param fromCurrency - The source currency code
   * @param toCurrency - The target currency code
   * @param effectiveDate - The date the rate is effective for
   * @param rateType - The type of rate (Spot, Average, Historical, Closing)
   * @returns Effect containing Option of ExchangeRate (None if not found)
   */
  readonly findRate: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    effectiveDate: LocalDate,
    rateType: RateType
  ) => Effect.Effect<Option.Option<ExchangeRate>, PersistenceError>

  /**
   * Find the latest exchange rate for a currency pair
   *
   * Returns the most recent rate regardless of effective date.
   *
   * @param fromCurrency - The source currency code
   * @param toCurrency - The target currency code
   * @param rateType - The type of rate (Spot, Average, Historical, Closing)
   * @returns Effect containing Option of ExchangeRate (None if not found)
   */
  readonly findLatestRate: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rateType: RateType
  ) => Effect.Effect<Option.Option<ExchangeRate>, PersistenceError>

  /**
   * Create a new exchange rate
   *
   * @param rate - The exchange rate entity to create
   * @returns Effect containing the created exchange rate
   */
  readonly create: (
    rate: ExchangeRate
  ) => Effect.Effect<ExchangeRate, PersistenceError>

  /**
   * Find an exchange rate by its unique identifier
   *
   * @param id - The exchange rate ID to search for
   * @returns Effect containing Option of ExchangeRate (None if not found)
   */
  readonly findById: (
    id: ExchangeRateId
  ) => Effect.Effect<Option.Option<ExchangeRate>, PersistenceError>

  /**
   * Find an exchange rate by its unique identifier, throwing if not found
   *
   * @param id - The exchange rate ID to search for
   * @returns Effect containing the ExchangeRate
   * @throws EntityNotFoundError if rate doesn't exist
   */
  readonly getById: (
    id: ExchangeRateId
  ) => Effect.Effect<ExchangeRate, EntityNotFoundError | PersistenceError>

  /**
   * Find all exchange rates for a currency pair
   *
   * @param fromCurrency - The source currency code
   * @param toCurrency - The target currency code
   * @returns Effect containing array of exchange rates ordered by date descending
   */
  readonly findByCurrencyPair: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ) => Effect.Effect<ReadonlyArray<ExchangeRate>, PersistenceError>

  /**
   * Find exchange rates within a date range
   *
   * @param fromCurrency - The source currency code
   * @param toCurrency - The target currency code
   * @param startDate - The start date (inclusive)
   * @param endDate - The end date (inclusive)
   * @returns Effect containing array of exchange rates
   */
  readonly findByDateRange: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    startDate: LocalDate,
    endDate: LocalDate
  ) => Effect.Effect<ReadonlyArray<ExchangeRate>, PersistenceError>

  /**
   * Find the closest exchange rate to a given date
   *
   * If no exact match, returns the most recent rate before the date.
   *
   * @param fromCurrency - The source currency code
   * @param toCurrency - The target currency code
   * @param date - The target date
   * @param rateType - The type of rate (Spot, Average, Historical, Closing)
   * @returns Effect containing Option of ExchangeRate
   */
  readonly findClosestRate: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    date: LocalDate,
    rateType: RateType
  ) => Effect.Effect<Option.Option<ExchangeRate>, PersistenceError>

  /**
   * Find average rates for a fiscal period
   *
   * @param fromCurrency - The source currency code
   * @param toCurrency - The target currency code
   * @param year - The fiscal year
   * @param period - The fiscal period number (1-12)
   * @returns Effect containing Option of average ExchangeRate
   */
  readonly findAverageRateForPeriod: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    year: number,
    period: number
  ) => Effect.Effect<Option.Option<ExchangeRate>, PersistenceError>

  /**
   * Find closing rate for a fiscal period
   *
   * @param fromCurrency - The source currency code
   * @param toCurrency - The target currency code
   * @param year - The fiscal year
   * @param period - The fiscal period number (1-12)
   * @returns Effect containing Option of closing ExchangeRate
   */
  readonly findClosingRateForPeriod: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    year: number,
    period: number
  ) => Effect.Effect<Option.Option<ExchangeRate>, PersistenceError>

  /**
   * Bulk create exchange rates
   *
   * @param rates - Array of exchange rates to create
   * @returns Effect containing array of created exchange rates
   */
  readonly createMany: (
    rates: ReadonlyArray<ExchangeRate>
  ) => Effect.Effect<ReadonlyArray<ExchangeRate>, PersistenceError>

  /**
   * Check if an exchange rate exists
   *
   * @param id - The exchange rate ID to check
   * @returns Effect containing boolean indicating existence
   */
  readonly exists: (
    id: ExchangeRateId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Delete an exchange rate
   *
   * @param id - The exchange rate ID to delete
   * @returns Effect indicating success
   * @throws EntityNotFoundError if rate doesn't exist
   */
  readonly delete: (
    id: ExchangeRateId
  ) => Effect.Effect<void, EntityNotFoundError | PersistenceError>
}

/**
 * ExchangeRateRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { ExchangeRateRepository } from "@accountability/persistence/Services/ExchangeRateRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* ExchangeRateRepository
 *   const rate = yield* repo.findRate(USD, EUR, today, "Spot")
 *   // ...
 * })
 * ```
 */
export class ExchangeRateRepository extends Context.Tag("ExchangeRateRepository")<
  ExchangeRateRepository,
  ExchangeRateRepositoryService
>() {}
