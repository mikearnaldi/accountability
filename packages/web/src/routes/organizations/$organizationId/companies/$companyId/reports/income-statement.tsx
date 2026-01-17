/**
 * Income Statement Report Route
 *
 * Displays the income statement (profit & loss) for a specific company
 * showing Revenue, Expenses, and Net Income for a period.
 *
 * Route: /organizations/:organizationId/companies/:companyId/reports/income-statement
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
  DateInput
} from "@/components/reports/ReportParameterForm"
import { Tooltip } from "@/components/ui/Tooltip"
import { ArrowLeft, Download, Printer } from "lucide-react"

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

interface IncomeStatementLineItem {
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

interface IncomeStatementSection {
  readonly title: string
  readonly lineItems: readonly IncomeStatementLineItem[]
  readonly subtotal: MonetaryAmount
  readonly comparativeSubtotal: MonetaryAmount | null
}

interface Timestamp {
  readonly epochMillis: number
}

interface IncomeStatementReport {
  readonly companyId: string
  readonly periodStartDate: LocalDate
  readonly periodEndDate: LocalDate
  readonly comparativeStartDate: LocalDate | null
  readonly comparativeEndDate: LocalDate | null
  readonly currency: string
  readonly generatedAt: Timestamp
  readonly revenue: IncomeStatementSection
  readonly costOfSales: IncomeStatementSection
  readonly grossProfit: MonetaryAmount
  readonly operatingExpenses: IncomeStatementSection
  readonly operatingIncome: MonetaryAmount
  readonly otherIncomeExpense: IncomeStatementSection
  readonly incomeBeforeTax: MonetaryAmount
  readonly taxExpense: MonetaryAmount
  readonly netIncome: MonetaryAmount
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchIncomeStatementData = createServerFn({ method: "GET" })
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

const fetchIncomeStatement = createServerFn({ method: "GET" })
  .inputValidator((data: {
    organizationId: string
    companyId: string
    periodStartDate: string
    periodEndDate: string
    comparativeStartDate: string
    comparativeEndDate: string
  }) => data)
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
        periodStartDate: string
        periodEndDate: string
        comparativeStartDate?: string
        comparativeEndDate?: string
      } = {
        organizationId: data.organizationId,
        companyId: data.companyId,
        periodStartDate: data.periodStartDate,
        periodEndDate: data.periodEndDate
      }

      if (data.comparativeStartDate) {
        queryParams.comparativeStartDate = data.comparativeStartDate
      }
      if (data.comparativeEndDate) {
        queryParams.comparativeEndDate = data.comparativeEndDate
      }

      const result = await serverApi.GET("/api/v1/reports/income-statement", {
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
  "/organizations/$organizationId/companies/$companyId/reports/income-statement"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/income-statement`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchIncomeStatementData({
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
  component: IncomeStatementPage
})

// =============================================================================
// Income Statement Page Component
// =============================================================================

function IncomeStatementPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as Organization | null
  const company = loaderData.company as Company | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  const organizations = context.organizations ?? []

  // Default to current year period
  const currentYear = new Date().getFullYear()
  const [periodStartDate, setPeriodStartDate] = useState<string>(`${currentYear}-01-01`)
  const [periodEndDate, setPeriodEndDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [comparativeStartDate, setComparativeStartDate] = useState<string>("")
  const [comparativeEndDate, setComparativeEndDate] = useState<string>("")
  const [report, setReport] = useState<IncomeStatementReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateReport = async () => {
    if (!periodStartDate || !periodEndDate || !company) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchIncomeStatement({
        data: {
          organizationId: params.organizationId,
          companyId: company.id,
          periodStartDate,
          periodEndDate,
          comparativeStartDate: comparativeStartDate || "",
          comparativeEndDate: comparativeEndDate || ""
        }
      })

      if (result.error || !result.report) {
        setError("Failed to generate income statement. Please try again.")
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
      label: "Income Statement",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/income-statement`
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
      <div data-testid="income-statement-page">
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
            Income Statement
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {company.name} - {company.functionalCurrency}
          </p>
        </div>

        {/* Parameter Form */}
        <ReportParameterForm
          onSubmit={handleGenerateReport}
          isLoading={isLoading}
          isValid={Boolean(periodStartDate && periodEndDate)}
          error={error}
        >
          <FormSection title="Report Period" description="Date range for revenue and expenses">
            <FormRow>
              <FormField label="Period Start Date" required hint="Beginning of reporting period">
                <DateInput
                  value={periodStartDate}
                  onChange={(value) => {
                    setPeriodStartDate(value)
                    setReport(null)
                  }}
                  data-testid="income-statement-start-date"
                />
              </FormField>
              <FormField label="Period End Date" required hint="End of reporting period">
                <DateInput
                  value={periodEndDate}
                  onChange={(value) => {
                    setPeriodEndDate(value)
                    setReport(null)
                  }}
                  data-testid="income-statement-end-date"
                />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Comparison Period" description="Optional prior period for variance analysis">
            <FormRow>
              <FormField label="Comparative Start Date" hint="Beginning of comparison period">
                <DateInput
                  value={comparativeStartDate}
                  onChange={(value) => {
                    setComparativeStartDate(value)
                    setReport(null)
                  }}
                  data-testid="income-statement-comparative-start"
                />
              </FormField>
              <FormField label="Comparative End Date" hint="End of comparison period">
                <DateInput
                  value={comparativeEndDate}
                  onChange={(value) => {
                    setComparativeEndDate(value)
                    setReport(null)
                  }}
                  data-testid="income-statement-comparative-end"
                />
              </FormField>
            </FormRow>
          </FormSection>
        </ReportParameterForm>

        {/* Income Statement Report */}
        {report && (
          <IncomeStatementReportDisplay report={report} company={company} />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Income Statement Report Display Component
// =============================================================================

function IncomeStatementReportDisplay({
  report,
  company
}: {
  readonly report: IncomeStatementReport
  readonly company: Company
}) {
  const hasComparative = report.comparativeStartDate !== null && report.comparativeEndDate !== null

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
        month: "short",
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
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="income-statement-report">
      {/* Report Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Income Statement</h2>
            <p className="text-sm text-gray-500">
              {company.name} - {formatDate(report.periodStartDate)} to {formatDate(report.periodEndDate)}
            </p>
            {hasComparative && report.comparativeStartDate && report.comparativeEndDate && (
              <p className="text-sm text-gray-500">
                Comparative: {formatDate(report.comparativeStartDate)} to {formatDate(report.comparativeEndDate)}
              </p>
            )}
            <p className="text-sm text-gray-500">Currency: {report.currency}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="income-statement-print"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="income-statement-export"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Account or category description">
                  <span>Description</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Amount for the current reporting period">
                  <span>Current Period</span>
                </Tooltip>
              </th>
              {hasComparative && (
                <>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Amount for the comparative period">
                      <span>Prior Period</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Difference between current and prior period">
                      <span>Variance</span>
                    </Tooltip>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    <Tooltip content="Percentage change from prior to current period">
                      <span>%</span>
                    </Tooltip>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {/* Revenue Section */}
            <SectionHeader title="REVENUE" hasComparative={hasComparative} />
            {report.revenue.lineItems.map((item, idx) => (
              <LineItemRow
                key={`revenue-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label="Total Revenue"
              subtotal={report.revenue.subtotal}
              comparativeSubtotal={report.revenue.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Cost of Sales Section */}
            <SectionHeader title="COST OF SALES" hasComparative={hasComparative} />
            {report.costOfSales.lineItems.map((item, idx) => (
              <LineItemRow
                key={`cogs-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label="Total Cost of Sales"
              subtotal={report.costOfSales.subtotal}
              comparativeSubtotal={report.costOfSales.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Gross Profit */}
            <TotalRow
              label="GROSS PROFIT"
              amount={report.grossProfit}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Operating Expenses Section */}
            <SectionHeader title="OPERATING EXPENSES" hasComparative={hasComparative} />
            {report.operatingExpenses.lineItems.map((item, idx) => (
              <LineItemRow
                key={`opex-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label="Total Operating Expenses"
              subtotal={report.operatingExpenses.subtotal}
              comparativeSubtotal={report.operatingExpenses.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Operating Income */}
            <TotalRow
              label="OPERATING INCOME"
              amount={report.operatingIncome}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Other Income/Expense Section */}
            <SectionHeader title="OTHER INCOME (EXPENSE)" hasComparative={hasComparative} />
            {report.otherIncomeExpense.lineItems.map((item, idx) => (
              <LineItemRow
                key={`other-${idx}`}
                item={item}
                hasComparative={hasComparative}
                formatAmount={formatMonetaryAmount}
                formatPercentage={formatVariancePercentage}
              />
            ))}
            <SectionSubtotalRow
              label="Total Other Income (Expense)"
              subtotal={report.otherIncomeExpense.subtotal}
              comparativeSubtotal={report.otherIncomeExpense.comparativeSubtotal}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Income Before Tax */}
            <TotalRow
              label="INCOME BEFORE INCOME TAX"
              amount={report.incomeBeforeTax}
              hasComparative={hasComparative}
              formatAmount={formatMonetaryAmount}
            />

            {/* Tax Expense */}
            <tr className="bg-gray-50">
              <td className="whitespace-nowrap px-6 py-2 text-sm text-gray-900">
                Income Tax Expense
              </td>
              <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-900">
                {formatMonetaryAmount(report.taxExpense)}
              </td>
              {hasComparative && (
                <>
                  <td className="whitespace-nowrap px-6 py-2" />
                  <td className="whitespace-nowrap px-6 py-2" />
                  <td className="whitespace-nowrap px-6 py-2" />
                </>
              )}
            </tr>

            {/* Net Income */}
            <TotalRow
              label="NET INCOME"
              amount={report.netIncome}
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

function LineItemRow({
  item,
  hasComparative,
  formatAmount,
  formatPercentage
}: {
  readonly item: IncomeStatementLineItem
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
