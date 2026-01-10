/**
 * CurrencyService - Effect service for managing exchange rates
 *
 * Implements exchange rate management per SPECIFICATIONS.md including:
 * - Create and update exchange rates
 * - Rate lookups by currency pair, date, and type
 * - Latest rate lookups
 *
 * Uses Context.Tag and Layer patterns for dependency injection.
 *
 * @module CurrencyService
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { ExchangeRate, ExchangeRateId, Rate, RateType, RateSource } from "./ExchangeRate.js"
import type { CurrencyCode } from "./CurrencyCode.js"
import type { LocalDate } from "./LocalDate.js"
import { nowEffect as timestampNowEffect } from "./Timestamp.js"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when an exchange rate is not found
 */
export class RateNotFoundError extends Schema.TaggedError<RateNotFoundError>()(
  "RateNotFoundError",
  {
    fromCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    toCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    effectiveDate: Schema.optional(Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    })),
    rateType: Schema.optional(Schema.Literal("Spot", "Average", "Historical", "Closing"))
  }
) {
  get message(): string {
    const datePart = this.effectiveDate
      ? ` for date ${this.effectiveDate.year}-${String(this.effectiveDate.month).padStart(2, "0")}-${String(this.effectiveDate.day).padStart(2, "0")}`
      : ""
    const typePart = this.rateType ? ` (${this.rateType})` : ""
    return `Exchange rate not found: ${this.fromCurrency}/${this.toCurrency}${datePart}${typePart}`
  }
}

/**
 * Type guard for RateNotFoundError
 */
export const isRateNotFoundError = Schema.is(RateNotFoundError)

/**
 * Error when an exchange rate already exists (for create operation)
 */
export class RateAlreadyExistsError extends Schema.TaggedError<RateAlreadyExistsError>()(
  "RateAlreadyExistsError",
  {
    fromCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    toCurrency: Schema.String.pipe(Schema.brand("CurrencyCode")),
    effectiveDate: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    rateType: Schema.Literal("Spot", "Average", "Historical", "Closing")
  }
) {
  get message(): string {
    const dateStr = `${this.effectiveDate.year}-${String(this.effectiveDate.month).padStart(2, "0")}-${String(this.effectiveDate.day).padStart(2, "0")}`
    return `Exchange rate already exists: ${this.fromCurrency}/${this.toCurrency} for date ${dateStr} (${this.rateType})`
  }
}

/**
 * Type guard for RateAlreadyExistsError
 */
export const isRateAlreadyExistsError = Schema.is(RateAlreadyExistsError)

/**
 * Error when exchange rate ID is not found (for update operation)
 */
export class ExchangeRateIdNotFoundError extends Schema.TaggedError<ExchangeRateIdNotFoundError>()(
  "ExchangeRateIdNotFoundError",
  {
    exchangeRateId: Schema.UUID.pipe(Schema.brand("ExchangeRateId"))
  }
) {
  get message(): string {
    return `Exchange rate not found: ${this.exchangeRateId}`
  }
}

/**
 * Type guard for ExchangeRateIdNotFoundError
 */
export const isExchangeRateIdNotFoundError = Schema.is(ExchangeRateIdNotFoundError)

/**
 * Union type for all currency service errors
 */
export type CurrencyServiceError =
  | RateNotFoundError
  | RateAlreadyExistsError
  | ExchangeRateIdNotFoundError

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * ExchangeRateRepository - Repository interface for exchange rate persistence
 *
 * Used by CurrencyService for rate storage and retrieval.
 */
export interface ExchangeRateRepositoryService {
  /**
   * Find an exchange rate by ID
   * @param id - The exchange rate ID
   * @returns Effect containing the rate or None if not found
   */
  readonly findById: (id: ExchangeRateId) => Effect.Effect<Option.Option<ExchangeRate>>

  /**
   * Find an exchange rate by currency pair, date, and type
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param effectiveDate - The date to find the rate for
   * @param rateType - The type of rate (Spot, Average, Historical, Closing)
   * @returns Effect containing the rate or None if not found
   */
  readonly findByPairDateAndType: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    effectiveDate: LocalDate,
    rateType: RateType
  ) => Effect.Effect<Option.Option<ExchangeRate>>

  /**
   * Find the latest exchange rate for a currency pair
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Effect containing the latest rate or None if not found
   */
  readonly findLatestByPair: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ) => Effect.Effect<Option.Option<ExchangeRate>>

  /**
   * Save a new exchange rate
   * @param exchangeRate - The exchange rate to save
   * @returns Effect containing the saved rate
   */
  readonly save: (exchangeRate: ExchangeRate) => Effect.Effect<ExchangeRate>

  /**
   * Update an existing exchange rate
   * @param exchangeRate - The exchange rate to update
   * @returns Effect containing the updated rate
   */
  readonly update: (exchangeRate: ExchangeRate) => Effect.Effect<ExchangeRate>

  /**
   * Check if a rate exists for the given currency pair, date, and type
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param effectiveDate - The effective date
   * @param rateType - The type of rate
   * @returns Effect containing true if exists, false otherwise
   */
  readonly exists: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    effectiveDate: LocalDate,
    rateType: RateType
  ) => Effect.Effect<boolean>
}

/**
 * ExchangeRateRepository Context.Tag
 */
export class ExchangeRateRepository extends Context.Tag("ExchangeRateRepository")<
  ExchangeRateRepository,
  ExchangeRateRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * CreateExchangeRateInput - Input for creating a new exchange rate
 */
export interface CreateExchangeRateInput {
  /** Unique identifier for the new rate */
  readonly id: ExchangeRateId
  /** Source currency code */
  readonly fromCurrency: CurrencyCode
  /** Target currency code */
  readonly toCurrency: CurrencyCode
  /** The exchange rate value */
  readonly rate: Rate
  /** The date this rate is effective for */
  readonly effectiveDate: LocalDate
  /** The type of exchange rate */
  readonly rateType: RateType
  /** The source of this rate */
  readonly source: RateSource
}

/**
 * UpdateExchangeRateInput - Input for updating an existing exchange rate
 */
export interface UpdateExchangeRateInput {
  /** The ID of the rate to update */
  readonly id: ExchangeRateId
  /** The new exchange rate value */
  readonly rate: Rate
  /** Optionally update the source */
  readonly source?: RateSource
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * CurrencyService - Service interface for exchange rate management
 */
export interface CurrencyServiceShape {
  /**
   * Create a new exchange rate
   *
   * @param input - The exchange rate data to create
   * @returns Effect containing the created exchange rate
   * @throws RateAlreadyExistsError if a rate already exists for the same pair/date/type
   */
  readonly createRate: (
    input: CreateExchangeRateInput
  ) => Effect.Effect<
    ExchangeRate,
    RateAlreadyExistsError,
    never
  >

  /**
   * Update an existing exchange rate
   *
   * @param input - The update data
   * @returns Effect containing the updated exchange rate
   * @throws ExchangeRateIdNotFoundError if the rate ID doesn't exist
   */
  readonly updateRate: (
    input: UpdateExchangeRateInput
  ) => Effect.Effect<
    ExchangeRate,
    ExchangeRateIdNotFoundError,
    never
  >

  /**
   * Get an exchange rate for a specific currency pair, date, and type
   *
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @param effectiveDate - The date to find the rate for
   * @param rateType - The type of rate
   * @returns Effect containing the exchange rate
   * @throws RateNotFoundError if no rate is found
   */
  readonly getRate: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    effectiveDate: LocalDate,
    rateType: RateType
  ) => Effect.Effect<
    ExchangeRate,
    RateNotFoundError,
    never
  >

  /**
   * Get the latest exchange rate for a currency pair
   *
   * @param fromCurrency - Source currency code
   * @param toCurrency - Target currency code
   * @returns Effect containing the latest exchange rate
   * @throws RateNotFoundError if no rate is found
   */
  readonly getLatestRate: (
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ) => Effect.Effect<
    ExchangeRate,
    RateNotFoundError,
    never
  >
}

/**
 * CurrencyService Context.Tag
 */
export class CurrencyService extends Context.Tag("CurrencyService")<
  CurrencyService,
  CurrencyServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the CurrencyService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* ExchangeRateRepository

  return {
    createRate: (input: CreateExchangeRateInput) =>
      Effect.gen(function* () {
        // Check if a rate already exists for this combination
        const exists = yield* repository.exists(
          input.fromCurrency,
          input.toCurrency,
          input.effectiveDate,
          input.rateType
        )

        if (exists) {
          return yield* Effect.fail(
            new RateAlreadyExistsError({
              fromCurrency: input.fromCurrency,
              toCurrency: input.toCurrency,
              effectiveDate: {
                year: input.effectiveDate.year,
                month: input.effectiveDate.month,
                day: input.effectiveDate.day
              },
              rateType: input.rateType
            })
          )
        }

        // Create the exchange rate
        const now = yield* timestampNowEffect
        const exchangeRate = ExchangeRate.make({
          id: input.id,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          rate: input.rate,
          effectiveDate: input.effectiveDate,
          rateType: input.rateType,
          source: input.source,
          createdAt: now
        })

        // Save and return
        return yield* repository.save(exchangeRate)
      }),

    updateRate: (input: UpdateExchangeRateInput) =>
      Effect.gen(function* () {
        // Find the existing rate
        const existingRate = yield* repository.findById(input.id)

        if (Option.isNone(existingRate)) {
          return yield* Effect.fail(
            new ExchangeRateIdNotFoundError({
              exchangeRateId: input.id
            })
          )
        }

        // Create updated rate - note we keep all other fields the same
        const updatedRate = ExchangeRate.make({
          ...existingRate.value,
          rate: input.rate,
          source: input.source ?? existingRate.value.source
        })

        // Update and return
        return yield* repository.update(updatedRate)
      }),

    getRate: (
      fromCurrency: CurrencyCode,
      toCurrency: CurrencyCode,
      effectiveDate: LocalDate,
      rateType: RateType
    ) =>
      Effect.gen(function* () {
        const rate = yield* repository.findByPairDateAndType(
          fromCurrency,
          toCurrency,
          effectiveDate,
          rateType
        )

        if (Option.isNone(rate)) {
          return yield* Effect.fail(
            new RateNotFoundError({
              fromCurrency,
              toCurrency,
              effectiveDate: {
                year: effectiveDate.year,
                month: effectiveDate.month,
                day: effectiveDate.day
              },
              rateType
            })
          )
        }

        return rate.value
      }),

    getLatestRate: (
      fromCurrency: CurrencyCode,
      toCurrency: CurrencyCode
    ) =>
      Effect.gen(function* () {
        const rate = yield* repository.findLatestByPair(fromCurrency, toCurrency)

        if (Option.isNone(rate)) {
          return yield* Effect.fail(
            new RateNotFoundError({
              fromCurrency,
              toCurrency
            })
          )
        }

        return rate.value
      })
  } satisfies CurrencyServiceShape
})

/**
 * CurrencyServiceLive - Live implementation of CurrencyService
 *
 * Requires ExchangeRateRepository
 */
export const CurrencyServiceLive: Layer.Layer<
  CurrencyService,
  never,
  ExchangeRateRepository
> = Layer.effect(CurrencyService, make)
