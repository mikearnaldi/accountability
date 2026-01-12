/**
 * FiscalPeriodsApi - HTTP API group for fiscal year and period management
 *
 * Provides endpoints for CRUD operations on fiscal years and periods,
 * including period status management (open, close, soft close, reopen).
 *
 * @module FiscalPeriodsApi
 */

import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import {
  FiscalYear,
  FiscalYearId,
  FiscalYearStatus,
  FiscalPeriod,
  FiscalPeriodId,
  FiscalPeriodStatus,
  FiscalPeriodType,
  UserId
} from "@accountability/core/services/PeriodService"
import { CompanyId } from "@accountability/core/domain/Company"
import { LocalDateFromString } from "@accountability/core/domain/LocalDate"
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * CreateFiscalYearRequest - Request body for creating a new fiscal year
 */
export class CreateFiscalYearRequest extends Schema.Class<CreateFiscalYearRequest>("CreateFiscalYearRequest")({
  companyId: CompanyId,
  startDate: LocalDateFromString,
  includeAdjustmentPeriod: Schema.optionalWith(Schema.Boolean, { default: () => false })
}) {}

/**
 * FiscalYearWithPeriodsResponse - Response containing a fiscal year with its periods
 */
export class FiscalYearWithPeriodsResponse extends Schema.Class<FiscalYearWithPeriodsResponse>("FiscalYearWithPeriodsResponse")({
  fiscalYear: FiscalYear,
  periods: Schema.Array(FiscalPeriod)
}) {}

/**
 * FiscalYearListResponse - Response containing a list of fiscal years
 */
export class FiscalYearListResponse extends Schema.Class<FiscalYearListResponse>("FiscalYearListResponse")({
  fiscalYears: Schema.Array(FiscalYear),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * FiscalPeriodListResponse - Response containing a list of fiscal periods
 */
export class FiscalPeriodListResponse extends Schema.Class<FiscalPeriodListResponse>("FiscalPeriodListResponse")({
  periods: Schema.Array(FiscalPeriod),
  total: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  limit: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  offset: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * ClosePeriodRequest - Request body for closing a fiscal period
 */
export class ClosePeriodRequest extends Schema.Class<ClosePeriodRequest>("ClosePeriodRequest")({
  closedBy: UserId
}) {}

/**
 * SoftClosePeriodRequest - Request body for soft closing a fiscal period
 */
export class SoftClosePeriodRequest extends Schema.Class<SoftClosePeriodRequest>("SoftClosePeriodRequest")({
  closedBy: UserId
}) {}

/**
 * ReopenPeriodRequest - Request body for reopening a closed fiscal period
 */
export class ReopenPeriodRequest extends Schema.Class<ReopenPeriodRequest>("ReopenPeriodRequest")({
  reopenedBy: UserId,
  reason: Schema.NonEmptyTrimmedString.annotations({
    title: "Reason",
    description: "Required reason for reopening the period (audit trail)"
  })
}) {}

/**
 * ReopenPeriodResponse - Response after reopening a period
 */
export class ReopenPeriodResponse extends Schema.Class<ReopenPeriodResponse>("ReopenPeriodResponse")({
  period: FiscalPeriod,
  auditEntryId: Schema.UUID
}) {}

/**
 * Query parameters for listing fiscal years
 */
export const FiscalYearListParams = Schema.Struct({
  companyId: Schema.optional(CompanyId),
  status: Schema.optional(FiscalYearStatus),
  year: Schema.optional(Schema.NumberFromString.pipe(Schema.int())),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

export type FiscalYearListParams = typeof FiscalYearListParams.Type

/**
 * Query parameters for listing fiscal periods
 */
export const FiscalPeriodListParams = Schema.Struct({
  fiscalYearId: Schema.optional(FiscalYearId),
  companyId: Schema.optional(CompanyId),
  status: Schema.optional(FiscalPeriodStatus),
  periodType: Schema.optional(FiscalPeriodType),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThan(0))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)))
})

export type FiscalPeriodListParams = typeof FiscalPeriodListParams.Type

// =============================================================================
// Fiscal Year Endpoints
// =============================================================================

/**
 * List all fiscal years with filtering
 */
const listFiscalYears = HttpApiEndpoint.get("listFiscalYears", "/fiscal-years")
  .setUrlParams(FiscalYearListParams)
  .addSuccess(FiscalYearListResponse)
  .addError(ValidationError)
  .annotateContext(OpenApi.annotations({
    summary: "List fiscal years",
    description: "Retrieve a paginated list of fiscal years. Supports filtering by company and status."
  }))

/**
 * Get a single fiscal year by ID with its periods
 */
const getFiscalYear = HttpApiEndpoint.get("getFiscalYear", "/fiscal-years/:id")
  .setPath(Schema.Struct({ id: FiscalYearId }))
  .addSuccess(FiscalYearWithPeriodsResponse)
  .addError(NotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get fiscal year",
    description: "Retrieve a single fiscal year by its unique identifier, including all of its periods."
  }))

/**
 * Create a new fiscal year
 */
const createFiscalYear = HttpApiEndpoint.post("createFiscalYear", "/fiscal-years")
  .setPayload(CreateFiscalYearRequest)
  .addSuccess(FiscalYearWithPeriodsResponse, { status: 201 })
  .addError(ValidationError)
  .addError(ConflictError)
  .addError(BusinessRuleError)
  .annotateContext(OpenApi.annotations({
    summary: "Create fiscal year",
    description: "Create a new fiscal year for a company. Automatically generates 12 monthly periods (and optional period 13 for adjustments)."
  }))

/**
 * Delete a fiscal year
 */
const deleteFiscalYear = HttpApiEndpoint.del("deleteFiscalYear", "/fiscal-years/:id")
  .setPath(Schema.Struct({ id: FiscalYearId }))
  .addSuccess(HttpApiSchema.NoContent)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .annotateContext(OpenApi.annotations({
    summary: "Delete fiscal year",
    description: "Delete a fiscal year. Only fiscal years with no posted transactions can be deleted."
  }))

// =============================================================================
// Fiscal Period Endpoints
// =============================================================================

/**
 * List all fiscal periods with filtering
 */
const listFiscalPeriods = HttpApiEndpoint.get("listFiscalPeriods", "/fiscal-periods")
  .setUrlParams(FiscalPeriodListParams)
  .addSuccess(FiscalPeriodListResponse)
  .addError(ValidationError)
  .annotateContext(OpenApi.annotations({
    summary: "List fiscal periods",
    description: "Retrieve a paginated list of fiscal periods. Supports filtering by fiscal year, company, status, and period type."
  }))

/**
 * Get a single fiscal period by ID
 */
const getFiscalPeriod = HttpApiEndpoint.get("getFiscalPeriod", "/fiscal-periods/:id")
  .setPath(Schema.Struct({ id: FiscalPeriodId }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get fiscal period",
    description: "Retrieve a single fiscal period by its unique identifier."
  }))

/**
 * Open a fiscal period for posting
 */
const openPeriod = HttpApiEndpoint.post("openPeriod", "/fiscal-periods/:id/open")
  .setPath(Schema.Struct({ id: FiscalPeriodId }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .annotateContext(OpenApi.annotations({
    summary: "Open period",
    description: "Open a fiscal period for normal posting. Only periods in 'Future' status can be opened."
  }))

/**
 * Close a fiscal period
 */
const closePeriod = HttpApiEndpoint.post("closePeriod", "/fiscal-periods/:id/close")
  .setPath(Schema.Struct({ id: FiscalPeriodId }))
  .setPayload(ClosePeriodRequest)
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(ValidationError)
  .annotateContext(OpenApi.annotations({
    summary: "Close period",
    description: "Close a fiscal period. Validates that no draft journal entries exist. Only 'Open' or 'SoftClose' periods can be closed."
  }))

/**
 * Soft close a fiscal period for limited posting
 */
const softClosePeriod = HttpApiEndpoint.post("softClosePeriod", "/fiscal-periods/:id/soft-close")
  .setPath(Schema.Struct({ id: FiscalPeriodId }))
  .setPayload(SoftClosePeriodRequest)
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .annotateContext(OpenApi.annotations({
    summary: "Soft close period",
    description: "Soft close a fiscal period for limited posting (requires approval). Only 'Open' periods can be soft closed."
  }))

/**
 * Reopen a closed fiscal period
 */
const reopenPeriod = HttpApiEndpoint.post("reopenPeriod", "/fiscal-periods/:id/reopen")
  .setPath(Schema.Struct({ id: FiscalPeriodId }))
  .setPayload(ReopenPeriodRequest)
  .addSuccess(ReopenPeriodResponse)
  .addError(NotFoundError)
  .addError(BusinessRuleError)
  .addError(ValidationError)
  .annotateContext(OpenApi.annotations({
    summary: "Reopen period",
    description: "Reopen a closed fiscal period. Requires a reason for the audit trail. Locked periods cannot be reopened."
  }))

/**
 * Get the current open period for a company
 */
const getCurrentPeriod = HttpApiEndpoint.get("getCurrentPeriod", "/current")
  .setUrlParams(Schema.Struct({ companyId: CompanyId }))
  .addSuccess(FiscalPeriod)
  .addError(NotFoundError)
  .annotateContext(OpenApi.annotations({
    summary: "Get current period",
    description: "Get the current open fiscal period for a company based on the current date."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * FiscalPeriodsApi - API group for fiscal year and period management
 *
 * Base path: /api/v1/fiscal
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class FiscalPeriodsApi extends HttpApiGroup.make("fiscalPeriods")
  .add(listFiscalYears)
  .add(getFiscalYear)
  .add(createFiscalYear)
  .add(deleteFiscalYear)
  .add(listFiscalPeriods)
  .add(getFiscalPeriod)
  .add(openPeriod)
  .add(closePeriod)
  .add(softClosePeriod)
  .add(reopenPeriod)
  .add(getCurrentPeriod)
  .middleware(AuthMiddleware)
  .prefix("/v1/fiscal")
  .annotateContext(OpenApi.annotations({
    title: "Fiscal Periods",
    description: "Manage fiscal years and periods for companies. Includes period lifecycle management (open, soft close, close, reopen)."
  })) {}
