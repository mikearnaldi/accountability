/**
 * CashFlowStatementService - Cash Flow Statement Report generation service
 *
 * Implements cash flow statement report generation per ASC 230 and specs/ACCOUNTING_RESEARCH.md Phase 3.4:
 * - CashFlowStatementReport schema
 * - generateCashFlowStatement: (companyId, periodStart, periodEnd) -> Effect<CashFlowStatementReport>
 * - Operating activities using indirect method (start with Net Income, adjust for non-cash items)
 * - Investing activities (capital expenditures, asset sales, investments)
 * - Financing activities (debt, equity, dividends)
 * - Net change in cash reconciles to balance sheet cash movement
 * - Supplemental disclosures: Interest paid, Taxes paid
 *
 * Per ASC 230, the indirect method starts with net income and adjusts for:
 * 1. Non-cash items (depreciation, amortization, gains/losses)
 * 2. Changes in working capital accounts (receivables, payables, inventory, etc.)
 *
 * @module CashFlowStatementService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as ReadonlyArray from "effect/Array"
import * as Schema from "effect/Schema"
import type {
  Account} from "../accounting/Account.ts";
import {
  AccountId,
  getNormalBalanceForType
} from "../accounting/Account.ts"
import { CompanyId } from "../company/Company.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { LocalDate } from "../shared/values/LocalDate.ts"
import { MonetaryAmount } from "../shared/values/MonetaryAmount.ts"
import { Timestamp, nowEffect as timestampNowEffect } from "../shared/values/Timestamp.ts"
import type { JournalEntryWithLines } from "../accounting/AccountBalance.ts"
import {
  calculateBalance,
  calculatePeriodBalance
} from "../accounting/AccountBalance.ts"

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
 * Error for invalid period (start date after end date)
 */
export class InvalidPeriodError extends Schema.TaggedError<InvalidPeriodError>()(
  "InvalidPeriodError",
  {
    periodStart: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    periodEnd: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    })
  }
) {
  get message(): string {
    const startStr = `${this.periodStart.year}-${String(this.periodStart.month).padStart(2, "0")}-${String(this.periodStart.day).padStart(2, "0")}`
    const endStr = `${this.periodEnd.year}-${String(this.periodEnd.month).padStart(2, "0")}-${String(this.periodEnd.day).padStart(2, "0")}`
    return `Invalid period: start date ${startStr} is after end date ${endStr}`
  }
}

/**
 * Type guard for InvalidPeriodError
 */
export const isInvalidPeriodError = Schema.is(InvalidPeriodError)

/**
 * Error when cash flow reconciliation fails
 */
export class CashFlowReconciliationError extends Schema.TaggedError<CashFlowReconciliationError>()(
  "CashFlowReconciliationError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    expectedChange: MonetaryAmount,
    actualChange: MonetaryAmount
  }
) {
  get message(): string {
    return `Cash flow reconciliation failed for company ${this.companyId}: expected change ${this.expectedChange.format()}, actual net cash change ${this.actualChange.format()}`
  }
}

/**
 * Type guard for CashFlowReconciliationError
 */
export const isCashFlowReconciliationError = Schema.is(CashFlowReconciliationError)

/**
 * Union type for all cash flow statement service errors
 */
export type CashFlowStatementServiceError =
  | CompanyNotFoundError
  | InvalidPeriodError
  | CashFlowReconciliationError

// =============================================================================
// Line Item Types
// =============================================================================

/**
 * LineItemStyle - Visual style for report line items
 */
export const LineItemStyle = Schema.Literal(
  "Normal",
  "Subtotal",
  "Total",
  "Header"
).annotations({
  identifier: "LineItemStyle",
  title: "Line Item Style",
  description: "Visual style for a report line item"
})

export type LineItemStyle = typeof LineItemStyle.Type

/**
 * CashFlowLineItem - A single line in the cash flow statement report
 *
 * Represents either a cash flow adjustment, subtotal, or section total.
 */
export class CashFlowLineItem extends Schema.Class<CashFlowLineItem>("CashFlowLineItem")({
  /**
   * Optional account reference (null for subtotals/totals/adjustments)
   */
  accountId: Schema.OptionFromNullOr(AccountId),

  /**
   * Optional account number (for display/sorting)
   */
  accountNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),

  /**
   * Description text (account name, adjustment description, or subtotal label)
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * The cash flow amount (positive = cash inflow, negative = cash outflow)
   */
  amount: MonetaryAmount,

  /**
   * Whether this is a subtotal line
   */
  isSubtotal: Schema.Boolean,

  /**
   * Indent level for hierarchical display
   */
  indentLevel: Schema.Number,

  /**
   * Visual style for the line
   */
  style: LineItemStyle
}) {
  /**
   * Check if this is an account line (not a subtotal/total)
   */
  get isAccountLine(): boolean {
    return Option.isSome(this.accountId)
  }

  /**
   * Check if this is a total line
   */
  get isTotalLine(): boolean {
    return this.style === "Total"
  }

  /**
   * Check if this is a header line
   */
  get isHeaderLine(): boolean {
    return this.style === "Header"
  }

  /**
   * Check if this represents a cash inflow
   */
  get isCashInflow(): boolean {
    return this.amount.isPositive
  }

  /**
   * Check if this represents a cash outflow
   */
  get isCashOutflow(): boolean {
    return this.amount.isNegative
  }
}

/**
 * Type guard for CashFlowLineItem
 */
export const isCashFlowLineItem = Schema.is(CashFlowLineItem)

// =============================================================================
// Section Types
// =============================================================================

/**
 * CashFlowSectionType - The main sections of a cash flow statement
 *
 * Per ASC 230:
 * - Operating: Cash flows from principal revenue-producing activities
 * - Investing: Cash flows from acquiring/disposing long-term assets
 * - Financing: Cash flows from debt, equity, and dividend transactions
 */
export const CashFlowSectionType = Schema.Literal(
  "Operating",
  "Investing",
  "Financing"
).annotations({
  identifier: "CashFlowSectionType",
  title: "Cash Flow Section Type",
  description: "The main sections of a cash flow statement per ASC 230"
})

export type CashFlowSectionType = typeof CashFlowSectionType.Type

/**
 * Get the display name for a cash flow section
 */
export const getSectionDisplayName = (section: CashFlowSectionType): string => {
  switch (section) {
    case "Operating":
      return "Cash Flows from Operating Activities"
    case "Investing":
      return "Cash Flows from Investing Activities"
    case "Financing":
      return "Cash Flows from Financing Activities"
  }
}

/**
 * OperatingActivityAdjustment - A single adjustment in the operating activities section
 *
 * For the indirect method, we track:
 * - Net income (starting point)
 * - Adjustments for non-cash items
 * - Changes in working capital
 */
export class OperatingActivityAdjustment extends Schema.Class<OperatingActivityAdjustment>("OperatingActivityAdjustment")({
  /**
   * Description of the adjustment
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * The adjustment amount (positive = add back to net income, negative = subtract)
   */
  amount: MonetaryAmount,

  /**
   * Whether this is a non-cash adjustment (depreciation, etc.) vs working capital change
   */
  isNonCashAdjustment: Schema.Boolean,

  /**
   * Indent level for display
   */
  indentLevel: Schema.Number
}) {}

/**
 * Type guard for OperatingActivityAdjustment
 */
export const isOperatingActivityAdjustment = Schema.is(OperatingActivityAdjustment)

/**
 * OperatingActivitiesSection - Operating activities using indirect method
 *
 * Per ASC 230, starts with net income and adjusts for non-cash items
 * and changes in working capital accounts.
 */
export class OperatingActivitiesSection extends Schema.Class<OperatingActivitiesSection>("OperatingActivitiesSection")({
  /**
   * Net income (starting point for indirect method)
   */
  netIncome: MonetaryAmount,

  /**
   * Adjustments for non-cash items (depreciation, amortization, etc.)
   */
  nonCashAdjustments: Schema.Array(OperatingActivityAdjustment),

  /**
   * Subtotal of non-cash adjustments
   */
  nonCashAdjustmentsSubtotal: MonetaryAmount,

  /**
   * Changes in working capital accounts
   */
  workingCapitalChanges: Schema.Array(OperatingActivityAdjustment),

  /**
   * Subtotal of working capital changes
   */
  workingCapitalChangesSubtotal: MonetaryAmount,

  /**
   * Net cash from operating activities
   */
  netCashFromOperating: MonetaryAmount
}) {
  /**
   * Get all line items for display
   */
  get lineItems(): ReadonlyArray<CashFlowLineItem> {
    const items: CashFlowLineItem[] = []

    // Net Income header
    items.push(
      CashFlowLineItem.make({
        accountId: Option.none(),
        accountNumber: Option.none(),
        description: "Net Income",
        amount: this.netIncome,
        isSubtotal: false,
        indentLevel: 0,
        style: "Normal"
      })
    )

    // Non-cash adjustments
    if (this.nonCashAdjustments.length > 0) {
      items.push(
        CashFlowLineItem.make({
          accountId: Option.none(),
          accountNumber: Option.none(),
          description: "Adjustments for non-cash items:",
          amount: MonetaryAmount.zero(this.netIncome.currency),
          isSubtotal: false,
          indentLevel: 0,
          style: "Header"
        })
      )

      for (const adj of this.nonCashAdjustments) {
        items.push(
          CashFlowLineItem.make({
            accountId: Option.none(),
            accountNumber: Option.none(),
            description: adj.description,
            amount: adj.amount,
            isSubtotal: false,
            indentLevel: 1,
            style: "Normal"
          })
        )
      }
    }

    // Working capital changes
    if (this.workingCapitalChanges.length > 0) {
      items.push(
        CashFlowLineItem.make({
          accountId: Option.none(),
          accountNumber: Option.none(),
          description: "Changes in working capital:",
          amount: MonetaryAmount.zero(this.netIncome.currency),
          isSubtotal: false,
          indentLevel: 0,
          style: "Header"
        })
      )

      for (const change of this.workingCapitalChanges) {
        items.push(
          CashFlowLineItem.make({
            accountId: Option.none(),
            accountNumber: Option.none(),
            description: change.description,
            amount: change.amount,
            isSubtotal: false,
            indentLevel: 1,
            style: "Normal"
          })
        )
      }
    }

    // Net cash from operating
    items.push(
      CashFlowLineItem.make({
        accountId: Option.none(),
        accountNumber: Option.none(),
        description: "Net Cash from Operating Activities",
        amount: this.netCashFromOperating,
        isSubtotal: true,
        indentLevel: 0,
        style: "Total"
      })
    )

    return items
  }
}

/**
 * Type guard for OperatingActivitiesSection
 */
export const isOperatingActivitiesSection = Schema.is(OperatingActivitiesSection)

/**
 * CashFlowSection - A section of the cash flow statement (Investing or Financing)
 *
 * Contains line items and a subtotal for the section.
 */
export class CashFlowSection extends Schema.Class<CashFlowSection>("CashFlowSection")({
  /**
   * The section type
   */
  sectionType: CashFlowSectionType,

  /**
   * Display name for the section
   */
  displayName: Schema.NonEmptyTrimmedString,

  /**
   * Line items in this section
   */
  lineItems: Schema.Array(CashFlowLineItem),

  /**
   * Subtotal for this section
   */
  subtotal: MonetaryAmount
}) {
  /**
   * Get the number of line items (excluding subtotals)
   */
  get itemCount(): number {
    return ReadonlyArray.filter(
      this.lineItems,
      (item) => !item.isSubtotal && !item.isHeaderLine
    ).length
  }

  /**
   * Check if the section has any items
   */
  get hasItems(): boolean {
    return this.itemCount > 0
  }

  /**
   * Check if this section represents net cash inflow
   */
  get isNetInflow(): boolean {
    return this.subtotal.isPositive
  }

  /**
   * Check if this section represents net cash outflow
   */
  get isNetOutflow(): boolean {
    return this.subtotal.isNegative
  }
}

/**
 * Type guard for CashFlowSection
 */
export const isCashFlowSection = Schema.is(CashFlowSection)

// =============================================================================
// Supplemental Disclosures
// =============================================================================

/**
 * SupplementalDisclosures - Required supplemental disclosures per ASC 230
 *
 * These are required to be disclosed regardless of method used.
 */
export class SupplementalDisclosures extends Schema.Class<SupplementalDisclosures>("SupplementalDisclosures")({
  /**
   * Interest paid during the period (net of capitalized amounts)
   */
  interestPaid: MonetaryAmount,

  /**
   * Income taxes paid during the period
   */
  incomesTaxesPaid: MonetaryAmount,

  /**
   * Significant non-cash investing and financing activities
   * (e.g., acquiring assets by assuming liabilities, converting debt to equity)
   */
  nonCashActivities: Schema.Array(
    Schema.Struct({
      description: Schema.NonEmptyTrimmedString,
      amount: MonetaryAmount
    })
  )
}) {}

/**
 * Type guard for SupplementalDisclosures
 */
export const isSupplementalDisclosures = Schema.is(SupplementalDisclosures)

// =============================================================================
// Report Types
// =============================================================================

/**
 * CashFlowStatementReportMetadata - Metadata about the cash flow statement report
 */
export class CashFlowStatementReportMetadata extends Schema.Class<CashFlowStatementReportMetadata>("CashFlowStatementReportMetadata")({
  /**
   * The company ID
   */
  companyId: CompanyId,

  /**
   * The period start date
   */
  periodStart: LocalDate,

  /**
   * The period end date
   */
  periodEnd: LocalDate,

  /**
   * The presentation currency used for the report
   */
  currency: CurrencyCode,

  /**
   * When the report was generated
   */
  generatedAt: Timestamp,

  /**
   * Method used (Indirect for this implementation)
   */
  method: Schema.Literal("Indirect")
}) {}

/**
 * Type guard for CashFlowStatementReportMetadata
 */
export const isCashFlowStatementReportMetadata = Schema.is(CashFlowStatementReportMetadata)

/**
 * CashFlowStatementReport - Complete cash flow statement report (indirect method)
 *
 * Per ASC 230, this implements the indirect method cash flow statement:
 * - Operating: Net income + adjustments for non-cash items + working capital changes
 * - Investing: Capital expenditures, asset sales, investment purchases/sales
 * - Financing: Debt proceeds/payments, equity transactions, dividends
 * - Net change reconciles to cash movement on balance sheet
 */
export class CashFlowStatementReport extends Schema.Class<CashFlowStatementReport>("CashFlowStatementReport")({
  /**
   * Report metadata
   */
  metadata: CashFlowStatementReportMetadata,

  /**
   * Beginning cash and cash equivalents
   */
  beginningCash: MonetaryAmount,

  /**
   * Operating activities section (indirect method)
   */
  operatingActivities: OperatingActivitiesSection,

  /**
   * Investing activities section
   */
  investingActivities: CashFlowSection,

  /**
   * Financing activities section
   */
  financingActivities: CashFlowSection,

  /**
   * Effect of exchange rate changes on cash (for multi-currency companies)
   */
  exchangeRateEffect: MonetaryAmount,

  /**
   * Net increase/decrease in cash
   */
  netChangeInCash: MonetaryAmount,

  /**
   * Ending cash and cash equivalents
   */
  endingCash: MonetaryAmount,

  /**
   * Supplemental disclosures (interest paid, taxes paid, non-cash activities)
   */
  supplementalDisclosures: SupplementalDisclosures
}) {
  /**
   * Check if the cash flow statement reconciles
   * (Beginning + Net Change = Ending)
   */
  get isReconciled(): boolean {
    const expectedEnding = BigDecimal.sum(this.beginningCash.amount, this.netChangeInCash.amount)
    return BigDecimal.equals(expectedEnding, this.endingCash.amount)
  }

  /**
   * Check if the net change equals the sum of all sections plus exchange effect
   */
  get sectionsReconcile(): boolean {
    const sumOfSections = BigDecimal.sum(
      BigDecimal.sum(
        BigDecimal.sum(
          this.operatingActivities.netCashFromOperating.amount,
          this.investingActivities.subtotal.amount
        ),
        this.financingActivities.subtotal.amount
      ),
      this.exchangeRateEffect.amount
    )
    return BigDecimal.equals(sumOfSections, this.netChangeInCash.amount)
  }

  /**
   * Get the net cash from operating activities
   */
  get netCashFromOperating(): MonetaryAmount {
    return this.operatingActivities.netCashFromOperating
  }

  /**
   * Get the net cash from investing activities
   */
  get netCashFromInvesting(): MonetaryAmount {
    return this.investingActivities.subtotal
  }

  /**
   * Get the net cash from financing activities
   */
  get netCashFromFinancing(): MonetaryAmount {
    return this.financingActivities.subtotal
  }

  /**
   * Check if overall cash position increased
   */
  get cashIncreased(): boolean {
    return this.netChangeInCash.isPositive
  }

  /**
   * Check if overall cash position decreased
   */
  get cashDecreased(): boolean {
    return this.netChangeInCash.isNegative
  }
}

/**
 * Type guard for CashFlowStatementReport
 */
export const isCashFlowStatementReport = Schema.is(CashFlowStatementReport)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * CashFlowStatementRepository - Repository interface for fetching data needed for cash flow statement
 */
export interface CashFlowStatementRepositoryService {
  /**
   * Get all active accounts for a company
   */
  readonly getAccountsForCompany: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<Account>>

  /**
   * Get the functional currency for a company
   */
  readonly getCompanyFunctionalCurrency: (
    companyId: CompanyId
  ) => Effect.Effect<Option.Option<CurrencyCode>>

  /**
   * Get all posted journal entries with lines for a company
   */
  readonly getPostedJournalEntriesWithLines: (
    companyId: CompanyId
  ) => Effect.Effect<ReadonlyArray<JournalEntryWithLines>>
}

/**
 * CashFlowStatementRepository Context.Tag
 */
export class CashFlowStatementRepository extends Context.Tag("CashFlowStatementRepository")<
  CashFlowStatementRepository,
  CashFlowStatementRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * GenerateCashFlowStatementInput - Input for generating a cash flow statement report
 */
export interface GenerateCashFlowStatementInput {
  /** The company ID */
  readonly companyId: CompanyId
  /** The period start date */
  readonly periodStart: LocalDate
  /** The period end date */
  readonly periodEnd: LocalDate
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if periodStart is before or equal to periodEnd
 */
const isValidPeriod = (periodStart: LocalDate, periodEnd: LocalDate): boolean => {
  if (periodStart.year < periodEnd.year) return true
  if (periodStart.year > periodEnd.year) return false
  if (periodStart.month < periodEnd.month) return true
  if (periodStart.month > periodEnd.month) return false
  return periodStart.day <= periodEnd.day
}

/**
 * Get the day before periodStart for beginning balance calculation
 */
const getDayBefore = (date: LocalDate): LocalDate => {
  // Simple implementation: subtract one day
  // Handle month/year boundaries
  if (date.day > 1) {
    return LocalDate.make({ year: date.year, month: date.month, day: date.day - 1 })
  } else if (date.month > 1) {
    // First day of month, go to last day of previous month
    const prevMonth = date.month - 1
    const daysInPrevMonth = getDaysInMonth(date.year, prevMonth)
    return LocalDate.make({ year: date.year, month: prevMonth, day: daysInPrevMonth })
  } else {
    // January 1st, go to December 31st of previous year
    return LocalDate.make({ year: date.year - 1, month: 12, day: 31 })
  }
}

/**
 * Get days in a month
 */
const getDaysInMonth = (year: number, month: number): number => {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
    case 2:
      // Leap year check
      return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
    default:
      return 30
  }
}

/**
 * Check if an account is a cash account
 *
 * Cash accounts are identified by:
 * - Being a CurrentAsset
 * - Having a name that contains "cash" (case-insensitive)
 *
 * This is the standard convention for identifying cash and cash equivalents
 * for the statement of cash flows.
 */
const isCashAccount = (account: Account): boolean => {
  return (
    account.accountCategory === "CurrentAsset" &&
    account.name.toLowerCase().includes("cash")
  )
}

/**
 * Check if an account is a current asset (working capital)
 */
const isCurrentAssetWorkingCapital = (account: Account): boolean => {
  return account.accountCategory === "CurrentAsset" && !isCashAccount(account)
}

/**
 * Check if an account is a current liability (working capital)
 */
const isCurrentLiabilityWorkingCapital = (account: Account): boolean => {
  return account.accountCategory === "CurrentLiability"
}

/**
 * Check if an account is a depreciation/amortization expense
 */
const isDepreciationOrAmortization = (account: Account): boolean => {
  return account.accountCategory === "DepreciationAmortization"
}

/**
 * Check if an account is an interest expense
 */
const isInterestExpense = (account: Account): boolean => {
  return account.accountCategory === "InterestExpense"
}

/**
 * Check if an account is a tax expense
 */
const isTaxExpense = (account: Account): boolean => {
  return account.accountCategory === "TaxExpense"
}

/**
 * Check if an account is a fixed asset (investing)
 */
const isFixedAsset = (account: Account): boolean => {
  return (
    account.accountCategory === "FixedAsset" ||
    account.accountCategory === "IntangibleAsset" ||
    account.accountCategory === "NonCurrentAsset"
  )
}

/**
 * Check if an account is a debt account (financing)
 */
const isDebtAccount = (account: Account): boolean => {
  return (
    account.accountCategory === "NonCurrentLiability" ||
    (account.accountCategory === "CurrentLiability" &&
      account.name.toLowerCase().includes("loan"))
  )
}

/**
 * Check if an account is an equity account (financing)
 */
const isEquityAccount = (account: Account): boolean => {
  return (
    account.accountCategory === "ContributedCapital" ||
    account.accountCategory === "TreasuryStock" ||
    (account.accountCategory === "RetainedEarnings" &&
      account.name.toLowerCase().includes("dividend"))
  )
}

/**
 * Calculate net income from income statement accounts
 */
const calculateNetIncome = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let revenue = BigDecimal.fromBigInt(0n)
  let expenses = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    if (account.accountType === "Revenue") {
      revenue = BigDecimal.sum(revenue, balance.amount)
    } else if (account.accountType === "Expense") {
      expenses = BigDecimal.sum(expenses, balance.amount)
    }
  }

  return MonetaryAmount.fromBigDecimal(
    BigDecimal.subtract(revenue, expenses),
    functionalCurrency
  )
}

/**
 * Calculate depreciation and amortization for the period
 */
const calculateDepreciationAmortization = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable || !isDepreciationOrAmortization(account)) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Depreciation is an expense (debit balance), but we add it back as a non-cash item
    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

/**
 * Calculate working capital changes
 *
 * For working capital accounts:
 * - Increase in current assets = cash outflow (negative)
 * - Decrease in current assets = cash inflow (positive)
 * - Increase in current liabilities = cash inflow (positive)
 * - Decrease in current liabilities = cash outflow (negative)
 */
const calculateWorkingCapitalChanges = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): {
  changes: ReadonlyArray<OperatingActivityAdjustment>
  total: MonetaryAmount
} => {
  const dayBefore = getDayBefore(periodStart)
  const changes: OperatingActivityAdjustment[] = []
  let total = BigDecimal.fromBigInt(0n)

  // Sort accounts by account number
  const accountOrder: Order.Order<Account> = Order.make(
    (a, b) =>
      a.accountNumber < b.accountNumber
        ? -1
        : a.accountNumber > b.accountNumber
          ? 1
          : 0
  )
  const sortedAccounts = ReadonlyArray.sort(accounts, accountOrder)

  for (const account of sortedAccounts) {
    if (!account.isPostable) continue

    const normalBalance = getNormalBalanceForType(account.accountType)

    if (isCurrentAssetWorkingCapital(account)) {
      // Current assets (excluding cash)
      const beginningBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        dayBefore,
        functionalCurrency
      )
      const endingBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        periodEnd,
        functionalCurrency
      )

      const change = BigDecimal.subtract(endingBalance.amount, beginningBalance.amount)

      // Skip if no change
      if (BigDecimal.isZero(change)) continue

      // Increase in current assets = cash outflow (negate)
      const cashImpact = BigDecimal.negate(change)

      changes.push(
        OperatingActivityAdjustment.make({
          description: `Change in ${account.name}`,
          amount: MonetaryAmount.fromBigDecimal(cashImpact, functionalCurrency),
          isNonCashAdjustment: false,
          indentLevel: 1
        })
      )

      total = BigDecimal.sum(total, cashImpact)
    } else if (isCurrentLiabilityWorkingCapital(account)) {
      // Current liabilities
      const beginningBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        dayBefore,
        functionalCurrency
      )
      const endingBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        periodEnd,
        functionalCurrency
      )

      const change = BigDecimal.subtract(endingBalance.amount, beginningBalance.amount)

      // Skip if no change
      if (BigDecimal.isZero(change)) continue

      // Increase in current liabilities = cash inflow (same sign)
      changes.push(
        OperatingActivityAdjustment.make({
          description: `Change in ${account.name}`,
          amount: MonetaryAmount.fromBigDecimal(change, functionalCurrency),
          isNonCashAdjustment: false,
          indentLevel: 1
        })
      )

      total = BigDecimal.sum(total, change)
    }
  }

  return {
    changes,
    total: MonetaryAmount.fromBigDecimal(total, functionalCurrency)
  }
}

/**
 * Calculate investing activities
 *
 * Investing activities include:
 * - Purchase of fixed assets (outflow)
 * - Sale of fixed assets (inflow)
 * - Purchase of investments (outflow)
 * - Sale of investments (inflow)
 */
const calculateInvestingActivities = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): {
  lineItems: ReadonlyArray<CashFlowLineItem>
  total: MonetaryAmount
} => {
  const dayBefore = getDayBefore(periodStart)
  const lineItems: CashFlowLineItem[] = []
  let total = BigDecimal.fromBigInt(0n)

  // Sort accounts by account number
  const accountOrder: Order.Order<Account> = Order.make(
    (a, b) =>
      a.accountNumber < b.accountNumber
        ? -1
        : a.accountNumber > b.accountNumber
          ? 1
          : 0
  )
  const sortedAccounts = ReadonlyArray.sort(accounts, accountOrder)

  for (const account of sortedAccounts) {
    if (!account.isPostable || !isFixedAsset(account)) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const beginningBalance = calculateBalance(
      account.id,
      normalBalance,
      entries,
      dayBefore,
      functionalCurrency
    )
    const endingBalance = calculateBalance(
      account.id,
      normalBalance,
      entries,
      periodEnd,
      functionalCurrency
    )

    const change = BigDecimal.subtract(endingBalance.amount, beginningBalance.amount)

    // Skip if no change
    if (BigDecimal.isZero(change)) continue

    // Increase in fixed assets = cash outflow (negate)
    // Decrease in fixed assets = cash inflow (negate)
    const cashImpact = BigDecimal.negate(change)

    const description = BigDecimal.isPositive(cashImpact)
      ? `Proceeds from sale of ${account.name}`
      : `Purchase of ${account.name}`

    lineItems.push(
      CashFlowLineItem.make({
        accountId: Option.some(account.id),
        accountNumber: Option.some(account.accountNumber),
        description,
        amount: MonetaryAmount.fromBigDecimal(cashImpact, functionalCurrency),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })
    )

    total = BigDecimal.sum(total, cashImpact)
  }

  return {
    lineItems,
    total: MonetaryAmount.fromBigDecimal(total, functionalCurrency)
  }
}

/**
 * Calculate financing activities
 *
 * Financing activities include:
 * - Proceeds from borrowings (inflow)
 * - Repayment of borrowings (outflow)
 * - Issuance of stock (inflow)
 * - Repurchase of stock (outflow)
 * - Payment of dividends (outflow)
 */
const calculateFinancingActivities = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): {
  lineItems: ReadonlyArray<CashFlowLineItem>
  total: MonetaryAmount
} => {
  const dayBefore = getDayBefore(periodStart)
  const lineItems: CashFlowLineItem[] = []
  let total = BigDecimal.fromBigInt(0n)

  // Sort accounts by account number
  const accountOrder: Order.Order<Account> = Order.make(
    (a, b) =>
      a.accountNumber < b.accountNumber
        ? -1
        : a.accountNumber > b.accountNumber
          ? 1
          : 0
  )
  const sortedAccounts = ReadonlyArray.sort(accounts, accountOrder)

  for (const account of sortedAccounts) {
    if (!account.isPostable) continue

    if (isDebtAccount(account)) {
      const normalBalance = getNormalBalanceForType(account.accountType)
      const beginningBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        dayBefore,
        functionalCurrency
      )
      const endingBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        periodEnd,
        functionalCurrency
      )

      const change = BigDecimal.subtract(endingBalance.amount, beginningBalance.amount)

      // Skip if no change
      if (BigDecimal.isZero(change)) continue

      // Increase in debt = cash inflow (same sign)
      // Decrease in debt = cash outflow (same sign)
      const description = BigDecimal.isPositive(change)
        ? `Proceeds from ${account.name}`
        : `Repayment of ${account.name}`

      lineItems.push(
        CashFlowLineItem.make({
          accountId: Option.some(account.id),
          accountNumber: Option.some(account.accountNumber),
          description,
          amount: MonetaryAmount.fromBigDecimal(change, functionalCurrency),
          isSubtotal: false,
          indentLevel: 1,
          style: "Normal"
        })
      )

      total = BigDecimal.sum(total, change)
    } else if (isEquityAccount(account)) {
      const normalBalance = getNormalBalanceForType(account.accountType)
      const beginningBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        dayBefore,
        functionalCurrency
      )
      const endingBalance = calculateBalance(
        account.id,
        normalBalance,
        entries,
        periodEnd,
        functionalCurrency
      )

      const change = BigDecimal.subtract(endingBalance.amount, beginningBalance.amount)

      // Skip if no change
      if (BigDecimal.isZero(change)) continue

      // For equity accounts:
      // - ContributedCapital increase = stock issuance (inflow)
      // - TreasuryStock increase = stock repurchase (outflow, but TreasuryStock is contra-equity)
      // - Dividends = outflow (negative change in retained earnings related to dividends)

      let cashImpact: BigDecimal.BigDecimal
      let description: string

      if (account.accountCategory === "TreasuryStock") {
        // Treasury stock is a contra-equity (debit balance)
        // Increase = cash outflow (negate)
        cashImpact = BigDecimal.negate(change)
        description = BigDecimal.isNegative(cashImpact)
          ? `Stock repurchase`
          : `Sale of treasury stock`
      } else if (account.name.toLowerCase().includes("dividend")) {
        // Dividend payments (usually a reduction in retained earnings or separate account)
        // Dividends paid = outflow
        cashImpact = BigDecimal.negate(change)
        description = `Dividends paid`
      } else {
        // Regular equity (ContributedCapital)
        // Increase = stock issuance (inflow)
        cashImpact = change
        description = BigDecimal.isPositive(change)
          ? `Proceeds from stock issuance`
          : `Stock redemption`
      }

      lineItems.push(
        CashFlowLineItem.make({
          accountId: Option.some(account.id),
          accountNumber: Option.some(account.accountNumber),
          description,
          amount: MonetaryAmount.fromBigDecimal(cashImpact, functionalCurrency),
          isSubtotal: false,
          indentLevel: 1,
          style: "Normal"
        })
      )

      total = BigDecimal.sum(total, cashImpact)
    }
  }

  return {
    lineItems,
    total: MonetaryAmount.fromBigDecimal(total, functionalCurrency)
  }
}

/**
 * Calculate cash balance at a point in time
 */
const calculateCashBalance = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable || !isCashAccount(account)) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculateBalance(
      account.id,
      normalBalance,
      entries,
      asOfDate,
      functionalCurrency
    )

    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

/**
 * Calculate interest paid for supplemental disclosure
 */
const calculateInterestPaid = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable || !isInterestExpense(account)) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

/**
 * Calculate income taxes paid for supplemental disclosure
 */
const calculateTaxesPaid = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): MonetaryAmount => {
  let total = BigDecimal.fromBigInt(0n)

  for (const account of accounts) {
    if (!account.isPostable || !isTaxExpense(account)) continue

    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    total = BigDecimal.sum(total, balance.amount)
  }

  return MonetaryAmount.fromBigDecimal(total, functionalCurrency)
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * CashFlowStatementService - Service interface for generating cash flow statement reports
 */
export interface CashFlowStatementServiceShape {
  /**
   * Generate a cash flow statement report for a company for a specific period
   *
   * @param input - The input parameters
   * @returns Effect containing the cash flow statement report
   * @throws CompanyNotFoundError if the company doesn't exist
   * @throws InvalidPeriodError if periodStart is after periodEnd
   */
  readonly generateCashFlowStatement: (
    input: GenerateCashFlowStatementInput
  ) => Effect.Effect<CashFlowStatementReport, CompanyNotFoundError | InvalidPeriodError, never>
}

/**
 * CashFlowStatementService Context.Tag
 */
export class CashFlowStatementService extends Context.Tag("CashFlowStatementService")<
  CashFlowStatementService,
  CashFlowStatementServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the CashFlowStatementService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* CashFlowStatementRepository

  return {
    generateCashFlowStatement: (input: GenerateCashFlowStatementInput) =>
      Effect.gen(function* () {
        const { companyId, periodStart, periodEnd } = input

        // Validate period
        if (!isValidPeriod(periodStart, periodEnd)) {
          return yield* Effect.fail(
            new InvalidPeriodError({
              periodStart: {
                year: periodStart.year,
                month: periodStart.month,
                day: periodStart.day
              },
              periodEnd: {
                year: periodEnd.year,
                month: periodEnd.month,
                day: periodEnd.day
              }
            })
          )
        }

        // Get company's functional currency
        const currencyOption = yield* repository.getCompanyFunctionalCurrency(companyId)
        if (Option.isNone(currencyOption)) {
          return yield* Effect.fail(new CompanyNotFoundError({ companyId }))
        }
        const functionalCurrency = currencyOption.value

        // Get all accounts for the company
        const accounts = yield* repository.getAccountsForCompany(companyId)

        // Get all posted journal entries with lines
        const entries = yield* repository.getPostedJournalEntriesWithLines(companyId)

        // Calculate beginning and ending cash balances
        const dayBefore = getDayBefore(periodStart)
        const beginningCash = calculateCashBalance(
          accounts,
          entries,
          dayBefore,
          functionalCurrency
        )
        const endingCash = calculateCashBalance(accounts, entries, periodEnd, functionalCurrency)

        // Calculate net income
        const netIncome = calculateNetIncome(
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency
        )

        // Calculate depreciation/amortization (add back to net income)
        const depreciation = calculateDepreciationAmortization(
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency
        )

        // Build non-cash adjustments
        const nonCashAdjustments: OperatingActivityAdjustment[] = []
        if (!depreciation.isZero) {
          nonCashAdjustments.push(
            OperatingActivityAdjustment.make({
              description: "Depreciation and amortization",
              amount: depreciation,
              isNonCashAdjustment: true,
              indentLevel: 1
            })
          )
        }

        const nonCashAdjustmentsSubtotal = MonetaryAmount.fromBigDecimal(
          nonCashAdjustments.reduce(
            (sum, adj) => BigDecimal.sum(sum, adj.amount.amount),
            BigDecimal.fromBigInt(0n)
          ),
          functionalCurrency
        )

        // Calculate working capital changes
        const { changes: workingCapitalChanges, total: workingCapitalChangesSubtotal } =
          calculateWorkingCapitalChanges(
            accounts,
            entries,
            periodStart,
            periodEnd,
            functionalCurrency
          )

        // Calculate net cash from operating
        const netCashFromOperating = MonetaryAmount.fromBigDecimal(
          BigDecimal.sum(
            BigDecimal.sum(netIncome.amount, nonCashAdjustmentsSubtotal.amount),
            workingCapitalChangesSubtotal.amount
          ),
          functionalCurrency
        )

        // Build operating activities section
        const operatingActivities = OperatingActivitiesSection.make({
          netIncome,
          nonCashAdjustments,
          nonCashAdjustmentsSubtotal,
          workingCapitalChanges,
          workingCapitalChangesSubtotal,
          netCashFromOperating
        })

        // Calculate investing activities
        const { lineItems: investingLineItems, total: investingTotal } =
          calculateInvestingActivities(
            accounts,
            entries,
            periodStart,
            periodEnd,
            functionalCurrency
          )

        const investingActivities = CashFlowSection.make({
          sectionType: "Investing",
          displayName: getSectionDisplayName("Investing"),
          lineItems: investingLineItems,
          subtotal: investingTotal
        })

        // Calculate financing activities
        const { lineItems: financingLineItems, total: financingTotal } =
          calculateFinancingActivities(
            accounts,
            entries,
            periodStart,
            periodEnd,
            functionalCurrency
          )

        const financingActivities = CashFlowSection.make({
          sectionType: "Financing",
          displayName: getSectionDisplayName("Financing"),
          lineItems: financingLineItems,
          subtotal: financingTotal
        })

        // Exchange rate effect (for multi-currency - currently zero for single-currency)
        const exchangeRateEffect = MonetaryAmount.zero(functionalCurrency)

        // Calculate net change in cash
        const netChangeInCash = MonetaryAmount.fromBigDecimal(
          BigDecimal.sum(
            BigDecimal.sum(
              BigDecimal.sum(netCashFromOperating.amount, investingTotal.amount),
              financingTotal.amount
            ),
            exchangeRateEffect.amount
          ),
          functionalCurrency
        )

        // Calculate supplemental disclosures
        const interestPaid = calculateInterestPaid(
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency
        )

        const incomesTaxesPaid = calculateTaxesPaid(
          accounts,
          entries,
          periodStart,
          periodEnd,
          functionalCurrency
        )

        const supplementalDisclosures = SupplementalDisclosures.make({
          interestPaid,
          incomesTaxesPaid,
          nonCashActivities: []
        })

        // Generate timestamp
        const generatedAt = yield* timestampNowEffect

        // Create metadata
        const metadata = CashFlowStatementReportMetadata.make({
          companyId,
          periodStart,
          periodEnd,
          currency: functionalCurrency,
          generatedAt,
          method: "Indirect"
        })

        // Create and return the report
        return CashFlowStatementReport.make({
          metadata,
          beginningCash,
          operatingActivities,
          investingActivities,
          financingActivities,
          exchangeRateEffect,
          netChangeInCash,
          endingCash,
          supplementalDisclosures
        })
      })
  } satisfies CashFlowStatementServiceShape
})

/**
 * CashFlowStatementServiceLive - Live implementation of CashFlowStatementService
 *
 * Requires CashFlowStatementRepository
 */
export const CashFlowStatementServiceLive: Layer.Layer<
  CashFlowStatementService,
  never,
  CashFlowStatementRepository
> = Layer.effect(CashFlowStatementService, make)

// =============================================================================
// Pure Functions for Direct Use (without repository)
// =============================================================================

/**
 * Generate a cash flow statement from provided accounts and journal entries
 *
 * This is a pure function that can be used directly without the service layer
 * when all data is already available in memory.
 *
 * @param companyId - The company ID
 * @param accounts - All accounts for the company
 * @param entries - All posted journal entries with lines
 * @param periodStart - The period start date
 * @param periodEnd - The period end date
 * @param functionalCurrency - The functional currency for calculations
 * @returns Effect containing the cash flow statement report
 */
export const generateCashFlowStatementFromData = (
  companyId: CompanyId,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode
): Effect.Effect<CashFlowStatementReport, InvalidPeriodError> =>
  Effect.gen(function* () {
    // Validate period
    if (!isValidPeriod(periodStart, periodEnd)) {
      return yield* Effect.fail(
        new InvalidPeriodError({
          periodStart: {
            year: periodStart.year,
            month: periodStart.month,
            day: periodStart.day
          },
          periodEnd: {
            year: periodEnd.year,
            month: periodEnd.month,
            day: periodEnd.day
          }
        })
      )
    }

    // Calculate beginning and ending cash balances
    const dayBefore = getDayBefore(periodStart)
    const beginningCash = calculateCashBalance(accounts, entries, dayBefore, functionalCurrency)
    const endingCash = calculateCashBalance(accounts, entries, periodEnd, functionalCurrency)

    // Calculate net income
    const netIncome = calculateNetIncome(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Calculate depreciation/amortization (add back to net income)
    const depreciation = calculateDepreciationAmortization(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Build non-cash adjustments
    const nonCashAdjustments: OperatingActivityAdjustment[] = []
    if (!depreciation.isZero) {
      nonCashAdjustments.push(
        OperatingActivityAdjustment.make({
          description: "Depreciation and amortization",
          amount: depreciation,
          isNonCashAdjustment: true,
          indentLevel: 1
        })
      )
    }

    const nonCashAdjustmentsSubtotal = MonetaryAmount.fromBigDecimal(
      nonCashAdjustments.reduce(
        (sum, adj) => BigDecimal.sum(sum, adj.amount.amount),
        BigDecimal.fromBigInt(0n)
      ),
      functionalCurrency
    )

    // Calculate working capital changes
    const { changes: workingCapitalChanges, total: workingCapitalChangesSubtotal } =
      calculateWorkingCapitalChanges(accounts, entries, periodStart, periodEnd, functionalCurrency)

    // Calculate net cash from operating
    const netCashFromOperating = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(
        BigDecimal.sum(netIncome.amount, nonCashAdjustmentsSubtotal.amount),
        workingCapitalChangesSubtotal.amount
      ),
      functionalCurrency
    )

    // Build operating activities section
    const operatingActivities = OperatingActivitiesSection.make({
      netIncome,
      nonCashAdjustments,
      nonCashAdjustmentsSubtotal,
      workingCapitalChanges,
      workingCapitalChangesSubtotal,
      netCashFromOperating
    })

    // Calculate investing activities
    const { lineItems: investingLineItems, total: investingTotal } = calculateInvestingActivities(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    const investingActivities = CashFlowSection.make({
      sectionType: "Investing",
      displayName: getSectionDisplayName("Investing"),
      lineItems: investingLineItems,
      subtotal: investingTotal
    })

    // Calculate financing activities
    const { lineItems: financingLineItems, total: financingTotal } = calculateFinancingActivities(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    const financingActivities = CashFlowSection.make({
      sectionType: "Financing",
      displayName: getSectionDisplayName("Financing"),
      lineItems: financingLineItems,
      subtotal: financingTotal
    })

    // Exchange rate effect (for multi-currency - currently zero for single-currency)
    const exchangeRateEffect = MonetaryAmount.zero(functionalCurrency)

    // Calculate net change in cash
    const netChangeInCash = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(
        BigDecimal.sum(
          BigDecimal.sum(netCashFromOperating.amount, investingTotal.amount),
          financingTotal.amount
        ),
        exchangeRateEffect.amount
      ),
      functionalCurrency
    )

    // Calculate supplemental disclosures
    const interestPaid = calculateInterestPaid(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    const incomesTaxesPaid = calculateTaxesPaid(
      accounts,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    const supplementalDisclosures = SupplementalDisclosures.make({
      interestPaid,
      incomesTaxesPaid,
      nonCashActivities: []
    })

    // Generate timestamp
    const generatedAt = yield* timestampNowEffect

    // Create metadata
    const metadata = CashFlowStatementReportMetadata.make({
      companyId,
      periodStart,
      periodEnd,
      currency: functionalCurrency,
      generatedAt,
      method: "Indirect"
    })

    // Create and return the report
    return CashFlowStatementReport.make({
      metadata,
      beginningCash,
      operatingActivities,
      investingActivities,
      financingActivities,
      exchangeRateEffect,
      netChangeInCash,
      endingCash,
      supplementalDisclosures
    })
  })
