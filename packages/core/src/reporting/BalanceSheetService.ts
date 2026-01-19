/**
 * BalanceSheetService - Balance Sheet Report generation service
 *
 * Implements balance sheet report generation per ASC 210 and specs/ACCOUNTING_RESEARCH.md Phase 3.2:
 * - BalanceSheetReport schema with sections and line items
 * - generateBalanceSheet: (companyId, asOfDate, options) -> Effect<BalanceSheetReport>
 * - Sections: Current Assets, Non-Current Assets, Current Liabilities, Non-Current Liabilities, Equity
 * - Line items grouped by AccountCategory
 * - Subtotals for each section
 * - Validation: Total Assets = Total Liabilities + Total Equity
 * - Support for comparative periods (prior year/period)
 *
 * Per ASC 210, the balance sheet presents the financial position at a specific
 * point in time with current/non-current classification.
 *
 * @module reporting/BalanceSheetService
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
import { calculateBalance } from "../accounting/AccountBalance.ts"

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
 * Error when balance sheet does not balance (Assets != Liabilities + Equity)
 * This indicates a serious issue with the accounting data.
 */
export class BalanceSheetNotBalancedError extends Schema.TaggedError<BalanceSheetNotBalancedError>()(
  "BalanceSheetNotBalancedError",
  {
    companyId: Schema.UUID.pipe(Schema.brand("CompanyId")),
    asOfDate: Schema.Struct({
      year: Schema.Number,
      month: Schema.Number,
      day: Schema.Number
    }),
    totalAssets: MonetaryAmount,
    totalLiabilities: MonetaryAmount,
    totalEquity: MonetaryAmount
  }
) {
  get message(): string {
    const dateStr = `${this.asOfDate.year}-${String(this.asOfDate.month).padStart(2, "0")}-${String(this.asOfDate.day).padStart(2, "0")}`
    const liabPlusEquity = BigDecimal.sum(this.totalLiabilities.amount, this.totalEquity.amount)
    return `Balance sheet not balanced for company ${this.companyId} as of ${dateStr}: Assets ${this.totalAssets.format()} != Liabilities ${this.totalLiabilities.format()} + Equity ${this.totalEquity.format()} (${BigDecimal.format(liabPlusEquity)})`
  }
}

/**
 * Type guard for BalanceSheetNotBalancedError
 */
export const isBalanceSheetNotBalancedError = Schema.is(BalanceSheetNotBalancedError)

/**
 * Union type for all balance sheet service errors
 */
export type BalanceSheetServiceError = CompanyNotFoundError | BalanceSheetNotBalancedError

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
 * BalanceSheetLineItem - A single line in the balance sheet report
 *
 * Represents either an account balance, subtotal, or section total.
 */
export class BalanceSheetLineItem extends Schema.Class<BalanceSheetLineItem>("BalanceSheetLineItem")({
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
 * Type guard for BalanceSheetLineItem
 */
export const isBalanceSheetLineItem = Schema.is(BalanceSheetLineItem)

// =============================================================================
// Section Types
// =============================================================================

/**
 * BalanceSheetSectionType - The main sections of a balance sheet
 */
export const BalanceSheetSectionType = Schema.Literal(
  "CurrentAssets",
  "NonCurrentAssets",
  "CurrentLiabilities",
  "NonCurrentLiabilities",
  "Equity"
).annotations({
  identifier: "BalanceSheetSectionType",
  title: "Balance Sheet Section Type",
  description: "The main sections of a balance sheet per ASC 210"
})

export type BalanceSheetSectionType = typeof BalanceSheetSectionType.Type

/**
 * Get the display name for a balance sheet section
 */
export const getSectionDisplayName = (section: BalanceSheetSectionType): string => {
  switch (section) {
    case "CurrentAssets":
      return "Current Assets"
    case "NonCurrentAssets":
      return "Non-Current Assets"
    case "CurrentLiabilities":
      return "Current Liabilities"
    case "NonCurrentLiabilities":
      return "Non-Current Liabilities"
    case "Equity":
      return "Equity"
  }
}

/**
 * BalanceSheetSection - A section of the balance sheet
 *
 * Contains line items and a subtotal for the section.
 */
export class BalanceSheetSection extends Schema.Class<BalanceSheetSection>("BalanceSheetSection")({
  /**
   * The section type
   */
  sectionType: BalanceSheetSectionType,

  /**
   * Display name for the section
   */
  displayName: Schema.NonEmptyTrimmedString,

  /**
   * Line items in this section
   */
  lineItems: Schema.Array(BalanceSheetLineItem),

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
 * Type guard for BalanceSheetSection
 */
export const isBalanceSheetSection = Schema.is(BalanceSheetSection)

// =============================================================================
// Report Types
// =============================================================================

/**
 * BalanceSheetReportMetadata - Metadata about the balance sheet report
 */
export class BalanceSheetReportMetadata extends Schema.Class<BalanceSheetReportMetadata>("BalanceSheetReportMetadata")({
  /**
   * The company ID
   */
  companyId: CompanyId,

  /**
   * The report date (as-of date)
   */
  asOfDate: LocalDate,

  /**
   * Optional comparative date (for prior period comparison)
   */
  comparativeDate: Schema.OptionFromNullOr(LocalDate),

  /**
   * The presentation currency used for the report
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
   * Whether the balance sheet is balanced (Assets = Liabilities + Equity)
   */
  isBalanced: Schema.Boolean
}) {}

/**
 * Type guard for BalanceSheetReportMetadata
 */
export const isBalanceSheetReportMetadata = Schema.is(BalanceSheetReportMetadata)

/**
 * BalanceSheetReport - Complete balance sheet report
 *
 * Contains metadata, sections with line items, and totals.
 * Validates that Total Assets = Total Liabilities + Total Equity.
 */
export class BalanceSheetReport extends Schema.Class<BalanceSheetReport>("BalanceSheetReport")({
  /**
   * Report metadata
   */
  metadata: BalanceSheetReportMetadata,

  /**
   * Current Assets section
   */
  currentAssets: BalanceSheetSection,

  /**
   * Non-Current Assets section
   */
  nonCurrentAssets: BalanceSheetSection,

  /**
   * Current Liabilities section
   */
  currentLiabilities: BalanceSheetSection,

  /**
   * Non-Current Liabilities section
   */
  nonCurrentLiabilities: BalanceSheetSection,

  /**
   * Equity section
   */
  equity: BalanceSheetSection,

  /**
   * Total Assets
   */
  totalAssets: MonetaryAmount,

  /**
   * Comparative Total Assets
   */
  comparativeTotalAssets: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Total Liabilities
   */
  totalLiabilities: MonetaryAmount,

  /**
   * Comparative Total Liabilities
   */
  comparativeTotalLiabilities: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Total Equity
   */
  totalEquity: MonetaryAmount,

  /**
   * Comparative Total Equity
   */
  comparativeTotalEquity: Schema.OptionFromNullOr(MonetaryAmount),

  /**
   * Total Liabilities and Equity
   */
  totalLiabilitiesAndEquity: MonetaryAmount,

  /**
   * Comparative Total Liabilities and Equity
   */
  comparativeTotalLiabilitiesAndEquity: Schema.OptionFromNullOr(MonetaryAmount)
}) {
  /**
   * Check if the balance sheet is balanced (Assets = Liabilities + Equity)
   */
  get isBalanced(): boolean {
    return BigDecimal.equals(this.totalAssets.amount, this.totalLiabilitiesAndEquity.amount)
  }

  /**
   * Get the out-of-balance amount (Assets - (Liabilities + Equity))
   * Should be zero for a balanced balance sheet
   */
  get outOfBalanceAmount(): MonetaryAmount {
    return MonetaryAmount.fromBigDecimal(
      BigDecimal.subtract(this.totalAssets.amount, this.totalLiabilitiesAndEquity.amount),
      this.totalAssets.currency
    )
  }

  /**
   * Get all sections as an array
   */
  get sections(): ReadonlyArray<BalanceSheetSection> {
    return [
      this.currentAssets,
      this.nonCurrentAssets,
      this.currentLiabilities,
      this.nonCurrentLiabilities,
      this.equity
    ]
  }

  /**
   * Get all asset sections
   */
  get assetSections(): ReadonlyArray<BalanceSheetSection> {
    return [this.currentAssets, this.nonCurrentAssets]
  }

  /**
   * Get all liability sections
   */
  get liabilitySections(): ReadonlyArray<BalanceSheetSection> {
    return [this.currentLiabilities, this.nonCurrentLiabilities]
  }

  /**
   * Get total account count across all sections
   */
  get totalAccountCount(): number {
    return this.sections.reduce((sum, section) => sum + section.accountCount, 0)
  }
}

/**
 * Type guard for BalanceSheetReport
 */
export const isBalanceSheetReport = Schema.is(BalanceSheetReport)

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * BalanceSheetRepository - Repository interface for fetching data needed for balance sheet
 */
export interface BalanceSheetRepositoryService {
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
 * BalanceSheetRepository Context.Tag
 */
export class BalanceSheetRepository extends Context.Tag("BalanceSheetRepository")<
  BalanceSheetRepository,
  BalanceSheetRepositoryService
>() {}

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * GenerateBalanceSheetInput - Input for generating a balance sheet report
 */
export interface GenerateBalanceSheetInput {
  /** The company ID */
  readonly companyId: CompanyId
  /** The as-of date for the balance sheet */
  readonly asOfDate: LocalDate
  /** Optional: Include zero balance accounts (default: false) */
  readonly includeZeroBalances?: boolean
  /** Optional: Comparative date for prior period comparison */
  readonly comparativeDate?: LocalDate
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the balance sheet section type for an account category
 */
const getSectionTypeForCategory = (category: AccountCategory): BalanceSheetSectionType | null => {
  switch (category) {
    // Current Assets
    case "CurrentAsset":
      return "CurrentAssets"
    // Non-Current Assets
    case "NonCurrentAsset":
    case "FixedAsset":
    case "IntangibleAsset":
      return "NonCurrentAssets"
    // Current Liabilities
    case "CurrentLiability":
      return "CurrentLiabilities"
    // Non-Current Liabilities
    case "NonCurrentLiability":
      return "NonCurrentLiabilities"
    // Equity
    case "ContributedCapital":
    case "RetainedEarnings":
    case "OtherComprehensiveIncome":
    case "TreasuryStock":
      return "Equity"
    // Revenue and Expense accounts are not on the balance sheet
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
      // Round to 2 decimal places
      const rounded = BigDecimal.round(pct.value, { scale: 2, mode: "half-from-zero" })
      variancePercentage = Number(BigDecimal.format(rounded))
    }
  }

  return { variance, variancePercentage }
}

/**
 * Group accounts by balance sheet section
 */
const groupAccountsBySection = (
  accounts: ReadonlyArray<Account>
): Map<BalanceSheetSectionType, ReadonlyArray<Account>> => {
  const groups = new Map<BalanceSheetSectionType, Account[]>([
    ["CurrentAssets", []],
    ["NonCurrentAssets", []],
    ["CurrentLiabilities", []],
    ["NonCurrentLiabilities", []],
    ["Equity", []]
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
 */
const buildSectionLineItems = (
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode,
  includeZeroBalances: boolean,
  comparativeDate: LocalDate | undefined,
  comparativeEntries: ReadonlyArray<JournalEntryWithLines> | undefined
): {
  lineItems: ReadonlyArray<BalanceSheetLineItem>
  subtotal: MonetaryAmount
  comparativeSubtotal: MonetaryAmount | undefined
} => {
  // Sort accounts by account number
  const accountOrder: Order.Order<Account> = Order.make(
    (a, b) => a.accountNumber < b.accountNumber ? -1 : a.accountNumber > b.accountNumber ? 1 : 0
  )
  const sortedAccounts = ReadonlyArray.sort(accounts, accountOrder)

  const lineItems: BalanceSheetLineItem[] = []
  let subtotal = BigDecimal.fromBigInt(0n)
  let comparativeSubtotal = BigDecimal.fromBigInt(0n)

  for (const account of sortedAccounts) {
    const normalBalance = getNormalBalanceForType(account.accountType)
    const balance = calculateBalance(
      account.id,
      normalBalance,
      entries,
      asOfDate,
      functionalCurrency
    )

    // Calculate comparative balance if requested
    let comparativeBalance: MonetaryAmount | undefined
    if (comparativeDate !== undefined && comparativeEntries !== undefined) {
      comparativeBalance = calculateBalance(
        account.id,
        normalBalance,
        comparativeEntries,
        comparativeDate,
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
      BalanceSheetLineItem.make({
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
    comparativeSubtotal: comparativeDate !== undefined
      ? MonetaryAmount.fromBigDecimal(comparativeSubtotal, functionalCurrency)
      : undefined
  }
}

/**
 * Build a balance sheet section
 */
const buildSection = (
  sectionType: BalanceSheetSectionType,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode,
  includeZeroBalances: boolean,
  comparativeDate: LocalDate | undefined,
  comparativeEntries: ReadonlyArray<JournalEntryWithLines> | undefined
): BalanceSheetSection => {
  const { lineItems, subtotal, comparativeSubtotal } = buildSectionLineItems(
    accounts,
    entries,
    asOfDate,
    functionalCurrency,
    includeZeroBalances,
    comparativeDate,
    comparativeEntries
  )

  return BalanceSheetSection.make({
    sectionType,
    displayName: getSectionDisplayName(sectionType),
    lineItems,
    subtotal,
    comparativeSubtotal: comparativeSubtotal !== undefined ? Option.some(comparativeSubtotal) : Option.none()
  })
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * BalanceSheetService - Service interface for generating balance sheet reports
 */
export interface BalanceSheetServiceShape {
  /**
   * Generate a balance sheet report for a company as of a specific date
   *
   * @param input - The input parameters
   * @returns Effect containing the balance sheet report
   * @throws CompanyNotFoundError if the company doesn't exist
   * @throws BalanceSheetNotBalancedError if Assets != Liabilities + Equity
   */
  readonly generateBalanceSheet: (
    input: GenerateBalanceSheetInput
  ) => Effect.Effect<
    BalanceSheetReport,
    CompanyNotFoundError | BalanceSheetNotBalancedError,
    never
  >
}

/**
 * BalanceSheetService Context.Tag
 */
export class BalanceSheetService extends Context.Tag("BalanceSheetService")<
  BalanceSheetService,
  BalanceSheetServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the BalanceSheetService implementation
 */
const make = Effect.gen(function* () {
  const repository = yield* BalanceSheetRepository

  return {
    generateBalanceSheet: (input: GenerateBalanceSheetInput) =>
      Effect.gen(function* () {
        const {
          companyId,
          asOfDate,
          includeZeroBalances = false,
          comparativeDate
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

        // For comparative, we use the same entries but filter by date in calculateBalance
        const comparativeEntries = comparativeDate !== undefined ? entries : undefined

        // Group accounts by section
        const accountsBySection = groupAccountsBySection(accounts)

        // Build each section
        const currentAssets = buildSection(
          "CurrentAssets",
          accountsBySection.get("CurrentAssets") || [],
          entries,
          asOfDate,
          functionalCurrency,
          includeZeroBalances,
          comparativeDate,
          comparativeEntries
        )

        const nonCurrentAssets = buildSection(
          "NonCurrentAssets",
          accountsBySection.get("NonCurrentAssets") || [],
          entries,
          asOfDate,
          functionalCurrency,
          includeZeroBalances,
          comparativeDate,
          comparativeEntries
        )

        const currentLiabilities = buildSection(
          "CurrentLiabilities",
          accountsBySection.get("CurrentLiabilities") || [],
          entries,
          asOfDate,
          functionalCurrency,
          includeZeroBalances,
          comparativeDate,
          comparativeEntries
        )

        const nonCurrentLiabilities = buildSection(
          "NonCurrentLiabilities",
          accountsBySection.get("NonCurrentLiabilities") || [],
          entries,
          asOfDate,
          functionalCurrency,
          includeZeroBalances,
          comparativeDate,
          comparativeEntries
        )

        const equity = buildSection(
          "Equity",
          accountsBySection.get("Equity") || [],
          entries,
          asOfDate,
          functionalCurrency,
          includeZeroBalances,
          comparativeDate,
          comparativeEntries
        )

        // Calculate totals
        const totalAssets = MonetaryAmount.fromBigDecimal(
          BigDecimal.sum(currentAssets.subtotal.amount, nonCurrentAssets.subtotal.amount),
          functionalCurrency
        )

        const totalLiabilities = MonetaryAmount.fromBigDecimal(
          BigDecimal.sum(currentLiabilities.subtotal.amount, nonCurrentLiabilities.subtotal.amount),
          functionalCurrency
        )

        const totalEquity = equity.subtotal

        const totalLiabilitiesAndEquity = MonetaryAmount.fromBigDecimal(
          BigDecimal.sum(totalLiabilities.amount, totalEquity.amount),
          functionalCurrency
        )

        // Calculate comparative totals if applicable
        let comparativeTotalAssets: MonetaryAmount | undefined
        let comparativeTotalLiabilities: MonetaryAmount | undefined
        let comparativeTotalEquity: MonetaryAmount | undefined
        let comparativeTotalLiabilitiesAndEquity: MonetaryAmount | undefined

        if (comparativeDate !== undefined) {
          const compCurrentAssetsSubtotal = Option.getOrElse(
            currentAssets.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          const compNonCurrentAssetsSubtotal = Option.getOrElse(
            nonCurrentAssets.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          comparativeTotalAssets = MonetaryAmount.fromBigDecimal(
            BigDecimal.sum(compCurrentAssetsSubtotal.amount, compNonCurrentAssetsSubtotal.amount),
            functionalCurrency
          )

          const compCurrentLiabilitiesSubtotal = Option.getOrElse(
            currentLiabilities.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          const compNonCurrentLiabilitiesSubtotal = Option.getOrElse(
            nonCurrentLiabilities.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )
          comparativeTotalLiabilities = MonetaryAmount.fromBigDecimal(
            BigDecimal.sum(compCurrentLiabilitiesSubtotal.amount, compNonCurrentLiabilitiesSubtotal.amount),
            functionalCurrency
          )

          comparativeTotalEquity = Option.getOrElse(
            equity.comparativeSubtotal,
            () => MonetaryAmount.zero(functionalCurrency)
          )

          comparativeTotalLiabilitiesAndEquity = MonetaryAmount.fromBigDecimal(
            BigDecimal.sum(comparativeTotalLiabilities.amount, comparativeTotalEquity.amount),
            functionalCurrency
          )
        }

        // Validate that Assets = Liabilities + Equity
        const isBalanced = BigDecimal.equals(totalAssets.amount, totalLiabilitiesAndEquity.amount)
        if (!isBalanced) {
          return yield* Effect.fail(
            new BalanceSheetNotBalancedError({
              companyId,
              asOfDate: {
                year: asOfDate.year,
                month: asOfDate.month,
                day: asOfDate.day
              },
              totalAssets,
              totalLiabilities,
              totalEquity
            })
          )
        }

        // Count total accounts
        const accountCount =
          currentAssets.accountCount +
          nonCurrentAssets.accountCount +
          currentLiabilities.accountCount +
          nonCurrentLiabilities.accountCount +
          equity.accountCount

        // Generate timestamp
        const generatedAt = yield* timestampNowEffect

        // Create metadata
        const metadata = BalanceSheetReportMetadata.make({
          companyId,
          asOfDate,
          comparativeDate: comparativeDate !== undefined ? Option.some(comparativeDate) : Option.none(),
          currency: functionalCurrency,
          generatedAt,
          accountCount,
          isBalanced
        })

        // Create and return the report
        return BalanceSheetReport.make({
          metadata,
          currentAssets,
          nonCurrentAssets,
          currentLiabilities,
          nonCurrentLiabilities,
          equity,
          totalAssets,
          comparativeTotalAssets: comparativeTotalAssets !== undefined ? Option.some(comparativeTotalAssets) : Option.none(),
          totalLiabilities,
          comparativeTotalLiabilities: comparativeTotalLiabilities !== undefined ? Option.some(comparativeTotalLiabilities) : Option.none(),
          totalEquity,
          comparativeTotalEquity: comparativeTotalEquity !== undefined ? Option.some(comparativeTotalEquity) : Option.none(),
          totalLiabilitiesAndEquity,
          comparativeTotalLiabilitiesAndEquity: comparativeTotalLiabilitiesAndEquity !== undefined ? Option.some(comparativeTotalLiabilitiesAndEquity) : Option.none()
        })
      })
  } satisfies BalanceSheetServiceShape
})

/**
 * BalanceSheetServiceLive - Live implementation of BalanceSheetService
 *
 * Requires BalanceSheetRepository
 */
export const BalanceSheetServiceLive: Layer.Layer<
  BalanceSheetService,
  never,
  BalanceSheetRepository
> = Layer.effect(BalanceSheetService, make)

// =============================================================================
// Pure Functions for Direct Use (without repository)
// =============================================================================

/**
 * Generate a balance sheet from provided accounts and journal entries
 *
 * This is a pure function that can be used directly without the service layer
 * when all data is already available in memory.
 *
 * @param companyId - The company ID
 * @param accounts - All accounts for the company
 * @param entries - All posted journal entries with lines
 * @param asOfDate - The as-of date for the balance sheet
 * @param functionalCurrency - The functional currency for calculations
 * @param options - Optional parameters
 * @returns Effect containing the balance sheet report
 */
export const generateBalanceSheetFromData = (
  companyId: CompanyId,
  accounts: ReadonlyArray<Account>,
  entries: ReadonlyArray<JournalEntryWithLines>,
  asOfDate: LocalDate,
  functionalCurrency: CurrencyCode,
  options?: {
    includeZeroBalances?: boolean
    comparativeDate?: LocalDate
  }
): Effect.Effect<BalanceSheetReport, BalanceSheetNotBalancedError> =>
  Effect.gen(function* () {
    const { includeZeroBalances = false, comparativeDate } = options ?? {}

    // For comparative, we use the same entries but filter by date in calculateBalance
    const comparativeEntries = comparativeDate !== undefined ? entries : undefined

    // Group accounts by section
    const accountsBySection = groupAccountsBySection(accounts)

    // Build each section
    const currentAssets = buildSection(
      "CurrentAssets",
      accountsBySection.get("CurrentAssets") || [],
      entries,
      asOfDate,
      functionalCurrency,
      includeZeroBalances,
      comparativeDate,
      comparativeEntries
    )

    const nonCurrentAssets = buildSection(
      "NonCurrentAssets",
      accountsBySection.get("NonCurrentAssets") || [],
      entries,
      asOfDate,
      functionalCurrency,
      includeZeroBalances,
      comparativeDate,
      comparativeEntries
    )

    const currentLiabilities = buildSection(
      "CurrentLiabilities",
      accountsBySection.get("CurrentLiabilities") || [],
      entries,
      asOfDate,
      functionalCurrency,
      includeZeroBalances,
      comparativeDate,
      comparativeEntries
    )

    const nonCurrentLiabilities = buildSection(
      "NonCurrentLiabilities",
      accountsBySection.get("NonCurrentLiabilities") || [],
      entries,
      asOfDate,
      functionalCurrency,
      includeZeroBalances,
      comparativeDate,
      comparativeEntries
    )

    const equity = buildSection(
      "Equity",
      accountsBySection.get("Equity") || [],
      entries,
      asOfDate,
      functionalCurrency,
      includeZeroBalances,
      comparativeDate,
      comparativeEntries
    )

    // Calculate totals
    const totalAssets = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(currentAssets.subtotal.amount, nonCurrentAssets.subtotal.amount),
      functionalCurrency
    )

    const totalLiabilities = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(currentLiabilities.subtotal.amount, nonCurrentLiabilities.subtotal.amount),
      functionalCurrency
    )

    const totalEquity = equity.subtotal

    const totalLiabilitiesAndEquity = MonetaryAmount.fromBigDecimal(
      BigDecimal.sum(totalLiabilities.amount, totalEquity.amount),
      functionalCurrency
    )

    // Calculate comparative totals if applicable
    let comparativeTotalAssets: MonetaryAmount | undefined
    let comparativeTotalLiabilities: MonetaryAmount | undefined
    let comparativeTotalEquity: MonetaryAmount | undefined
    let comparativeTotalLiabilitiesAndEquity: MonetaryAmount | undefined

    if (comparativeDate !== undefined) {
      const compCurrentAssetsSubtotal = Option.getOrElse(
        currentAssets.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      const compNonCurrentAssetsSubtotal = Option.getOrElse(
        nonCurrentAssets.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      comparativeTotalAssets = MonetaryAmount.fromBigDecimal(
        BigDecimal.sum(compCurrentAssetsSubtotal.amount, compNonCurrentAssetsSubtotal.amount),
        functionalCurrency
      )

      const compCurrentLiabilitiesSubtotal = Option.getOrElse(
        currentLiabilities.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      const compNonCurrentLiabilitiesSubtotal = Option.getOrElse(
        nonCurrentLiabilities.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )
      comparativeTotalLiabilities = MonetaryAmount.fromBigDecimal(
        BigDecimal.sum(compCurrentLiabilitiesSubtotal.amount, compNonCurrentLiabilitiesSubtotal.amount),
        functionalCurrency
      )

      comparativeTotalEquity = Option.getOrElse(
        equity.comparativeSubtotal,
        () => MonetaryAmount.zero(functionalCurrency)
      )

      comparativeTotalLiabilitiesAndEquity = MonetaryAmount.fromBigDecimal(
        BigDecimal.sum(comparativeTotalLiabilities.amount, comparativeTotalEquity.amount),
        functionalCurrency
      )
    }

    // Validate that Assets = Liabilities + Equity
    const isBalanced = BigDecimal.equals(totalAssets.amount, totalLiabilitiesAndEquity.amount)
    if (!isBalanced) {
      return yield* Effect.fail(
        new BalanceSheetNotBalancedError({
          companyId,
          asOfDate: {
            year: asOfDate.year,
            month: asOfDate.month,
            day: asOfDate.day
          },
          totalAssets,
          totalLiabilities,
          totalEquity
        })
      )
    }

    // Count total accounts
    const accountCount =
      currentAssets.accountCount +
      nonCurrentAssets.accountCount +
      currentLiabilities.accountCount +
      nonCurrentLiabilities.accountCount +
      equity.accountCount

    // Generate timestamp
    const generatedAt = yield* timestampNowEffect

    // Create metadata
    const metadata = BalanceSheetReportMetadata.make({
      companyId,
      asOfDate,
      comparativeDate: comparativeDate !== undefined ? Option.some(comparativeDate) : Option.none(),
      currency: functionalCurrency,
      generatedAt,
      accountCount,
      isBalanced
    })

    // Create and return the report
    return BalanceSheetReport.make({
      metadata,
      currentAssets,
      nonCurrentAssets,
      currentLiabilities,
      nonCurrentLiabilities,
      equity,
      totalAssets,
      comparativeTotalAssets: comparativeTotalAssets !== undefined ? Option.some(comparativeTotalAssets) : Option.none(),
      totalLiabilities,
      comparativeTotalLiabilities: comparativeTotalLiabilities !== undefined ? Option.some(comparativeTotalLiabilities) : Option.none(),
      totalEquity,
      comparativeTotalEquity: comparativeTotalEquity !== undefined ? Option.some(comparativeTotalEquity) : Option.none(),
      totalLiabilitiesAndEquity,
      comparativeTotalLiabilitiesAndEquity: comparativeTotalLiabilitiesAndEquity !== undefined ? Option.some(comparativeTotalLiabilitiesAndEquity) : Option.none()
    })
  })
