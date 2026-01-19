/**
 * ConsolidatedReportService - Consolidated Financial Report generation service
 *
 * Transforms a ConsolidatedTrialBalance (from a completed consolidation run) into
 * standard financial report formats per ASC 210, ASC 220, ASC 230, and ASC 810.
 *
 * Reports generated:
 * - Consolidated Balance Sheet - Assets, Liabilities, Equity with NCI per ASC 210/810
 * - Consolidated Income Statement - Revenue, Expenses, Net Income with NCI attribution per ASC 220/810
 * - Consolidated Cash Flow Statement - Operating, Investing, Financing activities per ASC 230
 * - Consolidated Statement of Changes in Equity - Equity movements with NCI per ASC 810
 *
 * The consolidated trial balance already contains:
 * - Aggregated balances from all member companies (after currency translation)
 * - Elimination amounts (intercompany transactions removed)
 * - NCI amounts (non-controlling interest portions)
 * - Final consolidated balances
 *
 * @module ConsolidatedReportService
 */

import * as BigDecimal from "effect/BigDecimal"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type { AccountCategory } from "../accounting/Account.ts"
import {
  ConsolidationRunId,
  type ConsolidatedTrialBalance,
  type ConsolidatedTrialBalanceLineItem
} from "../consolidation/ConsolidationRun.ts"
import { CurrencyCode } from "../currency/CurrencyCode.ts"
import { FiscalPeriodRef } from "../fiscal/FiscalPeriodRef.ts"
import { LocalDateFromString } from "../shared/values/LocalDate.ts"

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error when the consolidated trial balance is not available
 */
export class ConsolidatedTrialBalanceNotAvailableError extends Schema.TaggedError<ConsolidatedTrialBalanceNotAvailableError>()(
  "ConsolidatedTrialBalanceNotAvailableError",
  {
    runId: ConsolidationRunId
  }
) {
  get message(): string {
    return `Consolidated trial balance not available for run: ${this.runId}`
  }
}

/**
 * Type guard for ConsolidatedTrialBalanceNotAvailableError
 */
export const isConsolidatedTrialBalanceNotAvailableError = Schema.is(ConsolidatedTrialBalanceNotAvailableError)

/**
 * Error when the balance sheet does not balance
 */
export class ConsolidatedBalanceSheetNotBalancedError extends Schema.TaggedError<ConsolidatedBalanceSheetNotBalancedError>()(
  "ConsolidatedBalanceSheetNotBalancedError",
  {
    runId: ConsolidationRunId,
    totalAssets: Schema.Number,
    totalLiabilitiesAndEquity: Schema.Number
  }
) {
  get message(): string {
    return `Consolidated balance sheet not balanced for run ${this.runId}: Assets ${this.totalAssets} != Liabilities + Equity ${this.totalLiabilitiesAndEquity}`
  }
}

/**
 * Type guard for ConsolidatedBalanceSheetNotBalancedError
 */
export const isConsolidatedBalanceSheetNotBalancedError = Schema.is(ConsolidatedBalanceSheetNotBalancedError)

/**
 * Union type for all consolidated report service errors
 */
export type ConsolidatedReportServiceError =
  | ConsolidatedTrialBalanceNotAvailableError
  | ConsolidatedBalanceSheetNotBalancedError

// =============================================================================
// Report Line Item Types
// =============================================================================

/**
 * ReportLineItemStyle - Visual style for report line items
 */
export const ReportLineItemStyle = Schema.Literal(
  "Normal",
  "Subtotal",
  "Total",
  "Header"
).annotations({
  identifier: "ReportLineItemStyle",
  title: "Report Line Item Style",
  description: "Visual style for a report line item"
})

export type ReportLineItemStyle = typeof ReportLineItemStyle.Type

/**
 * ConsolidatedReportLineItem - A single line in a consolidated report
 */
export class ConsolidatedReportLineItem extends Schema.Class<ConsolidatedReportLineItem>("ConsolidatedReportLineItem")({
  /**
   * Description text (account name or section label)
   */
  description: Schema.NonEmptyTrimmedString,

  /**
   * The amount to display
   */
  amount: Schema.Number,

  /**
   * Visual style for the line
   */
  style: ReportLineItemStyle,

  /**
   * Indent level for hierarchical display (0-based)
   */
  indentLevel: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * Type guard for ConsolidatedReportLineItem
 */
export const isConsolidatedReportLineItem = Schema.is(ConsolidatedReportLineItem)

/**
 * ConsolidatedReportSection - A section of a consolidated report
 */
export class ConsolidatedReportSection extends Schema.Class<ConsolidatedReportSection>("ConsolidatedReportSection")({
  /**
   * Section title
   */
  title: Schema.NonEmptyTrimmedString,

  /**
   * Line items in this section
   */
  lineItems: Schema.Array(ConsolidatedReportLineItem),

  /**
   * Subtotal for this section
   */
  subtotal: Schema.Number
}) {}

/**
 * Type guard for ConsolidatedReportSection
 */
export const isConsolidatedReportSection = Schema.is(ConsolidatedReportSection)

// =============================================================================
// Balance Sheet Report
// =============================================================================

/**
 * ConsolidatedBalanceSheetReport - Consolidated balance sheet from a completed run
 */
export class ConsolidatedBalanceSheetReport extends Schema.Class<ConsolidatedBalanceSheetReport>("ConsolidatedBalanceSheetReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  currentAssets: ConsolidatedReportSection,
  nonCurrentAssets: ConsolidatedReportSection,
  totalAssets: Schema.Number,
  currentLiabilities: ConsolidatedReportSection,
  nonCurrentLiabilities: ConsolidatedReportSection,
  totalLiabilities: Schema.Number,
  equity: ConsolidatedReportSection,
  nonControllingInterest: Schema.Number,
  totalEquity: Schema.Number,
  totalLiabilitiesAndEquity: Schema.Number
}) {}

/**
 * Type guard for ConsolidatedBalanceSheetReport
 */
export const isConsolidatedBalanceSheetReport = Schema.is(ConsolidatedBalanceSheetReport)

// =============================================================================
// Income Statement Report
// =============================================================================

/**
 * ConsolidatedIncomeStatementReport - Consolidated income statement from a completed run
 */
export class ConsolidatedIncomeStatementReport extends Schema.Class<ConsolidatedIncomeStatementReport>("ConsolidatedIncomeStatementReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  revenue: ConsolidatedReportSection,
  costOfSales: ConsolidatedReportSection,
  grossProfit: Schema.Number,
  operatingExpenses: ConsolidatedReportSection,
  operatingIncome: Schema.Number,
  otherIncomeExpense: ConsolidatedReportSection,
  incomeBeforeTax: Schema.Number,
  taxExpense: Schema.Number,
  netIncome: Schema.Number,
  netIncomeAttributableToParent: Schema.Number,
  netIncomeAttributableToNCI: Schema.Number
}) {}

/**
 * Type guard for ConsolidatedIncomeStatementReport
 */
export const isConsolidatedIncomeStatementReport = Schema.is(ConsolidatedIncomeStatementReport)

// =============================================================================
// Cash Flow Statement Report
// =============================================================================

/**
 * ConsolidatedCashFlowReport - Consolidated cash flow statement from a completed run
 */
export class ConsolidatedCashFlowReport extends Schema.Class<ConsolidatedCashFlowReport>("ConsolidatedCashFlowReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  operatingActivities: ConsolidatedReportSection,
  investingActivities: ConsolidatedReportSection,
  financingActivities: ConsolidatedReportSection,
  netChangeInCash: Schema.Number,
  beginningCash: Schema.Number,
  endingCash: Schema.Number
}) {}

/**
 * Type guard for ConsolidatedCashFlowReport
 */
export const isConsolidatedCashFlowReport = Schema.is(ConsolidatedCashFlowReport)

// =============================================================================
// Equity Statement Report
// =============================================================================

/**
 * EquityMovementRow - A row in the equity statement showing movements
 */
export class EquityMovementRow extends Schema.Class<EquityMovementRow>("EquityMovementRow")({
  description: Schema.NonEmptyTrimmedString,
  commonStock: Schema.Number,
  additionalPaidInCapital: Schema.Number,
  retainedEarnings: Schema.Number,
  accumulatedOCI: Schema.Number,
  nonControllingInterest: Schema.Number,
  total: Schema.Number
}) {}

/**
 * Type guard for EquityMovementRow
 */
export const isEquityMovementRow = Schema.is(EquityMovementRow)

/**
 * ConsolidatedEquityStatementReport - Consolidated statement of changes in equity
 */
export class ConsolidatedEquityStatementReport extends Schema.Class<ConsolidatedEquityStatementReport>("ConsolidatedEquityStatementReport")({
  runId: ConsolidationRunId,
  groupName: Schema.NonEmptyTrimmedString,
  periodRef: FiscalPeriodRef,
  asOfDate: LocalDateFromString,
  currency: CurrencyCode,
  openingBalance: EquityMovementRow,
  movements: Schema.Array(EquityMovementRow),
  closingBalance: EquityMovementRow
}) {}

/**
 * Type guard for ConsolidatedEquityStatementReport
 */
export const isConsolidatedEquityStatementReport = Schema.is(ConsolidatedEquityStatementReport)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a BigDecimal to number for report display
 */
const toNumber = (bd: BigDecimal.BigDecimal): number => {
  return Number(BigDecimal.format(bd))
}

/**
 * Get the consolidated balance as a number (positive for normal balance direction)
 */
const getConsolidatedAmount = (lineItem: ConsolidatedTrialBalanceLineItem): number => {
  return toNumber(lineItem.consolidatedBalance.amount)
}

/**
 * Get the NCI amount as a number (or 0 if none)
 */
const getNCIAmount = (lineItem: ConsolidatedTrialBalanceLineItem): number => {
  return Option.match(lineItem.nciAmount, {
    onNone: () => 0,
    onSome: (amt) => toNumber(amt.amount)
  })
}

/**
 * Build a report section from filtered line items
 */
const buildReportSection = (
  title: string,
  lineItems: ReadonlyArray<ConsolidatedTrialBalanceLineItem>
): ConsolidatedReportSection => {
  const reportLineItems: ConsolidatedReportLineItem[] = []
  let subtotal = 0

  // Sort by account number
  const sorted = [...lineItems].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))

  for (const item of sorted) {
    const amount = getConsolidatedAmount(item)
    subtotal += amount
    reportLineItems.push(
      ConsolidatedReportLineItem.make({
        description: `${item.accountNumber} - ${item.accountName}`,
        amount,
        style: "Normal",
        indentLevel: 1
      })
    )
  }

  return ConsolidatedReportSection.make({
    title,
    lineItems: reportLineItems,
    subtotal
  })
}

/**
 * Filter line items by account categories
 */
const filterByCategories = (
  lineItems: ReadonlyArray<ConsolidatedTrialBalanceLineItem>,
  categories: ReadonlyArray<AccountCategory>
): ReadonlyArray<ConsolidatedTrialBalanceLineItem> => {
  return lineItems.filter((item) => categories.includes(item.accountCategory))
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * GenerateBalanceSheetInput - Input for generating a consolidated balance sheet
 */
export interface GenerateBalanceSheetInput {
  readonly trialBalance: ConsolidatedTrialBalance
  readonly groupName: string
}

/**
 * GenerateIncomeStatementInput - Input for generating a consolidated income statement
 */
export interface GenerateIncomeStatementInput {
  readonly trialBalance: ConsolidatedTrialBalance
  readonly groupName: string
}

/**
 * GenerateCashFlowInput - Input for generating a consolidated cash flow statement
 */
export interface GenerateCashFlowInput {
  readonly trialBalance: ConsolidatedTrialBalance
  readonly groupName: string
  readonly priorTrialBalance?: ConsolidatedTrialBalance
}

/**
 * GenerateEquityStatementInput - Input for generating a consolidated equity statement
 */
export interface GenerateEquityStatementInput {
  readonly trialBalance: ConsolidatedTrialBalance
  readonly groupName: string
  readonly priorTrialBalance?: ConsolidatedTrialBalance
}

/**
 * ConsolidatedReportServiceShape - Service interface for generating consolidated reports
 */
export interface ConsolidatedReportServiceShape {
  /**
   * Generate a consolidated balance sheet from a trial balance
   */
  readonly generateBalanceSheet: (
    input: GenerateBalanceSheetInput
  ) => Effect.Effect<ConsolidatedBalanceSheetReport, ConsolidatedBalanceSheetNotBalancedError>

  /**
   * Generate a consolidated income statement from a trial balance
   */
  readonly generateIncomeStatement: (
    input: GenerateIncomeStatementInput
  ) => Effect.Effect<ConsolidatedIncomeStatementReport>

  /**
   * Generate a consolidated cash flow statement from a trial balance
   * Note: Requires prior period trial balance for full accuracy
   */
  readonly generateCashFlow: (
    input: GenerateCashFlowInput
  ) => Effect.Effect<ConsolidatedCashFlowReport>

  /**
   * Generate a consolidated statement of changes in equity
   * Note: Requires prior period trial balance for full accuracy
   */
  readonly generateEquityStatement: (
    input: GenerateEquityStatementInput
  ) => Effect.Effect<ConsolidatedEquityStatementReport>
}

/**
 * ConsolidatedReportService Context.Tag
 */
export class ConsolidatedReportService extends Context.Tag("ConsolidatedReportService")<
  ConsolidatedReportService,
  ConsolidatedReportServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the ConsolidatedReportService implementation
 */
const make: ConsolidatedReportServiceShape = {
  generateBalanceSheet: (input: GenerateBalanceSheetInput) =>
    Effect.gen(function* () {
      const { trialBalance, groupName } = input
      const lineItems = Chunk.toReadonlyArray(trialBalance.lineItems)

      // Group line items by balance sheet section using accountCategory
      const currentAssetsItems = filterByCategories(lineItems, ["CurrentAsset"])
      const nonCurrentAssetsItems = filterByCategories(lineItems, ["NonCurrentAsset", "FixedAsset", "IntangibleAsset"])
      const currentLiabilitiesItems = filterByCategories(lineItems, ["CurrentLiability"])
      const nonCurrentLiabilitiesItems = filterByCategories(lineItems, ["NonCurrentLiability"])
      const equityItems = filterByCategories(lineItems, ["ContributedCapital", "RetainedEarnings", "OtherComprehensiveIncome", "TreasuryStock"])

      // Build sections
      const currentAssets = buildReportSection("Current Assets", currentAssetsItems)
      const nonCurrentAssets = buildReportSection("Non-Current Assets", nonCurrentAssetsItems)
      const currentLiabilities = buildReportSection("Current Liabilities", currentLiabilitiesItems)
      const nonCurrentLiabilities = buildReportSection("Non-Current Liabilities", nonCurrentLiabilitiesItems)
      const equity = buildReportSection("Equity", equityItems)

      // Calculate totals
      const totalAssets = currentAssets.subtotal + nonCurrentAssets.subtotal
      const totalLiabilities = currentLiabilities.subtotal + nonCurrentLiabilities.subtotal

      // Calculate NCI from equity items
      let nonControllingInterest = 0
      for (const item of equityItems) {
        nonControllingInterest += getNCIAmount(item)
      }

      // Parent equity = total equity - NCI
      const totalEquity = equity.subtotal + nonControllingInterest
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

      // Validate balance sheet equation (allowing for small rounding differences)
      const tolerance = 0.01
      if (Math.abs(totalAssets - totalLiabilitiesAndEquity) > tolerance) {
        return yield* Effect.fail(
          new ConsolidatedBalanceSheetNotBalancedError({
            runId: trialBalance.consolidationRunId,
            totalAssets,
            totalLiabilitiesAndEquity
          })
        )
      }

      return ConsolidatedBalanceSheetReport.make({
        runId: trialBalance.consolidationRunId,
        groupName,
        asOfDate: trialBalance.asOfDate,
        currency: trialBalance.currency,
        currentAssets,
        nonCurrentAssets,
        totalAssets,
        currentLiabilities,
        nonCurrentLiabilities,
        totalLiabilities,
        equity,
        nonControllingInterest,
        totalEquity,
        totalLiabilitiesAndEquity
      })
    }),

  generateIncomeStatement: (input: GenerateIncomeStatementInput) =>
    Effect.gen(function* () {
      const { trialBalance, groupName } = input
      const lineItems = Chunk.toReadonlyArray(trialBalance.lineItems)

      // Group line items by income statement section using accountCategory
      const revenueItems = filterByCategories(lineItems, ["OperatingRevenue"])
      const costOfSalesItems = filterByCategories(lineItems, ["CostOfGoodsSold"])
      const operatingExpenseItems = filterByCategories(lineItems, ["OperatingExpense", "DepreciationAmortization"])
      const otherItems = filterByCategories(lineItems, ["OtherRevenue", "InterestExpense", "OtherExpense"])
      const taxItems = filterByCategories(lineItems, ["TaxExpense"])

      // Build sections
      const revenue = buildReportSection("Revenue", revenueItems)
      const costOfSales = buildReportSection("Cost of Sales", costOfSalesItems)
      const operatingExpenses = buildReportSection("Operating Expenses", operatingExpenseItems)
      const otherIncomeExpense = buildReportSection("Other Income/Expense", otherItems)

      // Calculate income statement line items
      // Revenue is credit balance (positive), expenses are debit balance (positive = expense)
      // For display: Revenue - Expenses = Income
      const grossProfit = revenue.subtotal - costOfSales.subtotal
      const operatingIncome = grossProfit - operatingExpenses.subtotal
      const incomeBeforeTax = operatingIncome + otherIncomeExpense.subtotal

      // Tax expense
      let taxExpense = 0
      for (const item of taxItems) {
        taxExpense += getConsolidatedAmount(item)
      }

      const netIncome = incomeBeforeTax - taxExpense

      // Calculate NCI portion of net income
      let nciIncome = 0
      for (const item of [...revenueItems, ...costOfSalesItems, ...operatingExpenseItems, ...otherItems, ...taxItems]) {
        nciIncome += getNCIAmount(item)
      }

      const netIncomeAttributableToNCI = nciIncome
      const netIncomeAttributableToParent = netIncome - netIncomeAttributableToNCI

      return ConsolidatedIncomeStatementReport.make({
        runId: trialBalance.consolidationRunId,
        groupName,
        periodRef: trialBalance.periodRef,
        asOfDate: trialBalance.asOfDate,
        currency: trialBalance.currency,
        revenue,
        costOfSales,
        grossProfit,
        operatingExpenses,
        operatingIncome,
        otherIncomeExpense,
        incomeBeforeTax,
        taxExpense,
        netIncome,
        netIncomeAttributableToParent,
        netIncomeAttributableToNCI
      })
    }),

  generateCashFlow: (input: GenerateCashFlowInput) =>
    Effect.gen(function* () {
      const { trialBalance, groupName, priorTrialBalance: _priorTrialBalance } = input
      const lineItems = Chunk.toReadonlyArray(trialBalance.lineItems)

      // For a proper cash flow statement, we need to calculate changes from prior period
      // This is a simplified implementation that categorizes accounts into activities

      // Operating activities: changes in current assets/liabilities (except cash)
      const currentAssetsItems = filterByCategories(lineItems, ["CurrentAsset"])
      const currentLiabilitiesItems = filterByCategories(lineItems, ["CurrentLiability"])

      // For now, show current balances as a starting point
      // A full implementation would calculate period-over-period changes
      const operatingActivities = buildReportSection("Operating Activities", [
        ...currentAssetsItems,
        ...currentLiabilitiesItems
      ])

      // Investing activities: changes in non-current assets
      const nonCurrentAssetsItems = filterByCategories(lineItems, ["NonCurrentAsset", "FixedAsset", "IntangibleAsset"])
      const investingActivities = buildReportSection("Investing Activities", nonCurrentAssetsItems)

      // Financing activities: changes in non-current liabilities and equity
      const nonCurrentLiabilitiesItems = filterByCategories(lineItems, ["NonCurrentLiability"])
      const equityItems = filterByCategories(lineItems, ["ContributedCapital", "TreasuryStock"])
      const financingActivities = buildReportSection("Financing Activities", [
        ...nonCurrentLiabilitiesItems,
        ...equityItems
      ])

      // Calculate totals
      // Note: This is simplified - a real implementation would use indirect method adjustments
      const netChangeInCash = operatingActivities.subtotal + investingActivities.subtotal + financingActivities.subtotal

      // Find cash account in current assets for beginning/ending balances
      const cashItems = currentAssetsItems.filter((item) =>
        item.accountName.toLowerCase().includes("cash") ||
        item.accountNumber.startsWith("1")
      )
      const endingCash = cashItems.reduce((sum, item) => sum + getConsolidatedAmount(item), 0)
      const beginningCash = endingCash - netChangeInCash

      return ConsolidatedCashFlowReport.make({
        runId: trialBalance.consolidationRunId,
        groupName,
        periodRef: trialBalance.periodRef,
        asOfDate: trialBalance.asOfDate,
        currency: trialBalance.currency,
        operatingActivities,
        investingActivities,
        financingActivities,
        netChangeInCash,
        beginningCash,
        endingCash
      })
    }),

  generateEquityStatement: (input: GenerateEquityStatementInput) =>
    Effect.gen(function* () {
      const { trialBalance, groupName, priorTrialBalance: _priorTrialBalance } = input
      const lineItems = Chunk.toReadonlyArray(trialBalance.lineItems)

      // Get equity account balances
      const contributedCapitalItems = filterByCategories(lineItems, ["ContributedCapital"])
      const retainedEarningsItems = filterByCategories(lineItems, ["RetainedEarnings"])
      const ociItems = filterByCategories(lineItems, ["OtherComprehensiveIncome"])
      const treasuryStockItems = filterByCategories(lineItems, ["TreasuryStock"])

      // Calculate current period ending balances
      const commonStock = contributedCapitalItems.reduce((sum, item) => sum + getConsolidatedAmount(item), 0)
      const additionalPaidInCapital = 0 // Would need more detailed account classification
      const retainedEarnings = retainedEarningsItems.reduce((sum, item) => sum + getConsolidatedAmount(item), 0)
      const accumulatedOCI = ociItems.reduce((sum, item) => sum + getConsolidatedAmount(item), 0)
      const treasuryStock = treasuryStockItems.reduce((sum, item) => sum + getConsolidatedAmount(item), 0)

      // Calculate NCI
      let nonControllingInterest = 0
      const allEquityItems = [...contributedCapitalItems, ...retainedEarningsItems, ...ociItems, ...treasuryStockItems]
      for (const item of allEquityItems) {
        nonControllingInterest += getNCIAmount(item)
      }

      // Calculate totals
      const total = commonStock + additionalPaidInCapital + retainedEarnings + accumulatedOCI - treasuryStock + nonControllingInterest

      // Opening balance would come from prior period
      // For now, assume zero if no prior period provided
      const openingBalance = EquityMovementRow.make({
        description: "Opening Balance",
        commonStock: _priorTrialBalance ? 0 : 0, // Would need prior period data
        additionalPaidInCapital: 0,
        retainedEarnings: 0,
        accumulatedOCI: 0,
        nonControllingInterest: 0,
        total: 0
      })

      // Net income movement (from income statement)
      const revenueItems = filterByCategories(lineItems, ["OperatingRevenue", "OtherRevenue"])
      const expenseItems = filterByCategories(lineItems, ["CostOfGoodsSold", "OperatingExpense", "DepreciationAmortization", "InterestExpense", "TaxExpense", "OtherExpense"])
      const totalRevenue = revenueItems.reduce((sum, item) => sum + getConsolidatedAmount(item), 0)
      const totalExpenses = expenseItems.reduce((sum, item) => sum + getConsolidatedAmount(item), 0)
      const netIncome = totalRevenue - totalExpenses

      // NCI portion of net income
      let nciNetIncome = 0
      for (const item of [...revenueItems, ...expenseItems]) {
        nciNetIncome += getNCIAmount(item)
      }

      const movements: EquityMovementRow[] = [
        EquityMovementRow.make({
          description: "Net Income",
          commonStock: 0,
          additionalPaidInCapital: 0,
          retainedEarnings: netIncome - nciNetIncome,
          accumulatedOCI: 0,
          nonControllingInterest: nciNetIncome,
          total: netIncome
        })
      ]

      const closingBalance = EquityMovementRow.make({
        description: "Closing Balance",
        commonStock,
        additionalPaidInCapital,
        retainedEarnings,
        accumulatedOCI,
        nonControllingInterest,
        total
      })

      return ConsolidatedEquityStatementReport.make({
        runId: trialBalance.consolidationRunId,
        groupName,
        periodRef: trialBalance.periodRef,
        asOfDate: trialBalance.asOfDate,
        currency: trialBalance.currency,
        openingBalance,
        movements,
        closingBalance
      })
    })
}

/**
 * ConsolidatedReportServiceLive - Live implementation of ConsolidatedReportService
 */
export const ConsolidatedReportServiceLive: Layer.Layer<ConsolidatedReportService> = Layer.succeed(
  ConsolidatedReportService,
  make
)
