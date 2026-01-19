/**
 * ConsolidatedReportService - Re-export from canonical location
 *
 * This file provides the new import path for ConsolidatedReportService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module reporting/ConsolidatedReportService
 */

export {
  ConsolidatedReportService,
  ConsolidatedReportServiceLive,
  isConsolidatedBalanceSheetNotBalancedError
} from "../Services/ConsolidatedReportService.ts"
