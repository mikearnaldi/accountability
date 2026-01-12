/**
 * FiscalPeriodsApiLive - Live implementation of fiscal periods API handlers
 *
 * Implements the FiscalPeriodsApi endpoints with real CRUD operations
 * by calling the FiscalPeriodRepository.
 *
 * Note: This is a simplified implementation that provides basic CRUD functionality.
 * Complex period management operations (like automated period creation with proper dates)
 * would require the full PeriodService which needs a FiscalYearRepository adapter.
 *
 * @module FiscalPeriodsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import {
  FiscalYear,
  FiscalYearId,
  FiscalPeriod,
  FiscalPeriodId
} from "@accountability/core/Services/PeriodService"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { FiscalPeriodRepository } from "@accountability/persistence/Services/FiscalPeriodRepository"
import {
  isEntityNotFoundError,
  type EntityNotFoundError,
  type PersistenceError
} from "@accountability/persistence/RepositoryError"
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
 * FiscalPeriodsApiLive - Layer providing FiscalPeriodsApi handlers
 *
 * Dependencies:
 * - FiscalPeriodRepository
 */
export const FiscalPeriodsApiLive = HttpApiBuilder.group(AppApi, "fiscalPeriods", (handlers) =>
  Effect.gen(function* () {
    const fiscalPeriodRepo = yield* FiscalPeriodRepository

    return handlers
      .handle("listFiscalYears", (_) =>
        Effect.gen(function* () {
          const { companyId, status, year } = _.urlParams

          let fiscalYears: ReadonlyArray<FiscalYear>

          if (companyId !== undefined) {
            fiscalYears = yield* fiscalPeriodRepo.findFiscalYearsByCompany(companyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else {
            // If no companyId filter, return empty for now
            fiscalYears = []
          }

          // Apply additional filters
          if (status !== undefined) {
            fiscalYears = fiscalYears.filter((fy) => fy.status === status)
          }
          if (year !== undefined) {
            fiscalYears = fiscalYears.filter((fy) => fy.year === year)
          }

          // Apply pagination
          const total = fiscalYears.length
          const limit = _.urlParams.limit ?? 100
          const offset = _.urlParams.offset ?? 0
          const paginatedFiscalYears = fiscalYears.slice(offset, offset + limit)

          return {
            fiscalYears: paginatedFiscalYears,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getFiscalYear", (_) =>
        Effect.gen(function* () {
          const fiscalYearId = _.path.id

          const maybeFiscalYear = yield* fiscalPeriodRepo.findFiscalYearById(fiscalYearId).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("FiscalYear", fiscalYearId, e))
          )

          if (Option.isNone(maybeFiscalYear)) {
            return yield* Effect.fail(new NotFoundError({ resource: "FiscalYear", id: fiscalYearId }))
          }

          const periods = yield* fiscalPeriodRepo.findByFiscalYear(fiscalYearId).pipe(
            Effect.orDie
          )

          return {
            fiscalYear: maybeFiscalYear.value,
            periods: Array.fromIterable(periods)
          }
        })
      )
      .handle("createFiscalYear", (_) =>
        Effect.gen(function* () {
          const req = _.payload
          const startDate = req.startDate

          // Calculate end date (one year from start, minus one day)
          const endYear = startDate.month === 1 ? startDate.year : startDate.year + 1
          const endMonth = startDate.month === 1 ? 12 : startDate.month - 1
          const endDate = LocalDate.make({
            year: endYear,
            month: endMonth,
            day: 28 // Simplified, would properly calculate last day of month
          })

          // Create fiscal year
          const now = timestampNow()
          const newFiscalYear = FiscalYear.make({
            id: FiscalYearId.make(crypto.randomUUID()),
            companyId: req.companyId,
            name: `FY${startDate.year}`,
            year: startDate.year,
            startDate,
            endDate,
            status: "Open",
            includesAdjustmentPeriod: req.includeAdjustmentPeriod ?? false,
            createdAt: now
          })

          const createdFiscalYear = yield* fiscalPeriodRepo.createFiscalYear(newFiscalYear).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )

          // Create 12 periods (simplified - would use proper date calculation in production)
          const periods: FiscalPeriod[] = []
          const periodCount = req.includeAdjustmentPeriod ? 13 : 12
          const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"]

          for (let periodNum = 1; periodNum <= periodCount; periodNum++) {
            const isAdjustmentPeriod = periodNum === 13
            const periodStartMonth = ((startDate.month - 1 + periodNum - 1) % 12) + 1
            const periodStartYear = startDate.year + Math.floor((startDate.month - 1 + periodNum - 1) / 12)
            const periodEndMonth = periodStartMonth
            const periodEndYear = periodStartYear

            // Calculate last day of the period's month (simplified)
            const lastDayOfMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][periodEndMonth - 1]

            const periodName = isAdjustmentPeriod
              ? `Adjustment Period ${startDate.year}`
              : `${monthNames[periodStartMonth - 1]} ${periodStartYear}`

            const period = FiscalPeriod.make({
              id: FiscalPeriodId.make(crypto.randomUUID()),
              fiscalYearId: createdFiscalYear.id,
              periodNumber: periodNum,
              name: periodName,
              periodType: isAdjustmentPeriod ? "Adjustment" : "Regular",
              startDate: LocalDate.make({ year: periodStartYear, month: periodStartMonth, day: 1 }),
              endDate: LocalDate.make({ year: periodEndYear, month: periodEndMonth, day: lastDayOfMonth }),
              status: "Open",
              closedBy: Option.none(),
              closedAt: Option.none()
            })

            const createdPeriod = yield* fiscalPeriodRepo.create(period).pipe(
              Effect.mapError((e) => mapPersistenceToBusinessRule(e))
            )
            periods.push(createdPeriod)
          }

          return {
            fiscalYear: createdFiscalYear,
            periods
          }
        })
      )
      .handle("deleteFiscalYear", (_) =>
        Effect.gen(function* () {
          const fiscalYearId = _.path.id

          // Check if exists
          const maybeFiscalYear = yield* fiscalPeriodRepo.findFiscalYearById(fiscalYearId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybeFiscalYear)) {
            return yield* Effect.fail(new NotFoundError({ resource: "FiscalYear", id: fiscalYearId }))
          }

          // Check if has any closed periods
          const periods = yield* fiscalPeriodRepo.findByFiscalYear(fiscalYearId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          const closedPeriods = periods.filter(p => p.status === "Closed" || p.status === "Locked")
          if (closedPeriods.length > 0) {
            return yield* Effect.fail(new BusinessRuleError({
              code: "HAS_CLOSED_PERIODS",
              message: `Cannot delete fiscal year with ${closedPeriods.length} closed/locked periods`,
              details: Option.none()
            }))
          }

          // Note: Deletion would typically cascade delete periods via FK constraint
          // For now, just return not implemented
          return yield* Effect.fail(new BusinessRuleError({
            code: "DELETE_NOT_IMPLEMENTED",
            message: "Fiscal year deletion is not yet implemented",
            details: Option.none()
          }))
        })
      )
      .handle("listFiscalPeriods", (_) =>
        Effect.gen(function* () {
          const { companyId, fiscalYearId, status } = _.urlParams

          let periods: ReadonlyArray<FiscalPeriod>

          if (fiscalYearId !== undefined) {
            periods = yield* fiscalPeriodRepo.findByFiscalYear(fiscalYearId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else if (companyId !== undefined) {
            periods = yield* fiscalPeriodRepo.findByCompany(companyId).pipe(
              Effect.mapError((e) => mapPersistenceToValidation(e))
            )
          } else {
            periods = []
          }

          // Apply status filter
          if (status !== undefined) {
            periods = periods.filter((p) => p.status === status)
          }

          // Apply pagination
          const total = periods.length
          const limit = _.urlParams.limit ?? 100
          const offset = _.urlParams.offset ?? 0
          const paginatedPeriods = periods.slice(offset, offset + limit)

          return {
            periods: paginatedPeriods,
            total,
            limit,
            offset
          }
        })
      )
      .handle("getFiscalPeriod", (_) =>
        Effect.gen(function* () {
          const periodId = _.path.id

          const maybePeriod = yield* fiscalPeriodRepo.findById(periodId).pipe(
            Effect.mapError((e) => mapPersistenceToNotFound("FiscalPeriod", periodId, e))
          )

          return yield* Option.match(maybePeriod, {
            onNone: () => Effect.fail(new NotFoundError({ resource: "FiscalPeriod", id: periodId })),
            onSome: Effect.succeed
          })
        })
      )
      .handle("openPeriod", (_) =>
        Effect.gen(function* () {
          const periodId = _.path.id

          const maybePeriod = yield* fiscalPeriodRepo.findById(periodId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybePeriod)) {
            return yield* Effect.fail(new NotFoundError({ resource: "FiscalPeriod", id: periodId }))
          }
          const existing = maybePeriod.value

          // Check status allows opening
          if (existing.status === "Open") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "ALREADY_OPEN",
              message: "Period is already open",
              details: Option.none()
            }))
          }
          if (existing.status === "Locked") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "CANNOT_OPEN_LOCKED",
              message: "Cannot open a locked period",
              details: Option.none()
            }))
          }

          const updatedPeriod = FiscalPeriod.make({
            ...existing,
            status: "Open"
          })

          return yield* fiscalPeriodRepo.update(updatedPeriod).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("closePeriod", (_) =>
        Effect.gen(function* () {
          const periodId = _.path.id
          const { closedBy } = _.payload

          const maybePeriod = yield* fiscalPeriodRepo.findById(periodId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybePeriod)) {
            return yield* Effect.fail(new NotFoundError({ resource: "FiscalPeriod", id: periodId }))
          }
          const existing = maybePeriod.value

          // Check status allows closing
          if (existing.status === "Closed" || existing.status === "Locked") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "ALREADY_CLOSED",
              message: `Period is already ${existing.status}`,
              details: Option.none()
            }))
          }

          const updatedPeriod = FiscalPeriod.make({
            ...existing,
            status: "Closed",
            closedAt: Option.some(timestampNow()),
            closedBy: Option.some(closedBy)
          })

          return yield* fiscalPeriodRepo.update(updatedPeriod).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("softClosePeriod", (_) =>
        Effect.gen(function* () {
          const periodId = _.path.id
          const { closedBy } = _.payload

          const maybePeriod = yield* fiscalPeriodRepo.findById(periodId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybePeriod)) {
            return yield* Effect.fail(new NotFoundError({ resource: "FiscalPeriod", id: periodId }))
          }
          const existing = maybePeriod.value

          // Check status allows soft closing
          if (existing.status !== "Open") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "INVALID_STATUS_FOR_SOFT_CLOSE",
              message: `Cannot soft close period with status: ${existing.status}`,
              details: Option.none()
            }))
          }

          const updatedPeriod = FiscalPeriod.make({
            ...existing,
            status: "SoftClose",
            closedAt: Option.some(timestampNow()),
            closedBy: Option.some(closedBy)
          })

          return yield* fiscalPeriodRepo.update(updatedPeriod).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
        })
      )
      .handle("reopenPeriod", (_) =>
        Effect.gen(function* () {
          const periodId = _.path.id
          const { reopenedBy, reason } = _.payload
          void reopenedBy
          void reason // Would be logged in audit trail

          const maybePeriod = yield* fiscalPeriodRepo.findById(periodId).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )
          if (Option.isNone(maybePeriod)) {
            return yield* Effect.fail(new NotFoundError({ resource: "FiscalPeriod", id: periodId }))
          }
          const existing = maybePeriod.value

          // Check status allows reopening
          if (existing.status === "Open") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "ALREADY_OPEN",
              message: "Period is already open",
              details: Option.none()
            }))
          }
          if (existing.status === "Locked") {
            return yield* Effect.fail(new BusinessRuleError({
              code: "CANNOT_REOPEN_LOCKED",
              message: "Cannot reopen a locked period",
              details: Option.none()
            }))
          }

          const updatedPeriod = FiscalPeriod.make({
            ...existing,
            status: "Open",
            closedAt: Option.none(),
            closedBy: Option.none()
          })

          const savedPeriod = yield* fiscalPeriodRepo.update(updatedPeriod).pipe(
            Effect.mapError((e) => mapPersistenceToBusinessRule(e))
          )

          // In production, would create and save audit entry
          const auditEntryId = crypto.randomUUID()

          return {
            period: savedPeriod,
            auditEntryId
          }
        })
      )
      .handle("getCurrentPeriod", (_) =>
        Effect.gen(function* () {
          const { companyId } = _.urlParams

          // Find current open period for the company
          const openPeriods = yield* fiscalPeriodRepo.findOpen(companyId).pipe(
            Effect.orDie
          )

          if (openPeriods.length === 0) {
            return yield* Effect.fail(new NotFoundError({
              resource: "FiscalPeriod",
              id: `current-for-${companyId}`
            }))
          }

          // Return the first open period (sorted by start date)
          const sorted = [...openPeriods].sort((a, b) =>
            a.startDate.year * 100 + a.startDate.month - (b.startDate.year * 100 + b.startDate.month)
          )

          return sorted[0]
        })
      )
  })
)
