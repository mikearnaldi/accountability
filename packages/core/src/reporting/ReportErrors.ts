/**
 * ReportErrors - Domain errors for Reporting domain
 *
 * These errors are used for Report generation operations and include
 * HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * @module reporting/ReportErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Validation Errors (400)
// =============================================================================

/**
 * InvalidReportPeriodError - Report period is invalid (end before start)
 */
export class InvalidReportPeriodError extends Schema.TaggedError<InvalidReportPeriodError>()(
  "InvalidReportPeriodError",
  {
    periodStart: Schema.String,
    periodEnd: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid report period: ${this.periodStart} to ${this.periodEnd}`
  }
}

export const isInvalidReportPeriodError = Schema.is(InvalidReportPeriodError)

// =============================================================================
// Business Rule Errors (422)
// =============================================================================

/**
 * TrialBalanceNotBalancedError - Trial balance debits don't equal credits
 */
export class TrialBalanceNotBalancedError extends Schema.TaggedError<TrialBalanceNotBalancedError>()(
  "TrialBalanceNotBalancedError",
  {
    totalDebits: Schema.Number,
    totalCredits: Schema.Number
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Trial balance is not balanced: debits ${this.totalDebits}, credits ${this.totalCredits}`
  }
}

export const isTrialBalanceNotBalancedError = Schema.is(TrialBalanceNotBalancedError)

/**
 * BalanceSheetNotBalancedError - Balance sheet assets don't equal liabilities + equity
 */
export class BalanceSheetNotBalancedError extends Schema.TaggedError<BalanceSheetNotBalancedError>()(
  "BalanceSheetNotBalancedError",
  {
    totalAssets: Schema.Number,
    totalLiabilitiesAndEquity: Schema.Number
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Balance sheet is not balanced: assets ${this.totalAssets}, liabilities + equity ${this.totalLiabilitiesAndEquity}`
  }
}

export const isBalanceSheetNotBalancedError = Schema.is(BalanceSheetNotBalancedError)
