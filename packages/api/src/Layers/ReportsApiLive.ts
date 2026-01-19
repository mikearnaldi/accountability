/**
 * ReportsApiLive - Live implementation of reports API handlers
 *
 * Implements the ReportsApi endpoints by calling the core report services.
 * Fetches data from repositories and transforms to API response types.
 *
 * URL params use LocalDateFromString schema to automatically parse
 * ISO date strings to LocalDate instances with validation.
 *
 * @module ReportsApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { CompanyId } from "@accountability/core/company/Company"
import { OrganizationId } from "@accountability/core/organization/Organization"
import type { LocalDate } from "@accountability/core/shared/values/LocalDate"
import { MonetaryAmount } from "@accountability/core/shared/values/MonetaryAmount"
import type { JournalEntryWithLines } from "@accountability/core/accounting/AccountBalance"
import {
  generateTrialBalanceFromData,
  type TrialBalanceLineItem as CoreTrialBalanceLineItem,
  type TrialBalanceReport as CoreTrialBalanceReport
} from "@accountability/core/accounting/TrialBalanceService"
import {
  generateBalanceSheetFromData,
  type BalanceSheetReport as CoreBalanceSheetReport,
  type BalanceSheetSection as CoreBalanceSheetSection,
  type BalanceSheetLineItem as CoreBalanceSheetLineItem
} from "@accountability/core/reporting/BalanceSheetService"
import {
  generateIncomeStatementFromData,
  type IncomeStatementReport as CoreIncomeStatementReport,
  type IncomeStatementSection as CoreIncomeStatementSection,
  type IncomeStatementLineItem as CoreIncomeStatementLineItem
} from "@accountability/core/reporting/IncomeStatementService"
import {
  generateCashFlowStatementFromData,
  type CashFlowStatementReport as CoreCashFlowStatementReport
} from "@accountability/core/reporting/CashFlowStatementService"
import {
  generateEquityStatementFromData,
  type EquityStatementReport as CoreEquityStatementReport,
  type EquityMovementRow as CoreEquityMovementRow
} from "@accountability/core/reporting/EquityStatementService"
import { AccountRepository } from "@accountability/persistence/Services/AccountRepository"
import { CompanyRepository } from "@accountability/persistence/Services/CompanyRepository"
import { JournalEntryRepository } from "@accountability/persistence/Services/JournalEntryRepository"
import { JournalEntryLineRepository } from "@accountability/persistence/Services/JournalEntryLineRepository"
import { AppApi } from "../Definitions/AppApi.ts"
import { requireOrganizationContext, requirePermission } from "./OrganizationContextMiddlewareLive.ts"
import { CompanyNotFoundError } from "@accountability/core/company/CompanyErrors"
import {
  InvalidReportPeriodError,
  TrialBalanceNotBalancedError,
  BalanceSheetNotBalancedError
} from "@accountability/core/reporting/ReportErrors"
import {
  TrialBalanceReport,
  TrialBalanceLineItem,
  BalanceSheetReport,
  BalanceSheetSection,
  BalanceSheetLineItem,
  IncomeStatementReport,
  IncomeStatementSection,
  IncomeStatementLineItem,
  CashFlowStatementReport,
  CashFlowSection,
  CashFlowLineItem,
  EquityStatementReport,
  EquityMovement,
  type EquityMovementType
} from "../Definitions/ReportsApi.ts"

// =============================================================================
// Data Fetching Helpers
// =============================================================================

/**
 * Fetch all data needed for report generation
 */
const fetchReportData = (organizationId: OrganizationId, companyId: CompanyId) =>
  Effect.gen(function* () {
    const accountRepo = yield* AccountRepository
    const companyRepo = yield* CompanyRepository
    const journalEntryRepo = yield* JournalEntryRepository
    const journalEntryLineRepo = yield* JournalEntryLineRepository

    // Get company to validate existence within organization and get functional currency
    const maybeCompany = yield* companyRepo.findById(organizationId, companyId).pipe(Effect.orDie)
    if (Option.isNone(maybeCompany)) {
      return yield* Effect.fail(new CompanyNotFoundError({ companyId }))
    }
    const company = maybeCompany.value
    const functionalCurrency = company.functionalCurrency

    // Get all accounts for the company
    const accounts = yield* accountRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)

    // Get all journal entries (we'll filter for posted status in the service)
    const journalEntries = yield* journalEntryRepo.findByCompany(organizationId, companyId).pipe(Effect.orDie)

    // Get journal entry IDs
    const entryIds = journalEntries.map((e) => e.id)

    // Get all lines for these entries
    const linesMap = yield* journalEntryLineRepo.findByJournalEntries(entryIds).pipe(Effect.orDie)

    // Build JournalEntryWithLines array
    const entriesWithLines: JournalEntryWithLines[] = journalEntries.map((entry) => ({
      entry,
      lines: linesMap.get(entry.id) ?? []
    }))

    return {
      accounts,
      entriesWithLines,
      functionalCurrency
    }
  })

// =============================================================================
// Report Transformation Helpers
// =============================================================================

/**
 * Transform core TrialBalanceReport to API TrialBalanceReport
 */
const transformTrialBalanceReport = (
  core: CoreTrialBalanceReport,
  companyId: CompanyId
): TrialBalanceReport => {
  const lineItems = core.lineItems.map((item: CoreTrialBalanceLineItem) =>
    TrialBalanceLineItem.make({
      accountId: item.accountId,
      accountNumber: item.accountNumber,
      accountName: item.accountName,
      accountType: item.accountType,
      debitBalance: item.debitBalance,
      creditBalance: item.creditBalance
    })
  )

  return TrialBalanceReport.make({
    companyId,
    asOfDate: core.metadata.asOfDate,
    currency: core.metadata.currency,
    generatedAt: core.metadata.generatedAt,
    lineItems,
    totalDebits: core.totalDebits,
    totalCredits: core.totalCredits,
    isBalanced: core.metadata.isBalanced
  })
}

/**
 * Transform core BalanceSheetLineItem to API BalanceSheetLineItem
 */
const transformBalanceSheetLineItem = (
  item: CoreBalanceSheetLineItem
): BalanceSheetLineItem =>
  BalanceSheetLineItem.make({
    accountId: item.accountId,
    accountNumber: item.accountNumber,
    description: item.description,
    currentAmount: item.currentAmount,
    comparativeAmount: item.comparativeAmount,
    variance: item.variance,
    variancePercentage: item.variancePercentage,
    style: item.style,
    indentLevel: item.indentLevel
  })

/**
 * Transform core BalanceSheetSection to API BalanceSheetSection
 */
const transformBalanceSheetSection = (
  section: CoreBalanceSheetSection
): BalanceSheetSection =>
  BalanceSheetSection.make({
    title: section.displayName,
    lineItems: section.lineItems.map(transformBalanceSheetLineItem),
    subtotal: section.subtotal,
    comparativeSubtotal: section.comparativeSubtotal
  })

/**
 * Transform core BalanceSheetReport to API BalanceSheetReport
 */
const transformBalanceSheetReport = (
  core: CoreBalanceSheetReport,
  companyId: CompanyId
): BalanceSheetReport =>
  BalanceSheetReport.make({
    companyId,
    asOfDate: core.metadata.asOfDate,
    comparativeDate: core.metadata.comparativeDate,
    currency: core.metadata.currency,
    generatedAt: core.metadata.generatedAt,
    currentAssets: transformBalanceSheetSection(core.currentAssets),
    nonCurrentAssets: transformBalanceSheetSection(core.nonCurrentAssets),
    totalAssets: core.totalAssets,
    currentLiabilities: transformBalanceSheetSection(core.currentLiabilities),
    nonCurrentLiabilities: transformBalanceSheetSection(core.nonCurrentLiabilities),
    totalLiabilities: core.totalLiabilities,
    equity: transformBalanceSheetSection(core.equity),
    totalEquity: core.totalEquity,
    totalLiabilitiesAndEquity: core.totalLiabilitiesAndEquity,
    isBalanced: core.metadata.isBalanced
  })

/**
 * Transform core IncomeStatementLineItem to API IncomeStatementLineItem
 */
const transformIncomeStatementLineItem = (
  item: CoreIncomeStatementLineItem
): IncomeStatementLineItem =>
  IncomeStatementLineItem.make({
    accountId: item.accountId,
    accountNumber: item.accountNumber,
    description: item.description,
    currentAmount: item.currentAmount,
    comparativeAmount: item.comparativeAmount,
    variance: item.variance,
    variancePercentage: item.variancePercentage,
    style: item.style,
    indentLevel: item.indentLevel
  })

/**
 * Transform core IncomeStatementSection to API IncomeStatementSection
 */
const transformIncomeStatementSection = (
  section: CoreIncomeStatementSection
): IncomeStatementSection =>
  IncomeStatementSection.make({
    title: section.displayName,
    lineItems: section.lineItems.map(transformIncomeStatementLineItem),
    subtotal: section.subtotal,
    comparativeSubtotal: section.comparativeSubtotal
  })

/**
 * Transform core IncomeStatementReport to API IncomeStatementReport
 */
const transformIncomeStatementReport = (
  core: CoreIncomeStatementReport,
  companyId: CompanyId
): IncomeStatementReport =>
  IncomeStatementReport.make({
    companyId,
    periodStartDate: core.metadata.periodStart,
    periodEndDate: core.metadata.periodEnd,
    comparativeStartDate: core.metadata.comparativePeriodStart,
    comparativeEndDate: core.metadata.comparativePeriodEnd,
    currency: core.metadata.currency,
    generatedAt: core.metadata.generatedAt,
    revenue: transformIncomeStatementSection(core.revenue),
    costOfSales: transformIncomeStatementSection(core.costOfSales),
    grossProfit: core.grossProfit,
    operatingExpenses: transformIncomeStatementSection(core.operatingExpenses),
    operatingIncome: core.operatingIncome,
    otherIncomeExpense: transformIncomeStatementSection(core.otherIncomeExpense),
    incomeBeforeTax: core.incomeBeforeTax,
    taxExpense: core.incomeTaxExpense.subtotal,
    netIncome: core.netIncome
  })

/**
 * Transform core CashFlowStatementReport to API CashFlowStatementReport
 */
const transformCashFlowStatementReport = (
  core: CoreCashFlowStatementReport,
  companyId: CompanyId
): CashFlowStatementReport => {
  // Transform operating activities section
  const operatingLineItems = core.operatingActivities.lineItems.map((item) =>
    CashFlowLineItem.make({
      description: item.description,
      amount: item.amount,
      comparativeAmount: Option.none(),
      style: item.style,
      indentLevel: item.indentLevel
    })
  )

  const operatingSection = CashFlowSection.make({
    title: "Cash Flows from Operating Activities",
    lineItems: operatingLineItems,
    netCashFlow: core.operatingActivities.netCashFromOperating,
    comparativeNetCashFlow: Option.none()
  })

  // Transform investing activities section
  const investingLineItems = core.investingActivities.lineItems.map((item) =>
    CashFlowLineItem.make({
      description: item.description,
      amount: item.amount,
      comparativeAmount: Option.none(),
      style: item.style,
      indentLevel: item.indentLevel
    })
  )

  const investingSection = CashFlowSection.make({
    title: "Cash Flows from Investing Activities",
    lineItems: investingLineItems,
    netCashFlow: core.investingActivities.subtotal,
    comparativeNetCashFlow: Option.none()
  })

  // Transform financing activities section
  const financingLineItems = core.financingActivities.lineItems.map((item) =>
    CashFlowLineItem.make({
      description: item.description,
      amount: item.amount,
      comparativeAmount: Option.none(),
      style: item.style,
      indentLevel: item.indentLevel
    })
  )

  const financingSection = CashFlowSection.make({
    title: "Cash Flows from Financing Activities",
    lineItems: financingLineItems,
    netCashFlow: core.financingActivities.subtotal,
    comparativeNetCashFlow: Option.none()
  })

  return CashFlowStatementReport.make({
    companyId,
    periodStartDate: core.metadata.periodStart,
    periodEndDate: core.metadata.periodEnd,
    currency: core.metadata.currency,
    generatedAt: core.metadata.generatedAt,
    method: "indirect",
    beginningCash: core.beginningCash,
    operatingActivities: operatingSection,
    investingActivities: investingSection,
    financingActivities: financingSection,
    exchangeRateEffect: MonetaryAmount.zero(core.metadata.currency),
    netChangeInCash: core.netChangeInCash,
    endingCash: core.endingCash
  })
}

/**
 * Map core equity movement type to API movement type
 */
const mapEquityMovementType = (
  coreType: "OpeningBalance" | "NetIncome" | "OCI" | "Dividends" | "StockIssuance" | "StockRepurchase" | "OtherAdjustments" | "ClosingBalance"
): EquityMovementType => {
  switch (coreType) {
    case "OpeningBalance":
      return "Other"
    case "NetIncome":
      return "NetIncome"
    case "OCI":
      return "OtherComprehensiveIncome"
    case "Dividends":
      return "DividendsDeclared"
    case "StockIssuance":
      return "StockIssuance"
    case "StockRepurchase":
      return "StockRepurchase"
    case "OtherAdjustments":
      return "Other"
    case "ClosingBalance":
      return "Other"
  }
}

/**
 * Transform core EquityMovementRow to API EquityMovement
 */
const transformEquityMovementRow = (
  row: CoreEquityMovementRow
): EquityMovement =>
  EquityMovement.make({
    movementType: mapEquityMovementType(row.movementType),
    description: row.displayName,
    commonStock: row.commonStock,
    preferredStock: MonetaryAmount.zero(row.commonStock.currency), // Not tracked in core
    additionalPaidInCapital: row.apic,
    retainedEarnings: row.retainedEarnings,
    treasuryStock: row.treasuryStock,
    accumulatedOCI: row.aoci,
    nonControllingInterest: row.nci,
    total: row.rowTotal
  })

/**
 * Transform core EquityStatementReport to API EquityStatementReport
 */
const transformEquityStatementReport = (
  core: CoreEquityStatementReport,
  companyId: CompanyId
): EquityStatementReport => {
  // Find opening and closing balance rows
  const openingRow = core.rows.find((r) => r.movementType === "OpeningBalance")
  const closingRow = core.rows.find((r) => r.movementType === "ClosingBalance")
  const movementRows = core.rows.filter(
    (r) => r.movementType !== "OpeningBalance" && r.movementType !== "ClosingBalance"
  )

  const zero = MonetaryAmount.zero(core.metadata.currency)

  // Create default movement if no row found
  const createDefaultMovement = (type: EquityMovementType, description: string): EquityMovement =>
    EquityMovement.make({
      movementType: type,
      description,
      commonStock: zero,
      preferredStock: zero,
      additionalPaidInCapital: zero,
      retainedEarnings: zero,
      treasuryStock: zero,
      accumulatedOCI: zero,
      nonControllingInterest: zero,
      total: zero
    })

  const openingBalances = openingRow
    ? transformEquityMovementRow(openingRow)
    : createDefaultMovement("Other", "Opening Balance")

  const closingBalances = closingRow
    ? transformEquityMovementRow(closingRow)
    : createDefaultMovement("Other", "Closing Balance")

  const movements = movementRows.map(transformEquityMovementRow)

  return EquityStatementReport.make({
    companyId,
    periodStartDate: core.metadata.periodStart,
    periodEndDate: core.metadata.periodEnd,
    currency: core.metadata.currency,
    generatedAt: core.metadata.generatedAt,
    openingBalances,
    movements,
    closingBalances
  })
}

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * ReportsApiLive - Layer providing ReportsApi handlers
 *
 * Dependencies:
 * - AccountRepository
 * - CompanyRepository
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 */
export const ReportsApiLive = HttpApiBuilder.group(AppApi, "reports", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle("generateTrialBalance", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const { organizationId: orgIdStr, companyId: companyIdStr, asOfDate, periodStartDate, excludeZeroBalances } = _.urlParams

            // Parse IDs (still strings in URL params)
            const organizationId = OrganizationId.make(orgIdStr)
            const companyId = CompanyId.make(companyIdStr)
            // Note: asOfDate and periodStartDate are already LocalDate instances
            // thanks to LocalDateFromString schema in URL params

            // Fetch data
            const { accounts, entriesWithLines, functionalCurrency } = yield* fetchReportData(organizationId, companyId)

            // Generate report
            const options = periodStartDate !== undefined
              ? { excludeZeroBalances: excludeZeroBalances ?? true, periodStartDate }
              : { excludeZeroBalances: excludeZeroBalances ?? true }
            const coreReport = yield* generateTrialBalanceFromData(
              companyId,
              accounts,
              entriesWithLines,
              asOfDate,
              functionalCurrency,
              options
            ).pipe(
              Effect.mapError(() =>
                new TrialBalanceNotBalancedError({ totalDebits: 0, totalCredits: 0 })
              )
            )

            return transformTrialBalanceReport(coreReport, companyId)
          })
        )
      )
      .handle("generateBalanceSheet", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const { organizationId: orgIdStr, companyId: companyIdStr, asOfDate, comparativeDate, includeZeroBalances } = _.urlParams

            // Parse IDs (still strings in URL params)
            const organizationId = OrganizationId.make(orgIdStr)
            const companyId = CompanyId.make(companyIdStr)
            // Note: asOfDate and comparativeDate are already LocalDate instances

            // Fetch data
            const { accounts, entriesWithLines, functionalCurrency } = yield* fetchReportData(organizationId, companyId)

            // Generate report
            const balanceSheetOptions = comparativeDate !== undefined
              ? { includeZeroBalances: includeZeroBalances ?? false, comparativeDate }
              : { includeZeroBalances: includeZeroBalances ?? false }
            const coreReport = yield* generateBalanceSheetFromData(
              companyId,
              accounts,
              entriesWithLines,
              asOfDate,
              functionalCurrency,
              balanceSheetOptions
            ).pipe(
              Effect.mapError(() =>
                new BalanceSheetNotBalancedError({ totalAssets: 0, totalLiabilitiesAndEquity: 0 })
              )
            )

            return transformBalanceSheetReport(coreReport, companyId)
          })
        )
      )
      .handle("generateIncomeStatement", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const {
              organizationId: orgIdStr,
              companyId: companyIdStr,
              periodStartDate,
              periodEndDate,
              comparativeStartDate,
              comparativeEndDate
            } = _.urlParams

            // Parse IDs (still strings in URL params)
            const organizationId = OrganizationId.make(orgIdStr)
            const companyId = CompanyId.make(companyIdStr)
            // Note: date params are already LocalDate instances

            // Fetch data
            const { accounts, entriesWithLines, functionalCurrency } = yield* fetchReportData(organizationId, companyId)

            // Generate report - build options conditionally
            const incomeStatementOptions: {
              includeZeroBalances?: boolean
              comparativePeriodStart?: LocalDate
              comparativePeriodEnd?: LocalDate
            } = {}
            if (comparativeStartDate !== undefined) {
              incomeStatementOptions.comparativePeriodStart = comparativeStartDate
            }
            if (comparativeEndDate !== undefined) {
              incomeStatementOptions.comparativePeriodEnd = comparativeEndDate
            }

            const coreReport = yield* generateIncomeStatementFromData(
              companyId,
              accounts,
              entriesWithLines,
              periodStartDate,
              periodEndDate,
              functionalCurrency,
              incomeStatementOptions
            ).pipe(
              Effect.mapError(() =>
                new InvalidReportPeriodError({
                  periodStart: `${periodStartDate.year}-${periodStartDate.month}-${periodStartDate.day}`,
                  periodEnd: `${periodEndDate.year}-${periodEndDate.month}-${periodEndDate.day}`
                })
              )
            )

            return transformIncomeStatementReport(coreReport, companyId)
          })
        )
      )
      .handle("generateCashFlowStatement", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const {
              organizationId: orgIdStr,
              companyId: companyIdStr,
              periodStartDate,
              periodEndDate
            } = _.urlParams

            // Parse IDs (still strings in URL params)
            const organizationId = OrganizationId.make(orgIdStr)
            const companyId = CompanyId.make(companyIdStr)
            // Note: date params are already LocalDate instances

            // Fetch data
            const { accounts, entriesWithLines, functionalCurrency } = yield* fetchReportData(organizationId, companyId)

            // Generate report - indirect method is the default
            const coreReport = yield* generateCashFlowStatementFromData(
              companyId,
              accounts,
              entriesWithLines,
              periodStartDate,
              periodEndDate,
              functionalCurrency
            ).pipe(
              Effect.mapError(() =>
                new InvalidReportPeriodError({
                  periodStart: `${periodStartDate.year}-${periodStartDate.month}-${periodStartDate.day}`,
                  periodEnd: `${periodEndDate.year}-${periodEndDate.month}-${periodEndDate.day}`
                })
              )
            )

            return transformCashFlowStatementReport(coreReport, companyId)
          })
        )
      )
      .handle("generateEquityStatement", (_) =>
        requireOrganizationContext(_.urlParams.organizationId,
          Effect.gen(function* () {
            yield* requirePermission("report:read")

            const {
              organizationId: orgIdStr,
              companyId: companyIdStr,
              periodStartDate,
              periodEndDate
            } = _.urlParams

            // Parse IDs (still strings in URL params)
            const organizationId = OrganizationId.make(orgIdStr)
            const companyId = CompanyId.make(companyIdStr)
            // Note: date params are already LocalDate instances

            // Fetch data
            const { accounts, entriesWithLines, functionalCurrency } = yield* fetchReportData(organizationId, companyId)

            // Generate report
            const coreReport = yield* generateEquityStatementFromData(
              companyId,
              accounts,
              entriesWithLines,
              periodStartDate,
              periodEndDate,
              functionalCurrency
            ).pipe(
              Effect.mapError(() =>
                new InvalidReportPeriodError({
                  periodStart: `${periodStartDate.year}-${periodStartDate.month}-${periodStartDate.day}`,
                  periodEnd: `${periodEndDate.year}-${periodEndDate.month}-${periodEndDate.day}`
                })
              )
            )

            return transformEquityStatementReport(coreReport, companyId)
          })
        )
      )
  })
)
