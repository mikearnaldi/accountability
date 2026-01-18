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
  type ReopenPeriodInput,
  type ListPeriodsFilter
} from "@accountability/core/FiscalPeriod/FiscalPeriodService"
import {
  FiscalYearNotFoundError,
  FiscalPeriodNotFoundError,
  InvalidStatusTransitionError,
  InvalidYearStatusTransitionError,
  FiscalYearAlreadyExistsError,
  PeriodsNotClosedError
} from "@accountability/core/FiscalPeriod/FiscalPeriodErrors"
import { FiscalYear, FiscalYearId } from "@accountability/core/Domains/FiscalYear"
import { FiscalPeriod, FiscalPeriodId, FiscalPeriodUserId as FiscalPeriodUserIdSchema, PeriodReopenAuditEntry, PeriodReopenAuditEntryId } from "@accountability/core/Domains/FiscalPeriod"
import type { FiscalPeriodStatus } from "@accountability/core/Domains/FiscalPeriodStatus"
import { canTransitionTo } from "@accountability/core/Domains/FiscalPeriodStatus"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import * as Timestamp from "@accountability/core/Domains/Timestamp"
import type { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { FiscalPeriodRepository } from "../Services/FiscalPeriodRepository.ts"
import { AuditLogService } from "@accountability/core/AuditLog/AuditLogService"
import { CurrentUserId } from "@accountability/core/AuditLog/CurrentUserId"

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
  const auditLogService = yield* Effect.serviceOption(AuditLogService)

  /**
   * Helper to get current user ID from context if available
   * Returns Option.none() if CurrentUserId is not provided
   */
  const getOptionalUserId = Effect.serviceOption(CurrentUserId)

  /**
   * Helper to log audit entries if AuditLogService is available
   * Silently ignores errors to not block business operations
   */
  const logAuditStatusChange = (
    entityType: "FiscalYear" | "FiscalPeriod",
    entityId: string,
    previousStatus: string,
    newStatus: string,
    userId: AuthUserId,
    reason?: string
  ) =>
    Option.match(auditLogService, {
      onNone: () => Effect.void,
      onSome: (svc) =>
        svc.logStatusChange(entityType, entityId, previousStatus, newStatus, userId, reason).pipe(
          Effect.catchAll(() => Effect.void) // Don't fail if audit logging fails
        )
    })

  /**
   * Helper to log create audit entries if AuditLogService is available
   */
  const logAuditCreate = <T>(
    entityType: "FiscalYear" | "FiscalPeriod",
    entityId: string,
    entity: T,
    userId: AuthUserId
  ) =>
    Option.match(auditLogService, {
      onNone: () => Effect.void,
      onSome: (svc) =>
        svc.logCreate(entityType, entityId, entity, userId).pipe(
          Effect.catchAll(() => Effect.void)
        )
    })

  /**
   * Helper to log create with optional user ID from context
   * Will skip audit logging if no user ID is in context
   */
  const logAuditCreateWithContext = <T>(
    entityType: "FiscalYear" | "FiscalPeriod",
    entityId: string,
    entity: T
  ) =>
    Effect.gen(function* () {
      const maybeUserId = yield* getOptionalUserId
      if (Option.isSome(maybeUserId) && Option.isSome(auditLogService)) {
        yield* logAuditCreate(entityType, entityId, entity, maybeUserId.value)
      }
    }).pipe(Effect.catchAll(() => Effect.void))

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
        closedBy: targetStatus === "Closed" || targetStatus === "Locked"
          ? Option.some(FiscalPeriodUserIdSchema.make(userId))
          : period.closedBy,
        closedAt: targetStatus === "Closed" || targetStatus === "Locked"
          ? Option.some(now)
          : period.closedAt,
        updatedAt: now
      })

      const result = yield* periodRepo.updatePeriod(fiscalYearId, updatedPeriod)

      // Log the status change to audit log
      yield* logAuditStatusChange("FiscalPeriod", periodId, previousStatus, targetStatus, userId)

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
          includesAdjustmentPeriod: input.includeAdjustmentPeriod ?? false,
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

    beginYearClose: (companyId, fiscalYearId) =>
      Effect.gen(function* () {
        const fiscalYear = yield* service.getFiscalYear(companyId, fiscalYearId)

        if (fiscalYear.status !== "Open") {
          return yield* Effect.fail(
            new InvalidYearStatusTransitionError({
              currentStatus: fiscalYear.status,
              targetStatus: "Closing",
              fiscalYearId
            })
          )
        }

        const updatedYear = FiscalYear.make({
          ...fiscalYear,
          status: "Closing",
          updatedAt: Timestamp.now()
        })

        return yield* periodRepo.updateFiscalYear(companyId, updatedYear)
      }),

    completeYearClose: (companyId, fiscalYearId) =>
      Effect.gen(function* () {
        const fiscalYear = yield* service.getFiscalYear(companyId, fiscalYearId)

        if (fiscalYear.status !== "Closing") {
          return yield* Effect.fail(
            new InvalidYearStatusTransitionError({
              currentStatus: fiscalYear.status,
              targetStatus: "Closed",
              fiscalYearId
            })
          )
        }

        // Check if all periods are closed or locked
        const periods = yield* periodRepo.findPeriodsByFiscalYear(fiscalYearId)
        const openPeriods = periods.filter(
          (p) => p.status === "Future" || p.status === "Open" || p.status === "SoftClose"
        )

        if (openPeriods.length > 0) {
          return yield* Effect.fail(
            new PeriodsNotClosedError({
              fiscalYearId,
              openPeriodCount: openPeriods.length
            })
          )
        }

        const updatedYear = FiscalYear.make({
          ...fiscalYear,
          status: "Closed",
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
        const includesAdjustmentPeriod = input.includeAdjustmentPeriod ?? false

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
            status: "Future",
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

        // Add adjustment period (Period 13) if requested
        if (includesAdjustmentPeriod) {
          const adjustmentPeriod = FiscalPeriod.make({
            id: FiscalPeriodId.make(crypto.randomUUID()),
            fiscalYearId: input.fiscalYearId,
            periodNumber: 13,
            name: `Period 13 (Adjustment)`,
            periodType: "Adjustment",
            // Adjustment period covers the same dates as the last regular period
            startDate: endDate,
            endDate,
            status: "Future",
            closedBy: Option.none(),
            closedAt: Option.none(),
            createdAt: now,
            updatedAt: now
          })
          periods.push(adjustmentPeriod)
        }

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

    softClosePeriod: (fiscalYearId, periodId, userId) =>
      transitionPeriodStatus(fiscalYearId, periodId, "SoftClose", userId),

    closePeriod: (fiscalYearId, periodId, userId) =>
      transitionPeriodStatus(fiscalYearId, periodId, "Closed", userId),

    lockPeriod: (fiscalYearId, periodId, userId) =>
      transitionPeriodStatus(fiscalYearId, periodId, "Locked", userId),

    reopenPeriod: (fiscalYearId, input: ReopenPeriodInput) =>
      Effect.gen(function* () {
        const maybePeriod = yield* periodRepo.findPeriodById(fiscalYearId, input.periodId)
        if (Option.isNone(maybePeriod)) {
          return yield* Effect.fail(
            new FiscalPeriodNotFoundError({ fiscalPeriodId: input.periodId })
          )
        }
        const period = maybePeriod.value

        // Validate transition
        if (!canTransitionTo(period.status, "Open")) {
          return yield* Effect.fail(
            new InvalidStatusTransitionError({
              currentStatus: period.status,
              targetStatus: "Open",
              periodId: input.periodId
            })
          )
        }

        const now = Timestamp.now()

        // Create audit entry
        const auditEntry = PeriodReopenAuditEntry.make({
          id: PeriodReopenAuditEntryId.make(crypto.randomUUID()),
          periodId: input.periodId,
          reason: input.reason,
          reopenedBy: FiscalPeriodUserIdSchema.make(input.userId),
          reopenedAt: now,
          previousStatus: period.status
        })

        yield* periodRepo.createReopenAuditEntry(auditEntry)

        // Update period status
        const updatedPeriod = FiscalPeriod.make({
          ...period,
          status: "Open",
          closedBy: Option.none(),
          closedAt: Option.none(),
          updatedAt: now
        })

        const result = yield* periodRepo.updatePeriod(fiscalYearId, updatedPeriod)

        // Log to general audit log as well
        yield* logAuditStatusChange(
          "FiscalPeriod",
          input.periodId,
          period.status,
          "Open",
          input.userId,
          input.reason
        )

        return result
      }),

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
        return maybePeriod.value.status === "Open" || maybePeriod.value.status === "SoftClose"
      }),

    getPeriodStatusForDate: (companyId, date) =>
      Effect.gen(function* () {
        const maybePeriod = yield* periodRepo.findPeriodByDate(companyId, date.toString())
        return Option.map(maybePeriod, (p) => p.status)
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
