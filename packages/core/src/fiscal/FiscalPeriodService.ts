/**
 * FiscalPeriodService - Re-export from canonical location
 *
 * This file provides the new import path for FiscalPeriodService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/FiscalPeriodService
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
  FiscalPeriodService
} from "../FiscalPeriod/FiscalPeriodService.ts"
