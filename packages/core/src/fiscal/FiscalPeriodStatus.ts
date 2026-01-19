/**
 * FiscalPeriodStatus - Re-export from canonical location
 *
 * This file provides the new import path for FiscalPeriodStatus value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/FiscalPeriodStatus
 */

export {
  FiscalPeriodStatus,
  isFiscalPeriodStatus,
  FiscalPeriodStatusValues,
  statusAllowsJournalEntries,
  statusAllowsModifications,
  canTransitionTo
} from "../Domains/FiscalPeriodStatus.ts"
