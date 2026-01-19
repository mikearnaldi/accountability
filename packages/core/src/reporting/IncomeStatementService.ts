/**
 * IncomeStatementService - Income Statement (P&L) Report generation service
 *
 * Implements income statement report generation per ASC 220 and specs/ACCOUNTING_RESEARCH.md Phase 3.3:
 * - IncomeStatementReport schema with sections
 * - generateIncomeStatement: (companyId, periodStart, periodEnd, options) -> Effect<IncomeStatementReport>
 * - Multi-step format: Revenue -> COGS -> Gross Profit -> OpEx -> Operating Income -> Other -> Net Income
 * - Expenses grouped by function (per US GAAP requirement)
 * - Subtotals: Gross Profit, Operating Income, Income Before Tax, Net Income
 * - Support for comparative periods
 *
 * Per ASC 220, expenses are presented by function (required for SEC filers).
 * The multi-step format provides key subtotals for analysis.
 *
 * @module IncomeStatementService
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
  Account,
  AccountCategory} from "../accounting/Account.ts";
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
import { calculatePeriodBalance } from "../accounting/AccountBalance.ts"

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
 * Union type for all income statement service errors
 */
export type IncomeStatementServiceError = CompanyNotFoundError | InvalidPeriodError

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
 * IncomeStatementLineItem - A single line in the income statement report
 *
 * Represents either an account balance, subtotal, or section total.
 */
export class IncomeStatementLineItem extends Schema.Class<IncomeStatementLineItem>("IncomeStatementLineItem")({
  /**
   * Optional account reference (null for subtotals/totals)
   */
  accountId: Schema.OptionFromNullOr(AccountId),

  /**
   * Optional account number (for display/sorting)
   */
  accountNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),

  /**
   * Description text (account name or subtotal label)
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * Current period amount
   */
  currentAmount: MonetaryAmount,

  /**
   * Comparative period amount (if comparative period requested)
   */
  comparativeAmount: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Variance from comparative period (absolute)
   */
  variance: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Variance as a percentage
   */
  variancePercentage: Schema.OptionFromNullOr(Schema.Number),

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
   * Check if variance is positive (increase)
   */
  get hasPositiveVariance(): boolean {
    return Option.match(this.variance, {
      onNone: () => false,
      onSome: (v) => v.isPositive
    })
  }

  /**
   * Check if variance is negative (decrease)
   */
  get hasNegativeVariance(): boolean {
    return Option.match(this.variance, {
      onNone: () => false,
      onSome: (v) => v.isNegative
    })
  }
}

/**
 * Type guard for IncomeStatementLineItem
 */
export const isIncomeStatementLineItem = Schema.is(IncomeStatementLineItem)

// =============================================================================
// Section Types
// =============================================================================

/**
 * IncomeStatementSectionType - The main sections of a multi-step income statement
 *
 * Per ASC 220, expenses are grouped by function:
 * - Revenue: Operating Revenue, Other Revenue
 * - CostOfSales: Direct costs (COGS)
 * - OperatingExpenses: Operating expenses by function (selling, general, admin, etc.)
 * - OtherIncomeExpense: Non-operating items (interest expense, other)
 * - IncomeTaxExpense: Income tax expense
 */
export const IncomeStatementSectionType = Schema.Literal(
  "Revenue",
  "CostOfSales",
  "OperatingExpenses",
  "OtherIncomeExpense",
  "IncomeTaxExpense"
).annotations({
  identifier: "IncomeStatementSectionType",
  title: "Income Statement Section Type",
  description: "The main sections of a multi-step income statement per ASC 220"
})

export type IncomeStatementSectionType = typeof IncomeStatementSectionType.Type

/**
 * Get the display name for an income statement section
 */
export const getSectionDisplayName = (section: IncomeStatementSectionType): string => {
  switch (section) {
    case "Revenue":
      return "Revenue"
    case "CostOfSales":
      return "Cost of Sales"
    case "OperatingExpenses":
      return "Operating Expenses"
    case "OtherIncomeExpense":
      return "Other Income and Expenses"
    case "IncomeTaxExpense":
      return "Income Tax Expense"
  }
}

/**
 * IncomeStatementSection - A section of the income statement
 *
 * Contains line items and a subtotal for the section.
 */
export class IncomeStatementSection extends Schema.Class<IncomeStatementSection>("IncomeStatementSection")({
  /**
   * The section type
   */
  sectionType: IncomeStatementSectionType,

  /**
   * Display name for the section
   */
  displayName: Schema.NonEmptyTrimmedString,

  /**
   * Line items in this section
   */
  lineItems: Schema.Array(IncomeStatementLineItem),

  /**
   * Subtotal for this section
   */
  subtotal: MonetaryAmount,

  /**
   * Comparative period subtotal
   */
  comparativeSubtotal: Schema.OptionFromNullOr(MonetaryAmount)
}) {
  /**
   * Get the number of account lines (excluding subtotals)
   */
  get accountCount(): number {
    return ReadonlyArray.filter(this.lineItems, (item) => item.isAccountLine).length
  }

  /**
   * Check if the section has any accounts
   */
  get hasAccounts(): boolean {
    return this.accountCount > 0
  }
}

/**
 * Type guard for IncomeStatementSection
 */
export const isIncomeStatementSection = Schema.is(IncomeStatementSection)

// =============================================================================
// Report Types
// =============================================================================

/**
 * IncomeStatementReportMetadata - Metadata about the income statement report
 */
export class IncomeStatementReportMetadata extends Schema.Class<IncomeStatementReportMetadata>("IncomeStatementReportMetadata")({
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
   * Optional comparative period start date
   */
  comparativePeriodStart: Schema.OptionFromNullOr(LocalDate),

  /**
   * Optional comparative period end date
   */
  comparativePeriodEnd: Schema.OptionFromNullOr(LocalDate),

  /**
   * The presentation currency used for the report
   */
  currency: CurrencyCode,

  /**
   * When the report was generated
   */
  generatedAt: Timestamp,

  /**
   * Total number of accounts with activity
   */
  accountCount: Schema.Number
}) {}

/**
 * Type guard for IncomeStatementReportMetadata
 */
export const isIncomeStatementReportMetadata = Schema.is(IncomeStatementReportMetadata)

/**
 * IncomeStatementReport - Complete income statement report (multi-step format)
 *
 * Per ASC 220, this implements the multi-step income statement format:
 * Revenue
 * - Cost of Sales
 * = Gross Profit
 * - Operating Expenses
 * = Operating Income
 * +/- Other Income/Expenses
 * = Income Before Tax
 * - Income Tax Expense
 * = Net Income
 */
export class IncomeStatementReport extends Schema.Class<IncomeStatementReport>("IncomeStatementReport")({
  /**
   * Report metadata
   */
  metadata: IncomeStatementReportMetadata,

  /**
   * Revenue section (Operating Revenue + Other Revenue)
   */
  revenue: IncomeStatementSection,

  /**
   * Cost of Sales section (COGS)
   */
  costOfSales: IncomeStatementSection,

  /**
   * Operating Expenses section (grouped by function)
   */
  operatingExpenses: IncomeStatementSection,

  /**
   * Other Income/Expense section (non-operating)
   */
  otherIncomeExpense: IncomeStatementSection,

  /**
   * Income Tax Expense section
   */
  incomeTaxExpense: IncomeStatementSection,

  /**
   * Total Revenue
   */
  totalRevenue: MonetaryAmount,

  /**
   * Comparative Total Revenue
   */
  comparativeTotalRevenue: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Gross Profit = Revenue - Cost of Sales
   */
  grossProfit: MonetaryAmount,

  /**
   * Comparative Gross Profit
   */
  comparativeGrossProfit: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Operating Income = Gross Profit - Operating Expenses
   */
  operatingIncome: MonetaryAmount,

  /**
   * Comparative Operating Income
   */
  comparativeOperatingIncome: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Income Before Tax = Operating Income + Other Income/Expense
   */
  incomeBeforeTax: MonetaryAmount,

  /**
   * Comparative Income Before Tax
   */
  comparativeIncomeBeforeTax: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Net Income = Income Before Tax - Income Tax Expense
   */
  netIncome: MonetaryAmount,

  /**
   * Comparative Net Income
   */
  comparativeNetIncome: Schema.OptionFromNullOr(MonetaryAmount)
}) {
  /**
   * Check if the company is profitable (positive net income)
   */
  get isProfitable(): boolean {
    return this.netIncome.isPositive
  }

  /**
   * Get gross profit margin (Gross Profit / Revenue * 100)
   */
  get grossProfitMargin(): number | null {
    if (this.totalRevenue.isZero) return null
    const margin = BigDecimal.divide(
      BigDecimal.multiply(this.grossProfit.amount, BigDecimal.unsafeFromString("100")),
      this.totalRevenue.amount
    )
    if (Option.isNone(margin)) return null
    const rounded = BigDecimal.round(margin.value, { scale: 2, mode: "half-from-zero" })
    return Number(BigDecimal.format(rounded))
  }

  /**
   * Get operating profit margin (Operating Income / Revenue * 100)
   */
  get operatingProfitMargin(): number | null {
    if (this.totalRevenue.isZero) return null
    const margin = BigDecimal.divide(
      BigDecimal.multiply(this.operatingIncome.amount, BigDecimal.unsafeFromString("100")),
      this.totalRevenue.amount
    )
    if (Option.isNone(margin)) return null
    const rounded = BigDecimal.round(margin.value, { scale: 2, mode: "half-from-zero" })
    return Number(BigDecimal.format(rounded))
  }

  /**
   * Get net profit margin (Net Income / Revenue * 100)
   */
  get netProfitMargin(): number | null {
    if (this.totalRevenue.isZero) return null
    const margin = BigDecimal.divide(
      BigDecimal.multiply(this.netIncome.amount, BigDecimal.unsafeFromString("100")),
      this.totalRevenue.amount
    )
    if (Option.isNone(margin)) return null
    const rounded = BigDecimal.round(margin.value, { scale: 2, mode: "half-from-zero" })
    return Number(BigDecimal.format(rounded))
  }

  /**
   * Get all sections as an array
   */
  get sections(): ReadonlyArray<IncomeStatementSection> {
    return [
      this.revenue,
      this.costOfSales,
      this.operatingExpenses,
      this.otherIncomeExpense,
      this.incomeTaxExpense
    ]
  }

  /**
   * Get total account count across all sections
   */
  get totalAccountCount(): number {
    return this.sections.reduce((sum, section) => sum + section.accountCount, 0)
  }
}

/**
 * Type guard for IncomeStatementReport
 */
export const isIncomeStatementReport = Schema.is(IncomeStatementReport)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * IncomeStatementRepository - Repository interface for fetching data needed for income statement
 */
export interface IncomeStatementRepositoryService {
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
 * IncomeStatementRepository Context.Tag
 */
export class IncomeStatementRepository extends Context.Tag("IncomeStatementRepository")<
  IncomeStatementRepository,
  IncomeStatementRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * GenerateIncomeStatementInput - Input for generating an income statement report
 */
export interface GenerateIncomeStatementInput {
  /** The company ID */
  readonly companyId: CompanyId
  /** The period start date */
  readonly periodStart: LocalDate
  /** The period end date */
  readonly periodEnd: LocalDate
  /** Optional: Include zero balance accounts (default: false) */
  readonly includeZeroBalances?: boolean
  /** Optional: Comparative period start date */
  readonly comparativePeriodStart?: LocalDate
  /** Optional: Comparative period end date */
  readonly comparativePeriodEnd?: LocalDate
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the income statement section type for an account category
 */
const getSectionTypeForCategory = (category: AccountCategory): IncomeStatementSectionType | null => {
  switch (category) {
    // Revenue categories
    case "OperatingRevenue":
    case "OtherRevenue":
      return "Revenue"
    // Cost of Sales
    case "CostOfGoodsSold":
      return "CostOfSales"
    // Operating Expenses (by function)
    case "OperatingExpense":
    case "DepreciationAmortization":
      return "OperatingExpenses"
    // Other Income/Expense (non-operating)
    case "InterestExpense":
    case "OtherExpense":
      return "OtherIncomeExpense"
    // Income Tax
    case "TaxExpense":
      return "IncomeTaxExpense"
    // Balance sheet accounts are not on the income statement
    default:
      return null
  }
}

/**
 * Calculate variance and percentage between current and comparative amounts
 */
const calculateVariance = (
  current: MonetaryAmount,
  comparative: MonetaryAmount
): { variance: MonetaryAmount; variancePercentage: number | null } => {
  const variance = MonetaryAmount.fromBigDecimal(
    BigDecimal.subtract(current.amount, comparative.amount),
    current.currency
  )

  let variancePercentage: number | null = null
  if (!BigDecimal.isZero(comparative.amount)) {
    const pct = BigDecimal.divide(
      BigDecimal.multiply(variance.amount, BigDecimal.unsafeFromString("100")),
      comparative.amount
    )
    if (Option.isSome(pct)) {
      const rounded = BigDecimal.round(pct.value, { scale: 2, mode: "half-from-zero" })
      variancePercentage = Number(BigDecimal.format(rounded))
    }
  }

  return { variance, variancePercentage }
}

/**
 * Group accounts by income statement section
 */
const groupAccountsBySection = (
  accounts: ReadonlyArray<Account>
): Map<IncomeStatementSectionType, ReadonlyArray<Account>> => {
  const groups = new Map<IncomeStatementSectionType, Account[]>([
    ["Revenue", []],
    ["CostOfSales", []],
    ["OperatingExpenses", []],
    ["OtherIncomeExpense", []],
    ["IncomeTaxExpense", []]
  ])

  for (const account of accounts) {
    // Only include postable accounts
    if (!account.isPostable) continue

    const sectionType = getSectionTypeForCategory(account.accountCategory)
    if (sectionType !== null) {
      groups.get(sectionType)!.push(account)
    }
  }

  return groups
}

/**
 * Build line items for a section from accounts and their balances
 *
 * Note: For income statement, we calculate the period activity (not cumulative balance).
 * Revenue accounts (credit balance) should show positive amounts when they have credits.
 * Expense accounts (debit balance) should show positive amounts when they have debits.
 */
const buildSectionLineItems = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode,
  includeZeroBalances: boolean,
  comparativePeriodStart: LocalDate | undefined,
  comparativePeriodEnd: LocalDate | undefined
): {
  lineItems: ReadonlyArray<IncomeStatementLineItem>
  subtotal: MonetaryAmount
  comparativeSubtotal: MonetaryAmount | undefined
} => {
  // Sort accounts by account number
  const accountOrder: Order.Order<Account> = Order.make(
    (a, b) => a.accountNumber < b.accountNumber ? -1 : a.accountNumber > b.accountNumber ? 1 : 0
  )
  const sortedAccounts = ReadonlyArray.sort(accounts, accountOrder)

  const lineItems: IncomeStatementLineItem[] = []
  let subtotal = BigDecimal.fromBigInt(0n)
  let comparativeSubtotal = BigDecimal.fromBigInt(0n)

  for (const account of sortedAccounts) {
    const normalBalance = getNormalBalanceForType(account.accountType)

    // Calculate period balance (activity during the period)
    const balance = calculatePeriodBalance(
      account.id,
      normalBalance,
      entries,
      periodStart,
      periodEnd,
      functionalCurrency
    )

    // Calculate comparative balance if requested
    let comparativeBalance: MonetaryAmount | undefined
    if (comparativePeriodStart !== undefined && comparativePeriodEnd !== undefined) {
      comparativeBalance = calculatePeriodBalance(
        account.id,
        normalBalance,
        entries,
        comparativePeriodStart,
        comparativePeriodEnd,
        functionalCurrency
      )
    }

    // Skip zero balances if not requested
    if (!includeZeroBalances && balance.isZero && (comparativeBalance === undefined || comparativeBalance.isZero)) {
      continue
    }

    // Calculate variance if comparative
    let variance: MonetaryAmount | undefined
    let variancePercentage: number | undefined
    if (comparativeBalance !== undefined) {
      const varResult = calculateVariance(balance, comparativeBalance)
      variance = varResult.variance
      variancePercentage = varResult.variancePercentage ?? undefined
    }

    lineItems.push(
      IncomeStatementLineItem.make({
        accountId: Option.some(account.id),
        accountNumber: Option.some(account.accountNumber),
        description: account.name,
        currentAmount: balance,
        comparativeAmount: comparativeBalance !== undefined ? Option.some(comparativeBalance) : Option.none(),
        variance: variance !== undefined ? Option.some(variance) : Option.none(),
        variancePercentage: variancePercentage !== undefined ? Option.some(variancePercentage) : Option.none(),
        isSubtotal: false,
        indentLevel: 1,
        style: "Normal"
      })
    )

    subtotal = BigDecimal.sum(subtotal, balance.amount)
    if (comparativeBalance !== undefined) {
      comparativeSubtotal = BigDecimal.sum(comparativeSubtotal, comparativeBalance.amount)
    }
  }

  return {
    lineItems,
    subtotal: MonetaryAmount.fromBigDecimal(subtotal, functionalCurrency),
    comparativeSubtotal: comparativePeriodStart !== undefined
      ? MonetaryAmount.fromBigDecimal(comparativeSubtotal, functionalCurrency)
      : undefined
  }
}

/**
 * Build an income statement section
 */
const buildSection = (
  sectionType: IncomeStatementSectionType,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode,
  includeZeroBalances: boolean,
  comparativePeriodStart: LocalDate | undefined,
  comparativePeriodEnd: LocalDate | undefined
): IncomeStatementSection => {
  const { lineItems, subtotal, comparativeSubtotal } = buildSectionLineItems(
    accounts,
    entries,
    periodStart,
    periodEnd,
    functionalCurrency,
    includeZeroBalances,
    comparativePeriodStart,
    comparativePeriodEnd
  )

  return IncomeStatementSection.make({
    sectionType,
    displayName: getSectionDisplayName(sectionType),
    lineItems,
    subtotal,
    comparativeSubtotal: comparativeSubtotal !== undefined ? Option.some(comparativeSubtotal) : Option.none()
  })
}

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

// =============================================================================
// Service Interface
// =============================================================================

/**
 * IncomeStatementService - Service interface for generating income statement reports
 */
export interface IncomeStatementServiceShape {
  /**
   * Generate an income statement report for a company for a specific period
   *
   * @param input - The input parameters
   * @returns Effect containing the income statement report
   * @throws CompanyNotFoundError if the company doesn't exist
   * @throws InvalidPeriodError if periodStart is after periodEnd
   */
  readonly generateIncomeStatement: (
    input: GenerateIncomeStatementInput
  ) => Effect.Effect<
    IncomeStatementReport,
    CompanyNotFoundError | InvalidPeriodError,
    never
  >
}

/**
 * IncomeStatementService Context.Tag
 */
export class IncomeStatementService extends Context.Tag("IncomeStatementService")<
  IncomeStatementService,
  IncomeStatementServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the IncomeStatementService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* IncomeStatementRepository

  return {
    generateIncomeStatement: (input: GenerateIncomeStatementInput) =>
      Effect.gen(function* () {
        const {
          companyId,
          periodStart,
          periodEnd,
          includeZeroBalances = false,
          comparativePeriodStart,
          comparativePeriodEnd
        } = input

        // Validate period
        if (!isValidPeriod(periodStart, periodEnd)) {
          return yield* Effect.fail(
            new InvalidPeriodError({
              periodStart: { year: periodStart.year, month: periodStart.month, day: periodStart.day },
              periodEnd: { year: periodEnd.year, month: periodEnd.month, day: periodEnd.day }
            })
          )
        }

        // Validate comparative period if provided
        if (comparativePeriodStart !== undefined && comparativePeriodEnd !== undefined) {
          if (!isValidPeriod(comparativePeriodStart, comparativePeriodEnd)) {
            return yield* Effect.fail(
              new InvalidPeriodError({
                periodStart: { year: comparativePeriodStart.year, month: comparativePeriodStart.month, day: comparativePeriodStart.day },
                periodEnd: { year: comparativePeriodEnd.year, month: comparativePeriodEnd.month, day: comparativePeriodEnd.day }
              })
            )
          }
        }

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

        // Group accounts by section
        const accountsBySection = groupAccountsBySection(accounts)

        // Build each section
        const revenue = buildSection(
          "Revenue",
          accountsBySection.get("Revenue") || [],
          entries,
          periodStart,
          periodEnd,
          functionalCurrency,
          includeZeroBalances,
          comparativePeriodStart,
          comparativePeriodEnd
        )

        const costOfSales = buildSection(
          "CostOfSales",
          accountsBySection.get("CostOfSales") || [],
          entries,
          periodStart,
          periodEnd,
          functionalCurrency,
          includeZeroBalances,
          comparativePeriodStart,
          comparativePeriodEnd
        )

        const operatingExpenses = buildSection(
          "OperatingExpenses",
          accountsBySection.get("OperatingExpenses") || [],
          entries,
          periodStart,
          periodEnd,
          functionalCurrency,
          includeZeroBalances,
          comparativePeriodStart,
          comparativePeriodEnd
        )

        const otherIncomeExpense = buildSection(
          "OtherIncomeExpense",
          accountsBySection.get("OtherIncomeExpense") || [],
          entries,
          periodStart,
          periodEnd,
          functionalCurrency,
          includeZeroBalances,
          comparativePeriodStart,
          comparativePeriodEnd
        )

        const incomeTaxExpense = buildSection(
          "IncomeTaxExpense",
          accountsBySection.get("IncomeTaxExpense") || [],
          entries,
          periodStart,
          periodEnd,
          functionalCurrency,
          includeZeroBalances,
          comparativePeriodStart,
          comparativePeriodEnd
        )

        // Calculate totals and subtotals
        // Total Revenue
        const totalRevenue = revenue.subtotal

        // Gross Profit = Revenue - Cost of Sales
        const grossProfit = MonetaryAmount.fromBigDecimal(
          BigDecimal.subtract(totalRevenue.amount, costOfSales.subtotal.amount),
          functionalCurrency
        )

        // Operating Income = Gross Profit - Operating Expenses
        const operatingIncome = MonetaryAmount.fromBigDecimal(
          BigDecimal.subtract(grossProfit.amount, operatingExpenses.subtotal.amount),
          functionalCurrency
        )

        // Income Before Tax = Operating Income - Other Income/Expense
        // Note: Other expenses are typically positive (debits), so we subtract them
        const incomeBeforeTax = MonetaryAmount.fromBigDecimal(
          BigDecimal.subtract(operatingIncome.amount, otherIncomeExpense.subtotal.amount),
          functionalCurrency
        )

        // Net Income = Income Before Tax - Income Tax Expense
        const netIncome = MonetaryAmount.fromBigDecimal(
          BigDecimal.subtract(incomeBeforeTax.amount, incomeTaxExpense.subtotal.amount),
          functionalCurrency
        )

        // Calculate comparative totals if applicable
        let comparativeTotalRevenue: MonetaryAmount | undefined
        let comparativeGrossProfit: MonetaryAmount | undefined
        let comparativeOperatingIncome: MonetaryAmount | undefined
        let comparativeIncomeBeforeTax: MonetaryAmount | undefined
        let comparativeNetIncome: MonetaryAmount | undefined

        if (comparativePeriodStart !== undefined && comparativePeriodEnd !== undefined) {
          const compRevenue = Option.getOrElse(
            revenue.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          comparativeTotalRevenue = compRevenue

          const compCostOfSales = Option.getOrElse(
            costOfSales.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          comparativeGrossProfit = MonetaryAmount.fromBigDecimal(
            BigDecimal.subtract(compRevenue.amount, compCostOfSales.amount),
            functionalCurrency
          )

          const compOpEx = Option.getOrElse(
            operatingExpenses.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          comparativeOperatingIncome = MonetaryAmount.fromBigDecimal(
            BigDecimal.subtract(comparativeGrossProfit.amount, compOpEx.amount),
            functionalCurrency
          )

          const compOther = Option.getOrElse(
            otherIncomeExpense.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          comparativeIncomeBeforeTax = MonetaryAmount.fromBigDecimal(
            BigDecimal.subtract(comparativeOperatingIncome.amount, compOther.amount),
            functionalCurrency
          )

          const compTax = Option.getOrElse(
            incomeTaxExpense.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          comparativeNetIncome = MonetaryAmount.fromBigDecimal(
            BigDecimal.subtract(comparativeIncomeBeforeTax.amount, compTax.amount),
            functionalCurrency
          )
        }

        // Count total accounts
        const accountCount =
          revenue.accountCount +
          costOfSales.accountCount +
          operatingExpenses.accountCount +
          otherIncomeExpense.accountCount +
          incomeTaxExpense.accountCount

        // Generate timestamp
        const generatedAt = yield* timestampNowEffect

        // Create metadata
        const metadata = IncomeStatementReportMetadata.make({
          companyId,
          periodStart,
          periodEnd,
          comparativePeriodStart: comparativePeriodStart !== undefined ? Option.some(comparativePeriodStart) : Option.none(),
          comparativePeriodEnd: comparativePeriodEnd !== undefined ? Option.some(comparativePeriodEnd) : Option.none(),
          currency: functionalCurrency,
          generatedAt,
          accountCount
        })

        // Create and return the report
        return IncomeStatementReport.make({
          metadata,
          revenue,
          costOfSales,
          operatingExpenses,
          otherIncomeExpense,
          incomeTaxExpense,
          totalRevenue,
          comparativeTotalRevenue: comparativeTotalRevenue !== undefined ? Option.some(comparativeTotalRevenue) : Option.none(),
          grossProfit,
          comparativeGrossProfit: comparativeGrossProfit !== undefined ? Option.some(comparativeGrossProfit) : Option.none(),
          operatingIncome,
          comparativeOperatingIncome: comparativeOperatingIncome !== undefined ? Option.some(comparativeOperatingIncome) : Option.none(),
          incomeBeforeTax,
          comparativeIncomeBeforeTax: comparativeIncomeBeforeTax !== undefined ? Option.some(comparativeIncomeBeforeTax) : Option.none(),
          netIncome,
          comparativeNetIncome: comparativeNetIncome !== undefined ? Option.some(comparativeNetIncome) : Option.none()
        })
      })
  } satisfies IncomeStatementServiceShape
})

/**
 * IncomeStatementServiceLive - Live implementation of IncomeStatementService
 *
 * Requires IncomeStatementRepository
 */
export const IncomeStatementServiceLive: Layer.Layer<
  IncomeStatementService,
  never,
  IncomeStatementRepository
> = Layer.effect(IncomeStatementService, make)

// =============================================================================
// Pure Functions for Direct Use (without repository)
// =============================================================================

/**
 * Generate an income statement from provided accounts and journal entries
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
 * @param options - Optional parameters
 * @returns Effect containing the income statement report
 */
export const generateIncomeStatementFromData = (
  companyId: CompanyId,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  periodStart: LocalDate,
  periodEnd: LocalDate,
  functionalCurrency: CurrencyCode,
  options?: {
    includeZeroBalances?: boolean
    comparativePeriodStart?: LocalDate
    comparativePeriodEnd?: LocalDate
  }
): Effect.Effect<IncomeStatementReport, InvalidPeriodError> =>
  Effect.gen(function* () {
    const { includeZeroBalances = false, comparativePeriodStart, comparativePeriodEnd } = options ?? {}

    // Validate period
    if (!isValidPeriod(periodStart, periodEnd)) {
      return yield* Effect.fail(
        new InvalidPeriodError({
          periodStart: { year: periodStart.year, month: periodStart.month, day: periodStart.day },
          periodEnd: { year: periodEnd.year, month: periodEnd.month, day: periodEnd.day }
        })
      )
    }

    // Validate comparative period if provided
    if (comparativePeriodStart !== undefined && comparativePeriodEnd !== undefined) {
      if (!isValidPeriod(comparativePeriodStart, comparativePeriodEnd)) {
        return yield* Effect.fail(
          new InvalidPeriodError({
            periodStart: { year: comparativePeriodStart.year, month: comparativePeriodStart.month, day: comparativePeriodStart.day },
            periodEnd: { year: comparativePeriodEnd.year, month: comparativePeriodEnd.month, day: comparativePeriodEnd.day }
          })
        )
      }
    }

    // Group accounts by section
    const accountsBySection = groupAccountsBySection(accounts)

    // Build each section
    const revenue = buildSection(
      "Revenue",
      accountsBySection.get("Revenue") || [],
      entries,
      periodStart,
      periodEnd,
      functionalCurrency,
      includeZeroBalances,
      comparativePeriodStart,
      comparativePeriodEnd
    )

    const costOfSales = buildSection(
      "CostOfSales",
      accountsBySection.get("CostOfSales") || [],
      entries,
      periodStart,
      periodEnd,
      functionalCurrency,
      includeZeroBalances,
      comparativePeriodStart,
      comparativePeriodEnd
    )

    const operatingExpenses = buildSection(
      "OperatingExpenses",
      accountsBySection.get("OperatingExpenses") || [],
      entries,
      periodStart,
      periodEnd,
      functionalCurrency,
      includeZeroBalances,
      comparativePeriodStart,
      comparativePeriodEnd
    )

    const otherIncomeExpense = buildSection(
      "OtherIncomeExpense",
      accountsBySection.get("OtherIncomeExpense") || [],
      entries,
      periodStart,
      periodEnd,
      functionalCurrency,
      includeZeroBalances,
      comparativePeriodStart,
      comparativePeriodEnd
    )

    const incomeTaxExpense = buildSection(
      "IncomeTaxExpense",
      accountsBySection.get("IncomeTaxExpense") || [],
      entries,
      periodStart,
      periodEnd,
      functionalCurrency,
      includeZeroBalances,
      comparativePeriodStart,
      comparativePeriodEnd
    )

    // Calculate totals and subtotals
    const totalRevenue = revenue.subtotal

    const grossProfit = MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(totalRevenue.amount, costOfSales.subtotal.amount),
      functionalCurrency
    )

    const operatingIncome = MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(grossProfit.amount, operatingExpenses.subtotal.amount),
      functionalCurrency
    )

    const incomeBeforeTax = MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(operatingIncome.amount, otherIncomeExpense.subtotal.amount),
      functionalCurrency
    )

    const netIncome = MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(incomeBeforeTax.amount, incomeTaxExpense.subtotal.amount),
      functionalCurrency
    )

    // Calculate comparative totals if applicable
    let comparativeTotalRevenue: MonetaryAmount | undefined
    let comparativeGrossProfit: MonetaryAmount | undefined
    let comparativeOperatingIncome: MonetaryAmount | undefined
    let comparativeIncomeBeforeTax: MonetaryAmount | undefined
    let comparativeNetIncome: MonetaryAmount | undefined

    if (comparativePeriodStart !== undefined && comparativePeriodEnd !== undefined) {
      const compRevenue = Option.getOrElse(
        revenue.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      comparativeTotalRevenue = compRevenue

      const compCostOfSales = Option.getOrElse(
        costOfSales.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      comparativeGrossProfit = MonetaryAmount.fromBigDecimal(
        BigDecimal.subtract(compRevenue.amount, compCostOfSales.amount),
        functionalCurrency
      )

      const compOpEx = Option.getOrElse(
        operatingExpenses.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      comparativeOperatingIncome = MonetaryAmount.fromBigDecimal(
        BigDecimal.subtract(comparativeGrossProfit.amount, compOpEx.amount),
        functionalCurrency
      )

      const compOther = Option.getOrElse(
        otherIncomeExpense.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      comparativeIncomeBeforeTax = MonetaryAmount.fromBigDecimal(
        BigDecimal.subtract(comparativeOperatingIncome.amount, compOther.amount),
        functionalCurrency
      )

      const compTax = Option.getOrElse(
        incomeTaxExpense.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      comparativeNetIncome = MonetaryAmount.fromBigDecimal(
        BigDecimal.subtract(comparativeIncomeBeforeTax.amount, compTax.amount),
        functionalCurrency
      )
    }

    // Count total accounts
    const accountCount =
      revenue.accountCount +
      costOfSales.accountCount +
      operatingExpenses.accountCount +
      otherIncomeExpense.accountCount +
      incomeTaxExpense.accountCount

    // Generate timestamp
    const generatedAt = yield* timestampNowEffect

    // Create metadata
    const metadata = IncomeStatementReportMetadata.make({
      companyId,
      periodStart,
      periodEnd,
      comparativePeriodStart: comparativePeriodStart !== undefined ? Option.some(comparativePeriodStart) : Option.none(),
      comparativePeriodEnd: comparativePeriodEnd !== undefined ? Option.some(comparativePeriodEnd) : Option.none(),
      currency: functionalCurrency,
      generatedAt,
      accountCount
    })

    // Create and return the report
    return IncomeStatementReport.make({
      metadata,
      revenue,
      costOfSales,
      operatingExpenses,
      otherIncomeExpense,
      incomeTaxExpense,
      totalRevenue,
      comparativeTotalRevenue: comparativeTotalRevenue !== undefined ? Option.some(comparativeTotalRevenue) : Option.none(),
      grossProfit,
      comparativeGrossProfit: comparativeGrossProfit !== undefined ? Option.some(comparativeGrossProfit) : Option.none(),
      operatingIncome,
      comparativeOperatingIncome: comparativeOperatingIncome !== undefined ? Option.some(comparativeOperatingIncome) : Option.none(),
      incomeBeforeTax,
      comparativeIncomeBeforeTax: comparativeIncomeBeforeTax !== undefined ? Option.some(comparativeIncomeBeforeTax) : Option.none(),
      netIncome,
      comparativeNetIncome: comparativeNetIncome !== undefined ? Option.some(comparativeNetIncome) : Option.none()
    })
  })
