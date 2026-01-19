/**
 * FiscalPeriodRef - Re-export from canonical location
 *
 * This file provides the new import path for FiscalPeriodRef value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module fiscal/FiscalPeriodRef
 */

export {
  FiscalPeriodRef,
  isFiscalPeriodRef,
  Order_ as Order,
  isBefore,
  isAfter,
  equals,
  nextPeriod,
  previousPeriod,
  startOfYear,
  endOfYear,
  adjustmentPeriod,
  allRegularPeriods,
  allPeriods,
  isWithinRange,
  periodsBetween
} from "../Domains/FiscalPeriodRef.ts"
