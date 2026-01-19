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
import { FiscalYearId } from "@accountability/core/Domains/FiscalYear"
import { FiscalPeriodId } from "@accountability/core/Domains/FiscalPeriod"
import type { FiscalPeriodStatus } from "@accountability/core/Domains/FiscalPeriodStatus"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import { CompanyId } from "@accountability/core/Domains/Company"
import { OrganizationId } from "@accountability/core/Domains/Organization"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { CompanyNotFoundError } from "@accountability/core/Errors/DomainErrors"
import { FiscalPeriodNotFoundForDateError } from "@accountability/core/FiscalPeriod/FiscalPeriodErrors"
import { AppApi } from "../Definitions/AppApi.ts"
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
            yield* requirePermission("fiscal_period:open") // Creating a fiscal year requires open permission

            const companyId = CompanyId.make(_.path.companyId)
            const organizationId = OrganizationId.make(_.path.organizationId)
            const req = _.payload

            // Verify company exists and belongs to organization
            const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
            if (Option.isNone(maybeCompany)) {
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Create fiscal year - domain errors flow through; infrastructure errors die
            const fiscalYear = yield* periodService.createFiscalYear({
              companyId,
              year: req.year,
              startDate: req.startDate,
              endDate: req.endDate,
              ...(Option.isSome(req.name) ? { name: req.name.value } : {}),
              ...(Option.isSome(req.includeAdjustmentPeriod) ? { includeAdjustmentPeriod: req.includeAdjustmentPeriod.value } : {})
            }).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e))
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
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain errors flow through; infrastructure errors die
            return yield* periodService.beginYearClose(companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
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
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain errors flow through; infrastructure errors die
            return yield* periodService.completeYearClose(companyId, fiscalYearId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
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
            yield* requirePermission("fiscal_period:open")

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

            // Domain errors flow through; infrastructure errors die
            return yield* periodService.openPeriod(fiscalYearId, periodId, currentUser.userId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
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
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain errors flow through; infrastructure errors die
            return yield* periodService.softClosePeriod(fiscalYearId, periodId, currentUser.userId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
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
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain errors flow through; infrastructure errors die
            return yield* periodService.closePeriod(fiscalYearId, periodId, currentUser.userId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
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
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain errors flow through; infrastructure errors die
            return yield* periodService.lockPeriod(fiscalYearId, periodId, currentUser.userId).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
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
              return yield* Effect.fail(new CompanyNotFoundError({ companyId: _.path.companyId }))
            }

            // Domain errors flow through; infrastructure errors die
            return yield* periodService.reopenPeriod(fiscalYearId, {
              periodId,
              reason: req.reason,
              userId: currentUser.userId
            }).pipe(
              Effect.catchTag("PersistenceError", (e) => Effect.die(e)),
              Effect.catchTag("EntityNotFoundError", (e) => Effect.die(e))
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
  })
)
