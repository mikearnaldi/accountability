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
} from "@accountability/core/currency/ExchangeRate"
import { now as timestampNow } from "@accountability/core/shared/values/Timestamp"
import { ExchangeRateRepository } from "@accountability/persistence/Services/ExchangeRateRepository"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  AuditLogError,
  UserLookupError
} from "../Definitions/ApiErrors.ts"
import {
  ExchangeRateNotFoundError,
  SameCurrencyExchangeRateError
} from "@accountability/core/currency/CurrencyErrors"
import type { AuditLogError as CoreAuditLogError, UserLookupError as CoreUserLookupError } from "@accountability/core/audit/AuditLogErrors"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"

/**
 * Map core AuditLogError to API AuditLogError
 */
const mapCoreAuditErrorToApi = (error: CoreAuditLogError | CoreUserLookupError): AuditLogError | UserLookupError => {
  if (error._tag === "UserLookupError") {
    return new UserLookupError({
      userId: error.userId,
      cause: error.cause
    })
  }
  return new AuditLogError({
    operation: error.operation,
    cause: error.cause
  })
}


/**
 * Helper to log exchange rate creation to audit log
 *
 * Uses the AuditLogService and CurrentUserId from the Effect context.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 *
 * @param organizationId - The organization this rate belongs to
 * @param rate - The created exchange rate
 * @returns Effect that completes when audit logging succeeds
 */
const logExchangeRateCreate = (
  organizationId: string,
  rate: ExchangeRate
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      organizationId,
      "ExchangeRate",
      rate.id,
      `${rate.fromCurrency}/${rate.toCurrency}`, // Human-readable currency pair for audit display
      rate,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log bulk exchange rate creation to audit log
 *
 * Logs each created rate as a separate audit entry.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 *
 * @param organizationId - The organization these rates belong to
 * @param rates - The created exchange rates
 * @returns Effect that completes when audit logging succeeds
 */
const logExchangeRateBulkCreate = (
  organizationId: string,
  rates: ReadonlyArray<ExchangeRate>
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    // Log each rate creation individually
    for (const rate of rates) {
      yield* auditService.logCreate(
        organizationId,
        "ExchangeRate",
        rate.id,
        `${rate.fromCurrency}/${rate.toCurrency}`, // Human-readable currency pair for audit display
        rate,
        userId
      )
    }
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log exchange rate deletion to audit log
 *
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 *
 * @param organizationId - The organization this rate belongs to
 * @param rate - The exchange rate being deleted
 * @returns Effect that completes when audit logging succeeds
 */
const logExchangeRateDelete = (
  organizationId: string,
  rate: ExchangeRate
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logDelete(
      organizationId,
      "ExchangeRate",
      rate.id,
      `${rate.fromCurrency}/${rate.toCurrency}`, // Human-readable currency pair for audit display
      rate,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
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
                ).pipe(Effect.orDie) // PersistenceError becomes a defect
              } else {
                rates = yield* exchangeRateRepo.findByCurrencyPair(fromCurrency, toCurrency).pipe(
                  Effect.orDie // PersistenceError becomes a defect
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
            Effect.orDie // PersistenceError becomes a defect
          )

          const rate = yield* Option.match(maybeRate, {
            onNone: () => Effect.fail(new ExchangeRateNotFoundError({ rateId })),
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
              return yield* Effect.fail(new SameCurrencyExchangeRateError({
                currency: req.fromCurrency
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
              Effect.orDie // PersistenceError becomes a defect
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

          // Validate there is at least one rate
          if (req.rates.length === 0) {
            // Empty rates array is a programming error, not a user input error
            return yield* Effect.die(new Error("At least one rate is required"))
          }

          const firstOrgId = req.rates[0].organizationId
          for (const rateReq of req.rates) {
            if (rateReq.organizationId !== firstOrgId) {
              // Mixed organization IDs in bulk create is a programming error
              return yield* Effect.die(new Error("All rates in bulk create must be for the same organization"))
            }
          }

          // Now check organization context and permission
          return yield* requireOrganizationContext(firstOrgId,
            Effect.gen(function* () {
              yield* requirePermission("exchange_rate:manage")

              // Validate each rate
              for (const rateReq of req.rates) {
                if (rateReq.fromCurrency === rateReq.toCurrency) {
                  return yield* Effect.fail(new SameCurrencyExchangeRateError({
                    currency: rateReq.fromCurrency
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
                Effect.orDie // PersistenceError becomes a defect
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
            Effect.orDie // PersistenceError becomes a defect
          )

          const rate = yield* Option.match(maybeRate, {
            onNone: () => Effect.fail(new ExchangeRateNotFoundError({ rateId })),
            onSome: Effect.succeed
          })

          // Now check organization context and permission
          return yield* requireOrganizationContext(rate.organizationId,
            Effect.gen(function* () {
              yield* requirePermission("exchange_rate:manage")

              yield* exchangeRateRepo.delete(rateId).pipe(
                Effect.orDie // PersistenceError becomes a defect
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
