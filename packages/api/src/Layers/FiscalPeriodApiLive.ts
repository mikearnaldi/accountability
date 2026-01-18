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
import { FiscalPeriodService } from "@accountability/core/FiscalPeriod/FiscalPeriodService"
import {
  isFiscalYearNotFoundError,
  isFiscalPeriodNotFoundError,
  isInvalidStatusTransitionError,
  isInvalidYearStatusTransitionError,
  isFiscalYearAlreadyExistsError,
  isFiscalYearOverlapError,
  isPeriodsNotClosedError
} from "@accountability/core/FiscalPeriod/FiscalPeriodErrors"
import { FiscalYearId } from "@accountability/core/Domains/FiscalYear"
import { FiscalPeriodId } from "@accountability/core/Domains/FiscalPeriod"
import type { FiscalPeriodStatus } from "@accountability/core/Domains/FiscalPeriodStatus"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { CompanyId } from "@accountability/core/Domains/Company"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  NotFoundError,
  ValidationError,
  BusinessRuleError
} from "../Definitions/ApiErrors.ts"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"

/**
 * Status lookup for FiscalPeriodStatus
 * Avoids type assertions by using a proper lookup table
 */
const FISCAL_PERIOD_STATUS_MAP: Record<string, FiscalPeriodStatus> = {
  Future: "Future",
  Open: "Open",
  SoftClose: "SoftClose",
  Closed: "Closed",
  Locked: "Locked"
}

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
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
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
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            return yield* periodService.getFiscalYear(companyId, fiscalYearId).pipe(
              Effect.mapError((e) => {
                if (isFiscalYearNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalYear", id: _.path.fiscalYearId })
                }
                // For persistence errors, convert to a generic error via orDie
                throw e
              })
            )
          })
        )
      )
      .handle("createFiscalYear", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:open") // Creating a fiscal year requires open permission

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const req = _.payload

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            // Create fiscal year
            const fiscalYear = yield* periodService.createFiscalYear({
              companyId,
              year: req.year,
              startDate: req.startDate,
              endDate: req.endDate,
              ...(Option.isSome(req.name) ? { name: req.name.value } : {}),
              ...(Option.isSome(req.includeAdjustmentPeriod) ? { includeAdjustmentPeriod: req.includeAdjustmentPeriod.value } : {})
            }).pipe(
              Effect.mapError((e) => {
                if (isFiscalYearAlreadyExistsError(e)) {
                  return new BusinessRuleError({
                    code: "FISCAL_YEAR_EXISTS",
                    message: e.message,
                    details: Option.none()
                  })
                }
                if (isFiscalYearOverlapError(e)) {
                  return new ValidationError({
                    message: e.message,
                    field: Option.some("year"),
                    details: Option.none()
                  })
                }
                // For persistence errors, convert to a generic error
                throw e
              })
            )

            // Generate periods for the fiscal year
            yield* periodService.generatePeriods({
              fiscalYearId: fiscalYear.id,
              startDate: fiscalYear.startDate,
              endDate: fiscalYear.endDate,
              includeAdjustmentPeriod: fiscalYear.includesAdjustmentPeriod
            }).pipe(Effect.orDie)

            return fiscalYear
          })
        )
      )
      .handle("beginYearClose", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:close")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            return yield* periodService.beginYearClose(companyId, fiscalYearId).pipe(
              Effect.mapError((e) => {
                if (isFiscalYearNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalYear", id: _.path.fiscalYearId })
                }
                if (isInvalidYearStatusTransitionError(e)) {
                  return new BusinessRuleError({
                    code: "INVALID_STATUS_TRANSITION",
                    message: e.message,
                    details: Option.none()
                  })
                }
                throw e
              })
            )
          })
        )
      )
      .handle("completeYearClose", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:close")

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            return yield* periodService.completeYearClose(companyId, fiscalYearId).pipe(
              Effect.mapError((e) => {
                if (isFiscalYearNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalYear", id: _.path.fiscalYearId })
                }
                if (isInvalidYearStatusTransitionError(e)) {
                  return new BusinessRuleError({
                    code: "INVALID_STATUS_TRANSITION",
                    message: e.message,
                    details: Option.none()
                  })
                }
                if (isPeriodsNotClosedError(e)) {
                  return new BusinessRuleError({
                    code: "PERIODS_NOT_CLOSED",
                    message: e.message,
                    details: Option.none()
                  })
                }
                throw e
              })
            )
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
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
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
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            return yield* periodService.getPeriod(fiscalYearId, periodId).pipe(
              Effect.mapError((e) => {
                if (isFiscalPeriodNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalPeriod", id: _.path.periodId })
                }
                throw e
              })
            )
          })
        )
      )
      .handle("openFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:open")

            const currentUser = yield* CurrentUser
            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            const userId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
              Effect.mapError(() => new BusinessRuleError({
                code: "INVALID_USER_ID",
                message: "Invalid user ID format",
                details: Option.none()
              }))
            )

            return yield* periodService.openPeriod(fiscalYearId, periodId, userId).pipe(
              Effect.mapError((e) => {
                if (isFiscalPeriodNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalPeriod", id: _.path.periodId })
                }
                if (isInvalidStatusTransitionError(e)) {
                  return new BusinessRuleError({
                    code: "INVALID_STATUS_TRANSITION",
                    message: e.message,
                    details: Option.none()
                  })
                }
                throw e
              })
            )
          })
        )
      )
      .handle("softCloseFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:soft_close")

            const currentUser = yield* CurrentUser
            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            const userId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
              Effect.mapError(() => new BusinessRuleError({
                code: "INVALID_USER_ID",
                message: "Invalid user ID format",
                details: Option.none()
              }))
            )

            return yield* periodService.softClosePeriod(fiscalYearId, periodId, userId).pipe(
              Effect.mapError((e) => {
                if (isFiscalPeriodNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalPeriod", id: _.path.periodId })
                }
                if (isInvalidStatusTransitionError(e)) {
                  return new BusinessRuleError({
                    code: "INVALID_STATUS_TRANSITION",
                    message: e.message,
                    details: Option.none()
                  })
                }
                throw e
              })
            )
          })
        )
      )
      .handle("closeFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:close")

            const currentUser = yield* CurrentUser
            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            const userId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
              Effect.mapError(() => new BusinessRuleError({
                code: "INVALID_USER_ID",
                message: "Invalid user ID format",
                details: Option.none()
              }))
            )

            return yield* periodService.closePeriod(fiscalYearId, periodId, userId).pipe(
              Effect.mapError((e) => {
                if (isFiscalPeriodNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalPeriod", id: _.path.periodId })
                }
                if (isInvalidStatusTransitionError(e)) {
                  return new BusinessRuleError({
                    code: "INVALID_STATUS_TRANSITION",
                    message: e.message,
                    details: Option.none()
                  })
                }
                throw e
              })
            )
          })
        )
      )
      .handle("lockFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:lock")

            const currentUser = yield* CurrentUser
            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            const userId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
              Effect.mapError(() => new BusinessRuleError({
                code: "INVALID_USER_ID",
                message: "Invalid user ID format",
                details: Option.none()
              }))
            )

            return yield* periodService.lockPeriod(fiscalYearId, periodId, userId).pipe(
              Effect.mapError((e) => {
                if (isFiscalPeriodNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalPeriod", id: _.path.periodId })
                }
                if (isInvalidStatusTransitionError(e)) {
                  return new BusinessRuleError({
                    code: "INVALID_STATUS_TRANSITION",
                    message: e.message,
                    details: Option.none()
                  })
                }
                throw e
              })
            )
          })
        )
      )
      .handle("reopenFiscalPeriod", (_) =>
        requireOrganizationContext(_.path.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("fiscal_period:reopen")

            const currentUser = yield* CurrentUser
            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const fiscalYearId = FiscalYearId.make(_.path.fiscalYearId)
            const periodId = FiscalPeriodId.make(_.path.periodId)
            const req = _.payload

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            const userId = yield* Schema.decodeUnknown(AuthUserId)(currentUser.userId).pipe(
              Effect.mapError(() => new BusinessRuleError({
                code: "INVALID_USER_ID",
                message: "Invalid user ID format",
                details: Option.none()
              }))
            )

            return yield* periodService.reopenPeriod(fiscalYearId, {
              periodId,
              reason: req.reason,
              userId
            }).pipe(
              Effect.mapError((e) => {
                if (isFiscalPeriodNotFoundError(e)) {
                  return new NotFoundError({ resource: "FiscalPeriod", id: _.path.periodId })
                }
                if (isInvalidStatusTransitionError(e)) {
                  return new BusinessRuleError({
                    code: "INVALID_STATUS_TRANSITION",
                    message: e.message,
                    details: Option.none()
                  })
                }
                throw e
              })
            )
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
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
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
              return yield* Effect.fail(new NotFoundError({ resource: "Company", id: _.path.companyId }))
            }

            // Parse the date from URL params
            const date = yield* Schema.decodeUnknown(LocalDate)(_.urlParams.date).pipe(
              Effect.mapError(() => new NotFoundError({
                resource: "Date",
                id: _.urlParams.date
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
  })
)
