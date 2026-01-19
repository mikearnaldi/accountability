/**
 * FiscalPeriodService - Re-export from canonical location
 *
 * This file provides backward compatibility during the core package reorganization.
 * The canonical location is now: fiscal/FiscalPeriodService.ts
 *
 * @module FiscalPeriod/FiscalPeriodService
 * @deprecated Import from "@accountability/core/fiscal/FiscalPeriodService" instead
 */

export {
  // Input types
  type CreateFiscalYearInput,
  type GeneratePeriodsInput,
  type ChangePeriodStatusInput,
  type ReopenPeriodInput,
  type ListPeriodsFilter,
  // Service interface shape
  type FiscalPeriodServiceShape,
  // Service tag
  FiscalPeriodService,
  // Error union types
  type CreateFiscalYearError,
  type PeriodStatusTransitionError,
  type YearStatusTransitionError
} from "../fiscal/FiscalPeriodService.ts"
