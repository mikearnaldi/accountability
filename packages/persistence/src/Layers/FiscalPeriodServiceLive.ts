/**
 * FiscalPeriodServiceLive - Implementation of FiscalPeriodService
 *
 * Implements the FiscalPeriodService interface from core, providing
 * business logic for fiscal period management including:
 * - Creating fiscal years with period generation
 * - Managing period status transitions
 * - Reopening periods with audit trail
 * - Querying period status for authorization
 *
 * @module FiscalPeriodServiceLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import {
  FiscalPeriodService,
  type FiscalPeriodServiceShape,
  type CreateFiscalYearInput,
  type GeneratePeriodsInput,
  type ListPeriodsFilter
} from "@accountability/core/fiscal/FiscalPeriodService"
import {
  FiscalYearNotFoundError,
  FiscalPeriodNotFoundError,
  InvalidStatusTransitionError,
  InvalidYearStatusTransitionError,
  FiscalYearAlreadyExistsError
} from "@accountability/core/fiscal/FiscalPeriodErrors"
import { FiscalYear, FiscalYearId } from "@accountability/core/fiscal/FiscalYear"
import { FiscalPeriod, FiscalPeriodId, FiscalPeriodUserId as FiscalPeriodUserIdSchema } from "@accountability/core/fiscal/FiscalPeriod"
import type { FiscalPeriodStatus } from "@accountability/core/fiscal/FiscalPeriodStatus"
import { canTransitionTo } from "@accountability/core/fiscal/FiscalPeriodStatus"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { FiscalPeriodRepository } from "../Services/FiscalPeriodRepository.ts"

// =============================================================================
// Date Helper Functions
// =============================================================================

/**
 * Get the number of days in a given month
 */
function getDaysInMonth(year: number, month: number): number {
  // Month is 1-indexed (1 = January, 12 = December)
  // Create a date for the first day of the next month, then go back one day
  const nextMonth = month === 12 ? 1 : month + 1
  const nextMonthYear = month === 12 ? year + 1 : year
  const date = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 0))
  return date.getUTCDate()
}

/**
 * Compare two LocalDate values
 * Returns negative if a < b, 0 if equal, positive if a > b
 */
function compareDates(a: LocalDate, b: LocalDate): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

/**
 * Add days to a LocalDate
 */
function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return LocalDate.make({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate()
  })
}

/**
 * Creates the FiscalPeriodService implementation
 */
const make = Effect.gen(function* () {
  const periodRepo = yield* FiscalPeriodRepository
  // AuditLogService is optional - accessed via Effect.either in helper functions

  /**
   * Helper to log audit entries (no-op at this layer)
   *
   * Note: organizationId is not available at the FiscalPeriodService layer.
   * Audit logging for fiscal periods should be done at the API layer where
   * organization context is available.
   *
   * This function always returns Effect.void since we don't have the
   * organization context needed for proper audit logging.
   */
  const logAuditStatusChange = (
    _organizationId: string | undefined,
    _entityType: "FiscalYear" | "FiscalPeriod",
    _entityId: string,
    _previousStatus: string,
    _newStatus: string,
    _userId: AuthUserId,
    _reason?: string
  ): Effect.Effect<void> =>
    // Skip audit logging - organizationId not available at this layer
    // Audit logging should be done at the API layer
    Effect.void

  /**
   * Helper to log create with optional user ID from context
   * Will skip audit logging if no user ID is in context
   *
   * Note: Currently skips audit logging as organizationId is not available
   * at the FiscalPeriodService level. Audit logging for fiscal periods
   * should be done at the API layer where organization context is available.
   */
  const logAuditCreateWithContext = <T>(
    _entityType: "FiscalYear" | "FiscalPeriod",
    _entityId: string,
    _entity: T
  ) =>
    // Skip audit logging - organizationId not available at this layer
    // Audit logging should be done at the API layer
    Effect.void

  /**
   * Helper function to transition period status with validation
   */
  const transitionPeriodStatus = (
    fiscalYearId: FiscalYearId,
    periodId: FiscalPeriodId,
    targetStatus: FiscalPeriodStatus,
    userId: AuthUserId
  ) =>
    Effect.gen(function* () {
      const maybePeriod = yield* periodRepo.findPeriodById(fiscalYearId, periodId)
      if (Option.isNone(maybePeriod)) {
        return yield* Effect.fail(
          new FiscalPeriodNotFoundError({ fiscalPeriodId: periodId })
        )
      }
      const period = maybePeriod.value
      const previousStatus = period.status

      // Validate transition
      if (!canTransitionTo(period.status, targetStatus)) {
        return yield* Effect.fail(
          new InvalidStatusTransitionError({
            currentStatus: period.status,
            targetStatus,
            periodId
          })
        )
      }

      const now = Timestamp.now()
      const updatedPeriod = FiscalPeriod.make({
        ...period,
        status: targetStatus,
        closedBy: targetStatus === "Closed"
          ? Option.some(FiscalPeriodUserIdSchema.make(userId))
          : Option.none(),
        closedAt: targetStatus === "Closed"
          ? Option.some(now)
          : Option.none(),
        updatedAt: now
      })

      const result = yield* periodRepo.updatePeriod(fiscalYearId, updatedPeriod)

      // Log the status change to audit log
      // Note: organizationId not available at this layer, skipping audit logging
      yield* logAuditStatusChange(undefined, "FiscalPeriod", periodId, previousStatus, targetStatus, userId)

      return result
    })

  const service: FiscalPeriodServiceShape = {
    // ==================== Fiscal Year Operations ====================

    createFiscalYear: (input: CreateFiscalYearInput) =>
      Effect.gen(function* () {
        // Check if year already exists
        const existingYear = yield* periodRepo.findFiscalYearByNumber(input.companyId, input.year)
        if (Option.isSome(existingYear)) {
          return yield* Effect.fail(
            new FiscalYearAlreadyExistsError({
              companyId: input.companyId,
              year: input.year
            })
          )
        }

        // Create the fiscal year
        const now = Timestamp.now()
        const fiscalYear = FiscalYear.make({
          id: FiscalYearId.make(crypto.randomUUID()),
          companyId: input.companyId,
          name: input.name ?? `FY ${input.year}`,
          year: input.year,
          startDate: input.startDate,
          endDate: input.endDate,
          status: "Open",
          // Period 13 is mandatory for consolidation compatibility
          includesAdjustmentPeriod: true,
          createdAt: now,
          updatedAt: now
        })

        const result = yield* periodRepo.createFiscalYear(fiscalYear)

        // Log audit entry if AuditLogService and CurrentUserId are available
        yield* logAuditCreateWithContext("FiscalYear", fiscalYear.id, fiscalYear)

        return result
      }),

    getFiscalYear: (companyId, fiscalYearId) =>
      Effect.gen(function* () {
        const maybeFiscalYear = yield* periodRepo.findFiscalYearById(companyId, fiscalYearId)
        if (Option.isNone(maybeFiscalYear)) {
          return yield* Effect.fail(
            new FiscalYearNotFoundError({ fiscalYearId })
          )
        }
        return maybeFiscalYear.value
      }),

    getFiscalYearByNumber: (companyId, year) =>
      periodRepo.findFiscalYearByNumber(companyId, year),

    listFiscalYears: (companyId) =>
      periodRepo.findFiscalYearsByCompany(companyId),

    closeFiscalYear: (companyId, fiscalYearId) =>
      Effect.gen(function* () {
        const fiscalYear = yield* service.getFiscalYear(companyId, fiscalYearId)

        if (fiscalYear.status !== "Open") {
          return yield* Effect.fail(
            new InvalidYearStatusTransitionError({
              currentStatus: fiscalYear.status,
              targetStatus: "Closed",
              fiscalYearId
            })
          )
        }

        // Auto-close all open periods
        const periods = yield* periodRepo.findPeriodsByFiscalYear(fiscalYearId)
        const now = Timestamp.now()

        for (const period of periods) {
          if (period.status === "Open") {
            const closedPeriod = FiscalPeriod.make({
              ...period,
              status: "Closed",
              closedAt: Option.some(now),
              updatedAt: now
            })
            yield* periodRepo.updatePeriod(fiscalYearId, closedPeriod)
          }
        }

        const updatedYear = FiscalYear.make({
          ...fiscalYear,
          status: "Closed",
          updatedAt: now
        })

        return yield* periodRepo.updateFiscalYear(companyId, updatedYear)
      }),

    reopenFiscalYear: (companyId, fiscalYearId) =>
      Effect.gen(function* () {
        const fiscalYear = yield* service.getFiscalYear(companyId, fiscalYearId)

        if (fiscalYear.status !== "Closed") {
          return yield* Effect.fail(
            new InvalidYearStatusTransitionError({
              currentStatus: fiscalYear.status,
              targetStatus: "Open",
              fiscalYearId
            })
          )
        }

        const updatedYear = FiscalYear.make({
          ...fiscalYear,
          status: "Open",
          updatedAt: Timestamp.now()
        })

        return yield* periodRepo.updateFiscalYear(companyId, updatedYear)
      }),

    // ==================== Fiscal Period Operations ====================

    generatePeriods: (input: GeneratePeriodsInput) =>
      Effect.gen(function* () {
        const periodCount = input.periodCount ?? 12
        const now = Timestamp.now()
        const periods: FiscalPeriod[] = []

        // Use the start/end dates from input - they are provided by the caller
        // who already has the fiscal year data from createFiscalYear
        const startDate = input.startDate
        const endDate = input.endDate

        // Generate monthly periods that are sequential with no gaps
        // Each period starts where the previous one ended + 1 day
        let currentStart = startDate

        for (let i = 1; i <= periodCount; i++) {
          let periodEnd: LocalDate

          if (i === periodCount) {
            // Last regular period ends at fiscal year end
            periodEnd = endDate
          } else {
            // Calculate end date as last day of the month containing currentStart
            // Then move to first day of next month for next period
            const currentMonth = currentStart.month
            const currentYear = currentStart.year

            // Get last day of current month
            const daysInMonth = getDaysInMonth(currentYear, currentMonth)
            periodEnd = LocalDate.make({
              year: currentYear,
              month: currentMonth,
              day: daysInMonth
            })

            // If period end would be after fiscal year end, clamp it
            if (compareDates(periodEnd, endDate) > 0) {
              periodEnd = endDate
            }
          }

          const period = FiscalPeriod.make({
            id: FiscalPeriodId.make(crypto.randomUUID()),
            fiscalYearId: input.fiscalYearId,
            periodNumber: i,
            name: `Period ${i}`,
            periodType: "Regular",
            startDate: currentStart,
            endDate: periodEnd,
            status: "Open",
            closedBy: Option.none(),
            closedAt: Option.none(),
            createdAt: now,
            updatedAt: now
          })
          periods.push(period)

          // Next period starts the day after this one ends
          if (i < periodCount) {
            currentStart = addDays(periodEnd, 1)
          }
        }

        // Period 13 (Adjustment) is ALWAYS created
        // This is mandatory for:
        // 1. Consolidation compatibility - consolidation runs support periods 1-13
        // 2. Audit compliance - year-end adjustments must be segregated
        // 3. Standard accounting practice - period 13 is an industry standard
        const adjustmentPeriod = FiscalPeriod.make({
          id: FiscalPeriodId.make(crypto.randomUUID()),
          fiscalYearId: input.fiscalYearId,
          periodNumber: 13,
          name: `Period 13 (Adjustment)`,
          periodType: "Adjustment",
          // Adjustment period covers the same dates as the last regular period
          startDate: endDate,
          endDate,
          status: "Open",
          closedBy: Option.none(),
          closedAt: Option.none(),
          createdAt: now,
          updatedAt: now
        })
        periods.push(adjustmentPeriod)

        return yield* periodRepo.createPeriods(periods)
      }),

    getPeriod: (fiscalYearId, periodId) =>
      Effect.gen(function* () {
        const maybePeriod = yield* periodRepo.findPeriodById(fiscalYearId, periodId)
        if (Option.isNone(maybePeriod)) {
          return yield* Effect.fail(
            new FiscalPeriodNotFoundError({ fiscalPeriodId: periodId })
          )
        }
        return maybePeriod.value
      }),

    findPeriodByDate: (companyId, date) =>
      periodRepo.findPeriodByDate(companyId, date.toString()),

    listPeriods: (fiscalYearId) =>
      periodRepo.findPeriodsByFiscalYear(fiscalYearId),

    listPeriodsByFilter: (filter: ListPeriodsFilter) =>
      Effect.gen(function* () {
        if (filter.fiscalYearId !== undefined) {
          const periods = yield* periodRepo.findPeriodsByFiscalYear(filter.fiscalYearId)
          if (filter.status !== undefined) {
            return periods.filter((p) => p.status === filter.status)
          }
          return periods
        }
        if (filter.status !== undefined) {
          return yield* periodRepo.findPeriodsByStatus(filter.companyId, filter.status)
        }
        // Need to get all fiscal years for company and then all periods
        const fiscalYears = yield* periodRepo.findFiscalYearsByCompany(filter.companyId)
        const allPeriods: FiscalPeriod[] = []
        for (const fy of fiscalYears) {
          const periods = yield* periodRepo.findPeriodsByFiscalYear(fy.id)
          allPeriods.push(...periods)
        }
        return allPeriods
      }),

    openPeriod: (fiscalYearId, periodId, userId) =>
      transitionPeriodStatus(fiscalYearId, periodId, "Open", userId),

    closePeriod: (fiscalYearId, periodId, userId) =>
      transitionPeriodStatus(fiscalYearId, periodId, "Closed", userId),

    getPeriodReopenHistory: (periodId) =>
      periodRepo.findReopenAuditEntriesByPeriod(periodId),

    // ==================== Period Status Queries ====================

    isPeriodOpenForEntries: (companyId, date) =>
      Effect.gen(function* () {
        const maybePeriod = yield* periodRepo.findPeriodByDate(companyId, date.toString())
        if (Option.isNone(maybePeriod)) {
          // No period defined - consider it open (default behavior)
          return true
        }
        return maybePeriod.value.status === "Open"
      }),

    isPeriodOpenForModifications: (companyId, date) =>
      Effect.gen(function* () {
        const maybePeriod = yield* periodRepo.findPeriodByDate(companyId, date.toString())
        if (Option.isNone(maybePeriod)) {
          return true
        }
        return maybePeriod.value.status === "Open"
      }),

    getPeriodStatusForDate: (companyId, date) =>
      Effect.gen(function* () {
        const maybePeriod = yield* periodRepo.findPeriodByDate(companyId, date.toString())
        return Option.map(maybePeriod, (p) => p.status)
      }),

    getPeriodByYearAndNumber: (companyId, fiscalYear, periodNumber) =>
      Effect.gen(function* () {
        // First find the fiscal year by number
        const maybeFiscalYear = yield* periodRepo.findFiscalYearByNumber(companyId, fiscalYear)
        if (Option.isNone(maybeFiscalYear)) {
          return Option.none()
        }
        // Then find the period by number within that fiscal year
        return yield* periodRepo.findPeriodByNumber(maybeFiscalYear.value.id, periodNumber)
      }),

    getAllPeriodsForCompany: (companyId) =>
      Effect.gen(function* () {
        // Get all fiscal years for the company
        const fiscalYears = yield* periodRepo.findFiscalYearsByCompany(companyId)

        // Get all periods for each fiscal year and annotate with fiscal year number
        const allPeriods: Array<FiscalPeriod & { fiscalYear: number }> = []
        for (const fy of fiscalYears) {
          const periods = yield* periodRepo.findPeriodsByFiscalYear(fy.id)
          for (const p of periods) {
            // Use Object.assign to preserve class methods while adding fiscalYear
            allPeriods.push(Object.assign(p, { fiscalYear: fy.year }))
          }
        }

        return allPeriods
      })
  }

  return service
})

/**
 * FiscalPeriodServiceLive - Layer providing FiscalPeriodService implementation
 *
 * Requires FiscalPeriodRepository in context.
 */
export const FiscalPeriodServiceLive = Layer.effect(FiscalPeriodService, make)
