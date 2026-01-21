/**
 * FiscalPeriodApiLive - Live implementation of fiscal period API handlers
 *
 * Implements the FiscalPeriodApi endpoints with real operations
 * by calling the FiscalPeriodService.
 *
 * @module FiscalPeriodApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { FiscalPeriodService } from "@accountability/core/fiscal/FiscalPeriodService"
import { YearEndCloseService } from "@accountability/core/fiscal/YearEndCloseService"
import { type FiscalYear, FiscalYearId } from "@accountability/core/fiscal/FiscalYear"
import { type FiscalPeriod, FiscalPeriodId } from "@accountability/core/fiscal/FiscalPeriod"
import type { FiscalPeriodStatus } from "@accountability/core/fiscal/FiscalPeriodStatus"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { CompanyId } from "@accountability/core/company/Company"
import { OrganizationId } from "@accountability/core/organization/Organization"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import { FiscalPeriodNotFoundForDateError } from "@accountability/core/fiscal/FiscalPeriodErrors"
import { AuditLogService } from "@accountability/core/audit/AuditLogService"
import { CurrentUserId } from "@accountability/core/shared/context/CurrentUserId"
import type {
  AuditLogError as CoreAuditLogError,
  UserLookupError as CoreUserLookupError
} from "@accountability/core/audit/AuditLogErrors"
import { AppApi } from "../Definitions/AppApi.ts"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import {
  AuditLogError,
  UserLookupError
} from "../Definitions/ApiErrors.ts"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"

/**
 * Status lookup for FiscalPeriodStatus
 * Simplified 2-state model: Open and Closed
 */
const FISCAL_PERIOD_STATUS_MAP: Record<string, FiscalPeriodStatus> = {
  Open: "Open",
  Closed: "Closed"
}

/**
 * Map core audit errors to API errors
 *
 * The core AuditLogError/UserLookupError and API equivalents have the same shape,
 * but different types. This maps between them for proper API error handling.
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
 * Helper to log fiscal year creation to audit log
 *
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param organizationId - The organization this fiscal year belongs to
 * @param fiscalYear - The created fiscal year
 * @returns Effect that completes when audit logging succeeds
 */
const logFiscalYearCreate = (
  organizationId: string,
  fiscalYear: FiscalYear
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      organizationId,
      "FiscalYear",
      fiscalYear.id,
      fiscalYear.name, // Human-readable fiscal year name for audit display (e.g., "FY 2025")
      fiscalYear,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log fiscal period creation to audit log
 *
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 * If audit logging fails, the operation fails - this ensures audit trail integrity.
 *
 * @param organizationId - The organization this fiscal period belongs to
 * @param fiscalPeriod - The created fiscal period
 * @returns Effect that completes when audit logging succeeds
 */
const logFiscalPeriodCreate = (
  organizationId: string,
  fiscalPeriod: FiscalPeriod
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logCreate(
      organizationId,
      "FiscalPeriod",
      fiscalPeriod.id,
      fiscalPeriod.name, // Human-readable period name for audit display (e.g., "Period 1", "Period 13 (Adjustment)")
      fiscalPeriod,
      userId
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log fiscal year status change to audit log
 *
 * Used for year-end close operations (Open -> Closing -> Closed).
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 *
 * @param organizationId - The organization this fiscal year belongs to
 * @param fiscalYear - The fiscal year with updated status
 * @param previousStatus - The status before the change
 * @param reason - Optional reason for the status change
 * @returns Effect that completes when audit logging succeeds
 */
const logFiscalYearStatusChange = (
  organizationId: string,
  fiscalYear: FiscalYear,
  previousStatus: string,
  reason?: string
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logStatusChange(
      organizationId,
      "FiscalYear",
      fiscalYear.id,
      fiscalYear.name,
      previousStatus,
      fiscalYear.status,
      userId,
      reason
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * Helper to log fiscal period status change to audit log
 *
 * Used for period open/close operations.
 * Per AUDIT_PAGE.md spec: audit logging must NOT silently fail.
 *
 * @param organizationId - The organization this fiscal period belongs to
 * @param fiscalPeriod - The fiscal period with updated status
 * @param previousStatus - The status before the change
 * @param reason - Optional reason for the status change
 * @returns Effect that completes when audit logging succeeds
 */
const logFiscalPeriodStatusChange = (
  organizationId: string,
  fiscalPeriod: FiscalPeriod,
  previousStatus: string,
  reason?: string
): Effect.Effect<void, AuditLogError | UserLookupError, AuditLogService | CurrentUserId> =>
  Effect.gen(function* () {
    const auditService = yield* AuditLogService
    const userId = yield* CurrentUserId

    yield* auditService.logStatusChange(
      organizationId,
      "FiscalPeriod",
      fiscalPeriod.id,
      fiscalPeriod.name,
      previousStatus,
      fiscalPeriod.status,
      userId,
      reason
    )
  }).pipe(
    Effect.mapError(mapCoreAuditErrorToApi)
  )

/**
 * FiscalPeriodApiLive - Layer providing FiscalPeriodApi handlers
 *
 * Dependencies:
 * - FiscalPeriodService
 * - CompanyRepository
 */
export const FiscalPeriodApiLive = HttpApiBuilder.group(AppApi, "fiscal-periods", (handlers) =>
  Effect.gen(function* () {
    const periodService = yield* FiscalPeriodService
    const yearEndCloseService = yield* YearEndCloseService
    const companyRepo = yield* CompanyRepository

    return handlers
      // =============================================================================
      // Fiscal Year Endpoints
      // =============================================================================
      .handle("listFiscalYears", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            const fiscalYears = yield* periodService.listFiscalYears(companyId).pipe(Effect.orDie)

            return {
              fiscalYears: [...fiscalYears],
              total: fiscalYears.length
            }
          })
        )
      )
      .handle("getFiscalYear", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain error FiscalYearNotFoundError flows through; infrastructure errors die
            return yield* periodService.getFiscalYear(companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
          })
        )
      )
      .handle("createFiscalYear", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:manage") // Creating a fiscal year requires manage permission

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const req = _.payload

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Create fiscal year - domain errors flow through; infrastructure errors die
            // Note: Period 13 (adjustment period) is always created - it's mandatory
            const fiscalYear = yield* periodService.createFiscalYear({
              companyId,
              year: req.year,
              startDate: req.startDate,
              endDate: req.endDate,
              ...(Option.isSome(req.name) ? { name: req.name.value } : {})
            }).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )

            // Audit log the fiscal year creation
            yield* logFiscalYearCreate(_.path.organizationId, fiscalYear)

            // Generate periods for the fiscal year (always includes period 13)
            const periods = yield* periodService.generatePeriods({
              fiscalYearId: fiscalYear.id,
              startDate: fiscalYear.startDate,
              endDate: fiscalYear.endDate
            }).pipe(Effect.orDie)

            // Audit log each generated fiscal period
            for (const period of periods) {
              yield* logFiscalPeriodCreate(_.path.organizationId, period)
            }

            return fiscalYear
          })
        )
      )
      .handle("closeFiscalYear", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:manage")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Get the fiscal year to capture its current status before the transition
            const fiscalYearBefore = yield* periodService.getFiscalYear(companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
            const previousStatus = fiscalYearBefore.status

            // Execute year-end close using YearEndCloseService
            // This generates closing journal entries and then closes the fiscal year
            const result = yield* yearEndCloseService.executeYearEndClose(organizationId, companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
            )

            // Audit log the status change
            // Get updated fiscal year for audit log
            const fiscalYearAfter = yield* periodService.getFiscalYear(companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
            yield* logFiscalYearStatusChange(
              _.path.organizationId,
              fiscalYearAfter,
              previousStatus,
              `Year-end close completed. Net income: ${result.netIncome.format()}. Created ${result.closingEntryIds.length} closing entries.`
            )

            return result
          })
        )
      )
      .handle("reopenFiscalYear", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:manage")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Get the fiscal year to capture its current status before the transition
            const fiscalYearBefore = yield* periodService.getFiscalYear(companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
            const previousStatus = fiscalYearBefore.status

            // Reopen fiscal year using YearEndCloseService
            // This creates reversal entries for the closing journal entries and reopens the year
            const result = yield* yearEndCloseService.reopenFiscalYear(organizationId, companyId, fiscalYearId, "User requested reopen").pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
            )

            // Audit log the status change
            // Get updated fiscal year for audit log
            const fiscalYearAfter = yield* periodService.getFiscalYear(companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
            yield* logFiscalYearStatusChange(
              _.path.organizationId,
              fiscalYearAfter,
              previousStatus,
              `Fiscal year reopened. Created ${result.reversedEntryIds.length} reversal entries.`
            )

            return result
          })
        )
      )
      .handle("previewYearEndClose", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Get preview from YearEndCloseService
            // This calculates net income and validates prerequisites
            const preview = yield* yearEndCloseService.previewYearEndClose(organizationId, companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )

            return preview
          })
        )
      )

      // =============================================================================
      // Fiscal Period Endpoints
      // =============================================================================
      .handle("listFiscalPeriods", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Get all periods for the fiscal year
            let periods = yield* periodService.listPeriods(fiscalYearId).pipe(Effect.orDie)

            // Apply status filter if provided
            const statusFilter = _.urlParams.status
            if (statusFilter !== undefined) {
              const mappedStatus = FISCAL_PERIOD_STATUS_MAP[statusFilter]
              if (mappedStatus) {
                periods = periods.filter((p) => p.status === mappedStatus)
              }
            }

            return {
              periods: [...periods],
              total: periods.length
            }
          })
        )
      )
      .handle("getFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain error FiscalPeriodNotFoundError flows through; infrastructure errors die
            return yield* periodService.getPeriod(fiscalYearId, periodId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
          })
        )
      )
      .handle("openFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:manage")

            const currentUser = yield* CurrentUser
            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Get the period to capture its current status before the transition
            const periodBefore = yield* periodService.getPeriod(fiscalYearId, periodId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
            const previousStatus = periodBefore.status

            // Domain errors flow through; infrastructure errors die
            const period = yield* periodService.openPeriod(fiscalYearId, periodId, currentUser.userId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
            )

            // Audit log the status change
            yield* logFiscalPeriodStatusChange(
              _.path.organizationId,
              period,
              previousStatus,
              "Period reopened"
            )

            return period
          })
        )
      )
      .handle("closeFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:manage")

            const currentUser = yield* CurrentUser
            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Get the period to capture its current status before the transition
            const periodBefore = yield* periodService.getPeriod(fiscalYearId, periodId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
            )
            const previousStatus = periodBefore.status

            // Domain errors flow through; infrastructure errors die
            const period = yield* periodService.closePeriod(fiscalYearId, periodId, currentUser.userId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
            )

            // Audit log the status change
            yield* logFiscalPeriodStatusChange(
              _.path.organizationId,
              period,
              previousStatus,
              "Period closed"
            )

            return period
          })
        )
      )
      .handle("getPeriodReopenHistory", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            const history = yield* periodService.getPeriodReopenHistory(periodId).pipe(Effect.orDie)

            return {
              history: [...history],
              total: history.length
            }
          })
        )
      )
      .handle("getPeriodStatusForDate", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Parse the date from URL params
            const date = yield* Schema.decodeUnknown(LocalDate)(_.urlParams.date).pipe(
              Effect.mapError(() => new FiscalPeriodNotFoundForDateError({
                companyId,
                date: _.urlParams.date
              }))
            )

            const status = yield* periodService.getPeriodStatusForDate(companyId, date).pipe(Effect.orDie)
            const allowsEntries = yield* periodService.isPeriodOpenForEntries(companyId, date).pipe(Effect.orDie)
            const allowsModifications = yield* periodService.isPeriodOpenForModifications(companyId, date).pipe(Effect.orDie)

            return {
              status,
              allowsJournalEntries: allowsEntries,
              allowsModifications
            }
          })
        )
      )
      .handle("getPeriodsSummary", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:read")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Get all periods for the company with their fiscal year number
            const periodsWithYear = yield* periodService.getAllPeriodsForCompany(companyId).pipe(Effect.orDie)

            // Map to summary items - keep LocalDate objects, they will be serialized by the schema
            const periods = periodsWithYear.map((p) => ({
              fiscalYearId: p.fiscalYearId,
              fiscalYear: p.fiscalYear,
              periodId: p.id,
              periodNumber: p.periodNumber,
              periodName: p.name,
              periodType: p.periodType,
              startDate: p.startDate,
              endDate: p.endDate,
              status: p.status
            }))

            // Compute date ranges for regular periods (exclude adjustment periods from ranges)
            // Group periods by status and merge adjacent date ranges
            const regularPeriods = periodsWithYear.filter((p) => p.periodType === "Regular")

            // Build open date ranges from regular open periods
            const openPeriods = regularPeriods.filter((p) => p.status === "Open")
            const openDateRanges = mergeAdjacentLocalDateRanges(
              openPeriods.map((p) => ({
                startDate: p.startDate,
                endDate: p.endDate
              }))
            )

            // Build closed date ranges from regular closed periods
            const closedPeriods = regularPeriods.filter((p) => p.status === "Closed")
            const closedDateRanges = mergeAdjacentLocalDateRanges(
              closedPeriods.map((p) => ({
                startDate: p.startDate,
                endDate: p.endDate
              }))
            )

            return {
              periods,
              openDateRanges,
              closedDateRanges
            }
          })
        )
      )
  })
)

/**
 * Helper to merge adjacent date ranges using LocalDate objects
 *
 * Takes an array of date ranges and merges any that are adjacent or overlapping
 * into single continuous ranges.
 */
function mergeAdjacentLocalDateRanges(
  ranges: Array<{ startDate: LocalDate; endDate: LocalDate }>
): Array<{ startDate: LocalDate; endDate: LocalDate }> {
  if (ranges.length === 0) return []

  // Sort by start date
  const sorted = [...ranges].sort((a, b) => {
    const aStr = a.startDate.toString()
    const bStr = b.startDate.toString()
    return aStr.localeCompare(bStr)
  })

  const merged: Array<{ startDate: LocalDate; endDate: LocalDate }> = []
  let current = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]

    // Check if the next range starts on or before the day after current ends
    // This handles adjacent ranges (e.g., Jan 31 -> Feb 1)
    const currentEndStr = current.endDate.toString()
    const nextStartStr = next.startDate.toString()

    const currentEndDate = new Date(currentEndStr)
    const nextStartDate = new Date(nextStartStr)
    const dayAfterCurrentEnd = new Date(currentEndDate)
    dayAfterCurrentEnd.setDate(dayAfterCurrentEnd.getDate() + 1)

    if (nextStartDate <= dayAfterCurrentEnd) {
      // Merge: extend current to include next
      const currentEndStr2 = current.endDate.toString()
      const nextEndStr = next.endDate.toString()
      current = {
        startDate: current.startDate,
        endDate: currentEndStr2 > nextEndStr ? current.endDate : next.endDate
      }
    } else {
      // No overlap, push current and start new
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}
