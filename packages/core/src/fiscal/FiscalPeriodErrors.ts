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
 * @module fiscal/FiscalPeriodErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"
import { CompanyId } from "../company/Company.ts"
import { FiscalYearId } from "./FiscalYear.ts"
import { FiscalPeriodId } from "./FiscalPeriod.ts"
import { FiscalPeriodStatus } from "./FiscalPeriodStatus.ts"
import { FiscalYearStatus } from "./FiscalYearStatus.ts"

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
  },
  HttpApiSchema.annotations({ status: 404 })
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
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Fiscal period not found: ${this.fiscalPeriodId}`
  }
}

/**
 * Type guard for FiscalPeriodNotFoundError
 */
export const isFiscalPeriodNotFoundError = Schema.is(FiscalPeriodNotFoundError)

/**
 * FiscalPeriodNotFoundForDateError - No fiscal period exists for the given date
 *
 * Returned when attempting to create a journal entry for a date
 * that doesn't fall within any fiscal period.
 *
 * HTTP Status: 400 Bad Request
 */
export class FiscalPeriodNotFoundForDateError extends Schema.TaggedError<FiscalPeriodNotFoundForDateError>()(
  "FiscalPeriodNotFoundForDateError",
  {
    companyId: CompanyId.annotations({
      description: "The company ID"
    }),
    date: Schema.String.annotations({
      description: "The date for which no fiscal period exists (ISO format)"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `No fiscal period exists for date ${this.date}. Please create a fiscal year covering this date.`
  }
}

/**
 * Type guard for FiscalPeriodNotFoundForDateError
 */
export const isFiscalPeriodNotFoundForDateError = Schema.is(FiscalPeriodNotFoundForDateError)

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
  },
  HttpApiSchema.annotations({ status: 400 })
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
  },
  HttpApiSchema.annotations({ status: 400 })
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
  },
  HttpApiSchema.annotations({ status: 400 })
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
// 422 Unprocessable Entity Errors - Validation failures for journal entries
// =============================================================================

/**
 * FiscalPeriodClosedError - Period exists but is not open for posting
 *
 * Returned when attempting to create a journal entry in a closed period.
 * The period exists but its status is not "Open".
 *
 * HTTP Status: 422 Unprocessable Entity
 */
export class FiscalPeriodClosedError extends Schema.TaggedError<FiscalPeriodClosedError>()(
  "FiscalPeriodClosedError",
  {
    companyId: CompanyId.annotations({
      description: "The company ID"
    }),
    fiscalYear: Schema.Number.annotations({
      description: "The fiscal year"
    }),
    periodNumber: Schema.Number.annotations({
      description: "The period number (1-13)"
    }),
    periodStatus: FiscalPeriodStatus.annotations({
      description: "The current status of the period"
    })
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Fiscal period P${this.periodNumber} FY${this.fiscalYear} is ${this.periodStatus}. Open the period to post entries.`
  }
}

/**
 * Type guard for FiscalPeriodClosedError
 */
export const isFiscalPeriodClosedError = Schema.is(FiscalPeriodClosedError)

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
  },
  HttpApiSchema.annotations({ status: 409 })
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
  },
  HttpApiSchema.annotations({ status: 409 })
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
  | FiscalPeriodNotFoundForDateError
  | FiscalPeriodClosedError
  | InvalidStatusTransitionError
  | InvalidYearStatusTransitionError
  | FiscalYearOverlapError
  | FiscalYearAlreadyExistsError
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
  FiscalPeriodNotFoundForDateError: 400,
  // 422 Unprocessable Entity
  FiscalPeriodClosedError: 422,
  // 409 Conflict
  FiscalYearAlreadyExistsError: 409,
  PeriodsNotClosedError: 409
} as const
