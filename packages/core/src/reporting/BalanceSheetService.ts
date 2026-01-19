/**
 * BalanceSheetService - Re-export from canonical location
 *
 * This file provides the new import path for BalanceSheetService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module reporting/BalanceSheetService
 */

export {
  BalanceSheetService,
  generateBalanceSheetFromData,
  type BalanceSheetReport,
  type BalanceSheetSection,
  type BalanceSheetLineItem
} from "../Services/BalanceSheetService.ts"
