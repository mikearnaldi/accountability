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

import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { CompanyId } from "@accountability/core/company/Company"
import { LocalDate, LocalDateFromString } from "@accountability/core/shared/values/LocalDate"
import { CurrencyCode } from "@accountability/core/currency/CurrencyCode"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { AccountId } from "@accountability/core/accounting/Account"
import {
  ForbiddenError
} from "./ApiErrors.ts"
import { AuthMiddleware } from "./AuthMiddleware.ts"
import { OrganizationNotFoundError } from "@accountability/core/organization/OrganizationErrors"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  InvalidReportPeriodError,
  TrialBalanceNotBalancedError,
  BalanceSheetNotBalancedError
} from "@accountability/core/reporting/ReportErrors"

// Note: URL params use LocalDateFromString schema to automatically parse
// ISO date strings (YYYY-MM-DD) to LocalDate instances with validation.

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
 * Uses LocalDateFromString to automatically parse ISO date strings to LocalDate
 */
export const TrialBalanceParams = Schema.Struct({
  organizationId: Schema.String,
  companyId: Schema.String,
  asOfDate: LocalDateFromString,
  periodStartDate: Schema.optional(LocalDateFromString),
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
 * Uses LocalDateFromString to automatically parse ISO date strings to LocalDate
 */
export const BalanceSheetParams = Schema.Struct({
  organizationId: Schema.String,
  companyId: Schema.String,
  asOfDate: LocalDateFromString,
  comparativeDate: Schema.optional(LocalDateFromString),
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
 * Uses LocalDateFromString to automatically parse ISO date strings to LocalDate
 */
export const IncomeStatementParams = Schema.Struct({
  organizationId: Schema.String,
  companyId: Schema.String,
  periodStartDate: LocalDateFromString,
  periodEndDate: LocalDateFromString,
  comparativeStartDate: Schema.optional(LocalDateFromString),
  comparativeEndDate: Schema.optional(LocalDateFromString),
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
 * Uses LocalDateFromString to automatically parse ISO date strings to LocalDate
 */
export const CashFlowStatementParams = Schema.Struct({
  organizationId: Schema.String,
  companyId: Schema.String,
  periodStartDate: LocalDateFromString,
  periodEndDate: LocalDateFromString,
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
 * Uses LocalDateFromString to automatically parse ISO date strings to LocalDate
 */
export const EquityStatementParams = Schema.Struct({
  organizationId: Schema.String,
  companyId: Schema.String,
  periodStartDate: LocalDateFromString,
  periodEndDate: LocalDateFromString,
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
  .addError(CompanyNotFoundError)
  .addError(TrialBalanceNotBalancedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Generate trial balance",
    description: "Generate a trial balance report showing all account balances with total debits and credits. The report validates that the books are balanced."
  }))

/**
 * Generate balance sheet report
 */
const generateBalanceSheet = HttpApiEndpoint.get("generateBalanceSheet", "/balance-sheet")
  .setUrlParams(BalanceSheetParams)
  .addSuccess(BalanceSheetReport)
  .addError(CompanyNotFoundError)
  .addError(BalanceSheetNotBalancedError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Generate balance sheet",
    description: "Generate a balance sheet report per ASC 210 showing Assets, Liabilities, and Equity at a point in time. Supports comparative periods."
  }))

/**
 * Generate income statement report
 */
const generateIncomeStatement = HttpApiEndpoint.get("generateIncomeStatement", "/income-statement")
  .setUrlParams(IncomeStatementParams)
  .addSuccess(IncomeStatementReport)
  .addError(CompanyNotFoundError)
  .addError(InvalidReportPeriodError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Generate income statement",
    description: "Generate an income statement per ASC 220 showing Revenue, Expenses, and Net Income for a period. Supports comparative periods."
  }))

/**
 * Generate cash flow statement report
 */
const generateCashFlowStatement = HttpApiEndpoint.get("generateCashFlowStatement", "/cash-flow")
  .setUrlParams(CashFlowStatementParams)
  .addSuccess(CashFlowStatementReport)
  .addError(CompanyNotFoundError)
  .addError(InvalidReportPeriodError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Generate cash flow statement",
    description: "Generate a cash flow statement per ASC 230 showing Operating, Investing, and Financing activities. Supports direct or indirect method."
  }))

/**
 * Generate statement of changes in equity
 */
const generateEquityStatement = HttpApiEndpoint.get("generateEquityStatement", "/equity-statement")
  .setUrlParams(EquityStatementParams)
  .addSuccess(EquityStatementReport)
  .addError(CompanyNotFoundError)
  .addError(InvalidReportPeriodError)
  .addError(OrganizationNotFoundError)
  .addError(ForbiddenError)
  .annotateContext(OpenApi.annotations({
    summary: "Generate equity statement",
    description: "Generate a statement of changes in equity showing movements in common stock, retained earnings, treasury stock, and other comprehensive income."
  }))

// =============================================================================
// API Group
// =============================================================================

/**
 * ReportsApi - API group for financial report generation
 *
 * Base path: /api/v1/reports
 * Protected by: AuthMiddleware (bearer token authentication)
 */
export class ReportsApi extends HttpApiGroup.make("reports")
  .add(generateTrialBalance)
  .add(generateBalanceSheet)
  .add(generateIncomeStatement)
  .add(generateCashFlowStatement)
  .add(generateEquityStatement)
  .middleware(AuthMiddleware)
  .prefix("/v1/reports")
  .annotateContext(OpenApi.annotations({
    title: "Reports",
    description: "Generate financial reports including Trial Balance, Balance Sheet (ASC 210), Income Statement (ASC 220), Cash Flow Statement (ASC 230), and Statement of Changes in Equity."
  })) {}
