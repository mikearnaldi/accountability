/**
 * FiscalYearStatus - Re-export from canonical location
 *
 * This file provides the new import path for FiscalYearStatus value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/FiscalYearStatus
 */

export {
  FiscalYearStatus,
  isFiscalYearStatus,
  FiscalYearStatusValues
} from "../Domains/FiscalYearStatus.ts"
