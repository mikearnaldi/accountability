/**
 * Report Viewer Page Route
 *
 * Route: /companies/:companyId/reports
 *
 * Displays financial reports for a specific company with:
 * - Report type selector (Trial Balance, Balance Sheet, Income Statement, Cash Flow)
 * - Date/period parameter inputs
 * - Report display with proper formatting (indentation, subtotals, totals)
 * - Drill-down to transactions by account
 * - Loading and error states via Atom status
 *
 * @module routes/companies/$companyId.reports
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"
import * as BigDecimal from "effect/BigDecimal"
import { LocalDate, today } from "@accountability/core/Domains/LocalDate"
import type { AccountId } from "@accountability/core/Domains/Account"
import { CompanyId } from "@accountability/core/Domains/Company"
import type { MonetaryAmount } from "@accountability/core/Domains/MonetaryAmount"
import type {
  TrialBalanceReport,
  TrialBalanceLineItem,
  BalanceSheetReport,
  BalanceSheetLineItem,
  BalanceSheetSection,
  IncomeStatementReport,
  IncomeStatementLineItem,
  IncomeStatementSection,
  CashFlowStatementReport,
  CashFlowLineItem,
  CashFlowSection,
  LineItemStyle
} from "@accountability/api/Definitions/ReportsApi"
import { ApiClient } from "../../atoms/ApiClient.ts"
import { AuthGuard } from "../../components/AuthGuard.tsx"

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/companies/$companyId/reports")({
  component: ReportViewerPageWithAuth,
  beforeLoad: async ({ params }) => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: `/companies/${params.companyId}/reports` },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function ReportViewerPageWithAuth(): React.ReactElement {
  const { companyId } = Route.useParams()
  return (
    <AuthGuard redirectTo={`/companies/${companyId}/reports`}>
      <ReportViewerPage />
    </AuthGuard>
  )
}

// =============================================================================
// Types
// =============================================================================

/**
 * Available report types
 */
type ReportType = "trial-balance" | "balance-sheet" | "income-statement" | "cash-flow"

/**
 * Type guard to check if a string is a valid ReportType
 */
const isReportType = (value: string): value is ReportType =>
  value === "trial-balance" ||
  value === "balance-sheet" ||
  value === "income-statement" ||
  value === "cash-flow"

/**
 * Report parameters state
 */
interface ReportParams {
  readonly reportType: ReportType
  readonly asOfDate: string
  readonly periodStartDate: string
  readonly periodEndDate: string
  readonly comparativeDate: string
  readonly comparativeStartDate: string
  readonly comparativeEndDate: string
  readonly excludeZeroBalances: boolean
}

/**
 * Drill-down state for viewing transactions
 */
interface DrillDownState {
  readonly accountId: AccountId | null
  readonly accountName: string
  readonly dateRange: { startDate: string; endDate: string }
}

// =============================================================================
// Report Type Configuration
// =============================================================================

const REPORT_TYPES: ReadonlyArray<{ value: ReportType; label: string; description: string }> = [
  {
    value: "trial-balance",
    label: "Trial Balance",
    description: "Shows all account balances with total debits and credits"
  },
  {
    value: "balance-sheet",
    label: "Balance Sheet",
    description: "Assets, Liabilities, and Equity at a point in time"
  },
  {
    value: "income-statement",
    label: "Income Statement",
    description: "Revenue, Expenses, and Net Income for a period"
  },
  {
    value: "cash-flow",
    label: "Cash Flow Statement",
    description: "Operating, Investing, and Financing cash flows"
  }
]

// =============================================================================
// Atoms
// =============================================================================

/**
 * Report parameters atom (local React state pattern)
 */
const reportParamsAtom = Atom.make<ReportParams>({
  reportType: "trial-balance",
  asOfDate: today().toISOString(),
  periodStartDate: LocalDate.make({ year: today().year, month: 1, day: 1 }).toISOString(),
  periodEndDate: today().toISOString(),
  comparativeDate: "",
  comparativeStartDate: "",
  comparativeEndDate: "",
  excludeZeroBalances: false
})

/**
 * Drill-down state atom
 */
const drillDownStateAtom = Atom.make<DrillDownState>({
  accountId: null,
  accountName: "",
  dateRange: { startDate: "", endDate: "" }
})

/**
 * Parse ISO date string to LocalDate
 * Returns undefined if empty string
 */
const parseLocalDate = (dateStr: string): LocalDate | undefined => {
  if (!dateStr) return undefined
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  const [, yearStr, monthStr, dayStr] = match
  return LocalDate.make({
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10)
  })
}


/**
 * Create transactions query atom for drill-down
 */
const createTransactionsQueryAtom = (
  companyIdStr: string,
  startDate: string,
  endDate: string
) => {
  // JournalEntriesApi expects branded CompanyId and optional LocalDate
  const brandedCompanyId = CompanyId.make(companyIdStr)
  return ApiClient.query("journal-entries", "listJournalEntries", {
    urlParams: {
      companyId: brandedCompanyId,
      fromDate: parseLocalDate(startDate),
      toDate: parseLocalDate(endDate),
      limit: 100,
      offset: 0
    },
    timeToLive: Duration.minutes(2)
  })
}

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "1400px",
  margin: "0 auto",
  padding: "24px"
}

const headerStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "24px"
}

const controlsStyles: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px"
}

const controlsGridStyles: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: "16px",
  alignItems: "flex-end"
}

const formGroupStyles: React.CSSProperties = {
  marginBottom: "0"
}

const labelStyles: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontWeight: 500,
  fontSize: "14px",
  color: "#333"
}

const inputStyles: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "4px",
  border: "1px solid #ccc",
  fontSize: "14px",
  boxSizing: "border-box"
}

const selectStyles: React.CSSProperties = {
  ...inputStyles
}

const buttonStyles: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "4px",
  border: "none",
  backgroundColor: "#1890ff",
  color: "white",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "14px"
}

const secondaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#f5f5f5",
  color: "#333",
  border: "1px solid #ccc"
}

const checkboxLabelStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  cursor: "pointer"
}

const reportContainerStyles: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  overflow: "hidden"
}

const reportHeaderStyles: React.CSSProperties = {
  padding: "20px",
  borderBottom: "1px solid #e8e8e8",
  backgroundColor: "#fafafa"
}

const reportTitleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 600
}

const reportSubtitleStyles: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "14px",
  color: "#666"
}

const reportTableStyles: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse"
}

const thStyles: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  backgroundColor: "#fafafa",
  borderBottom: "2px solid #e8e8e8",
  fontWeight: 600,
  fontSize: "13px",
  color: "#333"
}

const thRightStyles: React.CSSProperties = {
  ...thStyles,
  textAlign: "right"
}

const tdStyles: React.CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid #f0f0f0",
  fontSize: "14px"
}

const tdRightStyles: React.CSSProperties = {
  ...tdStyles,
  textAlign: "right",
  fontFamily: "monospace"
}

const getLineItemStyles = (style: LineItemStyle, indentLevel: number): React.CSSProperties => {
  const base: React.CSSProperties = {
    ...tdStyles,
    paddingLeft: `${16 + indentLevel * 20}px`
  }

  switch (style) {
    case "Header":
      return { ...base, fontWeight: 600, backgroundColor: "#fafafa", fontSize: "14px" }
    case "Subtotal":
      return { ...base, fontWeight: 600, borderTop: "1px solid #e8e8e8" }
    case "Total":
      return { ...base, fontWeight: 700, backgroundColor: "#f5f5f5", borderTop: "2px solid #333" }
    default:
      return base
  }
}

const getAmountStyles = (style: LineItemStyle): React.CSSProperties => {
  const base: React.CSSProperties = { ...tdRightStyles }

  switch (style) {
    case "Header":
      return { ...base, fontWeight: 600, backgroundColor: "#fafafa" }
    case "Subtotal":
      return { ...base, fontWeight: 600, borderTop: "1px solid #e8e8e8" }
    case "Total":
      return { ...base, fontWeight: 700, backgroundColor: "#f5f5f5", borderTop: "2px solid #333" }
    default:
      return base
  }
}

const clickableRowStyles: React.CSSProperties = {
  cursor: "pointer"
}

const loadingStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "48px",
  color: "#666"
}

const errorStyles: React.CSSProperties = {
  backgroundColor: "#fff2f0",
  border: "1px solid #ffccc7",
  borderRadius: "4px",
  padding: "16px",
  color: "#ff4d4f",
  marginBottom: "24px"
}

const drillDownModalStyles: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000
}

const drillDownContentStyles: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "8px",
  width: "90%",
  maxWidth: "1000px",
  maxHeight: "80vh",
  overflow: "auto"
}

const drillDownHeaderStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px",
  borderBottom: "1px solid #e8e8e8"
}

const summaryRowStyles: React.CSSProperties = {
  backgroundColor: "#e6f7ff",
  fontWeight: 600
}

const balancedIndicatorStyles = (isBalanced: boolean): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: 500,
  backgroundColor: isBalanced ? "#f6ffed" : "#fff2f0",
  color: isBalanced ? "#52c41a" : "#ff4d4f"
})

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format monetary amount for display
 * MonetaryAmount has `amount` (BigDecimal) and `currency` (CurrencyCode)
 */
const formatMonetaryAmount = (amount: MonetaryAmount): string => {
  const formatted = BigDecimal.format(BigDecimal.abs(amount.amount))
  const num = parseFloat(formatted)
  const displayValue = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return BigDecimal.isNegative(amount.amount) ? `(${displayValue})` : displayValue
}

/**
 * Check if monetary amount is positive (greater than zero)
 */
const isPositiveAmount = (amount: MonetaryAmount): boolean => {
  return BigDecimal.isPositive(amount.amount)
}

/**
 * Get optional value from Option type
 */
const getOptionalValue = <T,>(opt: Option.Option<T> | null | undefined): T | null => {
  if (opt === null || opt === undefined) return null
  if (Option.isOption(opt)) {
    return Option.getOrNull(opt)
  }
  return null
}

// =============================================================================
// Components
// =============================================================================

/**
 * Report Parameters Form Component
 */
function ReportParametersForm({
  params,
  onChange,
  onGenerate,
  isLoading
}: {
  readonly params: ReportParams
  readonly onChange: (updates: Partial<ReportParams>) => void
  readonly onGenerate: () => void
  readonly isLoading: boolean
}): React.ReactElement {
  const showPeriodDates = params.reportType === "income-statement" || params.reportType === "cash-flow"

  return (
    <div style={controlsStyles}>
      <div style={controlsGridStyles}>
        {/* Report Type Selector */}
        <div style={formGroupStyles}>
          <label style={labelStyles}>Report Type</label>
          <select
            value={params.reportType}
            onChange={(e) => {
              const value = e.target.value
              if (isReportType(value)) {
                onChange({ reportType: value })
              }
            }}
            style={selectStyles}
          >
            {REPORT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Parameters - varies by report type */}
        {!showPeriodDates ? (
          // As-of date for Trial Balance and Balance Sheet
          <div style={formGroupStyles}>
            <label style={labelStyles}>As of Date</label>
            <input
              type="date"
              value={params.asOfDate}
              onChange={(e) => onChange({ asOfDate: e.target.value })}
              style={inputStyles}
            />
          </div>
        ) : (
          // Period dates for Income Statement and Cash Flow
          <>
            <div style={formGroupStyles}>
              <label style={labelStyles}>Period Start</label>
              <input
                type="date"
                value={params.periodStartDate}
                onChange={(e) => onChange({ periodStartDate: e.target.value })}
                style={inputStyles}
              />
            </div>
            <div style={formGroupStyles}>
              <label style={labelStyles}>Period End</label>
              <input
                type="date"
                value={params.periodEndDate}
                onChange={(e) => onChange({ periodEndDate: e.target.value })}
                style={inputStyles}
              />
            </div>
          </>
        )}

        {/* Comparative Date - Balance Sheet only */}
        {params.reportType === "balance-sheet" && (
          <div style={formGroupStyles}>
            <label style={labelStyles}>Comparative Date (optional)</label>
            <input
              type="date"
              value={params.comparativeDate}
              onChange={(e) => onChange({ comparativeDate: e.target.value })}
              style={inputStyles}
            />
          </div>
        )}

        {/* Generate Button */}
        <div style={formGroupStyles}>
          <label style={labelStyles}>&nbsp;</label>
          <button
            onClick={onGenerate}
            style={buttonStyles}
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Additional Options Row */}
      {params.reportType === "trial-balance" && (
        <div style={{ marginTop: "16px" }}>
          <label style={checkboxLabelStyles}>
            <input
              type="checkbox"
              checked={params.excludeZeroBalances}
              onChange={(e) => onChange({ excludeZeroBalances: e.target.checked })}
            />
            Exclude zero balances
          </label>
        </div>
      )}

      {/* Report Type Description */}
      <div style={{ marginTop: "12px", fontSize: "13px", color: "#666" }}>
        {REPORT_TYPES.find((t) => t.value === params.reportType)?.description}
      </div>
    </div>
  )
}

/**
 * Trial Balance Report Display Component
 */
function TrialBalanceDisplay({
  report,
  onDrillDown
}: {
  readonly report: TrialBalanceReport
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  return (
    <div style={reportContainerStyles}>
      <div style={reportHeaderStyles}>
        <h2 style={reportTitleStyles}>Trial Balance</h2>
        <p style={reportSubtitleStyles}>
          As of {report.asOfDate.toISOString()} | Currency: {report.currency}
        </p>
        <span style={balancedIndicatorStyles(report.isBalanced)}>
          {report.isBalanced ? "Balanced" : "Out of Balance"}
        </span>
      </div>

      <table style={reportTableStyles}>
        <thead>
          <tr>
            <th style={thStyles}>Account Number</th>
            <th style={thStyles}>Account Name</th>
            <th style={thStyles}>Type</th>
            <th style={thRightStyles}>Debit</th>
            <th style={thRightStyles}>Credit</th>
          </tr>
        </thead>
        <tbody>
          {report.lineItems.map((item: TrialBalanceLineItem) => (
            <tr
              key={item.accountId}
              style={clickableRowStyles}
              onClick={() => onDrillDown(item.accountId, item.accountName)}
              title="Click to view transactions"
            >
              <td style={tdStyles}>{item.accountNumber}</td>
              <td style={tdStyles}>{item.accountName}</td>
              <td style={tdStyles}>{item.accountType}</td>
              <td style={tdRightStyles}>
                {isPositiveAmount(item.debitBalance) ? formatMonetaryAmount(item.debitBalance) : ""}
              </td>
              <td style={tdRightStyles}>
                {isPositiveAmount(item.creditBalance) ? formatMonetaryAmount(item.creditBalance) : ""}
              </td>
            </tr>
          ))}
          {/* Totals Row */}
          <tr style={summaryRowStyles}>
            <td style={tdStyles} colSpan={3}>
              <strong>Total</strong>
            </td>
            <td style={tdRightStyles}>
              <strong>{formatMonetaryAmount(report.totalDebits)}</strong>
            </td>
            <td style={tdRightStyles}>
              <strong>{formatMonetaryAmount(report.totalCredits)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Balance Sheet Section Component
 */
function BalanceSheetSectionDisplay({
  section,
  hasComparative,
  onDrillDown
}: {
  readonly section: BalanceSheetSection
  readonly hasComparative: boolean
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  return (
    <>
      {/* Section Header */}
      <tr>
        <td style={getLineItemStyles("Header", 0)} colSpan={hasComparative ? 4 : 2}>
          {section.title}
        </td>
      </tr>

      {/* Line Items */}
      {section.lineItems.map((item: BalanceSheetLineItem, index: number) => {
        const accountId = getOptionalValue(item.accountId)
        const isClickable = accountId !== null

        return (
          <tr
            key={`${section.title}-${index}`}
            style={isClickable ? clickableRowStyles : {}}
            onClick={isClickable ? () => onDrillDown(accountId, item.description) : undefined}
            title={isClickable ? "Click to view transactions" : undefined}
          >
            <td style={getLineItemStyles(item.style, item.indentLevel)}>
              {item.description}
            </td>
            <td style={getAmountStyles(item.style)}>
              {formatMonetaryAmount(item.currentAmount)}
            </td>
            {hasComparative && (
              <>
                <td style={getAmountStyles(item.style)}>
                  {getOptionalValue(item.comparativeAmount)
                    ? formatMonetaryAmount(getOptionalValue(item.comparativeAmount)!)
                    : "-"}
                </td>
                <td style={getAmountStyles(item.style)}>
                  {getOptionalValue(item.variance)
                    ? formatMonetaryAmount(getOptionalValue(item.variance)!)
                    : "-"}
                </td>
              </>
            )}
          </tr>
        )
      })}
    </>
  )
}

/**
 * Balance Sheet Report Display Component
 */
function BalanceSheetDisplay({
  report,
  onDrillDown
}: {
  readonly report: BalanceSheetReport
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  const hasComparative = getOptionalValue(report.comparativeDate) !== null

  return (
    <div style={reportContainerStyles}>
      <div style={reportHeaderStyles}>
        <h2 style={reportTitleStyles}>Balance Sheet</h2>
        <p style={reportSubtitleStyles}>
          As of {report.asOfDate.toISOString()}
          {hasComparative && ` (Comparative: ${getOptionalValue(report.comparativeDate)?.toISOString()})`}
          {" | Currency: "}{report.currency}
        </p>
        <span style={balancedIndicatorStyles(report.isBalanced)}>
          {report.isBalanced ? "Balanced" : "Out of Balance"}
        </span>
      </div>

      <table style={reportTableStyles}>
        <thead>
          <tr>
            <th style={thStyles}>Description</th>
            <th style={thRightStyles}>Current</th>
            {hasComparative && (
              <>
                <th style={thRightStyles}>Prior</th>
                <th style={thRightStyles}>Variance</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {/* Assets */}
          <BalanceSheetSectionDisplay
            section={report.currentAssets}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />
          <BalanceSheetSectionDisplay
            section={report.nonCurrentAssets}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />

          {/* Total Assets */}
          <tr style={summaryRowStyles}>
            <td style={getLineItemStyles("Total", 0)}>Total Assets</td>
            <td style={getAmountStyles("Total")}>{formatMonetaryAmount(report.totalAssets)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Total")}>-</td>
                <td style={getAmountStyles("Total")}>-</td>
              </>
            )}
          </tr>

          {/* Spacer */}
          <tr><td colSpan={hasComparative ? 4 : 2} style={{ height: "16px" }}></td></tr>

          {/* Liabilities */}
          <BalanceSheetSectionDisplay
            section={report.currentLiabilities}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />
          <BalanceSheetSectionDisplay
            section={report.nonCurrentLiabilities}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />

          {/* Total Liabilities */}
          <tr>
            <td style={getLineItemStyles("Subtotal", 0)}>Total Liabilities</td>
            <td style={getAmountStyles("Subtotal")}>{formatMonetaryAmount(report.totalLiabilities)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Subtotal")}>-</td>
                <td style={getAmountStyles("Subtotal")}>-</td>
              </>
            )}
          </tr>

          {/* Equity */}
          <BalanceSheetSectionDisplay
            section={report.equity}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />

          {/* Total Equity */}
          <tr>
            <td style={getLineItemStyles("Subtotal", 0)}>Total Equity</td>
            <td style={getAmountStyles("Subtotal")}>{formatMonetaryAmount(report.totalEquity)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Subtotal")}>-</td>
                <td style={getAmountStyles("Subtotal")}>-</td>
              </>
            )}
          </tr>

          {/* Total Liabilities & Equity */}
          <tr style={summaryRowStyles}>
            <td style={getLineItemStyles("Total", 0)}>Total Liabilities & Equity</td>
            <td style={getAmountStyles("Total")}>{formatMonetaryAmount(report.totalLiabilitiesAndEquity)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Total")}>-</td>
                <td style={getAmountStyles("Total")}>-</td>
              </>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Income Statement Section Component
 */
function IncomeStatementSectionDisplay({
  section,
  hasComparative,
  onDrillDown
}: {
  readonly section: IncomeStatementSection
  readonly hasComparative: boolean
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  return (
    <>
      {/* Section Header */}
      <tr>
        <td style={getLineItemStyles("Header", 0)} colSpan={hasComparative ? 4 : 2}>
          {section.title}
        </td>
      </tr>

      {/* Line Items */}
      {section.lineItems.map((item: IncomeStatementLineItem, index: number) => {
        const accountId = getOptionalValue(item.accountId)
        const isClickable = accountId !== null

        return (
          <tr
            key={`${section.title}-${index}`}
            style={isClickable ? clickableRowStyles : {}}
            onClick={isClickable ? () => onDrillDown(accountId, item.description) : undefined}
            title={isClickable ? "Click to view transactions" : undefined}
          >
            <td style={getLineItemStyles(item.style, item.indentLevel)}>
              {item.description}
            </td>
            <td style={getAmountStyles(item.style)}>
              {formatMonetaryAmount(item.currentAmount)}
            </td>
            {hasComparative && (
              <>
                <td style={getAmountStyles(item.style)}>
                  {getOptionalValue(item.comparativeAmount)
                    ? formatMonetaryAmount(getOptionalValue(item.comparativeAmount)!)
                    : "-"}
                </td>
                <td style={getAmountStyles(item.style)}>
                  {getOptionalValue(item.variance)
                    ? formatMonetaryAmount(getOptionalValue(item.variance)!)
                    : "-"}
                </td>
              </>
            )}
          </tr>
        )
      })}
    </>
  )
}

/**
 * Income Statement Report Display Component
 */
function IncomeStatementDisplay({
  report,
  onDrillDown
}: {
  readonly report: IncomeStatementReport
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  const hasComparative = getOptionalValue(report.comparativeStartDate) !== null

  return (
    <div style={reportContainerStyles}>
      <div style={reportHeaderStyles}>
        <h2 style={reportTitleStyles}>Income Statement</h2>
        <p style={reportSubtitleStyles}>
          Period: {report.periodStartDate.toISOString()} to {report.periodEndDate.toISOString()}
          {" | Currency: "}{report.currency}
        </p>
      </div>

      <table style={reportTableStyles}>
        <thead>
          <tr>
            <th style={thStyles}>Description</th>
            <th style={thRightStyles}>Current</th>
            {hasComparative && (
              <>
                <th style={thRightStyles}>Prior</th>
                <th style={thRightStyles}>Variance</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {/* Revenue */}
          <IncomeStatementSectionDisplay
            section={report.revenue}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />

          {/* Cost of Sales */}
          <IncomeStatementSectionDisplay
            section={report.costOfSales}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />

          {/* Gross Profit */}
          <tr style={summaryRowStyles}>
            <td style={getLineItemStyles("Subtotal", 0)}>Gross Profit</td>
            <td style={getAmountStyles("Subtotal")}>{formatMonetaryAmount(report.grossProfit)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Subtotal")}>-</td>
                <td style={getAmountStyles("Subtotal")}>-</td>
              </>
            )}
          </tr>

          {/* Operating Expenses */}
          <IncomeStatementSectionDisplay
            section={report.operatingExpenses}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />

          {/* Operating Income */}
          <tr>
            <td style={getLineItemStyles("Subtotal", 0)}>Operating Income</td>
            <td style={getAmountStyles("Subtotal")}>{formatMonetaryAmount(report.operatingIncome)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Subtotal")}>-</td>
                <td style={getAmountStyles("Subtotal")}>-</td>
              </>
            )}
          </tr>

          {/* Other Income/Expense */}
          <IncomeStatementSectionDisplay
            section={report.otherIncomeExpense}
            hasComparative={hasComparative}
            onDrillDown={onDrillDown}
          />

          {/* Income Before Tax */}
          <tr>
            <td style={getLineItemStyles("Subtotal", 0)}>Income Before Tax</td>
            <td style={getAmountStyles("Subtotal")}>{formatMonetaryAmount(report.incomeBeforeTax)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Subtotal")}>-</td>
                <td style={getAmountStyles("Subtotal")}>-</td>
              </>
            )}
          </tr>

          {/* Tax Expense */}
          <tr>
            <td style={{ ...tdStyles, paddingLeft: "36px" }}>Tax Expense</td>
            <td style={tdRightStyles}>{formatMonetaryAmount(report.taxExpense)}</td>
            {hasComparative && (
              <>
                <td style={tdRightStyles}>-</td>
                <td style={tdRightStyles}>-</td>
              </>
            )}
          </tr>

          {/* Net Income */}
          <tr style={summaryRowStyles}>
            <td style={getLineItemStyles("Total", 0)}>Net Income</td>
            <td style={getAmountStyles("Total")}>{formatMonetaryAmount(report.netIncome)}</td>
            {hasComparative && (
              <>
                <td style={getAmountStyles("Total")}>-</td>
                <td style={getAmountStyles("Total")}>-</td>
              </>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Cash Flow Section Component
 */
function CashFlowSectionDisplay({
  section
}: {
  readonly section: CashFlowSection
}): React.ReactElement {
  return (
    <>
      {/* Section Header */}
      <tr>
        <td style={getLineItemStyles("Header", 0)} colSpan={2}>
          {section.title}
        </td>
      </tr>

      {/* Line Items */}
      {section.lineItems.map((item: CashFlowLineItem, index: number) => (
        <tr key={`${section.title}-${index}`}>
          <td style={getLineItemStyles(item.style, item.indentLevel)}>
            {item.description}
          </td>
          <td style={getAmountStyles(item.style)}>
            {formatMonetaryAmount(item.amount)}
          </td>
        </tr>
      ))}

      {/* Net Cash Flow */}
      <tr>
        <td style={getLineItemStyles("Subtotal", 0)}>
          Net Cash from {section.title.replace(" Activities", "")}
        </td>
        <td style={getAmountStyles("Subtotal")}>{formatMonetaryAmount(section.netCashFlow)}</td>
      </tr>
    </>
  )
}

/**
 * Cash Flow Statement Report Display Component
 */
function CashFlowStatementDisplay({
  report
}: {
  readonly report: CashFlowStatementReport
}): React.ReactElement {
  return (
    <div style={reportContainerStyles}>
      <div style={reportHeaderStyles}>
        <h2 style={reportTitleStyles}>Cash Flow Statement</h2>
        <p style={reportSubtitleStyles}>
          Period: {report.periodStartDate.toISOString()} to {report.periodEndDate.toISOString()}
          {" | Method: "}{report.method.charAt(0).toUpperCase() + report.method.slice(1)}
          {" | Currency: "}{report.currency}
        </p>
      </div>

      <table style={reportTableStyles}>
        <thead>
          <tr>
            <th style={thStyles}>Description</th>
            <th style={thRightStyles}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {/* Beginning Cash */}
          <tr>
            <td style={tdStyles}>Beginning Cash Balance</td>
            <td style={tdRightStyles}>{formatMonetaryAmount(report.beginningCash)}</td>
          </tr>

          {/* Spacer */}
          <tr><td colSpan={2} style={{ height: "16px" }}></td></tr>

          {/* Operating Activities */}
          <CashFlowSectionDisplay section={report.operatingActivities} />

          {/* Spacer */}
          <tr><td colSpan={2} style={{ height: "8px" }}></td></tr>

          {/* Investing Activities */}
          <CashFlowSectionDisplay section={report.investingActivities} />

          {/* Spacer */}
          <tr><td colSpan={2} style={{ height: "8px" }}></td></tr>

          {/* Financing Activities */}
          <CashFlowSectionDisplay section={report.financingActivities} />

          {/* Spacer */}
          <tr><td colSpan={2} style={{ height: "16px" }}></td></tr>

          {/* Exchange Rate Effect */}
          <tr>
            <td style={tdStyles}>Effect of Exchange Rate Changes</td>
            <td style={tdRightStyles}>{formatMonetaryAmount(report.exchangeRateEffect)}</td>
          </tr>

          {/* Net Change in Cash */}
          <tr>
            <td style={getLineItemStyles("Subtotal", 0)}>Net Change in Cash</td>
            <td style={getAmountStyles("Subtotal")}>{formatMonetaryAmount(report.netChangeInCash)}</td>
          </tr>

          {/* Ending Cash */}
          <tr style={summaryRowStyles}>
            <td style={getLineItemStyles("Total", 0)}>Ending Cash Balance</td>
            <td style={getAmountStyles("Total")}>{formatMonetaryAmount(report.endingCash)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * Drill-down Modal Component for viewing transactions
 */
function DrillDownModal({
  drillDown,
  companyId,
  onClose
}: {
  readonly drillDown: DrillDownState
  readonly companyId: string
  readonly onClose: () => void
}): React.ReactElement | null {
  if (!drillDown.accountId) return null

  // Create transactions query atom
  const transactionsQueryAtom = React.useMemo(
    () => createTransactionsQueryAtom(
      companyId,
      drillDown.dateRange.startDate,
      drillDown.dateRange.endDate
    ),
    [companyId, drillDown.dateRange.startDate, drillDown.dateRange.endDate]
  )

  const transactionsResult = useAtomValue(transactionsQueryAtom)

  return (
    <div style={drillDownModalStyles} onClick={onClose}>
      <div style={drillDownContentStyles} onClick={(e) => e.stopPropagation()}>
        <div style={drillDownHeaderStyles}>
          <div>
            <h3 style={{ margin: 0 }}>Transactions: {drillDown.accountName}</h3>
            <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>
              {drillDown.dateRange.startDate} to {drillDown.dateRange.endDate}
            </p>
          </div>
          <button onClick={onClose} style={secondaryButtonStyles}>Close</button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          {Result.isInitial(transactionsResult) || Result.isWaiting(transactionsResult) ? (
            <div style={loadingStyles}>Loading transactions...</div>
          ) : Result.isFailure(transactionsResult) ? (
            <div style={errorStyles}>
              Failed to load transactions. Please try again.
            </div>
          ) : (
            <table style={reportTableStyles}>
              <thead>
                <tr>
                  <th style={thStyles}>Date</th>
                  <th style={thStyles}>Entry #</th>
                  <th style={thStyles}>Description</th>
                  <th style={thStyles}>Type</th>
                  <th style={thStyles}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactionsResult.value.entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyles, textAlign: "center", color: "#666" }}>
                      No transactions found for this period.
                    </td>
                  </tr>
                ) : (
                  transactionsResult.value.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td style={tdStyles}>{entry.transactionDate.toISOString()}</td>
                      <td style={tdStyles}>
                        {Option.isSome(entry.entryNumber)
                          ? entry.entryNumber.value
                          : "-"}
                      </td>
                      <td style={tdStyles}>{entry.description}</td>
                      <td style={tdStyles}>{entry.entryType}</td>
                      <td style={tdStyles}>{entry.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Trial Balance Report Result Display
 */
function TrialBalanceResultDisplay({
  reportResult,
  onDrillDown
}: {
  readonly reportResult: Result.Result<TrialBalanceReport, unknown>
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  if (Result.isInitial(reportResult)) {
    return <ReportInitialState />
  }
  if (Result.isWaiting(reportResult)) {
    return <ReportLoadingState />
  }
  if (Result.isFailure(reportResult)) {
    return <ReportErrorState cause={reportResult.cause} />
  }
  return <TrialBalanceDisplay report={reportResult.value} onDrillDown={onDrillDown} />
}

/**
 * Balance Sheet Report Result Display
 */
function BalanceSheetResultDisplay({
  reportResult,
  onDrillDown
}: {
  readonly reportResult: Result.Result<BalanceSheetReport, unknown>
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  if (Result.isInitial(reportResult)) {
    return <ReportInitialState />
  }
  if (Result.isWaiting(reportResult)) {
    return <ReportLoadingState />
  }
  if (Result.isFailure(reportResult)) {
    return <ReportErrorState cause={reportResult.cause} />
  }
  return <BalanceSheetDisplay report={reportResult.value} onDrillDown={onDrillDown} />
}

/**
 * Income Statement Report Result Display
 */
function IncomeStatementResultDisplay({
  reportResult,
  onDrillDown
}: {
  readonly reportResult: Result.Result<IncomeStatementReport, unknown>
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  if (Result.isInitial(reportResult)) {
    return <ReportInitialState />
  }
  if (Result.isWaiting(reportResult)) {
    return <ReportLoadingState />
  }
  if (Result.isFailure(reportResult)) {
    return <ReportErrorState cause={reportResult.cause} />
  }
  return <IncomeStatementDisplay report={reportResult.value} onDrillDown={onDrillDown} />
}

/**
 * Cash Flow Statement Report Result Display
 */
function CashFlowStatementResultDisplay({
  reportResult
}: {
  readonly reportResult: Result.Result<CashFlowStatementReport, unknown>
}): React.ReactElement {
  if (Result.isInitial(reportResult)) {
    return <ReportInitialState />
  }
  if (Result.isWaiting(reportResult)) {
    return <ReportLoadingState />
  }
  if (Result.isFailure(reportResult)) {
    return <ReportErrorState cause={reportResult.cause} />
  }
  return <CashFlowStatementDisplay report={reportResult.value} />
}

/**
 * Report Initial State Component
 */
function ReportInitialState(): React.ReactElement {
  return (
    <div style={reportContainerStyles}>
      <div style={loadingStyles}>
        Select parameters and click "Generate Report" to view the report.
      </div>
    </div>
  )
}

/**
 * Report Loading State Component
 */
function ReportLoadingState(): React.ReactElement {
  return (
    <div style={reportContainerStyles}>
      <div style={loadingStyles}>Generating report...</div>
    </div>
  )
}

/**
 * Report Error State Component
 */
function ReportErrorState({ cause }: { readonly cause: unknown }): React.ReactElement {
  return (
    <div style={errorStyles}>
      Failed to generate report. Please check your parameters and try again.
      <br />
      <small>{String(cause)}</small>
    </div>
  )
}

// =============================================================================
// Report Display Selector
// =============================================================================

/**
 * Report Display Selector - renders the appropriate report based on type
 * Each report type has its own atom and display to maintain type safety
 */
function ReportDisplaySelector({
  companyId,
  params,
  shouldFetch,
  fetchKey,
  onDrillDown
}: {
  readonly companyId: string
  readonly params: ReportParams
  readonly shouldFetch: boolean
  readonly fetchKey: number
  readonly onDrillDown: (accountId: AccountId, accountName: string) => void
}): React.ReactElement {
  // Trial Balance
  const trialBalanceAtom = React.useMemo(() => {
    if (!shouldFetch || params.reportType !== "trial-balance") return null
    const asOfDate = parseLocalDate(params.asOfDate)
    if (!asOfDate) return null
    return ApiClient.query("reports", "generateTrialBalance", {
      urlParams: {
        companyId,
        asOfDate,
        periodStartDate: parseLocalDate(params.periodStartDate),
        excludeZeroBalances: params.excludeZeroBalances ? true : undefined
      },
      timeToLive: Duration.minutes(2)
    })
  }, [companyId, params, shouldFetch, fetchKey])

  // Balance Sheet
  const balanceSheetAtom = React.useMemo(() => {
    if (!shouldFetch || params.reportType !== "balance-sheet") return null
    const asOfDate = parseLocalDate(params.asOfDate)
    if (!asOfDate) return null
    return ApiClient.query("reports", "generateBalanceSheet", {
      urlParams: {
        companyId,
        asOfDate,
        comparativeDate: parseLocalDate(params.comparativeDate)
      },
      timeToLive: Duration.minutes(2)
    })
  }, [companyId, params, shouldFetch, fetchKey])

  // Income Statement
  const incomeStatementAtom = React.useMemo(() => {
    if (!shouldFetch || params.reportType !== "income-statement") return null
    const periodStartDate = parseLocalDate(params.periodStartDate)
    const periodEndDate = parseLocalDate(params.periodEndDate)
    if (!periodStartDate || !periodEndDate) return null
    return ApiClient.query("reports", "generateIncomeStatement", {
      urlParams: {
        companyId,
        periodStartDate,
        periodEndDate,
        comparativeStartDate: parseLocalDate(params.comparativeStartDate),
        comparativeEndDate: parseLocalDate(params.comparativeEndDate)
      },
      timeToLive: Duration.minutes(2)
    })
  }, [companyId, params, shouldFetch, fetchKey])

  // Cash Flow Statement
  const cashFlowAtom = React.useMemo(() => {
    if (!shouldFetch || params.reportType !== "cash-flow") return null
    const periodStartDate = parseLocalDate(params.periodStartDate)
    const periodEndDate = parseLocalDate(params.periodEndDate)
    if (!periodStartDate || !periodEndDate) return null
    return ApiClient.query("reports", "generateCashFlowStatement", {
      urlParams: {
        companyId,
        periodStartDate,
        periodEndDate
      },
      timeToLive: Duration.minutes(2)
    })
  }, [companyId, params, shouldFetch, fetchKey])

  // Type-safe dummy atoms for each report type
  const dummyTrialBalance = React.useMemo(
    () => Atom.make<Result.Result<TrialBalanceReport, unknown>>(Result.initial()),
    []
  )
  const dummyBalanceSheet = React.useMemo(
    () => Atom.make<Result.Result<BalanceSheetReport, unknown>>(Result.initial()),
    []
  )
  const dummyIncomeStatement = React.useMemo(
    () => Atom.make<Result.Result<IncomeStatementReport, unknown>>(Result.initial()),
    []
  )
  const dummyCashFlow = React.useMemo(
    () => Atom.make<Result.Result<CashFlowStatementReport, unknown>>(Result.initial()),
    []
  )

  // Get results from atoms
  const trialBalanceResult = useAtomValue(trialBalanceAtom ?? dummyTrialBalance)
  const balanceSheetResult = useAtomValue(balanceSheetAtom ?? dummyBalanceSheet)
  const incomeStatementResult = useAtomValue(incomeStatementAtom ?? dummyIncomeStatement)
  const cashFlowResult = useAtomValue(cashFlowAtom ?? dummyCashFlow)

  switch (params.reportType) {
    case "trial-balance":
      return <TrialBalanceResultDisplay reportResult={trialBalanceResult} onDrillDown={onDrillDown} />
    case "balance-sheet":
      return <BalanceSheetResultDisplay reportResult={balanceSheetResult} onDrillDown={onDrillDown} />
    case "income-statement":
      return <IncomeStatementResultDisplay reportResult={incomeStatementResult} onDrillDown={onDrillDown} />
    case "cash-flow":
      return <CashFlowStatementResultDisplay reportResult={cashFlowResult} />
  }
}

// =============================================================================
// Main Page Component
// =============================================================================

function ReportViewerPage(): React.ReactElement {
  const { companyId } = Route.useParams()

  // Report parameters (local state)
  const [params, setParams] = useAtom(reportParamsAtom)

  // Drill-down state
  const [drillDown, setDrillDown] = useAtom(drillDownStateAtom)

  // Track if we should fetch a report (only after clicking generate)
  const [shouldFetch, setShouldFetch] = React.useState(false)
  const [fetchKey, setFetchKey] = React.useState(0)

  // Handle parameter changes
  const handleParamsChange = (updates: Partial<ReportParams>) => {
    setParams((prev) => ({ ...prev, ...updates }))
  }

  // Handle generate report
  const handleGenerate = () => {
    setShouldFetch(true)
    setFetchKey((k) => k + 1)
  }

  // Handle drill-down
  const handleDrillDown = (accountId: AccountId, accountName: string) => {
    setDrillDown({
      accountId,
      accountName,
      dateRange: {
        startDate: params.periodStartDate || params.asOfDate,
        endDate: params.periodEndDate || params.asOfDate
      }
    })
  }

  // Handle close drill-down
  const handleCloseDrillDown = () => {
    setDrillDown({
      accountId: null,
      accountName: "",
      dateRange: { startDate: "", endDate: "" }
    })
  }

  return (
    <div style={pageStyles}>
      {/* Header */}
      <div style={headerStyles}>
        <div>
          <h1 style={{ margin: 0 }}>Financial Reports</h1>
          <p style={{ color: "#666", margin: "8px 0 0" }}>
            Company ID: {companyId}
          </p>
        </div>
        <Link
          to="/companies/$companyId/accounts"
          params={{ companyId }}
          style={{ textDecoration: "none" }}
        >
          <button style={secondaryButtonStyles}>
            View Chart of Accounts
          </button>
        </Link>
      </div>

      {/* Report Parameters Form */}
      <ReportParametersForm
        params={params}
        onChange={handleParamsChange}
        onGenerate={handleGenerate}
        isLoading={false}
      />

      {/* Report Display */}
      <ReportDisplaySelector
        companyId={companyId}
        params={params}
        shouldFetch={shouldFetch}
        fetchKey={fetchKey}
        onDrillDown={handleDrillDown}
      />

      {/* Drill-Down Modal */}
      {drillDown.accountId && (
        <DrillDownModal
          drillDown={drillDown}
          companyId={companyId}
          onClose={handleCloseDrillDown}
        />
      )}

      {/* Export Options (Future Enhancement Note) */}
      {shouldFetch && (
        <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
            Export to PDF/Excel - Coming soon
          </p>
        </div>
      )}
    </div>
  )
}
