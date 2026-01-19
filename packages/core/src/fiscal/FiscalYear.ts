/**
 * FiscalYear - Re-export from canonical location
 *
 * This file provides the new import path for FiscalYear domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/FiscalYear
 */

export {
  FiscalYearId,
  isFiscalYearId,
  FiscalYear,
  isFiscalYear
} from "../Domains/FiscalYear.ts"
