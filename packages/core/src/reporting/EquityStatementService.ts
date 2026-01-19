/**
 * EquityStatementService - Re-export from canonical location
 *
 * This file provides the new import path for EquityStatementService
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module reporting/EquityStatementService
 */

export {
  EquityStatementService,
  generateEquityStatementFromData,
  type EquityStatementReport,
  type EquityMovementRow
} from "../Services/EquityStatementService.ts"
