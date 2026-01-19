/**
 * FiscalPeriodApi - HTTP API group for fiscal period management
 *
 * Provides endpoints for managing fiscal years and periods including:
 * - Creating and listing fiscal years
 * - Opening, closing, and locking fiscal periods
 * - Reopening periods with audit trail
 *
 * @module FiscalPeriodApi
 */

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { FiscalYear } from "@accountability/core/Domains/FiscalYear"
import { FiscalPeriod, PeriodReopenAuditEntry } from "@accountability/core/Domains/FiscalPeriod"
import { FiscalPeriodStatus } from "@accountability/core/Domains/FiscalPeriodStatus"
import { LocalDate } from "@accountability/core/Domains/LocalDate"
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/Errors/DomainErrors"

// =============================================================================
// Fiscal Year Request/Response Schemas
// =============================================================================

/**
 * CreateFiscalYearRequest - Request body for creating a new fiscal year
 */
export class CreateFiscalYearRequest extends Schema.Class<CreateFiscalYearRequest>("CreateFiscalYearRequest")({
  /** The fiscal year number (e.g., 2025) */
  year: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1900),
    Schema.lessThanOrEqualTo(2999)
  ),
  /** Optional custom name (defaults to "FY {year}") */
  name: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  /** Start date of the fiscal year */
  startDate: LocalDate,
  /** End date of the fiscal year */
  endDate: LocalDate,
  /** Whether to include a 13th adjustment period (default: false) */
  includeAdjustmentPeriod: Schema.OptionFromNullOr(Schema.Boolean)
}) {}

/**
 * FiscalYearListResponse - Response containing a list of fiscal years
 */
export class FiscalYearListResponse extends Schema.Class<FiscalYearListResponse>("FiscalYearListResponse")({
  fiscalYears: Schema.Array(FiscalYear),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * FiscalPeriodListResponse - Response containing a list of fiscal periods
 */
export class FiscalPeriodListResponse extends Schema.Class<FiscalPeriodListResponse>("FiscalPeriodListResponse")({
  periods: Schema.Array(FiscalPeriod),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * ReopenPeriodRequest - Request body for reopening a closed/locked period
 */
export class ReopenPeriodRequest extends Schema.Class<ReopenPeriodRequest>("ReopenPeriodRequest")({
  /** Reason for reopening the period */
  reason: Schema.NonEmptyTrimmedString
}) {}

/**
 * PeriodReopenHistoryResponse - Response containing reopen audit history
 */
export class PeriodReopenHistoryResponse extends Schema.Class<PeriodReopenHistoryResponse>("PeriodReopenHistoryResponse")({
  history: Schema.Array(PeriodReopenAuditEntry),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * PeriodStatusResponse - Response for period status check
 */
export class PeriodStatusResponse extends Schema.Class<PeriodStatusResponse>("PeriodStatusResponse")({
  status: Schema.OptionFromNullOr(FiscalPeriodStatus),
  allowsJournalEntries: Schema.Boolean,
  allowsModifications: Schema.Boolean
}) {}

// =============================================================================
// Query Parameters
// =============================================================================

/**
 * Query parameters for listing fiscal periods
 */
export const FiscalPeriodListParams = Schema.Struct({
  fiscalYearId: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String)
})

export type FiscalPeriodListParams = typeof FiscalPeriodListParams.Type

// =============================================================================
// Fiscal Year Endpoints
// =============================================================================

/**
 * List all fiscal years for a company
 */
const listFiscalYears = HttpApiEndpoint.get("listFiscalYears", "/organizations/:organizationId/companies/:companyId/fiscal-years")
  .setPath(Schema.Struct({ organizationId: Schema.String, companyId: Schema.String }))
  .addSuccess(FiscalYearListResponse)
  .addError(NotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List fiscal years",
    description: "Retrieve all fiscal years for a company, ordered by year descending."
  }))

/**
 * Get a single fiscal year by ID
 */
const getFiscalYear = HttpApiEndpoint.get("getFiscalYear", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String
  }))
  .addSuccess(FiscalYear)
  .addError(NotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get fiscal year",
    description: "Retrieve a single fiscal year by its unique identifier."
  }))

/**
 * Create a new fiscal year
 */
const createFiscalYear = HttpApiEndpoint.post("createFiscalYear", "/organizations/:organizationId/companies/:companyId/fiscal-years")
  .setPath(Schema.Struct({ organizationId: Schema.String, companyId: Schema.String }))
  .setPayload(CreateFiscalYearRequest)
  .addSuccess(FiscalYear, { status: 201 })
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Create fiscal year",
    description: "Create a new fiscal year for a company with auto-generated monthly periods."
  }))

/**
 * Begin year-end close process
 */
const beginYearClose = HttpApiEndpoint.post("beginYearClose", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/begin-close")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String
  }))
  .addSuccess(FiscalYear)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Begin year-end close",
    description: "Transition a fiscal year to 'Closing' status to begin year-end close process."
  }))

/**
 * Complete year-end close
 */
const completeYearClose = HttpApiEndpoint.post("completeYearClose", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/complete-close")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String
  }))
  .addSuccess(FiscalYear)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Complete year-end close",
    description: "Transition a fiscal year to 'Closed' status. All periods must be closed first."
  }))

// =============================================================================
// Fiscal Period Endpoints
// =============================================================================

/**
 * List fiscal periods for a fiscal year
 */
const listPeriods = HttpApiEndpoint.get("listFiscalPeriods", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String
  }))
  .setUrlParams(FiscalPeriodListParams)
  .addSuccess(FiscalPeriodListResponse)
  .addError(NotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "List fiscal periods",
    description: "Retrieve all fiscal periods for a fiscal year, optionally filtered by status."
  }))

/**
 * Get a single fiscal period by ID
 */
const getPeriod = HttpApiEndpoint.get("getFiscalPeriod", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods/:periodId")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String,
    periodId: Schema.String
  }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get fiscal period",
    description: "Retrieve a single fiscal period by its unique identifier."
  }))

/**
 * Open a fiscal period
 */
const openPeriod = HttpApiEndpoint.post("openFiscalPeriod", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods/:periodId/open")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String,
    periodId: Schema.String
  }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Open fiscal period",
    description: "Transition a fiscal period from 'Future' to 'Open' status."
  }))

/**
 * Soft-close a fiscal period
 */
const softClosePeriod = HttpApiEndpoint.post("softCloseFiscalPeriod", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods/:periodId/soft-close")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String,
    periodId: Schema.String
  }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Soft-close fiscal period",
    description: "Transition a fiscal period from 'Open' to 'SoftClose' status. Limited operations still allowed with approval."
  }))

/**
 * Close a fiscal period
 */
const closePeriod = HttpApiEndpoint.post("closeFiscalPeriod", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods/:periodId/close")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String,
    periodId: Schema.String
  }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Close fiscal period",
    description: "Transition a fiscal period from 'SoftClose' to 'Closed' status. No modifications allowed after close."
  }))

/**
 * Lock a fiscal period
 */
const lockPeriod = HttpApiEndpoint.post("lockFiscalPeriod", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods/:periodId/lock")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String,
    periodId: Schema.String
  }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Lock fiscal period",
    description: "Transition a fiscal period from 'Closed' to 'Locked' status. Requires special authorization to reopen."
  }))

/**
 * Reopen a closed/locked fiscal period
 */
const reopenPeriod = HttpApiEndpoint.post("reopenFiscalPeriod", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods/:periodId/reopen")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String,
    periodId: Schema.String
  }))
  .setPayload(ReopenPeriodRequest)
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Reopen fiscal period",
    description: "Reopen a closed or locked fiscal period with audit trail. Requires special authorization (fiscal_period:reopen)."
  }))

/**
 * Get reopen audit history for a period
 */
const getPeriodReopenHistory = HttpApiEndpoint.get("getPeriodReopenHistory", "/organizations/:organizationId/companies/:companyId/fiscal-years/:fiscalYearId/periods/:periodId/reopen-history")
  .setPath(Schema.Struct({
    organizationId: Schema.String,
    companyId: Schema.String,
    fiscalYearId: Schema.String,
    periodId: Schema.String
  }))
  .addSuccess(PeriodReopenHistoryResponse)
  .addError(NotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get period reopen history",
    description: "Retrieve the audit history of all times this period has been reopened."
  }))

/**
 * Check period status for a specific date
 */
const getPeriodStatusForDate = HttpApiEndpoint.get("getPeriodStatusForDate", "/organizations/:organizationId/companies/:companyId/period-status")
  .setPath(Schema.Struct({ organizationId: Schema.String, companyId: Schema.String }))
  .setUrlParams(Schema.Struct({ date: Schema.String }))
  .addSuccess(PeriodStatusResponse)
  .addError(NotFoundError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Get period status for date",
    description: "Check the fiscal period status for a specific date, including whether journal entries and modifications are allowed."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * FiscalPeriodApi - API group for fiscal period management
 *
 * Base path: /api/v1
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class FiscalPeriodApi extends HttpApiGroup.make("fiscal-periods")
  .add(listFiscalYears)
  .add(getFiscalYear)
  .add(createFiscalYear)
  .add(beginYearClose)
  .add(completeYearClose)
  .add(listPeriods)
  .add(getPeriod)
  .add(openPeriod)
  .add(softClosePeriod)
  .add(closePeriod)
  .add(lockPeriod)
  .add(reopenPeriod)
  .add(getPeriodReopenHistory)
  .add(getPeriodStatusForDate)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Fiscal Periods",
    description: "Manage fiscal years and periods for companies. Control period status transitions to enforce the 'Locked Period Protection' authorization policy."
  })) {}
