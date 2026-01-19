/**
 * ConsolidationErrors - Re-export from canonical location
 *
 * This file provides the new import path for Consolidation-related errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module consolidation/ConsolidationErrors
 */

export {
  // Not Found errors
  IntercompanyTransactionNotFoundError,
  isIntercompanyTransactionNotFoundError,
  ConsolidationGroupNotFoundError,
  isConsolidationGroupNotFoundError,
  ConsolidationRunNotFoundError,
  isConsolidationRunNotFoundError,
  ConsolidationMemberNotFoundError,
  isConsolidationMemberNotFoundError,
  EliminationRuleNotFoundError,
  isEliminationRuleNotFoundError,

  // Validation errors
  SameCompanyIntercompanyError,
  isSameCompanyIntercompanyError,
  IntercompanyTransactionCannotBeDeletedError,
  isIntercompanyTransactionCannotBeDeletedError,
  EliminationRuleOperationFailedError,
  isEliminationRuleOperationFailedError,

  // Business rule errors
  ConsolidationGroupInactiveError,
  isConsolidationGroupInactiveError,
  ConsolidationRunInProgressError,
  isConsolidationRunInProgressError,
  ConsolidationGroupHasCompletedRunsError,
  isConsolidationGroupHasCompletedRunsError,
  ConsolidationGroupDeleteNotSupportedError,
  isConsolidationGroupDeleteNotSupportedError,
  ConsolidationMemberAlreadyExistsError,
  isConsolidationMemberAlreadyExistsError,
  ConsolidationRunExistsForPeriodError,
  isConsolidationRunExistsForPeriodError,
  ConsolidationRunCannotBeCancelledError,
  isConsolidationRunCannotBeCancelledError,
  ConsolidationRunCannotBeDeletedError,
  isConsolidationRunCannotBeDeletedError,
  ConsolidationRunNotCompletedError,
  isConsolidationRunNotCompletedError,
  ConsolidatedTrialBalanceNotAvailableError,
  isConsolidatedTrialBalanceNotAvailableError,
  ConsolidatedBalanceSheetNotBalancedError,
  isConsolidatedBalanceSheetNotBalancedError,
  ConsolidationReportGenerationError,
  isConsolidationReportGenerationError
} from "../Errors/DomainErrors.ts"
