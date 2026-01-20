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
import { FiscalYear } from "@accountability/core/fiscal/FiscalYear"
import { FiscalPeriod, PeriodReopenAuditEntry } from "@accountability/core/fiscal/FiscalPeriod"
import { FiscalPeriodStatus } from "@accountability/core/fiscal/FiscalPeriodStatus"
import { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { ForbiddenError } from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  FiscalYearNotFoundError,
  FiscalPeriodNotFoundError,
  FiscalPeriodNotFoundForDateError,
  FiscalYearAlreadyExistsError,
  FiscalYearOverlapError,
  InvalidStatusTransitionError,
  InvalidYearStatusTransitionError,
  PeriodsNotClosedError
} from "@accountability/core/fiscal/FiscalPeriodErrors"

// =============================================================================
// Fiscal Year Request/Response Schemas
// =============================================================================

/**
 * CreateFiscalYearRequest - Request body for creating a new fiscal year
 *
 * Note: Period 13 (adjustment period) is ALWAYS created automatically.
 * This is mandatory for consolidation compatibility and audit compliance.
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
  endDate: LocalDate
  // Note: includeAdjustmentPeriod has been removed - Period 13 is always created
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
  .addError(CompanyNotFoundError)
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
  .addError(CompanyNotFoundError)
  .addError(FiscalYearNotFoundError)
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
  .addError(CompanyNotFoundError)
  .addError(FiscalYearAlreadyExistsError)
  .addError(FiscalYearOverlapError)
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
  .addError(CompanyNotFoundError)
  .addError(FiscalYearNotFoundError)
  .addError(InvalidYearStatusTransitionError)
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
  .addError(CompanyNotFoundError)
  .addError(FiscalYearNotFoundError)
  .addError(InvalidYearStatusTransitionError)
  .addError(PeriodsNotClosedError)
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
  .addError(CompanyNotFoundError)
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
  .addError(CompanyNotFoundError)
  .addError(FiscalPeriodNotFoundError)
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
  .addError(CompanyNotFoundError)
  .addError(FiscalPeriodNotFoundError)
  .addError(InvalidStatusTransitionError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Open fiscal period",
    description: "Transition a fiscal period from 'Closed' to 'Open' status. Requires fiscal_period:manage permission."
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
  .addError(CompanyNotFoundError)
  .addError(FiscalPeriodNotFoundError)
  .addError(InvalidStatusTransitionError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Close fiscal period",
    description: "Transition a fiscal period from 'Open' to 'Closed' status. No journal entries allowed after close. Requires fiscal_period:manage permission."
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
  .addError(CompanyNotFoundError)
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
  .addError(CompanyNotFoundError)
  .addError(FiscalPeriodNotFoundForDateError)
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
  .add(closePeriod)
  .add(getPeriodReopenHistory)
  .add(getPeriodStatusForDate)
  .middleware(AuthMiddleware)
  .prefix("/v1")
  .annotateContext(OpenApi.annotations({
    title: "Fiscal Periods",
    description: "Manage fiscal years and periods for companies. Simple 2-state model: periods are either Open (accepts journal entries) or Closed (no entries allowed)."
  })) {}
