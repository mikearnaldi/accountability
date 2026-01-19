/**
 * FiscalPeriodErrors - Re-export from canonical location
 *
 * This file provides the new import path for FiscalPeriod-related errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/FiscalPeriodErrors
 */

export {
  // 404 Not Found errors
  FiscalYearNotFoundError,
  isFiscalYearNotFoundError,
  FiscalPeriodNotFoundError,
  isFiscalPeriodNotFoundError,
  FiscalPeriodNotFoundForDateError,
  isFiscalPeriodNotFoundForDateError,

  // 400 Bad Request errors
  InvalidStatusTransitionError,
  isInvalidStatusTransitionError,
  InvalidYearStatusTransitionError,
  isInvalidYearStatusTransitionError,
  FiscalYearOverlapError,
  isFiscalYearOverlapError,

  // 409 Conflict errors
  FiscalYearAlreadyExistsError,
  isFiscalYearAlreadyExistsError,
  PeriodsNotClosedError,
  isPeriodsNotClosedError,

  // Union type
  type FiscalPeriodError,

  // HTTP status code mapping
  FISCAL_PERIOD_ERROR_STATUS_CODES
} from "../FiscalPeriod/FiscalPeriodErrors.ts"
