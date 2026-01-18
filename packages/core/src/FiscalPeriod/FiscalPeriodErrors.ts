/**
 * FiscalPeriodErrors - Tagged error types for fiscal period management
 *
 * Defines all fiscal period-related errors for period state transitions and validation.
 * Each error extends Schema.TaggedError.
 *
 * HTTP Status Codes (for API layer reference):
 * - 400 Bad Request: InvalidStatusTransitionError, FiscalYearOverlapError
 * - 404 Not Found: FiscalYearNotFoundError, FiscalPeriodNotFoundError
 * - 409 Conflict: FiscalYearAlreadyExistsError, PeriodNotOpenError, PeriodProtectedError
 *
 * @module FiscalPeriodErrors
 */

import * as Schema from "effect/Schema"
import { CompanyId } from "../Domains/Company.ts"
import { FiscalYearId } from "../Domains/FiscalYear.ts"
import { FiscalPeriodId } from "../Domains/FiscalPeriod.ts"
import { FiscalPeriodStatus } from "../Domains/FiscalPeriodStatus.ts"
import { FiscalYearStatus } from "../Domains/FiscalYearStatus.ts"

// =============================================================================
// 404 Not Found Errors
// =============================================================================

/**
 * FiscalYearNotFoundError - Fiscal year does not exist
 *
 * Returned when attempting to access a fiscal year that doesn't exist.
 *
 * HTTP Status: 404 Not Found
 */
export class FiscalYearNotFoundError extends Schema.TaggedError<FiscalYearNotFoundError>()(
  "FiscalYearNotFoundError",
  {
    fiscalYearId: FiscalYearId.annotations({
      description: "The fiscal year ID that was not found"
    })
  }
) {
  get message(): string {
    return `Fiscal year not found: ${this.fiscalYearId}`
  }
}

/**
 * Type guard for FiscalYearNotFoundError
 */
export const isFiscalYearNotFoundError = Schema.is(FiscalYearNotFoundError)

/**
 * FiscalPeriodNotFoundError - Fiscal period does not exist
 *
 * Returned when attempting to access a fiscal period that doesn't exist.
 *
 * HTTP Status: 404 Not Found
 */
export class FiscalPeriodNotFoundError extends Schema.TaggedError<FiscalPeriodNotFoundError>()(
  "FiscalPeriodNotFoundError",
  {
    fiscalPeriodId: FiscalPeriodId.annotations({
      description: "The fiscal period ID that was not found"
    })
  }
) {
  get message(): string {
    return `Fiscal period not found: ${this.fiscalPeriodId}`
  }
}

/**
 * Type guard for FiscalPeriodNotFoundError
 */
export const isFiscalPeriodNotFoundError = Schema.is(FiscalPeriodNotFoundError)

// =============================================================================
// 400 Bad Request Errors - Invalid operations
// =============================================================================

/**
 * InvalidStatusTransitionError - Invalid period status transition
 *
 * Returned when attempting to transition a period to an invalid status.
 * Valid transitions are defined in FiscalPeriodStatus.canTransitionTo.
 *
 * HTTP Status: 400 Bad Request
 */
export class InvalidStatusTransitionError extends Schema.TaggedError<InvalidStatusTransitionError>()(
  "InvalidStatusTransitionError",
  {
    currentStatus: FiscalPeriodStatus.annotations({
      description: "The current status of the period"
    }),
    targetStatus: FiscalPeriodStatus.annotations({
      description: "The attempted target status"
    }),
    periodId: FiscalPeriodId.annotations({
      description: "The fiscal period ID"
    })
  }
) {
  get message(): string {
    return `Cannot transition period from '${this.currentStatus}' to '${this.targetStatus}'`
  }
}

/**
 * Type guard for InvalidStatusTransitionError
 */
export const isInvalidStatusTransitionError = Schema.is(InvalidStatusTransitionError)

/**
 * InvalidYearStatusTransitionError - Invalid fiscal year status transition
 *
 * Returned when attempting to transition a fiscal year to an invalid status.
 *
 * HTTP Status: 400 Bad Request
 */
export class InvalidYearStatusTransitionError extends Schema.TaggedError<InvalidYearStatusTransitionError>()(
  "InvalidYearStatusTransitionError",
  {
    currentStatus: FiscalYearStatus.annotations({
      description: "The current status of the fiscal year"
    }),
    targetStatus: FiscalYearStatus.annotations({
      description: "The attempted target status"
    }),
    fiscalYearId: FiscalYearId.annotations({
      description: "The fiscal year ID"
    })
  }
) {
  get message(): string {
    return `Cannot transition fiscal year from '${this.currentStatus}' to '${this.targetStatus}'`
  }
}

/**
 * Type guard for InvalidYearStatusTransitionError
 */
export const isInvalidYearStatusTransitionError = Schema.is(InvalidYearStatusTransitionError)

/**
 * FiscalYearOverlapError - Fiscal year dates overlap with existing year
 *
 * Returned when creating a fiscal year that overlaps with an existing one.
 *
 * HTTP Status: 400 Bad Request
 */
export class FiscalYearOverlapError extends Schema.TaggedError<FiscalYearOverlapError>()(
  "FiscalYearOverlapError",
  {
    companyId: CompanyId.annotations({
      description: "The company ID"
    }),
    year: Schema.Number.annotations({
      description: "The fiscal year number that would overlap"
    }),
    existingYearId: FiscalYearId.annotations({
      description: "The existing fiscal year that overlaps"
    })
  }
) {
  get message(): string {
    return `Fiscal year ${this.year} overlaps with an existing fiscal year`
  }
}

/**
 * Type guard for FiscalYearOverlapError
 */
export const isFiscalYearOverlapError = Schema.is(FiscalYearOverlapError)

// =============================================================================
// 409 Conflict Errors - Business rule violations
// =============================================================================

/**
 * FiscalYearAlreadyExistsError - Fiscal year already exists for this year
 *
 * Returned when attempting to create a fiscal year that already exists.
 *
 * HTTP Status: 409 Conflict
 */
export class FiscalYearAlreadyExistsError extends Schema.TaggedError<FiscalYearAlreadyExistsError>()(
  "FiscalYearAlreadyExistsError",
  {
    companyId: CompanyId.annotations({
      description: "The company ID"
    }),
    year: Schema.Number.annotations({
      description: "The fiscal year number that already exists"
    })
  }
) {
  get message(): string {
    return `Fiscal year ${this.year} already exists for this company`
  }
}

/**
 * Type guard for FiscalYearAlreadyExistsError
 */
export const isFiscalYearAlreadyExistsError = Schema.is(FiscalYearAlreadyExistsError)

/**
 * PeriodNotOpenError - Period is not in Open status
 *
 * Returned when attempting an operation that requires an open period.
 *
 * HTTP Status: 409 Conflict
 */
export class PeriodNotOpenError extends Schema.TaggedError<PeriodNotOpenError>()(
  "PeriodNotOpenError",
  {
    periodId: FiscalPeriodId.annotations({
      description: "The fiscal period ID"
    }),
    currentStatus: FiscalPeriodStatus.annotations({
      description: "The current status of the period"
    })
  }
) {
  get message(): string {
    return `Period is ${this.currentStatus}, not Open. Cannot perform this operation.`
  }
}

/**
 * Type guard for PeriodNotOpenError
 */
export const isPeriodNotOpenError = Schema.is(PeriodNotOpenError)

/**
 * PeriodProtectedError - Period is closed or locked
 *
 * Returned when attempting to modify a protected period without proper authorization.
 *
 * HTTP Status: 409 Conflict
 */
export class PeriodProtectedError extends Schema.TaggedError<PeriodProtectedError>()(
  "PeriodProtectedError",
  {
    periodId: FiscalPeriodId.annotations({
      description: "The fiscal period ID"
    }),
    currentStatus: FiscalPeriodStatus.annotations({
      description: "The current status of the period"
    }),
    action: Schema.String.annotations({
      description: "The action that was attempted"
    })
  }
) {
  get message(): string {
    return `Period is ${this.currentStatus} and protected. Cannot ${this.action}.`
  }
}

/**
 * Type guard for PeriodProtectedError
 */
export const isPeriodProtectedError = Schema.is(PeriodProtectedError)

/**
 * YearNotClosedError - Fiscal year is not closed
 *
 * Returned when attempting to lock a year that isn't fully closed.
 *
 * HTTP Status: 409 Conflict
 */
export class YearNotClosedError extends Schema.TaggedError<YearNotClosedError>()(
  "YearNotClosedError",
  {
    fiscalYearId: FiscalYearId.annotations({
      description: "The fiscal year ID"
    }),
    currentStatus: FiscalYearStatus.annotations({
      description: "The current status of the fiscal year"
    })
  }
) {
  get message(): string {
    return `Fiscal year must be Closed to perform this operation. Current status: ${this.currentStatus}`
  }
}

/**
 * Type guard for YearNotClosedError
 */
export const isYearNotClosedError = Schema.is(YearNotClosedError)

/**
 * PeriodsNotClosedError - Not all periods in the year are closed
 *
 * Returned when attempting to close a fiscal year with open periods.
 *
 * HTTP Status: 409 Conflict
 */
export class PeriodsNotClosedError extends Schema.TaggedError<PeriodsNotClosedError>()(
  "PeriodsNotClosedError",
  {
    fiscalYearId: FiscalYearId.annotations({
      description: "The fiscal year ID"
    }),
    openPeriodCount: Schema.Number.annotations({
      description: "The number of periods that are not closed"
    })
  }
) {
  get message(): string {
    return `Cannot close fiscal year: ${this.openPeriodCount} period(s) are not yet closed`
  }
}

/**
 * Type guard for PeriodsNotClosedError
 */
export const isPeriodsNotClosedError = Schema.is(PeriodsNotClosedError)

// =============================================================================
// Union Types
// =============================================================================

/**
 * Union type for all fiscal period errors
 */
export type FiscalPeriodError =
  | FiscalYearNotFoundError
  | FiscalPeriodNotFoundError
  | InvalidStatusTransitionError
  | InvalidYearStatusTransitionError
  | FiscalYearOverlapError
  | FiscalYearAlreadyExistsError
  | PeriodNotOpenError
  | PeriodProtectedError
  | YearNotClosedError
  | PeriodsNotClosedError

/**
 * HTTP status code mapping for API layer
 */
export const FISCAL_PERIOD_ERROR_STATUS_CODES = {
  // 404 Not Found
  FiscalYearNotFoundError: 404,
  FiscalPeriodNotFoundError: 404,
  // 400 Bad Request
  InvalidStatusTransitionError: 400,
  InvalidYearStatusTransitionError: 400,
  FiscalYearOverlapError: 400,
  // 409 Conflict
  FiscalYearAlreadyExistsError: 409,
  PeriodNotOpenError: 409,
  PeriodProtectedError: 409,
  YearNotClosedError: 409,
  PeriodsNotClosedError: 409
} as const
