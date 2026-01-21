/**
 * YearEndCloseService - Year-end close workflow service
 *
 * Implements the year-end close workflow per specs/pending/year-end-closing.md:
 * - Preview what closing will do (calculate net income, show affected accounts)
 * - Execute year-end close (generate closing entries, close all periods)
 * - Reopen a closed year (reverse closing entries, reopen periods)
 *
 * Year-end close generates two journal entries:
 * 1. Close Revenue: DR All Revenue Accounts, CR Retained Earnings (total revenue)
 * 2. Close Expenses: DR Retained Earnings (total expenses), CR All Expense Accounts
 *
 * Result: Net income (Revenue - Expenses) is transferred to Retained Earnings.
 *
 * @module fiscal/YearEndCloseService
 */

import { HttpApiSchema } from "@effect/platform"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { FiscalYearId } from "./FiscalYear.ts"
import type { InvalidYearStatusTransitionError } from "./FiscalPeriodErrors.ts"
import type { CompanyId } from "../company/Company.ts"
import type { OrganizationId } from "../organization/Organization.ts"
import { JournalEntryId } from "../journal/JournalEntry.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import type { PersistenceError, EntityNotFoundError } from "../shared/errors/RepositoryError.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * RetainedEarningsNotConfiguredError - Company doesn't have retained earnings account set
 *
 * Returned when attempting year-end close without a configured retained earnings account.
 * User must configure this in Company Settings first.
 *
 * HTTP Status: 400 Bad Request
 */
export class RetainedEarningsNotConfiguredError extends Schema.TaggedError<RetainedEarningsNotConfiguredError>()(
  "RetainedEarningsNotConfiguredError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")).annotations({
      description: "The company ID missing retained earnings configuration"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Retained earnings account not configured. Configure it in Company Settings before closing the year.`
  }
}

/**
 * Type guard for RetainedEarningsNotConfiguredError
 */
export const isRetainedEarningsNotConfiguredError = Schema.is(RetainedEarningsNotConfiguredError)

/**
 * InvalidRetainedEarningsAccountError - The configured account is not valid for retained earnings
 *
 * The retained earnings account must be an Equity account.
 *
 * HTTP Status: 400 Bad Request
 */
export class InvalidRetainedEarningsAccountError extends Schema.TaggedError<InvalidRetainedEarningsAccountError>()(
  "InvalidRetainedEarningsAccountError",
  {
    accountId: Schema.UUID.pipe(Schema.brand("AccountId")).annotations({
      description: "The invalid account ID"
    }),
    accountType: Schema.String.annotations({
      description: "The actual account type (should be Equity)"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `The configured retained earnings account is not an Equity account (current type: ${this.accountType}). Please select an Equity account.`
  }
}

/**
 * Type guard for InvalidRetainedEarningsAccountError
 */
export const isInvalidRetainedEarningsAccountError = Schema.is(InvalidRetainedEarningsAccountError)

/**
 * TrialBalanceNotBalancedForCloseError - Trial balance is out of balance
 *
 * Cannot close the year because debits don't equal credits.
 * User must fix journal entries before closing.
 *
 * HTTP Status: 422 Unprocessable Entity
 */
export class TrialBalanceNotBalancedForCloseError extends Schema.TaggedError<TrialBalanceNotBalancedForCloseError>()(
  "TrialBalanceNotBalancedForCloseError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")).annotations({
      description: "The company ID"
    }),
    outOfBalanceAmount: MonetaryAmount.annotations({
      description: "The amount by which the trial balance is out of balance"
    })
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Trial balance is out of balance by ${this.outOfBalanceAmount.format()}. Review journal entries before closing.`
  }
}

/**
 * Type guard for TrialBalanceNotBalancedForCloseError
 */
export const isTrialBalanceNotBalancedForCloseError = Schema.is(TrialBalanceNotBalancedForCloseError)

/**
 * YearAlreadyClosedError - Fiscal year is already closed
 *
 * Cannot close a year that is already in Closed status.
 *
 * HTTP Status: 409 Conflict
 */
export class YearAlreadyClosedError extends Schema.TaggedError<YearAlreadyClosedError>()(
  "YearAlreadyClosedError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")).annotations({
      description: "The fiscal year ID that is already closed"
    }),
    year: Schema.Number.annotations({
      description: "The fiscal year number"
    })
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Fiscal year ${this.year} is already closed.`
  }
}

/**
 * Type guard for YearAlreadyClosedError
 */
export const isYearAlreadyClosedError = Schema.is(YearAlreadyClosedError)

/**
 * YearNotClosedError - Fiscal year is not closed (for reopen operations)
 *
 * Cannot reopen a year that is not in Closed status.
 *
 * HTTP Status: 400 Bad Request
 */
export class YearNotClosedError extends Schema.TaggedError<YearNotClosedError>()(
  "YearNotClosedError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")).annotations({
      description: "The fiscal year ID that is not closed"
    }),
    year: Schema.Number.annotations({
      description: "The fiscal year number"
    }),
    currentStatus: Schema.String.annotations({
      description: "The current status of the fiscal year"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Cannot reopen fiscal year ${this.year}: it is currently ${this.currentStatus}, not Closed.`
  }
}

/**
 * Type guard for YearNotClosedError
 */
export const isYearNotClosedError = Schema.is(YearNotClosedError)

/**
 * NoClosingEntriesToReverseError - No closing entries found to reverse
 *
 * When reopening a year, we need closing entries to reverse.
 *
 * HTTP Status: 400 Bad Request
 */
export class NoClosingEntriesToReverseError extends Schema.TaggedError<NoClosingEntriesToReverseError>()(
  "NoClosingEntriesToReverseError",
  {
    fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")).annotations({
      description: "The fiscal year ID"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `No closing entries found to reverse for this fiscal year.`
  }
}

/**
 * Type guard for NoClosingEntriesToReverseError
 */
export const isNoClosingEntriesToReverseError = Schema.is(NoClosingEntriesToReverseError)

// =============================================================================
// Preview/Response Types
// =============================================================================

/**
 * AccountSummary - Brief account info for display
 */
export class AccountSummary extends Schema.Class<AccountSummary>("AccountSummary")({
  id: Schema.UUID.pipe(Schema.brand("AccountId")),
  number: Schema.NonEmptyTrimmedString,
  name: Schema.NonEmptyTrimmedString
}) {}

/**
 * Type guard for AccountSummary
 */
export const isAccountSummary = Schema.is(AccountSummary)

/**
 * YearEndClosePreview - Preview of what year-end close will do
 *
 * Returned before executing the actual close to show the user what will happen.
 */
export class YearEndClosePreview extends Schema.Class<YearEndClosePreview>("YearEndClosePreview")({
  /**
   * The fiscal year being closed
   */
  fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")),

  /**
   * Display name of the fiscal year (e.g., "FY 2025")
   */
  fiscalYearName: Schema.String,

  /**
   * Total revenue for the year (credit balance on revenue accounts)
   */
  totalRevenue: MonetaryAmount,

  /**
   * Total expenses for the year (debit balance on expense accounts)
   */
  totalExpenses: MonetaryAmount,

  /**
   * Net income (Revenue - Expenses)
   * Positive = profit, Negative = loss
   */
  netIncome: MonetaryAmount,

  /**
   * The retained earnings account that will receive net income
   * Null if not configured
   */
  retainedEarningsAccount: Schema.OptionFromNullOr(AccountSummary),

  /**
   * Whether the year-end close can proceed
   * False if there are blockers
   */
  canProceed: Schema.Boolean,

  /**
   * List of issues that prevent closing
   * Empty if canProceed is true
   */
  blockers: Schema.Array(Schema.String)
}) {}

/**
 * Type guard for YearEndClosePreview
 */
export const isYearEndClosePreview = Schema.is(YearEndClosePreview)

/**
 * YearEndCloseResult - Result of executing year-end close
 */
export class YearEndCloseResult extends Schema.Class<YearEndCloseResult>("YearEndCloseResult")({
  /**
   * The updated fiscal year (now in Closed status)
   */
  fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")),

  /**
   * IDs of the closing journal entries created
   * Typically 2 entries: one for revenue, one for expenses
   */
  closingEntryIds: Schema.Array(JournalEntryId),

  /**
   * The net income that was transferred to retained earnings
   */
  netIncome: MonetaryAmount,

  /**
   * Number of periods that were closed
   */
  periodsClosed: Schema.Number
}) {}

/**
 * Type guard for YearEndCloseResult
 */
export const isYearEndCloseResult = Schema.is(YearEndCloseResult)

/**
 * ReopenYearResult - Result of reopening a closed year
 */
export class ReopenYearResult extends Schema.Class<ReopenYearResult>("ReopenYearResult")({
  /**
   * The updated fiscal year (now in Open status)
   */
  fiscalYearId: Schema.UUID.pipe(Schema.brand("FiscalYearId")),

  /**
   * IDs of the reversing journal entries created
   */
  reversedEntryIds: Schema.Array(JournalEntryId),

  /**
   * Number of periods that were reopened
   */
  periodsReopened: Schema.Number
}) {}

/**
 * Type guard for ReopenYearResult
 */
export const isReopenYearResult = Schema.is(ReopenYearResult)

// =============================================================================
// Union Types
// =============================================================================

/**
 * Union type for year-end close preview errors
 */
export type YearEndClosePreviewError =
  | PersistenceError

/**
 * Union type for year-end close execution errors
 *
 * Includes errors from underlying FiscalPeriodService operations.
 */
export type YearEndCloseExecuteError =
  | RetainedEarningsNotConfiguredError
  | InvalidRetainedEarningsAccountError
  | TrialBalanceNotBalancedForCloseError
  | YearAlreadyClosedError
  | InvalidYearStatusTransitionError
  | PersistenceError
  | EntityNotFoundError

/**
 * Union type for reopen fiscal year errors
 *
 * Includes errors from underlying FiscalPeriodService operations.
 */
export type ReopenFiscalYearError =
  | YearNotClosedError
  | NoClosingEntriesToReverseError
  | InvalidYearStatusTransitionError
  | PersistenceError
  | EntityNotFoundError

// =============================================================================
// Service Interface
// =============================================================================

/**
 * YearEndCloseServiceShape - The shape of the year-end close service
 *
 * Provides year-end close workflow operations including:
 * - Preview (calculate net income, validate prerequisites)
 * - Execute (generate closing entries, close year)
 * - Reopen (reverse closing entries, reopen year)
 */
export interface YearEndCloseServiceShape {
  /**
   * Preview what year-end close will do
   *
   * Calculates net income, validates prerequisites, and returns a preview
   * of the closing operation without making any changes.
   *
   * @param organizationId - The organization ID (for account access)
   * @param companyId - The company ID
   * @param fiscalYearId - The fiscal year to preview closing
   * @returns Effect containing the preview
   */
  readonly previewYearEndClose: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<
    YearEndClosePreview,
    YearEndClosePreviewError
  >

  /**
   * Execute year-end close
   *
   * Generates closing journal entries to transfer income statement balances
   * to retained earnings, then closes all periods and the fiscal year.
   *
   * Closing entries are:
   * 1. DR All Revenue Accounts, CR Retained Earnings (total revenue)
   * 2. DR Retained Earnings, CR All Expense Accounts (total expenses)
   *
   * @param organizationId - The organization ID (for account access)
   * @param companyId - The company ID
   * @param fiscalYearId - The fiscal year to close
   * @returns Effect containing the result with closing entry IDs
   */
  readonly executeYearEndClose: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    fiscalYearId: FiscalYearId
  ) => Effect.Effect<
    YearEndCloseResult,
    YearEndCloseExecuteError
  >

  /**
   * Reopen a closed fiscal year
   *
   * Reverses the closing entries and reopens the fiscal year.
   * The reason is recorded for audit purposes.
   *
   * @param organizationId - The organization ID (for account access)
   * @param companyId - The company ID
   * @param fiscalYearId - The fiscal year to reopen
   * @param reason - The reason for reopening (minimum 10 characters)
   * @returns Effect containing the result with reversed entry IDs
   */
  readonly reopenFiscalYear: (
    organizationId: OrganizationId,
    companyId: CompanyId,
    fiscalYearId: FiscalYearId,
    reason: string
  ) => Effect.Effect<
    ReopenYearResult,
    ReopenFiscalYearError
  >

  /**
   * Get the retained earnings account for a company
   *
   * @param organizationId - The organization ID (for account access)
   * @param companyId - The company ID
   * @returns Effect containing the account summary if configured
   */
  readonly getRetainedEarningsAccount: (
    organizationId: OrganizationId,
    companyId: CompanyId
  ) => Effect.Effect<
    Option.Option<AccountSummary>,
    PersistenceError
  >
}

/**
 * YearEndCloseService - Context.Tag for the year-end close service
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const yearEndService = yield* YearEndCloseService
 *
 *   // Preview first
 *   const preview = yield* yearEndService.previewYearEndClose(companyId, fiscalYearId)
 *   if (!preview.canProceed) {
 *     console.log("Cannot close:", preview.blockers)
 *     return
 *   }
 *
 *   // Execute close
 *   const result = yield* yearEndService.executeYearEndClose(companyId, fiscalYearId)
 *   console.log(`Closed with net income: ${result.netIncome.format()}`)
 * })
 *
 * // Provide the implementation
 * program.pipe(Effect.provide(YearEndCloseServiceLive))
 * ```
 */
export class YearEndCloseService extends Context.Tag("YearEndCloseService")<
  YearEndCloseService,
  YearEndCloseServiceShape
>() {}
