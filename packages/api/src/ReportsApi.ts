/**
 * ReportsApi - HTTP API group for financial report generation
 *
 * Provides endpoints for generating financial reports:
 * - Trial Balance
 * - Balance Sheet (ASC 210)
 * - Income Statement (ASC 220)
 * - Cash Flow Statement (ASC 230)
 * - Statement of Changes in Equity
 *
 * @module ReportsApi
 */

import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import * as Schema from "effect/Schema"
import { CompanyId } from "@accountability/core/domain/Company"
import { LocalDate } from "@accountability/core/domain/LocalDate"
import { CurrencyCode } from "@accountability/core/domain/CurrencyCode"
import { MonetaryAmount } from "@accountability/core/domain/MonetaryAmount"
import { Timestamp } from "@accountability/core/domain/Timestamp"
import { AccountId } from "@accountability/core/domain/Account"
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError
} from "./ApiErrors.ts"

// Note: CompanyId, LocalDate, and AccountId are used in report response schemas.
// URL params use Schema.String for HTTP encoding compatibility.

// =============================================================================
// Shared Report Types
// =============================================================================

/**
 * ReportFormat - Output format for reports
 */
export const ReportFormat = Schema.Literal(
  "json",
  "pdf",
  "excel",
  "csv"
).annotations({
  identifier: "ReportFormat",
  title: "Report Format",
  description: "Output format for financial reports"
})

export type ReportFormat = typeof ReportFormat.Type

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

// =============================================================================
// Trial Balance Types
// =============================================================================

/**
 * TrialBalanceLineItem - A line in the trial balance report
 */
export class TrialBalanceLineItem extends Schema.Class<TrialBalanceLineItem>("TrialBalanceLineItem")({
  accountId: AccountId,
  accountNumber: Schema.NonEmptyTrimmedString,
  accountName: Schema.NonEmptyTrimmedString,
  accountType: Schema.Literal("Asset", "Liability", "Equity", "Revenue", "Expense"),
  debitBalance: MonetaryAmount,
  creditBalance: MonetaryAmount
}) {}

/**
 * TrialBalanceReport - Complete trial balance report
 */
export class TrialBalanceReport extends Schema.Class<TrialBalanceReport>("TrialBalanceReport")({
  companyId: CompanyId,
  asOfDate: LocalDate,
  currency: CurrencyCode,
  generatedAt: Timestamp,
  lineItems: Schema.Array(TrialBalanceLineItem),
  totalDebits: MonetaryAmount,
  totalCredits: MonetaryAmount,
  isBalanced: Schema.Boolean
}) {}

/**
 * Query parameters for trial balance report
 * Uses string types for URL parameters
 */
export const TrialBalanceParams = Schema.Struct({
  companyId: Schema.String,
  asOfDate: Schema.String,
  periodStartDate: Schema.optional(Schema.String),
  excludeZeroBalances: Schema.optional(Schema.BooleanFromString),
  format: Schema.optional(ReportFormat)
})

export type TrialBalanceParams = typeof TrialBalanceParams.Type

// =============================================================================
// Balance Sheet Types
// =============================================================================

/**
 * BalanceSheetLineItem - A line in the balance sheet report
 */
export class BalanceSheetLineItem extends Schema.Class<BalanceSheetLineItem>("BalanceSheetLineItem")({
  accountId: Schema.OptionFromNullOr(AccountId),
  accountNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  description: Schema.NonEmptyTrimmedString,
  currentAmount: MonetaryAmount,
  comparativeAmount: Schema.OptionFromNullOr(MonetaryAmount),
  variance: Schema.OptionFromNullOr(MonetaryAmount),
  variancePercentage: Schema.OptionFromNullOr(Schema.Number),
  style: LineItemStyle,
  indentLevel: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * BalanceSheetSection - A section of the balance sheet (Assets, Liabilities, Equity)
 */
export class BalanceSheetSection extends Schema.Class<BalanceSheetSection>("BalanceSheetSection")({
  title: Schema.NonEmptyTrimmedString,
  lineItems: Schema.Array(BalanceSheetLineItem),
  subtotal: MonetaryAmount,
  comparativeSubtotal: Schema.OptionFromNullOr(MonetaryAmount)
}) {}

/**
 * BalanceSheetReport - Complete balance sheet report per ASC 210
 */
export class BalanceSheetReport extends Schema.Class<BalanceSheetReport>("BalanceSheetReport")({
  companyId: CompanyId,
  asOfDate: LocalDate,
  comparativeDate: Schema.OptionFromNullOr(LocalDate),
  currency: CurrencyCode,
  generatedAt: Timestamp,
  currentAssets: BalanceSheetSection,
  nonCurrentAssets: BalanceSheetSection,
  totalAssets: MonetaryAmount,
  currentLiabilities: BalanceSheetSection,
  nonCurrentLiabilities: BalanceSheetSection,
  totalLiabilities: MonetaryAmount,
  equity: BalanceSheetSection,
  totalEquity: MonetaryAmount,
  totalLiabilitiesAndEquity: MonetaryAmount,
  isBalanced: Schema.Boolean
}) {}

/**
 * Query parameters for balance sheet report
 * Uses string types for URL parameters
 */
export const BalanceSheetParams = Schema.Struct({
  companyId: Schema.String,
  asOfDate: Schema.String,
  comparativeDate: Schema.optional(Schema.String),
  includeZeroBalances: Schema.optional(Schema.BooleanFromString),
  format: Schema.optional(ReportFormat)
})

export type BalanceSheetParams = typeof BalanceSheetParams.Type

// =============================================================================
// Income Statement Types
// =============================================================================

/**
 * IncomeStatementLineItem - A line in the income statement report
 */
export class IncomeStatementLineItem extends Schema.Class<IncomeStatementLineItem>("IncomeStatementLineItem")({
  accountId: Schema.OptionFromNullOr(AccountId),
  accountNumber: Schema.OptionFromNullOr(Schema.NonEmptyTrimmedString),
  description: Schema.NonEmptyTrimmedString,
  currentAmount: MonetaryAmount,
  comparativeAmount: Schema.OptionFromNullOr(MonetaryAmount),
  variance: Schema.OptionFromNullOr(MonetaryAmount),
  variancePercentage: Schema.OptionFromNullOr(Schema.Number),
  style: LineItemStyle,
  indentLevel: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * IncomeStatementSection - A section of the income statement
 */
export class IncomeStatementSection extends Schema.Class<IncomeStatementSection>("IncomeStatementSection")({
  title: Schema.NonEmptyTrimmedString,
  lineItems: Schema.Array(IncomeStatementLineItem),
  subtotal: MonetaryAmount,
  comparativeSubtotal: Schema.OptionFromNullOr(MonetaryAmount)
}) {}

/**
 * IncomeStatementReport - Complete income statement report per ASC 220
 */
export class IncomeStatementReport extends Schema.Class<IncomeStatementReport>("IncomeStatementReport")({
  companyId: CompanyId,
  periodStartDate: LocalDate,
  periodEndDate: LocalDate,
  comparativeStartDate: Schema.OptionFromNullOr(LocalDate),
  comparativeEndDate: Schema.OptionFromNullOr(LocalDate),
  currency: CurrencyCode,
  generatedAt: Timestamp,
  revenue: IncomeStatementSection,
  costOfSales: IncomeStatementSection,
  grossProfit: MonetaryAmount,
  operatingExpenses: IncomeStatementSection,
  operatingIncome: MonetaryAmount,
  otherIncomeExpense: IncomeStatementSection,
  incomeBeforeTax: MonetaryAmount,
  taxExpense: MonetaryAmount,
  netIncome: MonetaryAmount
}) {}

/**
 * Query parameters for income statement report
 * Uses string types for URL parameters
 */
export const IncomeStatementParams = Schema.Struct({
  companyId: Schema.String,
  periodStartDate: Schema.String,
  periodEndDate: Schema.String,
  comparativeStartDate: Schema.optional(Schema.String),
  comparativeEndDate: Schema.optional(Schema.String),
  format: Schema.optional(ReportFormat)
})

export type IncomeStatementParams = typeof IncomeStatementParams.Type

// =============================================================================
// Cash Flow Statement Types
// =============================================================================

/**
 * CashFlowMethod - Direct or indirect method per ASC 230
 */
export const CashFlowMethod = Schema.Literal(
  "direct",
  "indirect"
).annotations({
  identifier: "CashFlowMethod",
  title: "Cash Flow Method",
  description: "Method for preparing the cash flow statement per ASC 230"
})

export type CashFlowMethod = typeof CashFlowMethod.Type

/**
 * CashFlowLineItem - A line in the cash flow statement
 */
export class CashFlowLineItem extends Schema.Class<CashFlowLineItem>("CashFlowLineItem")({
  description: Schema.NonEmptyTrimmedString,
  amount: MonetaryAmount,
  comparativeAmount: Schema.OptionFromNullOr(MonetaryAmount),
  style: LineItemStyle,
  indentLevel: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}) {}

/**
 * CashFlowSection - A section of the cash flow statement
 */
export class CashFlowSection extends Schema.Class<CashFlowSection>("CashFlowSection")({
  title: Schema.NonEmptyTrimmedString,
  lineItems: Schema.Array(CashFlowLineItem),
  netCashFlow: MonetaryAmount,
  comparativeNetCashFlow: Schema.OptionFromNullOr(MonetaryAmount)
}) {}

/**
 * CashFlowStatementReport - Complete cash flow statement per ASC 230
 */
export class CashFlowStatementReport extends Schema.Class<CashFlowStatementReport>("CashFlowStatementReport")({
  companyId: CompanyId,
  periodStartDate: LocalDate,
  periodEndDate: LocalDate,
  currency: CurrencyCode,
  generatedAt: Timestamp,
  method: CashFlowMethod,
  beginningCash: MonetaryAmount,
  operatingActivities: CashFlowSection,
  investingActivities: CashFlowSection,
  financingActivities: CashFlowSection,
  exchangeRateEffect: MonetaryAmount,
  netChangeInCash: MonetaryAmount,
  endingCash: MonetaryAmount
}) {}

/**
 * Query parameters for cash flow statement
 * Uses string types for URL parameters
 */
export const CashFlowStatementParams = Schema.Struct({
  companyId: Schema.String,
  periodStartDate: Schema.String,
  periodEndDate: Schema.String,
  method: Schema.optional(CashFlowMethod),
  format: Schema.optional(ReportFormat)
})

export type CashFlowStatementParams = typeof CashFlowStatementParams.Type

// =============================================================================
// Statement of Changes in Equity Types
// =============================================================================

/**
 * EquityMovementType - Types of movements in equity
 */
export const EquityMovementType = Schema.Literal(
  "NetIncome",
  "OtherComprehensiveIncome",
  "DividendsDeclared",
  "StockIssuance",
  "StockRepurchase",
  "StockBasedCompensation",
  "PriorPeriodAdjustment",
  "Other"
).annotations({
  identifier: "EquityMovementType",
  title: "Equity Movement Type",
  description: "Type of movement in equity"
})

export type EquityMovementType = typeof EquityMovementType.Type

/**
 * EquityMovement - A single movement in equity
 */
export class EquityMovement extends Schema.Class<EquityMovement>("EquityMovement")({
  movementType: EquityMovementType,
  description: Schema.NonEmptyTrimmedString,
  commonStock: MonetaryAmount,
  preferredStock: MonetaryAmount,
  additionalPaidInCapital: MonetaryAmount,
  retainedEarnings: MonetaryAmount,
  treasuryStock: MonetaryAmount,
  accumulatedOCI: MonetaryAmount,
  nonControllingInterest: MonetaryAmount,
  total: MonetaryAmount
}) {}

/**
 * EquityStatementReport - Statement of changes in equity
 */
export class EquityStatementReport extends Schema.Class<EquityStatementReport>("EquityStatementReport")({
  companyId: CompanyId,
  periodStartDate: LocalDate,
  periodEndDate: LocalDate,
  currency: CurrencyCode,
  generatedAt: Timestamp,
  openingBalances: EquityMovement,
  movements: Schema.Array(EquityMovement),
  closingBalances: EquityMovement
}) {}

/**
 * Query parameters for equity statement
 * Uses string types for URL parameters
 */
export const EquityStatementParams = Schema.Struct({
  companyId: Schema.String,
  periodStartDate: Schema.String,
  periodEndDate: Schema.String,
  format: Schema.optional(ReportFormat)
})

export type EquityStatementParams = typeof EquityStatementParams.Type

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * Generate trial balance report
 */
const generateTrialBalance = HttpApiEndpoint.get("generateTrialBalance", "/trial-balance")
  .setUrlParams(TrialBalanceParams)
  .addSuccess(TrialBalanceReport)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(BusinessRuleError)

/**
 * Generate balance sheet report
 */
const generateBalanceSheet = HttpApiEndpoint.get("generateBalanceSheet", "/balance-sheet")
  .setUrlParams(BalanceSheetParams)
  .addSuccess(BalanceSheetReport)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(BusinessRuleError)

/**
 * Generate income statement report
 */
const generateIncomeStatement = HttpApiEndpoint.get("generateIncomeStatement", "/income-statement")
  .setUrlParams(IncomeStatementParams)
  .addSuccess(IncomeStatementReport)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(BusinessRuleError)

/**
 * Generate cash flow statement report
 */
const generateCashFlowStatement = HttpApiEndpoint.get("generateCashFlowStatement", "/cash-flow")
  .setUrlParams(CashFlowStatementParams)
  .addSuccess(CashFlowStatementReport)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(BusinessRuleError)

/**
 * Generate statement of changes in equity
 */
const generateEquityStatement = HttpApiEndpoint.get("generateEquityStatement", "/equity-statement")
  .setUrlParams(EquityStatementParams)
  .addSuccess(EquityStatementReport)
  .addError(NotFoundError)
  .addError(ValidationError)
  .addError(BusinessRuleError)

// =============================================================================
// API Group
// =============================================================================

/**
 * ReportsApi - API group for financial report generation
 *
 * Base path: /api/v1/reports
 */
export class ReportsApi extends HttpApiGroup.make("reports")
  .add(generateTrialBalance)
  .add(generateBalanceSheet)
  .add(generateIncomeStatement)
  .add(generateCashFlowStatement)
  .add(generateEquityStatement)
  .prefix("/v1/reports") {}
