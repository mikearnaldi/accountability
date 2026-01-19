/**
 * CashFlowStatementService - Re-export from canonical location
 *
 * This file provides the new import path for CashFlowStatementService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module reporting/CashFlowStatementService
 */

export {
  CashFlowStatementService,
  generateCashFlowStatementFromData,
  type CashFlowStatementReport
} from "../Services/CashFlowStatementService.ts"
