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
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"
import { AuditLogService } from "@accountability/core/AuditLog/AuditLogService"
import { CurrentUserId } from "@accountability/core/AuditLog/CurrentUserId"

/**
 * Convert persistence errors to NotFoundError
 */
const mapPersistenceToNotFound = (
  resource: string,
  id: string,
  _error: EntityNotFoundError | PersistenceError
): NotFoundError => {
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
 * Helper to log exchange rate creation to audit log
 *
 * Uses the AuditLogService and CurrentUserId from the Effect context.
 * Errors are caught and silently ignored to not block business operations.
 *
 * @param organizationId - The organization this rate belongs to
 * @param rate - The created exchange rate
 * @returns Effect that completes when audit logging is attempted
 */
const logExchangeRateCreate = (
  organizationId: string,
  rate: ExchangeRate
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      organizationId,
      "ExchangeRate",
      rate.id,
      rate,
      userId
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * Helper to log bulk exchange rate creation to audit log
 *
 * Logs each created rate as a separate audit entry.
 *
 * @param organizationId - The organization these rates belong to
 * @param rates - The created exchange rates
 * @returns Effect that completes when audit logging is attempted
 */
const logExchangeRateBulkCreate = (
  organizationId: string,
  rates: ReadonlyArray<ExchangeRate>
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    // Log each rate creation individually
    for (const rate of rates) {
      yield* auditService.logCreate(
        organizationId,
        "ExchangeRate",
        rate.id,
        rate,
        userId
      )
    }
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

/**
 * Helper to log exchange rate deletion to audit log
 *
 * @param organizationId - The organization this rate belongs to
 * @param rate - The exchange rate being deleted
 * @returns Effect that completes when audit logging is attempted
 */
const logExchangeRateDelete = (
  organizationId: string,
  rate: ExchangeRate
): Effect.Effect<void, never, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logDelete(
      organizationId,
      "ExchangeRate",
      rate.id,
      rate,
      userId
    )
  }).pipe(
    Effect.catchAll(() => Effect.void) // Silent failure - don't block business operations
  )

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
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("exchange_rate:read")

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
      )
      .handle("getExchangeRate", (_) =>
        Effect.gen(function* () {
          const rateId = _.path.id

          // First fetch the rate to get its organizationId
          const maybeRate = yield* exchangeRateRepo.findById(rateId).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("ExchangeRate", rateId, e))
          )

          const rate = yield* Option.match(maybeRate, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "ExchangeRate", id: rateId })),
            onSome: Effect.succeed
          })

          // Now check organization context and permission
          return yield* requireOrganizationContext(rate.organizationId,
            Effect.gen(function* () {
              yield* requirePermission("exchange_rate:read")
              return rate
            })
          )
        })
      )
      .handle("createExchangeRate", (_) =>
        requireOrganizationContext(_.payload.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("exchange_rate:manage")

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
              organizationId: req.organizationId,
              fromCurrency: req.fromCurrency,
              toCurrency: req.toCurrency,
              rate: req.rate,
              effectiveDate: req.effectiveDate,
              rateType: req.rateType,
              source: req.source,
              createdAt: timestampNow()
            })

            const createdRate = yield* exchangeRateRepo.create(newRate).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )

            // Log exchange rate creation to audit log
            yield* logExchangeRateCreate(req.organizationId, createdRate)

            return createdRate
          })
        )
      )
      .handle("bulkCreateExchangeRates", (_) =>
        Effect.gen(function* () {
          const req = _.payload

          // Validate there is at least one rate and all are for the same organization
          if (req.rates.length === 0) {
            return yield* Effect.fail(new ValidationError({
              message: "At least one rate is required",
              field: Option.some("rates"),
              details: Option.none()
            }))
          }

          const firstOrgId = req.rates[0].organizationId
          for (const rateReq of req.rates) {
            if (rateReq.organizationId !== firstOrgId) {
              return yield* Effect.fail(new ValidationError({
                message: "All rates in bulk create must be for the same organization",
                field: Option.some("rates"),
                details: Option.none()
              }))
            }
          }

          // Now check organization context and permission
          return yield* requireOrganizationContext(firstOrgId,
            Effect.gen(function* () {
              yield* requirePermission("exchange_rate:manage")

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
                  organizationId: rateReq.organizationId,
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

              // Log all exchange rate creations to audit log
              yield* logExchangeRateBulkCreate(firstOrgId, created)

              return {
                created: Array.fromIterable(created),
                count: created.length
              }
            })
          )
        })
      )
      .handle("deleteExchangeRate", (_) =>
        Effect.gen(function* () {
          const rateId = _.path.id

          // First fetch the rate to get its organizationId
          const maybeRate = yield* exchangeRateRepo.findById(rateId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )

          const rate = yield* Option.match(maybeRate, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "ExchangeRate", id: rateId })),
            onSome: Effect.succeed
          })

          // Now check organization context and permission
          return yield* requireOrganizationContext(rate.organizationId,
            Effect.gen(function* () {
              yield* requirePermission("exchange_rate:manage")

              yield* exchangeRateRepo.delete(rateId).pipe(
                Effect.mapError((e) => mapPersistenceToBusinessRule(e))
              )

              // Log exchange rate deletion to audit log
              yield* logExchangeRateDelete(rate.organizationId, rate)
            })
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
