/**
 * Balance Sheet Report Route
 *
 * Displays the balance sheet report for a specific company showing
 * Assets, Liabilities, and Equity at a specific point in time.
 *
 * Route: /organizations/:organizationId/companies/:companyId/reports/balance-sheet
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import {
  ReportParameterForm,
  FormSection,
  FormRow,
  FormField,
  DateInput,
  CheckboxField
} from "@/components/reports/ReportParameterForm"
import { Tooltip } from "@/components/ui/Tooltip"
import { ArrowLeft, Download, Printer, AlertTriangle, CheckCircle } from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface Company {
  readonly id: string
  readonly name: string
  readonly functionalCurrency: string
}

interface LocalDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface MonetaryAmount {
  readonly amount: string
  readonly currency: string
}

interface BalanceSheetLineItem {
  readonly accountId: string | null
  readonly accountNumber: string | null
  readonly description: string
  readonly currentAmount: MonetaryAmount
  readonly comparativeAmount: MonetaryAmount | null
  readonly variance: MonetaryAmount | null
  readonly variancePercentage: number | null
  readonly style: "Normal" | "Subtotal" | "Total" | "Header"
  readonly indentLevel: number
}

interface BalanceSheetSection {
  readonly title: string
  readonly lineItems: readonly BalanceSheetLineItem[]
  readonly subtotal: MonetaryAmount
  readonly comparativeSubtotal: MonetaryAmount | null
}

interface Timestamp {
  readonly epochMillis: number
}

interface BalanceSheetReport {
  readonly companyId: string
  readonly asOfDate: LocalDate
  readonly comparativeDate: LocalDate | null
  readonly currency: string
  readonly generatedAt: Timestamp
  readonly currentAssets: BalanceSheetSection
  readonly nonCurrentAssets: BalanceSheetSection
  readonly totalAssets: MonetaryAmount
  readonly currentLiabilities: BalanceSheetSection
  readonly nonCurrentLiabilities: BalanceSheetSection
  readonly totalLiabilities: MonetaryAmount
  readonly equity: BalanceSheetSection
  readonly totalEquity: MonetaryAmount
  readonly totalLiabilitiesAndEquity: MonetaryAmount
  readonly isBalanced: boolean
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchBalanceSheetData = createServerFn({ method: "GET" })
  .inputValidator((data: { companyId: string; organizationId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        organization: null,
        company: null,
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companyResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: data.companyId } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        if (typeof companyResult.error === "object" && "status" in companyResult.error && companyResult.error.status === 404) {
          return {
            organization: null,
            company: null,
            error: "not_found" as const
          }
        }
        return {
          organization: null,
          company: null,
          error: "failed" as const
        }
      }

      if (orgResult.error) {
        return {
          organization: null,
          company: null,
          error: "failed" as const
        }
      }

      return {
        organization: orgResult.data,
        company: companyResult.data,
        error: null
      }
    } catch {
      return {
        organization: null,
        company: null,
        error: "failed" as const
      }
    }
  })

// Server function to fetch balance sheet for specific dates
const fetchBalanceSheet = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; companyId: string; asOfDate: string; comparativeDate: string; includeZeroBalances: boolean }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { report: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const queryParams: {
        organizationId: string
        companyId: string
        asOfDate: string
        comparativeDate?: string
        includeZeroBalances?: "true" | "false"
      } = {
        organizationId: data.organizationId,
        companyId: data.companyId,
        asOfDate: data.asOfDate
      }

      if (data.comparativeDate) {
        queryParams.comparativeDate = data.comparativeDate
      }

      if (data.includeZeroBalances) {
        queryParams.includeZeroBalances = "true"
      }

      const result = await serverApi.GET("/api/v1/reports/balance-sheet", {
        params: {
          query: queryParams
        },
        headers: { Authorization }
      })

      if (result.error) {
        return { report: null, error: "failed" as const }
      }

      return { report: result.data, error: null }
    } catch {
      return { report: null, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/reports/balance-sheet"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/balance-sheet`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchBalanceSheetData({
      data: {
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Company not found")
    }

    return {
      organization: result.organization,
      company: result.company
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: BalanceSheetPage
})

// =============================================================================
// Balance Sheet Page Component
// =============================================================================

function BalanceSheetPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as Organization | null
  const company = loaderData.company as Company | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  const organizations = context.organizations ?? []

  // State for report parameters
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [comparativeDate, setComparativeDate] = useState<string>("")
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false)
  const [report, setReport] = useState<BalanceSheetReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle generating the report
  const handleGenerateReport = async () => {
    if (!asOfDate || !company) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchBalanceSheet({
        data: {
          organizationId: params.organizationId,
          companyId: company.id,
          asOfDate,
          comparativeDate: comparativeDate || "",
          includeZeroBalances
        }
      })

      if (result.error || !result.report) {
        setError("Failed to generate balance sheet. Please try again.")
      } else {
        setReport(result.report)
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!organization || !company) {
    return null
  }

  // Breadcrumb items
  const breadcrumbItems = [
    {
      label: "Companies",
      href: `/organizations/${params.organizationId}/companies`
    },
    {
      label: company.name,
      href: `/organizations/${params.organizationId}/companies/${params.companyId}`
    },
    {
      label: "Reports",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/reports`
    },
    {
      label: "Balance Sheet",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/balance-sheet`
    }
  ]

  const companiesForSidebar = useMemo(
    () => [{ id: company.id, name: company.name }],
    [company.id, company.name]
  )

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="balance-sheet-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/companies/$companyId/reports"
            params={{ organizationId: params.organizationId, companyId: params.companyId }}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Balance Sheet
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {company.name} - {company.functionalCurrency}
          </p>
        </div>

        {/* Parameter Form */}
        <ReportParameterForm
          onSubmit={handleGenerateReport}
          isLoading={isLoading}
          isValid={Boolean(asOfDate)}
          error={error}
        >
          <FormSection title="Report Date" description="Balance sheet as of a specific date">
            <FormRow>
              <FormField label="As of Date" required hint="Point-in-time balance snapshot">
                <DateInput
                  value={asOfDate}
                  onChange={(value) => {
                    setAsOfDate(value)
                    setReport(null)
                  }}
                  data-testid="balance-sheet-as-of-date"
                />
              </FormField>
              <FormField label="Comparative Date" hint="Optional prior period for comparison">
                <DateInput
                  value={comparativeDate}
                  onChange={(value) => {
                    setComparativeDate(value)
                    setReport(null)
                  }}
                  data-testid="balance-sheet-comparative-date"
                />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Options">
            <CheckboxField
              id="includeZeroBalances"
              checked={includeZeroBalances}
              onChange={(checked) => {
                setIncludeZeroBalances(checked)
                setReport(null)
              }}
              label="Include accounts with zero balances"
            />
          </FormSection>
        </ReportParameterForm>

        {/* Balance Sheet Report */}
        {report && (
          <BalanceSheetReportDisplay report={report} company={company} />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Balance Sheet Report Display Component
// =============================================================================

function BalanceSheetReportDisplay({
  report,
  company
}: {
  readonly report: BalanceSheetReport
  readonly company: Company
}) {
  const hasComparative = report.comparativeDate !== null

  const formatMonetaryAmount = (amount: MonetaryAmount) => {
    const num = parseFloat(amount.amount)
    if (num === 0) return "—"
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num)
  }

  const formatDate = (date: LocalDate) => {
    return new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
      }
    )
  }

  const formatVariancePercentage = (pct: number | null) => {
    if (pct === null) return "—"
    const sign = pct >= 0 ? "+" : ""
    return `${sign}${pct.toFixed(1)}%`
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="balance-sheet-report">
      {/* Report Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Balance Sheet</h2>
            <p className="text-sm text-gray-500">
              {company.name} - As of {formatDate(report.asOfDate)}
            </p>
            {report.comparativeDate && (
              <p className="text-sm text-gray-500">
                Comparative: {formatDate(report.comparativeDate)}
              </p>
            )}
            <p className="text-sm text-gray-500">Currency: {report.currency}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="balance-sheet-print"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="balance-sheet-export"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Balance Status */}
      <div className={`border-b px-6 py-3 ${report.isBalanced ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-2">
          {report.isBalanced ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Balance sheet is balanced. Total Assets = Total Liabilities + Equity
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                Warning: Balance sheet is not balanced. Total Assets does not equal Total Liabilities + Equity.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Account description or section heading">
                  <span>Description</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Balance as of the reporting date">
                  <span>Current</span>
                </Tooltip>
              </th>
              {hasComparative && (
                <>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Balance as of the comparative date">
                      <span>Comparative</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Difference between current and comparative periods">
                      <span>Variance</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Percentage change from comparative to current period">
                      <span>%</span>
                    </Tooltip>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {/* ASSETS */}
            <SectionHeader title="ASSETS" hasComparative={hasComparative} />

            {/* Current Assets */}
            <SectionSubheader title={report.currentAssets.title} hasComparative={hasComparative} />
            {report.currentAssets.lineItems.map((item, idx) => (
              <LineItemRow
                key={`current-asset-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label={`Total ${report.currentAssets.title}`}
              subtotal={report.currentAssets.subtotal}
              comparativeSubtotal={report.currentAssets.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Non-Current Assets */}
            <SectionSubheader title={report.nonCurrentAssets.title} hasComparative={hasComparative} />
            {report.nonCurrentAssets.lineItems.map((item, idx) => (
              <LineItemRow
                key={`non-current-asset-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label={`Total ${report.nonCurrentAssets.title}`}
              subtotal={report.nonCurrentAssets.subtotal}
              comparativeSubtotal={report.nonCurrentAssets.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Total Assets */}
            <TotalRow
              label="TOTAL ASSETS"
              amount={report.totalAssets}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Spacer */}
            <tr className="h-4"><td colSpan={hasComparative ? 5 : 2} /></tr>

            {/* LIABILITIES */}
            <SectionHeader title="LIABILITIES" hasComparative={hasComparative} />

            {/* Current Liabilities */}
            <SectionSubheader title={report.currentLiabilities.title} hasComparative={hasComparative} />
            {report.currentLiabilities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`current-liability-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label={`Total ${report.currentLiabilities.title}`}
              subtotal={report.currentLiabilities.subtotal}
              comparativeSubtotal={report.currentLiabilities.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Non-Current Liabilities */}
            <SectionSubheader title={report.nonCurrentLiabilities.title} hasComparative={hasComparative} />
            {report.nonCurrentLiabilities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`non-current-liability-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label={`Total ${report.nonCurrentLiabilities.title}`}
              subtotal={report.nonCurrentLiabilities.subtotal}
              comparativeSubtotal={report.nonCurrentLiabilities.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Total Liabilities */}
            <TotalRow
              label="TOTAL LIABILITIES"
              amount={report.totalLiabilities}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Spacer */}
            <tr className="h-4"><td colSpan={hasComparative ? 5 : 2} /></tr>

            {/* EQUITY */}
            <SectionHeader title="EQUITY" hasComparative={hasComparative} />
            {report.equity.lineItems.map((item, idx) => (
              <LineItemRow
                key={`equity-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}

            {/* Total Equity */}
            <TotalRow
              label="TOTAL EQUITY"
              amount={report.totalEquity}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Spacer */}
            <tr className="h-4"><td colSpan={hasComparative ? 5 : 2} /></tr>

            {/* Total Liabilities and Equity */}
            <TotalRow
              label="TOTAL LIABILITIES AND EQUITY"
              amount={report.totalLiabilitiesAndEquity}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
              highlight
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function SectionHeader({
  title,
  hasComparative
}: {
  readonly title: string
  readonly hasComparative: boolean
}) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={hasComparative ? 5 : 2} className="px-6 py-2 text-sm font-bold text-gray-900">
        {title}
      </td>
    </tr>
  )
}

function SectionSubheader({
  title,
  hasComparative
}: {
  readonly title: string
  readonly hasComparative: boolean
}) {
  return (
    <tr className="bg-gray-50">
      <td colSpan={hasComparative ? 5 : 2} className="px-6 py-2 text-sm font-semibold text-gray-800">
        {title}
      </td>
    </tr>
  )
}

function LineItemRow({
  item,
  hasComparative,
  formatAmount,
  formatPercentage
}: {
  readonly item: BalanceSheetLineItem
  readonly hasComparative: boolean
  readonly formatAmount: (amount: MonetaryAmount) => string
  readonly formatPercentage: (pct: number | null) => string
}) {
  const indentPadding = 24 + item.indentLevel * 16

  const getRowStyle = () => {
    switch (item.style) {
      case "Header":
        return "bg-gray-50 font-semibold"
      case "Subtotal":
        return "bg-gray-50 font-medium"
      case "Total":
        return "bg-gray-100 font-bold"
      default:
        return ""
    }
  }

  return (
    <tr className={`hover:bg-gray-50 ${getRowStyle()}`}>
      <td
        className="whitespace-nowrap py-2 text-sm text-gray-900"
        style={{ paddingLeft: `${indentPadding}px`, paddingRight: "24px" }}
      >
        {item.accountNumber && (
          <span className="mr-2 font-mono text-gray-500">{item.accountNumber}</span>
        )}
        {item.description}
      </td>
      <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(item.currentAmount)}
      </td>
      {hasComparative && (
        <>
          <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-900">
            {item.comparativeAmount ? formatAmount(item.comparativeAmount) : "—"}
          </td>
          <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-900">
            {item.variance ? formatAmount(item.variance) : "—"}
          </td>
          <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-500">
            {formatPercentage(item.variancePercentage)}
          </td>
        </>
      )}
    </tr>
  )
}

function SectionSubtotalRow({
  label,
  subtotal,
  comparativeSubtotal,
  hasComparative,
  formatAmount
}: {
  readonly label: string
  readonly subtotal: MonetaryAmount
  readonly comparativeSubtotal: MonetaryAmount | null
  readonly hasComparative: boolean
  readonly formatAmount: (amount: MonetaryAmount) => string
}) {
  return (
    <tr className="border-t border-gray-200 bg-gray-50">
      <td className="whitespace-nowrap px-6 py-2 text-sm font-semibold text-gray-900">
        {label}
      </td>
      <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm font-semibold text-gray-900">
        {formatAmount(subtotal)}
      </td>
      {hasComparative && (
        <>
          <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm font-semibold text-gray-900">
            {comparativeSubtotal ? formatAmount(comparativeSubtotal) : "—"}
          </td>
          <td className="whitespace-nowrap px-6 py-2" />
          <td className="whitespace-nowrap px-6 py-2" />
        </>
      )}
    </tr>
  )
}

function TotalRow({
  label,
  amount,
  hasComparative,
  formatAmount,
  highlight = false
}: {
  readonly label: string
  readonly amount: MonetaryAmount
  readonly hasComparative: boolean
  readonly formatAmount: (amount: MonetaryAmount) => string
  readonly highlight?: boolean
}) {
  return (
    <tr className={`border-t-2 border-gray-300 ${highlight ? "bg-blue-50" : "bg-gray-100"}`}>
      <td className="whitespace-nowrap px-6 py-3 text-sm font-bold text-gray-900">
        {label}
      </td>
      <td className="whitespace-nowrap px-6 py-3 text-right font-mono text-sm font-bold text-gray-900">
        {formatAmount(amount)}
      </td>
      {hasComparative && (
        <>
          <td className="whitespace-nowrap px-6 py-3" />
          <td className="whitespace-nowrap px-6 py-3" />
          <td className="whitespace-nowrap px-6 py-3" />
        </>
      )}
    </tr>
  )
}
