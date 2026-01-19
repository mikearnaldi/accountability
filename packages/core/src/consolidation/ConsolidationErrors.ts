/**
 * ConsolidationErrors - Domain errors for Consolidation domain
 *
 * These errors are used for Consolidation-related operations and include
 * HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * @module consolidation/ConsolidationErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404)
// =============================================================================

/**
 * IntercompanyTransactionNotFoundError - Intercompany transaction does not exist
 */
export class IntercompanyTransactionNotFoundError extends Schema.TaggedError<IntercompanyTransactionNotFoundError>()(
  "IntercompanyTransactionNotFoundError",
  {
    transactionId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Intercompany transaction not found: ${this.transactionId}`
  }
}

export const isIntercompanyTransactionNotFoundError = Schema.is(IntercompanyTransactionNotFoundError)

/**
 * ConsolidationGroupNotFoundError - Consolidation group does not exist
 */
export class ConsolidationGroupNotFoundError extends Schema.TaggedError<ConsolidationGroupNotFoundError>()(
  "ConsolidationGroupNotFoundError",
  {
    groupId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Consolidation group not found: ${this.groupId}`
  }
}

export const isConsolidationGroupNotFoundError = Schema.is(ConsolidationGroupNotFoundError)

/**
 * ConsolidationRunNotFoundError - Consolidation run does not exist
 */
export class ConsolidationRunNotFoundError extends Schema.TaggedError<ConsolidationRunNotFoundError>()(
  "ConsolidationRunNotFoundError",
  {
    runId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Consolidation run not found: ${this.runId}`
  }
}

export const isConsolidationRunNotFoundError = Schema.is(ConsolidationRunNotFoundError)

/**
 * ConsolidationMemberNotFoundError - Member not found in consolidation group
 */
export class ConsolidationMemberNotFoundError extends Schema.TaggedError<ConsolidationMemberNotFoundError>()(
  "ConsolidationMemberNotFoundError",
  {
    groupId: Schema.String,
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Member ${this.companyId} not found in consolidation group ${this.groupId}`
  }
}

export const isConsolidationMemberNotFoundError = Schema.is(ConsolidationMemberNotFoundError)

/**
 * EliminationRuleNotFoundError - Elimination rule does not exist
 */
export class EliminationRuleNotFoundError extends Schema.TaggedError<EliminationRuleNotFoundError>()(
  "EliminationRuleNotFoundError",
  {
    ruleId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Elimination rule not found: ${this.ruleId}`
  }
}

export const isEliminationRuleNotFoundError = Schema.is(EliminationRuleNotFoundError)

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * SameCompanyIntercompanyError - Cannot create intercompany transaction between same company
 */
export class SameCompanyIntercompanyError extends Schema.TaggedError<SameCompanyIntercompanyError>()(
  "SameCompanyIntercompanyError",
  {
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Cannot create intercompany transaction between same company: ${this.companyId}`
  }
}

export const isSameCompanyIntercompanyError = Schema.is(SameCompanyIntercompanyError)

// =============================================================================
// Conflict Errors (409)
// =============================================================================

/**
 * ConsolidationMemberAlreadyExistsError - Company is already a member of the group
 */
export class ConsolidationMemberAlreadyExistsError extends Schema.TaggedError<ConsolidationMemberAlreadyExistsError>()(
  "ConsolidationMemberAlreadyExistsError",
  {
    groupId: Schema.String,
    companyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Company ${this.companyId} is already a member of consolidation group ${this.groupId}`
  }
}

export const isConsolidationMemberAlreadyExistsError = Schema.is(ConsolidationMemberAlreadyExistsError)

/**
 * ConsolidationRunExistsForPeriodError - A consolidation run already exists for this period
 */
export class ConsolidationRunExistsForPeriodError extends Schema.TaggedError<ConsolidationRunExistsForPeriodError>()(
  "ConsolidationRunExistsForPeriodError",
  {
    groupId: Schema.String,
    year: Schema.Number,
    period: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `A consolidation run already exists for period ${this.year}-${this.period}`
  }
}

export const isConsolidationRunExistsForPeriodError = Schema.is(ConsolidationRunExistsForPeriodError)

/**
 * ConsolidationGroupHasCompletedRunsError - Cannot delete group with completed runs
 */
export class ConsolidationGroupHasCompletedRunsError extends Schema.TaggedError<ConsolidationGroupHasCompletedRunsError>()(
  "ConsolidationGroupHasCompletedRunsError",
  {
    groupId: Schema.String,
    completedRunCount: Schema.Number
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot delete consolidation group with ${this.completedRunCount} completed runs`
  }
}

export const isConsolidationGroupHasCompletedRunsError = Schema.is(ConsolidationGroupHasCompletedRunsError)

// =============================================================================
// Business Rule Errors (422)
// =============================================================================

/**
 * ConsolidationGroupInactiveError - Consolidation group is not active
 */
export class ConsolidationGroupInactiveError extends Schema.TaggedError<ConsolidationGroupInactiveError>()(
  "ConsolidationGroupInactiveError",
  {
    groupId: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Consolidation group ${this.groupId} is not active`
  }
}

export const isConsolidationGroupInactiveError = Schema.is(ConsolidationGroupInactiveError)

/**
 * ConsolidationRunInProgressError - Consolidation run already in progress
 */
export class ConsolidationRunInProgressError extends Schema.TaggedError<ConsolidationRunInProgressError>()(
  "ConsolidationRunInProgressError",
  {
    groupId: Schema.String,
    existingRunId: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Consolidation run already in progress for group ${this.groupId}: ${this.existingRunId}`
  }
}

export const isConsolidationRunInProgressError = Schema.is(ConsolidationRunInProgressError)

/**
 * ConsolidationGroupDeleteNotSupportedError - Group deletion is not implemented
 */
export class ConsolidationGroupDeleteNotSupportedError extends Schema.TaggedError<ConsolidationGroupDeleteNotSupportedError>()(
  "ConsolidationGroupDeleteNotSupportedError",
  {
    message: Schema.optionalWith(Schema.String, {
      default: () => "Group deletion is not yet implemented. Use deactivation instead."
    })
  },
  HttpApiSchema.annotations({ status: 422 })
) {}

export const isConsolidationGroupDeleteNotSupportedError = Schema.is(ConsolidationGroupDeleteNotSupportedError)

/**
 * ConsolidationRunCannotBeCancelledError - Run cannot be cancelled in current status
 */
export class ConsolidationRunCannotBeCancelledError extends Schema.TaggedError<ConsolidationRunCannotBeCancelledError>()(
  "ConsolidationRunCannotBeCancelledError",
  {
    runId: Schema.String,
    currentStatus: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Cannot cancel consolidation run with status: ${this.currentStatus}`
  }
}

export const isConsolidationRunCannotBeCancelledError = Schema.is(ConsolidationRunCannotBeCancelledError)

/**
 * ConsolidationRunCannotBeDeletedError - Run cannot be deleted in current status
 */
export class ConsolidationRunCannotBeDeletedError extends Schema.TaggedError<ConsolidationRunCannotBeDeletedError>()(
  "ConsolidationRunCannotBeDeletedError",
  {
    runId: Schema.String,
    currentStatus: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Cannot delete consolidation run with status: ${this.currentStatus}`
  }
}

export const isConsolidationRunCannotBeDeletedError = Schema.is(ConsolidationRunCannotBeDeletedError)

/**
 * ConsolidationRunNotCompletedError - Run has not completed successfully
 */
export class ConsolidationRunNotCompletedError extends Schema.TaggedError<ConsolidationRunNotCompletedError>()(
  "ConsolidationRunNotCompletedError",
  {
    runId: Schema.String,
    currentStatus: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Consolidation run status is ${this.currentStatus}, not Completed`
  }
}

export const isConsolidationRunNotCompletedError = Schema.is(ConsolidationRunNotCompletedError)

/**
 * ConsolidatedTrialBalanceNotAvailableError - Trial balance is not available for this run
 */
export class ConsolidatedTrialBalanceNotAvailableError extends Schema.TaggedError<ConsolidatedTrialBalanceNotAvailableError>()(
  "ConsolidatedTrialBalanceNotAvailableError",
  {
    runId: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Consolidated trial balance not available for run ${this.runId}`
  }
}

export const isConsolidatedTrialBalanceNotAvailableError = Schema.is(ConsolidatedTrialBalanceNotAvailableError)

/**
 * ConsolidatedBalanceSheetNotBalancedError - Balance sheet does not balance
 */
export class ConsolidatedBalanceSheetNotBalancedError extends Schema.TaggedError<ConsolidatedBalanceSheetNotBalancedError>()(
  "ConsolidatedBalanceSheetNotBalancedError",
  {
    difference: Schema.Number
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Balance sheet does not balance: difference of ${this.difference}`
  }
}

export const isConsolidatedBalanceSheetNotBalancedError = Schema.is(ConsolidatedBalanceSheetNotBalancedError)

/**
 * IntercompanyTransactionCannotBeDeletedError - Cannot delete a matched intercompany transaction
 */
export class IntercompanyTransactionCannotBeDeletedError extends Schema.TaggedError<IntercompanyTransactionCannotBeDeletedError>()(
  "IntercompanyTransactionCannotBeDeletedError",
  {
    transactionId: Schema.String,
    matchingStatus: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Cannot delete intercompany transaction with matching status: ${this.matchingStatus}`
  }
}

export const isIntercompanyTransactionCannotBeDeletedError = Schema.is(IntercompanyTransactionCannotBeDeletedError)

/**
 * EliminationRuleOperationFailedError - Elimination rule operation failed
 */
export class EliminationRuleOperationFailedError extends Schema.TaggedError<EliminationRuleOperationFailedError>()(
  "EliminationRuleOperationFailedError",
  {
    operation: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Elimination rule ${this.operation} failed: ${this.reason}`
  }
}

export const isEliminationRuleOperationFailedError = Schema.is(EliminationRuleOperationFailedError)

// =============================================================================
// Internal Errors (500)
// =============================================================================

/**
 * ConsolidationReportGenerationError - Failed to generate report
 */
export class ConsolidationReportGenerationError extends Schema.TaggedError<ConsolidationReportGenerationError>()(
  "ConsolidationReportGenerationError",
  {
    reportType: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Failed to generate ${this.reportType} report: ${this.reason}`
  }
}

export const isConsolidationReportGenerationError = Schema.is(ConsolidationReportGenerationError)
