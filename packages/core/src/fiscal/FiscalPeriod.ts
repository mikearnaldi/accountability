/**
 * FiscalPeriod - Re-export from canonical location
 *
 * This file provides the new import path for FiscalPeriod domain entities
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/FiscalPeriod
 */

export {
  FiscalPeriodId,
  isFiscalPeriodId,
  FiscalPeriodUserId,
  PeriodReopenAuditEntryId,
  FiscalPeriod,
  isFiscalPeriod,
  PeriodReopenAuditEntry,
  isPeriodReopenAuditEntry
} from "../Domains/FiscalPeriod.ts"
