/**
 * IncomeStatementService - Re-export from canonical location
 *
 * This file provides the new import path for IncomeStatementService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module reporting/IncomeStatementService
 */

export {
  IncomeStatementService,
  generateIncomeStatementFromData,
  type IncomeStatementReport,
  type IncomeStatementSection,
  type IncomeStatementLineItem
} from "../Services/IncomeStatementService.ts"
