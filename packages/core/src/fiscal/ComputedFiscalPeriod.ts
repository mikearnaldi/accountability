/**
 * ComputedFiscalPeriod - Re-export from canonical location
 *
 * This file provides the new import path for ComputedFiscalPeriod utilities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/ComputedFiscalPeriod
 */

export {
  ComputedFiscalPeriod,
  isComputedFiscalPeriod,
  computeFiscalPeriod,
  getAllPeriodsForFiscalYear,
  formatFiscalPeriodForDisplay
} from "../Domains/ComputedFiscalPeriod.ts"
