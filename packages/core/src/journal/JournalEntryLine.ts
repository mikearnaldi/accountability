/**
 * JournalEntryLine - Journal Entry Line entity for double-entry bookkeeping
 *
 * Represents a single line within a journal entry, containing account reference,
 * debit/credit amounts in both transaction and functional currencies,
 * memo, dimensions for reporting, and intercompany properties.
 *
 * Per specs/ACCOUNTING_RESEARCH.md Journal Entry Line contains:
 * - Account reference
 * - Amounts in Transaction Currency (debit or credit, not both)
 * - Amounts in Functional Currency with exchange rate
 * - Optional memo/narrative
 * - Optional dimensions for reporting (department, project, cost center)
 * - Intercompany partner reference and matching line reference
 *
 * Key Validation Rule:
 * Exactly one of debit or credit must be set - not both, not neither.
 *
 * @module journal/JournalEntryLine
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AccountId } from "../accounting/Account.ts"
import { CompanyId } from "../company/Company.ts"
import type { CurrencyCode } from "../currency/CurrencyCode.ts"
import { JournalEntryId } from "./JournalEntry.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"

/**
 * JournalEntryLineId - Branded UUID string for journal entry line identification
 *
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 */
export const JournalEntryLineId = Schema.UUID.pipe(
  Schema.brand("JournalEntryLineId"),
  Schema.annotations({
    identifier: "JournalEntryLineId",
    title: "Journal Entry Line ID",
    description: "A unique identifier for a journal entry line (UUID format)"
  })
)

/**
 * The branded JournalEntryLineId type
 */
export type JournalEntryLineId = typeof JournalEntryLineId.Type

/**
 * Type guard for JournalEntryLineId using Schema.is
 */
export const isJournalEntryLineId = Schema.is(JournalEntryLineId)

/**
 * Dimensions - Optional key-value pairs for reporting dimensions
 *
 * Used to track department, project, cost center, or any other
 * custom reporting dimensions on journal entry lines.
 */
export const Dimensions = Schema.Record({
  key: Schema.String,
  value: Schema.String
}).annotations({
  identifier: "Dimensions",
  title: "Dimensions",
  description: "Key-value pairs for reporting dimensions (department, project, cost center, etc.)"
})

/**
 * The Dimensions type
 */
export type Dimensions = typeof Dimensions.Type

/**
 * Type guard for Dimensions using Schema.is
 */
export const isDimensions = Schema.is(Dimensions)

/**
 * JournalEntryLine - Journal Entry Line entity
 *
 * Represents a single line within a journal entry with amounts in both
 * transaction and functional currencies, and optional intercompany properties.
 *
 * Note: Use JournalEntryLineSchema for decoding from external input to enforce
 * the debit/credit validation rule (exactly one must be set).
 */
export class JournalEntryLine extends Schema.Class<JournalEntryLine>("JournalEntryLine")({
  /**
   * Unique identifier for the journal entry line
   */
  id: JournalEntryLineId,

  /**
   * Reference to the parent journal entry
   */
  journalEntryId: JournalEntryId,

  /**
   * Line number for ordering within the journal entry
   * Starts at 1 for the first line
   */
  lineNumber: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(1),
    Schema.annotations({
      title: "Line Number",
      description: "Sequential line number for ordering (starts at 1)"
    })
  ),

  /**
   * Reference to the account being debited or credited
   */
  accountId: AccountId,

  /**
   * Debit amount in transaction currency
   * Must be None if credit is set, Some if credit is None
   */
  debitAmount: Schema.OptionFromNullOr(MonetaryAmount).annotations({
    title: "Debit Amount",
    description: "Debit amount in transaction currency (null if credit line)"
  }),

  /**
   * Credit amount in transaction currency
   * Must be None if debit is set, Some if debit is None
   */
  creditAmount: Schema.OptionFromNullOr(MonetaryAmount).annotations({
    title: "Credit Amount",
    description: "Credit amount in transaction currency (null if debit line)"
  }),

  /**
   * Functional currency debit amount
   * Converted from transaction currency using the exchange rate
   * Must be None if functionalCurrencyCreditAmount is set
   */
  functionalCurrencyDebitAmount: Schema.OptionFromNullOr(MonetaryAmount).annotations({
    title: "Functional Currency Debit Amount",
    description: "Debit amount converted to functional currency"
  }),

  /**
   * Functional currency credit amount
   * Converted from transaction currency using the exchange rate
   * Must be None if functionalCurrencyDebitAmount is set
   */
  functionalCurrencyCreditAmount: Schema.OptionFromNullOr(MonetaryAmount).annotations({
    title: "Functional Currency Credit Amount",
    description: "Credit amount converted to functional currency"
  }),

  /**
   * Exchange rate used for conversion from transaction to functional currency
   * Stored with high precision as BigDecimal
   */
  exchangeRate: Schema.BigDecimal.annotations({
    title: "Exchange Rate",
    description: "Exchange rate used for currency conversion"
  }),

  /**
   * Optional memo/narrative for this specific line
   */
  memo: Schema.OptionFromNullOr(Schema.String).annotations({
    title: "Memo",
    description: "Optional memo or narrative for this line"
  }),

  /**
   * Optional dimensions for reporting (department, project, cost center, etc.)
   */
  dimensions: Schema.OptionFromNullOr(Dimensions).annotations({
    title: "Dimensions",
    description: "Optional reporting dimensions as key-value pairs"
  }),

  /**
   * Intercompany partner company ID (if applicable)
   * Used for intercompany transactions
   */
  intercompanyPartnerId: Schema.OptionFromNullOr(CompanyId).annotations({
    title: "Intercompany Partner ID",
    description: "Reference to intercompany partner company"
  }),

  /**
   * Reference to matching line in partner company's books
   * Used for intercompany reconciliation
   */
  matchingLineId: Schema.OptionFromNullOr(JournalEntryLineId).annotations({
    title: "Matching Line ID",
    description: "Reference to matching line in partner company's journal entry"
  })
}) {
  /**
   * Check if this is a debit line
   */
  get isDebit(): boolean {
    return Option.isSome(this.debitAmount)
  }

  /**
   * Check if this is a credit line
   */
  get isCredit(): boolean {
    return Option.isSome(this.creditAmount)
  }

  /**
   * Get the transaction currency amount (either debit or credit)
   */
  get transactionAmount(): MonetaryAmount {
    return Option.getOrElse(this.debitAmount, () => Option.getOrThrow(this.creditAmount))
  }

  /**
   * Get the functional currency amount (either debit or credit)
   */
  get functionalCurrencyAmount(): MonetaryAmount {
    return Option.getOrElse(this.functionalCurrencyDebitAmount, () =>
      Option.getOrThrow(this.functionalCurrencyCreditAmount)
    )
  }

  /**
   * Get the transaction currency code
   */
  get transactionCurrency(): CurrencyCode {
    return this.transactionAmount.currency
  }

  /**
   * Get the functional currency code
   */
  get functionalCurrency(): CurrencyCode {
    return this.functionalCurrencyAmount.currency
  }

  /**
   * Check if transaction and functional currencies are the same
   */
  get isSameCurrency(): boolean {
    return this.transactionCurrency === this.functionalCurrency
  }

  /**
   * Check if this is an intercompany line
   */
  get isIntercompany(): boolean {
    return Option.isSome(this.intercompanyPartnerId)
  }

  /**
   * Check if this line has a matching line in partner's books
   */
  get hasMatchingLine(): boolean {
    return Option.isSome(this.matchingLineId)
  }

  /**
   * Check if this line has a memo
   */
  get hasMemo(): boolean {
    return Option.isSome(this.memo)
  }

  /**
   * Check if this line has dimensions
   */
  get hasDimensions(): boolean {
    return Option.isSome(this.dimensions)
  }

  /**
   * Get the debit amount or zero for the given currency
   */
  getDebitOrZero(currency: CurrencyCode): MonetaryAmount {
    return Option.getOrElse(this.debitAmount, () => MonetaryAmount.zero(currency))
  }

  /**
   * Get the credit amount or zero for the given currency
   */
  getCreditOrZero(currency: CurrencyCode): MonetaryAmount {
    return Option.getOrElse(this.creditAmount, () => MonetaryAmount.zero(currency))
  }

  /**
   * Get the functional currency debit amount or zero
   */
  getFunctionalDebitOrZero(currency: CurrencyCode): MonetaryAmount {
    return Option.getOrElse(this.functionalCurrencyDebitAmount, () => MonetaryAmount.zero(currency))
  }

  /**
   * Get the functional currency credit amount or zero
   */
  getFunctionalCreditOrZero(currency: CurrencyCode): MonetaryAmount {
    return Option.getOrElse(this.functionalCurrencyCreditAmount, () => MonetaryAmount.zero(currency))
  }

  /**
   * Check if exchange rate is 1 (no conversion needed)
   */
  get hasUnityExchangeRate(): boolean {
    return BigDecimal.equals(this.exchangeRate, BigDecimal.fromBigInt(1n))
  }
}

/**
 * Type guard for JournalEntryLine using Schema.is
 */
export const isJournalEntryLine = Schema.is(JournalEntryLine)

/**
 * Debit/credit validation filter function
 *
 * Ensures exactly one of debit or credit is set (not both, not neither).
 */
const validateDebitCredit = (
  line: JournalEntryLine
): boolean | { path: readonly (string | number)[]; message: string } => {
  const hasDebit = Option.isSome(line.debitAmount)
  const hasCredit = Option.isSome(line.creditAmount)

  if (hasDebit && hasCredit) {
    return {
      path: ["debitAmount", "creditAmount"],
      message: "A journal entry line cannot have both debit and credit amounts"
    }
  }
  if (!hasDebit && !hasCredit) {
    return {
      path: ["debitAmount", "creditAmount"],
      message: "A journal entry line must have either a debit or credit amount"
    }
  }
  return true
}

/**
 * JournalEntryLineSchema - Schema with debit/credit validation
 *
 * Use this schema for decoding from external input (JSON, API requests, etc.)
 * It enforces that exactly one of debit or credit is set.
 */
export const JournalEntryLineSchema = JournalEntryLine.pipe(
  Schema.filter(validateDebitCredit, {
    identifier: "JournalEntryLineDebitCreditValidation",
    message: () => "Exactly one of debit or credit amount must be set"
  })
)

/**
 * Error for invalid debit/credit configuration
 */
export class InvalidDebitCreditError extends Schema.TaggedError<InvalidDebitCreditError>()(
  "InvalidDebitCreditError",
  {
    lineId: JournalEntryLineId,
    hasDebit: Schema.Boolean,
    hasCredit: Schema.Boolean
  }
) {
  get message(): string {
    if (this.hasDebit && this.hasCredit) {
      return `Journal entry line ${this.lineId} cannot have both debit and credit amounts`
    }
    return `Journal entry line ${this.lineId} must have either a debit or credit amount`
  }
}

/**
 * Type guard for InvalidDebitCreditError using Schema.is
 */
export const isInvalidDebitCreditError = Schema.is(InvalidDebitCreditError)
