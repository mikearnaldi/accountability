/**
 * IntercompanyTransaction - Entity for tracking intercompany transactions
 *
 * Per ASC 810, intercompany transactions must be tracked for reconciliation
 * and elimination during consolidation. This entity captures transactions
 * between related companies within a consolidation group.
 *
 * Transaction Types:
 * - SalePurchase: Sale/purchase of goods or services
 * - Loan: Intercompany loans
 * - ManagementFee: Management fee charges
 * - Dividend: Dividend distributions
 * - CapitalContribution: Capital contributions
 * - CostAllocation: Cost allocation charges
 * - Royalty: Royalty payments
 *
 * Matching Statuses:
 * - Matched: Both sides agree on amount and details
 * - Unmatched: Missing entry on one side
 * - PartiallyMatched: Amounts differ between sides
 * - VarianceApproved: Difference has been reviewed and accepted
 *
 * @module IntercompanyTransaction
 */

import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { CompanyId } from "../company/Company.ts"
import { JournalEntryId } from "../journal/JournalEntry.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * IntercompanyTransactionId - Branded UUID string for intercompany transaction identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const IntercompanyTransactionId = Schema.UUID.pipe(
  Schema.brand("IntercompanyTransactionId"),
  Schema.annotations({
    identifier: "IntercompanyTransactionId",
    title: "Intercompany Transaction ID",
    description: "A unique identifier for an intercompany transaction (UUID format)"
  })
)

/**
 * The branded IntercompanyTransactionId type
 */
export type IntercompanyTransactionId = typeof IntercompanyTransactionId.Type

/**
 * Type guard for IntercompanyTransactionId using Schema.is
 */
export const isIntercompanyTransactionId = Schema.is(IntercompanyTransactionId)

/**
 * IntercompanyTransactionType - Classification of intercompany transaction types
 *
 * Per specs/ACCOUNTING_RESEARCH.md Intercompany Transaction Types:
 * - SalePurchase: Sale/Purchase of goods or services between related companies
 * - Loan: Intercompany loans (principal and interest)
 * - ManagementFee: Management or administrative fee charges
 * - Dividend: Dividend distributions from subsidiaries to parent
 * - CapitalContribution: Capital contributions from parent to subsidiary
 * - CostAllocation: Shared cost allocations between entities
 * - Royalty: Royalty payments for intellectual property
 */
export const IntercompanyTransactionType = Schema.Literal(
  "SalePurchase",
  "Loan",
  "ManagementFee",
  "Dividend",
  "CapitalContribution",
  "CostAllocation",
  "Royalty"
).annotations({
  identifier: "IntercompanyTransactionType",
  title: "Intercompany Transaction Type",
  description: "Classification of the intercompany transaction type"
})

/**
 * The IntercompanyTransactionType type
 */
export type IntercompanyTransactionType = typeof IntercompanyTransactionType.Type

/**
 * Type guard for IntercompanyTransactionType using Schema.is
 */
export const isIntercompanyTransactionType = Schema.is(IntercompanyTransactionType)

/**
 * MatchingStatus - Status of intercompany transaction matching/reconciliation
 *
 * Per specs/ACCOUNTING_RESEARCH.md Matching Statuses:
 * - Matched: Both sides agree - entries on both companies match exactly
 * - Unmatched: Missing entry on one side - only one company has recorded the transaction
 * - PartiallyMatched: Amounts differ - both sides have entries but amounts don't match
 * - VarianceApproved: Difference accepted - variance has been reviewed and approved
 */
export const MatchingStatus = Schema.Literal(
  "Matched",
  "Unmatched",
  "PartiallyMatched",
  "VarianceApproved"
).annotations({
  identifier: "MatchingStatus",
  title: "Matching Status",
  description: "Status of intercompany transaction reconciliation"
})

/**
 * The MatchingStatus type
 */
export type MatchingStatus = typeof MatchingStatus.Type

/**
 * Type guard for MatchingStatus using Schema.is
 */
export const isMatchingStatus = Schema.is(MatchingStatus)

/**
 * IntercompanyTransaction - Entity for tracking intercompany transactions
 *
 * Represents a transaction between two related companies within a consolidation group.
 * Links journal entries from both the "from" company (seller/lender) and "to" company
 * (buyer/borrower) for reconciliation and elimination purposes.
 *
 * Key features:
 * - Transaction type classification
 * - Links to journal entries on both sides
 * - Matching status for reconciliation
 * - Variance tracking with explanations
 * - Audit timestamps
 */
export class IntercompanyTransaction extends Schema.Class<IntercompanyTransaction>("IntercompanyTransaction")({
  /**
   * Unique identifier for the intercompany transaction
   */
  id: IntercompanyTransactionId,

  /**
   * The "from" company - seller, lender, or payer
   * The company initiating or providing in the transaction
   */
  fromCompanyId: CompanyId,

  /**
   * The "to" company - buyer, borrower, or recipient
   * The company receiving in the transaction
   */
  toCompanyId: CompanyId,

  /**
   * Classification of the transaction type
   * Determines how the transaction should be eliminated during consolidation
   */
  transactionType: IntercompanyTransactionType,

  /**
   * Date of the transaction
   */
  transactionDate: LocalDate,

  /**
   * Transaction amount with currency
   * This is the agreed/expected amount for the transaction
   */
  amount: MonetaryAmount,

  /**
   * Reference to journal entry on the "from" company side
   * Optional because the entry may not yet be recorded
   */
  fromJournalEntryId: Schema.OptionFromNullOr(JournalEntryId).annotations({
    title: "From Journal Entry ID",
    description: "Journal entry reference on the seller/lender side"
  }),

  /**
   * Reference to journal entry on the "to" company side
   * Optional because the entry may not yet be recorded
   */
  toJournalEntryId: Schema.OptionFromNullOr(JournalEntryId).annotations({
    title: "To Journal Entry ID",
    description: "Journal entry reference on the buyer/borrower side"
  }),

  /**
   * Current matching status of the transaction
   * Indicates the reconciliation state between the two companies
   */
  matchingStatus: MatchingStatus,

  /**
   * Variance amount (difference between the two sides)
   * Optional - only present when there is a variance
   */
  varianceAmount: Schema.OptionFromNullOr(MonetaryAmount).annotations({
    title: "Variance Amount",
    description: "Difference between amounts recorded by each company"
  }),

  /**
   * Explanation for any variance
   * Optional - provides justification when variance is approved
   */
  varianceExplanation: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Variance Explanation",
    description: "Explanation or justification for any variance"
  }),

  /**
   * Optional description or reference for the transaction
   */
  description: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString).annotations({
    title: "Description",
    description: "Description or reference for the transaction"
  }),

  /**
   * Creation timestamp
   */
  createdAt: Timestamp,

  /**
   * Last update timestamp
   */
  updatedAt: Timestamp
}) {
  /**
   * Check if the transaction is fully matched
   */
  get isMatched(): boolean {
    return this.matchingStatus === "Matched"
  }

  /**
   * Check if the transaction is unmatched (missing entry on one side)
   */
  get isUnmatched(): boolean {
    return this.matchingStatus === "Unmatched"
  }

  /**
   * Check if the transaction is partially matched (amounts differ)
   */
  get isPartiallyMatched(): boolean {
    return this.matchingStatus === "PartiallyMatched"
  }

  /**
   * Check if the variance has been approved
   */
  get isVarianceApproved(): boolean {
    return this.matchingStatus === "VarianceApproved"
  }

  /**
   * Check if the transaction has any variance
   */
  get hasVariance(): boolean {
    return Option.isSome(this.varianceAmount)
  }

  /**
   * Check if the variance has an explanation
   */
  get hasVarianceExplanation(): boolean {
    return Option.isSome(this.varianceExplanation)
  }

  /**
   * Check if the "from" side has a journal entry recorded
   */
  get hasFromEntry(): boolean {
    return Option.isSome(this.fromJournalEntryId)
  }

  /**
   * Check if the "to" side has a journal entry recorded
   */
  get hasToEntry(): boolean {
    return Option.isSome(this.toJournalEntryId)
  }

  /**
   * Check if both sides have journal entries recorded
   */
  get hasBothEntries(): boolean {
    return this.hasFromEntry && this.hasToEntry
  }

  /**
   * Check if only one side has a journal entry
   */
  get hasOnlyOneEntry(): boolean {
    return (this.hasFromEntry && !this.hasToEntry) ||
           (!this.hasFromEntry && this.hasToEntry)
  }

  /**
   * Check if neither side has a journal entry yet
   */
  get hasNoEntries(): boolean {
    return !this.hasFromEntry && !this.hasToEntry
  }

  /**
   * Check if this is a sale/purchase transaction
   */
  get isSalePurchase(): boolean {
    return this.transactionType === "SalePurchase"
  }

  /**
   * Check if this is a loan transaction
   */
  get isLoan(): boolean {
    return this.transactionType === "Loan"
  }

  /**
   * Check if this is a management fee transaction
   */
  get isManagementFee(): boolean {
    return this.transactionType === "ManagementFee"
  }

  /**
   * Check if this is a dividend transaction
   */
  get isDividend(): boolean {
    return this.transactionType === "Dividend"
  }

  /**
   * Check if this is a capital contribution transaction
   */
  get isCapitalContribution(): boolean {
    return this.transactionType === "CapitalContribution"
  }

  /**
   * Check if this is a cost allocation transaction
   */
  get isCostAllocation(): boolean {
    return this.transactionType === "CostAllocation"
  }

  /**
   * Check if this is a royalty transaction
   */
  get isRoyalty(): boolean {
    return this.transactionType === "Royalty"
  }

  /**
   * Check if the transaction requires elimination during consolidation
   * All matched or variance-approved transactions should be eliminated
   */
  get requiresElimination(): boolean {
    return this.isMatched || this.isVarianceApproved
  }

  /**
   * Check if the transaction has a description
   */
  get hasDescription(): boolean {
    return Option.isSome(this.description)
  }
}

/**
 * Type guard for IntercompanyTransaction using Schema.is
 */
export const isIntercompanyTransaction = Schema.is(IntercompanyTransaction)

/**
 * Encoded type interface for IntercompanyTransaction
 */
export interface IntercompanyTransactionEncoded extends Schema.Schema.Encoded<typeof IntercompanyTransaction> {}
