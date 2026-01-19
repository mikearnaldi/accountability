/**
 * TrialBalanceService - Trial Balance Report generation service
 *
 * Implements trial balance report generation per specs/ACCOUNTING_RESEARCH.md Phase 3.1:
 * - TrialBalanceReport schema with metadata and line items
 * - generateTrialBalance: (companyId, asOfDate) -> Effect<TrialBalanceReport>
 * - Shows all accounts with non-zero balances
 * - Debit and credit columns (not net balance)
 * - Total debits equals total credits (validation)
 * - Support for filtering by date range
 *
 * A trial balance lists all accounts and their balances at a specific point in time,
 * with separate debit and credit columns. It's used to verify that debits equal credits
 * (the fundamental accounting equation holds).
 *
 * @module accounting/TrialBalanceService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as ReadonlyArray from "effect/Array"
import * as Schema from "effect/Schema"
import type { Account, AccountType } from "./Account.ts";
import { AccountId } from "./Account.ts"
import { CompanyId } from "../company/Company.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { Timestamp, nowEffect as timestampNowEffect } from "../shared/values/Timestamp.ts"
import type { JournalEntryWithLines } from "./AccountBalance.ts"
import {
  calculateDebitCreditTotals,
  calculatePeriodDebitCreditTotals
} from "./AccountBalance.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when company is not found
 */
export class CompanyNotFoundError extends Schema.TaggedError<CompanyNotFoundError>()(
  "CompanyNotFoundError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId"))
  }
) {
  get message(): string {
    return `Company not found: ${this.companyId}`
  }
}

/**
 * Type guard for CompanyNotFoundError
 */
export const isCompanyNotFoundError = Schema.is(CompanyNotFoundError)

/**
 * Error when trial balance does not balance (debits != credits)
 * This indicates a serious issue with the accounting data.
 */
export class TrialBalanceNotBalancedError extends Schema.TaggedError<TrialBalanceNotBalancedError>()(
  "TrialBalanceNotBalancedError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    asOfDate: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    totalDebits: MonetaryAmount,
    totalCredits: MonetaryAmount
  }
) {
  get message(): string {
    const dateStr = `${this.asOfDate.year}-${String(this.asOfDate.month).padStart(2, "0")}-${String(this.asOfDate.day).padStart(2, "0")}`
    return `Trial balance not balanced for company ${this.companyId} as of ${dateStr}: debits ${this.totalDebits.format()} != credits ${this.totalCredits.format()}`
  }
}

/**
 * Type guard for TrialBalanceNotBalancedError
 */
export const isTrialBalanceNotBalancedError = Schema.is(TrialBalanceNotBalancedError)

/**
 * Union type for all trial balance service errors
 */
export type TrialBalanceServiceError = CompanyNotFoundError | TrialBalanceNotBalancedError

// =============================================================================
// Report Types
// =============================================================================

/**
 * TrialBalanceLineItem - A single line in the trial balance report
 *
 * Shows an account with its debit and credit balances.
 * Per accounting convention, an account appears in only one column:
 * - Debit-balance accounts show amount in debit column
 * - Credit-balance accounts show amount in credit column
 */
export class TrialBalanceLineItem extends Schema.Class<TrialBalanceLineItem>("TrialBalanceLineItem")({
  /**
   * The account ID
   */
  accountId: AccountId,

  /**
   * The account number (for display/sorting)
   */
  accountNumber: Schema.NonEmptyTrimmedString,

  /**
   * The account name
   */
  accountName: Schema.NonEmptyTrimmedString,

  /**
   * The account type (Asset, Liability, Equity, Revenue, Expense)
   */
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),

  /**
   * The account category
   */
  accountCategory: Schema.String,

  /**
   * The account's normal balance direction
   */
  normalBalance: Schema.Literal("Debit", "Credit"),

  /**
   * Debit balance (zero if this is a credit-balance account)
   */
  debitBalance: MonetaryAmount,

  /**
   * Credit balance (zero if this is a debit-balance account)
   */
  creditBalance: MonetaryAmount
}) {
  /**
   * Check if this line has a debit balance
   */
  get hasDebitBalance(): boolean {
    return !this.debitBalance.isZero
  }

  /**
   * Check if this line has a credit balance
   */
  get hasCreditBalance(): boolean {
    return !this.creditBalance.isZero
  }

  /**
   * Check if this line has any balance (non-zero)
   */
  get hasBalance(): boolean {
    return this.hasDebitBalance || this.hasCreditBalance
  }

  /**
   * Get the net balance (positive for normal balance direction)
   * For debit accounts: debit - credit
   * For credit accounts: credit - debit
   */
  get netBalance(): MonetaryAmount {
    if (this.normalBalance === "Debit") {
      return MonetaryAmount.fromBigDecimal(
        BigDecimal.subtract(this.debitBalance.amount, this.creditBalance.amount),
        this.debitBalance.currency
      )
    } else {
      return MonetaryAmount.fromBigDecimal(
        BigDecimal.subtract(this.creditBalance.amount, this.debitBalance.amount),
        this.creditBalance.currency
      )
    }
  }
}

/**
 * Type guard for TrialBalanceLineItem
 */
export const isTrialBalanceLineItem = Schema.is(TrialBalanceLineItem)

/**
 * TrialBalanceReportMetadata - Metadata about the trial balance report
 */
export class TrialBalanceReportMetadata extends Schema.Class<TrialBalanceReportMetadata>("TrialBalanceReportMetadata")({
  /**
   * The company ID
   */
  companyId: CompanyId,

  /**
   * The report date (as-of date)
   */
  asOfDate: LocalDate,

  /**
   * Optional period start date for period-based trial balance
   * If provided, shows activity during the period rather than cumulative balances
   */
  periodStartDate: Schema.OptionFromNullOr(LocalDate),

  /**
   * The functional currency used for the report
   */
  currency: CurrencyCode,

  /**
   * When the report was generated
   */
  generatedAt: Timestamp,

  /**
   * Total number of accounts with balances
   */
  accountCount: Schema.Number,

  /**
   * Whether the trial balance is balanced (debits = credits)
   */
  isBalanced: Schema.Boolean
}) {}

/**
 * Type guard for TrialBalanceReportMetadata
 */
export const isTrialBalanceReportMetadata = Schema.is(TrialBalanceReportMetadata)

/**
 * TrialBalanceReport - Complete trial balance report
 *
 * Contains metadata, line items for each account, and totals.
 */
export class TrialBalanceReport extends Schema.Class<TrialBalanceReport>("TrialBalanceReport")({
  /**
   * Report metadata
   */
  metadata: TrialBalanceReportMetadata,

  /**
   * Line items for each account with a balance
   */
  lineItems: Schema.Array(TrialBalanceLineItem),

  /**
   * Total debits across all accounts
   */
  totalDebits: MonetaryAmount,

  /**
   * Total credits across all accounts
   */
  totalCredits: MonetaryAmount
}) {
  /**
   * Check if the trial balance is balanced (debits = credits)
   */
  get isBalanced(): boolean {
    return BigDecimal.equals(this.totalDebits.amount, this.totalCredits.amount)
  }

  /**
   * Get the out-of-balance amount (debits - credits)
   * Should be zero for a balanced trial balance
   */
  get outOfBalanceAmount(): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(this.totalDebits.amount, this.totalCredits.amount),
      this.totalDebits.currency
    )
  }

  /**
   * Get line items filtered by account type
   */
  getLineItemsByType(type: AccountType): ReadonlyArray<TrialBalanceLineItem> {
    return ReadonlyArray.filter(this.lineItems, (item) => item.accountType === type)
  }

  /**
   * Get line items for balance sheet accounts (Asset, Liability, Equity)
   */
  get balanceSheetItems(): ReadonlyArray<TrialBalanceLineItem> {
    return ReadonlyArray.filter(
      this.lineItems,
      (item) =>
        item.accountType === "Asset" ||
        item.accountType === "Liability" ||
        item.accountType === "Equity"
    )
  }

  /**
   * Get line items for income statement accounts (Revenue, Expense)
   */
  get incomeStatementItems(): ReadonlyArray<TrialBalanceLineItem> {
    return ReadonlyArray.filter(
      this.lineItems,
      (item) =>
        item.accountType === "Revenue" || item.accountType === "Expense"
    )
  }

  /**
   * Get total debits for a specific account type
   */
  getTotalDebitsByType(type: AccountType): MonetaryAmount {
    const items = this.getLineItemsByType(type)
    const total = ReadonlyArray.reduce(
      items,
      BigDecimal.fromBigInt(0n),
      (sum, item) => BigDecimal.sum(sum, item.debitBalance.amount)
    )
    return MonetaryAmount.fromBigDecimal(total, this.totalDebits.currency)
  }

  /**
   * Get total credits for a specific account type
   */
  getTotalCreditsByType(type: AccountType): MonetaryAmount {
    const items = this.getLineItemsByType(type)
    const total = ReadonlyArray.reduce(
      items,
      BigDecimal.fromBigInt(0n),
      (sum, item) => BigDecimal.sum(sum, item.creditBalance.amount)
    )
    return MonetaryAmount.fromBigDecimal(total, this.totalCredits.currency)
  }
}

/**
 * Type guard for TrialBalanceReport
 */
export const isTrialBalanceReport = Schema.is(TrialBalanceReport)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * TrialBalanceRepository - Repository interface for fetching data needed for trial balance
 */
export interface TrialBalanceRepositoryService {
  /**
   * Get all active accounts for a company
   *
   * @param companyId - The company ID
   * @returns Effect containing array of accounts
   */
  readonly getAccountsForCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<Account>>

  /**
   * Get the functional currency for a company
   *
   * @param companyId - The company ID
   * @returns Effect containing the currency or None if company not found
   */
  readonly getCompanyFunctionalCurrency: (
    companyId: CompanyId
  ) => Effect.Effect<Option.Option<CurrencyCode>>

  /**
   * Get all posted journal entries with lines for a company
   *
   * @param companyId - The company ID
   * @returns Effect containing array of journal entries with their lines
   */
  readonly getPostedJournalEntriesWithLines: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntryWithLines>>
}

/**
 * TrialBalanceRepository Context.Tag
 */
export class TrialBalanceRepository extends Context.Tag("TrialBalanceRepository")<
  TrialBalanceRepository,
  TrialBalanceRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * GenerateTrialBalanceInput - Input for generating a trial balance report
 */
export interface GenerateTrialBalanceInput {
  /** The company ID */
  readonly companyId: CompanyId
  /** The as-of date for the trial balance */
  readonly asOfDate: LocalDate
  /** Optional: Include only accounts with non-zero balances (default: true) */
  readonly excludeZeroBalances?: boolean
  /** Optional: Period start date for period-based trial balance */
  readonly periodStartDate?: LocalDate
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * TrialBalanceService - Service interface for generating trial balance reports
 */
export interface TrialBalanceServiceShape {
  /**
   * Generate a trial balance report for a company as of a specific date
   *
   * This shows cumulative balances from all posted journal entries
   * up to and including the as-of date.
   *
   * @param input - The input parameters
   * @returns Effect containing the trial balance report
   * @throws CompanyNotFoundError if the company doesn't exist
   * @throws TrialBalanceNotBalancedError if debits don't equal credits
   */
  readonly generateTrialBalance: (
    input: GenerateTrialBalanceInput
  ) => Effect.Effect<
    TrialBalanceReport,
    CompanyNotFoundError | TrialBalanceNotBalancedError,
    never
  >
}

/**
 * TrialBalanceService Context.Tag
 */
export class TrialBalanceService extends Context.Tag("TrialBalanceService")<
  TrialBalanceService,
  TrialBalanceServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the TrialBalanceService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* TrialBalanceRepository

  return {
    generateTrialBalance: (input: GenerateTrialBalanceInput) =>
      Effect.gen(function* () {
        const {
          companyId,
          asOfDate,
          excludeZeroBalances = true,
          periodStartDate
        } = input

        // Get company's functional currency
        const currencyOption = yield* repository.getCompanyFunctionalCurrency(companyId)
        if (Option.isNone(currencyOption)) {
          return yield* Effect.fail(
            new CompanyNotFoundError({ companyId })
          )
        }
        const functionalCurrency = currencyOption.value

        // Get all accounts for the company
        const accounts = yield* repository.getAccountsForCompany(companyId)

        // Get all posted journal entries with lines
        const entries = yield* repository.getPostedJournalEntriesWithLines(companyId)

        // Calculate balances for each account
        const lineItems: TrialBalanceLineItem[] = []
        let totalDebits = BigDecimal.fromBigInt(0n)
        let totalCredits = BigDecimal.fromBigInt(0n)

        for (const account of accounts) {
          // Skip non-postable (summary) accounts
          if (!account.isPostable) {
            continue
          }

          // Calculate debit and credit totals for this account
          const { totalDebits: accountDebits, totalCredits: accountCredits } = periodStartDate
            ? calculatePeriodDebitCreditTotals(
                account.id,
                entries,
                periodStartDate,
                asOfDate,
                functionalCurrency
              )
            : calculateDebitCreditTotals(
                account.id,
                entries,
                asOfDate,
                functionalCurrency
              )

          // For trial balance, we show the balance in the appropriate column
          const netDebits = accountDebits.amount
          const netCredits = accountCredits.amount

          // Calculate net balance
          const netBalance = BigDecimal.subtract(netDebits, netCredits)

          // Skip zero balances if requested
          if (excludeZeroBalances && BigDecimal.isZero(netBalance)) {
            continue
          }

          // Determine which column to show the balance in
          // If net balance is positive (debits > credits), show in debit column
          // If net balance is negative (credits > debits), show in credit column
          let debitBalance: MonetaryAmount
          let creditBalance: MonetaryAmount

          if (BigDecimal.greaterThanOrEqualTo(netBalance, BigDecimal.fromBigInt(0n))) {
            // Net debit balance - show in debit column
            debitBalance = MonetaryAmount.fromBigDecimal(netBalance, functionalCurrency)
            creditBalance = MonetaryAmount.zero(functionalCurrency)
          } else {
            // Net credit balance - show in credit column (as positive amount)
            debitBalance = MonetaryAmount.zero(functionalCurrency)
            creditBalance = MonetaryAmount.fromBigDecimal(BigDecimal.abs(netBalance), functionalCurrency)
          }

          // Add to totals
          totalDebits = BigDecimal.sum(totalDebits, debitBalance.amount)
          totalCredits = BigDecimal.sum(totalCredits, creditBalance.amount)

          lineItems.push(
            TrialBalanceLineItem.make({
              accountId: account.id,
              accountNumber: account.accountNumber,
              accountName: account.name,
              accountType: account.accountType,
              accountCategory: account.accountCategory,
              normalBalance: account.normalBalance,
              debitBalance,
              creditBalance
            })
          )
        }

        // Sort line items by account number
        const lineItemOrder: Order.Order<TrialBalanceLineItem> = Order.make(
          (a, b) => a.accountNumber < b.accountNumber ? -1 : a.accountNumber > b.accountNumber ? 1 : 0
        )
        const sortedLineItems = ReadonlyArray.sort(lineItems, lineItemOrder)

        const totalDebitsAmount = MonetaryAmount.fromBigDecimal(totalDebits, functionalCurrency)
        const totalCreditsAmount = MonetaryAmount.fromBigDecimal(totalCredits, functionalCurrency)

        // Validate that debits equal credits
        const isBalanced = BigDecimal.equals(totalDebits, totalCredits)
        if (!isBalanced) {
          return yield* Effect.fail(
            new TrialBalanceNotBalancedError({
              companyId,
              asOfDate: {
                year: asOfDate.year,
                month: asOfDate.month,
                day: asOfDate.day
              },
              totalDebits: totalDebitsAmount,
              totalCredits: totalCreditsAmount
            })
          )
        }

        // Generate timestamp
        const generatedAt = yield* timestampNowEffect

        // Create metadata
        const metadata = TrialBalanceReportMetadata.make({
          companyId,
          asOfDate,
          periodStartDate: periodStartDate ? Option.some(periodStartDate) : Option.none(),
          currency: functionalCurrency,
          generatedAt,
          accountCount: sortedLineItems.length,
          isBalanced
        })

        // Create and return the report
        return TrialBalanceReport.make({
          metadata,
          lineItems: sortedLineItems,
          totalDebits: totalDebitsAmount,
          totalCredits: totalCreditsAmount
        })
      })
  } satisfies TrialBalanceServiceShape
})

/**
 * TrialBalanceServiceLive - Live implementation of TrialBalanceService
 *
 * Requires TrialBalanceRepository
 */
export const TrialBalanceServiceLive: Layer.Layer<
  TrialBalanceService,
  never,
  TrialBalanceRepository
> = Layer.effect(TrialBalanceService, make)

// =============================================================================
// Pure Functions for Direct Use (without repository)
// =============================================================================

/**
 * Generate a trial balance from provided accounts and journal entries
 *
 * This is a pure function that can be used directly without the service layer
 * when all data is already available in memory.
 *
 * @param companyId - The company ID
 * @param accounts - All accounts for the company
 * @param entries - All posted journal entries with lines
 * @param asOfDate - The as-of date for the trial balance
 * @param functionalCurrency - The functional currency for calculations
 * @param options - Optional parameters
 * @returns Effect containing the trial balance report
 */
export const generateTrialBalanceFromData = (
  companyId: CompanyId,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode,
  options?: {
    excludeZeroBalances?: boolean
    periodStartDate?: LocalDate
  }
): Effect.Effect<TrialBalanceReport, TrialBalanceNotBalancedError> =>
  Effect.gen(function* () {
    const { excludeZeroBalances = true, periodStartDate } = options ?? {}

    // Calculate balances for each account
    const lineItems: TrialBalanceLineItem[] = []
    let totalDebits = BigDecimal.fromBigInt(0n)
    let totalCredits = BigDecimal.fromBigInt(0n)

    for (const account of accounts) {
      // Skip non-postable (summary) accounts
      if (!account.isPostable) {
        continue
      }

      // Calculate debit and credit totals for this account
      const { totalDebits: accountDebits, totalCredits: accountCredits } = periodStartDate
        ? calculatePeriodDebitCreditTotals(
            account.id,
            entries,
            periodStartDate,
            asOfDate,
            functionalCurrency
          )
        : calculateDebitCreditTotals(
            account.id,
            entries,
            asOfDate,
            functionalCurrency
          )

      // Calculate net balance
      const netDebits = accountDebits.amount
      const netCredits = accountCredits.amount
      const netBalance = BigDecimal.subtract(netDebits, netCredits)

      // Skip zero balances if requested
      if (excludeZeroBalances && BigDecimal.isZero(netBalance)) {
        continue
      }

      // Determine which column to show the balance in
      let debitBalance: MonetaryAmount
      let creditBalance: MonetaryAmount

      if (BigDecimal.greaterThanOrEqualTo(netBalance, BigDecimal.fromBigInt(0n))) {
        // Net debit balance - show in debit column
        debitBalance = MonetaryAmount.fromBigDecimal(netBalance, functionalCurrency)
        creditBalance = MonetaryAmount.zero(functionalCurrency)
      } else {
        // Net credit balance - show in credit column (as positive amount)
        debitBalance = MonetaryAmount.zero(functionalCurrency)
        creditBalance = MonetaryAmount.fromBigDecimal(BigDecimal.abs(netBalance), functionalCurrency)
      }

      // Add to totals
      totalDebits = BigDecimal.sum(totalDebits, debitBalance.amount)
      totalCredits = BigDecimal.sum(totalCredits, creditBalance.amount)

      lineItems.push(
        TrialBalanceLineItem.make({
          accountId: account.id,
          accountNumber: account.accountNumber,
          accountName: account.name,
          accountType: account.accountType,
          accountCategory: account.accountCategory,
          normalBalance: account.normalBalance,
          debitBalance,
          creditBalance
        })
      )
    }

    // Sort line items by account number
    const lineItemOrder: Order.Order<TrialBalanceLineItem> = Order.make(
      (a, b) => a.accountNumber < b.accountNumber ? -1 : a.accountNumber > b.accountNumber ? 1 : 0
    )
    const sortedLineItems = ReadonlyArray.sort(lineItems, lineItemOrder)

    const totalDebitsAmount = MonetaryAmount.fromBigDecimal(totalDebits, functionalCurrency)
    const totalCreditsAmount = MonetaryAmount.fromBigDecimal(totalCredits, functionalCurrency)

    // Validate that debits equal credits
    const isBalanced = BigDecimal.equals(totalDebits, totalCredits)
    if (!isBalanced) {
      return yield* Effect.fail(
        new TrialBalanceNotBalancedError({
          companyId,
          asOfDate: {
            year: asOfDate.year,
            month: asOfDate.month,
            day: asOfDate.day
          },
          totalDebits: totalDebitsAmount,
          totalCredits: totalCreditsAmount
        })
      )
    }

    // Generate timestamp
    const generatedAt = yield* timestampNowEffect

    // Create metadata
    const metadata = TrialBalanceReportMetadata.make({
      companyId,
      asOfDate,
      periodStartDate: periodStartDate ? Option.some(periodStartDate) : Option.none(),
      currency: functionalCurrency,
      generatedAt,
      accountCount: sortedLineItems.length,
      isBalanced
    })

    // Create and return the report
    return TrialBalanceReport.make({
      metadata,
      lineItems: sortedLineItems,
      totalDebits: totalDebitsAmount,
      totalCredits: totalCreditsAmount
    })
  })
