/**
 * CurrencyApiLive - Live implementation of currency API handlers
 *
 * Implements the CurrencyApi endpoints with real CRUD operations
 * by calling the ExchangeRateRepository.
 *
 * @module CurrencyApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import {
  ExchangeRate,
  ExchangeRateId
} from "@accountability/core/Domains/ExchangeRate"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"
import { ExchangeRateRepository } from "@accountability/persistence/Services/ExchangeRateRepository"
import {
  isEntityNotFoundError,
  type EntityNotFoundError,
  type PersistenceError
} from "@accountability/persistence/Errors/RepositoryError"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  NotFoundError,
  ValidationError,
  BusinessRuleError
} from "../Definitions/ApiErrors.ts"

/**
 * Convert persistence errors to NotFoundError
 */
const mapPersistenceToNotFound = (
  resource: string,
  id: string,
  error: EntityNotFoundError | PersistenceError
): NotFoundError => {
  void error
  return new NotFoundError({ resource, id })
}

/**
 * Convert persistence errors to BusinessRuleError
 */
const mapPersistenceToBusinessRule = (
  error: EntityNotFoundError | PersistenceError
): BusinessRuleError => {
  if (isEntityNotFoundError(error)) {
    return new BusinessRuleError({
      code: "ENTITY_NOT_FOUND",
      message: error.message,
      details: Option.none()
    })
  }
  return new BusinessRuleError({
    code: "PERSISTENCE_ERROR",
    message: error.message,
    details: Option.none()
  })
}

/**
 * Convert persistence errors to ValidationError
 */
const mapPersistenceToValidation = (
  error: EntityNotFoundError | PersistenceError
): ValidationError => {
  return new ValidationError({
    message: error.message,
    field: Option.none(),
    details: Option.none()
  })
}

/**
 * CurrencyApiLive - Layer providing CurrencyApi handlers
 *
 * Dependencies:
 * - ExchangeRateRepository
 */
export const CurrencyApiLive = HttpApiBuilder.group(AppApi, "currency", (handlers) =>
  Effect.gen(function* () {
    const exchangeRateRepo = yield* ExchangeRateRepository

    return handlers
      .handle("listExchangeRates", (_) =>
        Effect.gen(function* () {
          const { fromCurrency, toCurrency, startDate, endDate } = _.urlParams

          let rates: ReadonlyArray<ExchangeRate>

          if (fromCurrency !== undefined && toCurrency !== undefined) {
            if (startDate !== undefined && endDate !== undefined) {
              rates = yield* exchangeRateRepo.findByDateRange(
                fromCurrency,
                toCurrency,
                startDate,
                endDate
              ).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            } else {
              rates = yield* exchangeRateRepo.findByCurrencyPair(fromCurrency, toCurrency).pipe(
                Effect.mapError((e) => mapPersistenceToValidation(e))
              )
            }
          } else {
            // No filter - return empty for now
            rates = []
          }

          // Apply rateType filter if provided
          const { rateType } = _.urlParams
          if (rateType !== undefined) {
            rates = rates.filter((r) => r.rateType === rateType)
          }

          // Apply pagination
          const total = rates.length
          const limit = _.urlParams.limit ?? 100
          const offset = _.urlParams.offset ?? 0
          const paginatedRates = rates.slice(offset, offset + limit)

          return {
            rates: paginatedRates,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getExchangeRate", (_) =>
        Effect.gen(function* () {
          const rateId = _.path.id

          const maybeRate = yield* exchangeRateRepo.findById(rateId).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("ExchangeRate", rateId, e))
          )

          return yield* Option.match(maybeRate, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "ExchangeRate", id: rateId })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("createExchangeRate", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate currencies are different
          if (req.fromCurrency === req.toCurrency) {
            return yield* Effect.fail(new ValidationError({
              message: "From and To currencies must be different",
              field: Option.some("toCurrency"),
              details: Option.none()
            }))
          }

          // Create the rate
          const newRate = ExchangeRate.make({
            id: ExchangeRateId.make(crypto.randomUUID()),
            fromCurrency: req.fromCurrency,
            toCurrency: req.toCurrency,
            rate: req.rate,
            effectiveDate: req.effectiveDate,
            rateType: req.rateType,
            source: req.source,
            createdAt: timestampNow()
          })

          return yield* exchangeRateRepo.create(newRate).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("bulkCreateExchangeRates", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate each rate
          for (const rateReq of req.rates) {
            if (rateReq.fromCurrency === rateReq.toCurrency) {
              return yield* Effect.fail(new ValidationError({
                message: `From and To currencies must be different: ${rateReq.fromCurrency}`,
                field: Option.some("rates"),
                details: Option.none()
              }))
            }
          }

          // Create all rates
          const newRates = req.rates.map((rateReq) =>
            ExchangeRate.make({
              id: ExchangeRateId.make(crypto.randomUUID()),
              fromCurrency: rateReq.fromCurrency,
              toCurrency: rateReq.toCurrency,
              rate: rateReq.rate,
              effectiveDate: rateReq.effectiveDate,
              rateType: rateReq.rateType,
              source: rateReq.source,
              createdAt: timestampNow()
            })
          )

          const created = yield* exchangeRateRepo.createMany(newRates).pipe(
            Effect.mapError((e) => mapPersistenceToValidation(e))
          )

          return {
            created: Array.fromIterable(created),
            count: created.length
          }
        })
      )
      .handle("deleteExchangeRate", (_) =>
        Effect.gen(function* () {
          const rateId = _.path.id

          // Check if exists
          const exists = yield* exchangeRateRepo.exists(rateId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (!exists) {
            return yield* Effect.fail(new NotFoundError({ resource: "ExchangeRate", id: rateId }))
          }

          yield* exchangeRateRepo.delete(rateId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("getRateForDate", (_) =>
        Effect.gen(function* () {
          const { fromCurrency, toCurrency, effectiveDate, rateType } = _.urlParams

          const maybeRate = yield* exchangeRateRepo.findRate(
            fromCurrency,
            toCurrency,
            effectiveDate,
            rateType
          ).pipe(Effect.orDie)

          return { rate: maybeRate }
        })
      )
      .handle("getLatestRate", (_) =>
        Effect.gen(function* () {
          const { fromCurrency, toCurrency, rateType } = _.urlParams

          const maybeRate = yield* exchangeRateRepo.findLatestRate(
            fromCurrency,
            toCurrency,
            rateType
          ).pipe(Effect.orDie)

          return { rate: maybeRate }
        })
      )
      .handle("getClosestRate", (_) =>
        Effect.gen(function* () {
          const { fromCurrency, toCurrency, date, rateType } = _.urlParams

          const maybeRate = yield* exchangeRateRepo.findClosestRate(
            fromCurrency,
            toCurrency,
            date,
            rateType
          ).pipe(Effect.orDie)

          return { rate: maybeRate }
        })
      )
      .handle("getPeriodAverageRate", (_) =>
        Effect.gen(function* () {
          const { fromCurrency, toCurrency, year, period } = _.urlParams

          const maybeRate = yield* exchangeRateRepo.findAverageRateForPeriod(
            fromCurrency,
            toCurrency,
            year,
            period
          ).pipe(Effect.orDie)

          return { rate: maybeRate }
        })
      )
      .handle("getPeriodClosingRate", (_) =>
        Effect.gen(function* () {
          const { fromCurrency, toCurrency, year, period } = _.urlParams

          const maybeRate = yield* exchangeRateRepo.findClosingRateForPeriod(
            fromCurrency,
            toCurrency,
            year,
            period
          ).pipe(Effect.orDie)

          return { rate: maybeRate }
        })
      )
  })
)
