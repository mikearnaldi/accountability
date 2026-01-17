/**
 * Cash Flow Statement Report Route
 *
 * Displays the cash flow statement for a specific company showing
 * Operating, Investing, and Financing activities.
 *
 * Route: /organizations/:organizationId/companies/:companyId/reports/cash-flow
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
  RadioGroup
} from "@/components/reports/ReportParameterForm"
import { Tooltip } from "@/components/ui/Tooltip"
import { ArrowLeft, Download, Printer, CheckCircle, AlertTriangle } from "lucide-react"

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

interface CashFlowLineItem {
  readonly description: string
  readonly amount: MonetaryAmount
  readonly comparativeAmount: MonetaryAmount | null
  readonly style: "Normal" | "Subtotal" | "Total" | "Header"
  readonly indentLevel: number
}

interface CashFlowSection {
  readonly title: string
  readonly lineItems: readonly CashFlowLineItem[]
  readonly netCashFlow: MonetaryAmount
  readonly comparativeNetCashFlow: MonetaryAmount | null
}

interface Timestamp {
  readonly epochMillis: number
}

interface CashFlowStatementReport {
  readonly companyId: string
  readonly periodStartDate: LocalDate
  readonly periodEndDate: LocalDate
  readonly currency: string
  readonly generatedAt: Timestamp
  readonly method: "direct" | "indirect"
  readonly beginningCash: MonetaryAmount
  readonly operatingActivities: CashFlowSection
  readonly investingActivities: CashFlowSection
  readonly financingActivities: CashFlowSection
  readonly exchangeRateEffect: MonetaryAmount
  readonly netChangeInCash: MonetaryAmount
  readonly endingCash: MonetaryAmount
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchCashFlowData = createServerFn({ method: "GET" })
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

const fetchCashFlowStatement = createServerFn({ method: "GET" })
  .inputValidator((data: {
    organizationId: string
    companyId: string
    periodStartDate: string
    periodEndDate: string
    method?: "direct" | "indirect"
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
        method?: "direct" | "indirect"
      } = {
        organizationId: data.organizationId,
        companyId: data.companyId,
        periodStartDate: data.periodStartDate,
        periodEndDate: data.periodEndDate
      }

      if (data.method) {
        queryParams.method = data.method
      }

      const result = await serverApi.GET("/api/v1/reports/cash-flow", {
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
  "/organizations/$organizationId/companies/$companyId/reports/cash-flow"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/cash-flow`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchCashFlowData({
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
  component: CashFlowStatementPage
})

// =============================================================================
// Cash Flow Statement Page Component
// =============================================================================

function CashFlowStatementPage() {
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
  const [method, setMethod] = useState<"direct" | "indirect">("indirect")
  const [report, setReport] = useState<CashFlowStatementReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateReport = async () => {
    if (!periodStartDate || !periodEndDate || !company) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchCashFlowStatement({
        data: {
          organizationId: params.organizationId,
          companyId: company.id,
          periodStartDate,
          periodEndDate,
          method
        }
      })

      if (result.error || !result.report) {
        setError("Failed to generate cash flow statement. Please try again.")
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
      label: "Cash Flow Statement",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/reports/cash-flow`
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
      <div data-testid="cash-flow-page">
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
            Cash Flow Statement
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
          <FormSection title="Report Period" description="Date range for cash flow activities">
            <FormRow>
              <FormField label="Period Start Date" required hint="Beginning of reporting period">
                <DateInput
                  value={periodStartDate}
                  onChange={(value) => {
                    setPeriodStartDate(value)
                    setReport(null)
                  }}
                  data-testid="cash-flow-start-date"
                />
              </FormField>
              <FormField label="Period End Date" required hint="End of reporting period">
                <DateInput
                  value={periodEndDate}
                  onChange={(value) => {
                    setPeriodEndDate(value)
                    setReport(null)
                  }}
                  data-testid="cash-flow-end-date"
                />
              </FormField>
            </FormRow>
          </FormSection>

          <FormSection title="Reporting Method" description="Choose how operating activities are presented">
            <FormField label="Method" hint="Indirect starts from net income; Direct shows cash receipts/payments">
              <RadioGroup
                name="method"
                value={method}
                onChange={(value) => {
                  const methodLookup: Record<string, "direct" | "indirect"> = {
                    direct: "direct",
                    indirect: "indirect"
                  }
                  const newMethod = methodLookup[value]
                  if (newMethod) {
                    setMethod(newMethod)
                    setReport(null)
                  }
                }}
                options={[
                  { value: "indirect", label: "Indirect Method" },
                  { value: "direct", label: "Direct Method" }
                ]}
              />
            </FormField>
          </FormSection>
        </ReportParameterForm>

        {/* Cash Flow Statement Report */}
        {report && (
          <CashFlowReportDisplay report={report} company={company} />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Cash Flow Statement Report Display Component
// =============================================================================

function CashFlowReportDisplay({
  report,
  company
}: {
  readonly report: CashFlowStatementReport
  readonly company: Company
}) {
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

  // Verify: Beginning Cash + Net Change = Ending Cash
  const beginningCashNum = parseFloat(report.beginningCash.amount)
  const netChangeNum = parseFloat(report.netChangeInCash.amount)
  const endingCashNum = parseFloat(report.endingCash.amount)
  const isBalanced = Math.abs(beginningCashNum + netChangeNum - endingCashNum) < 0.01

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="cash-flow-report">
      {/* Report Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cash Flow Statement</h2>
            <p className="text-sm text-gray-500">
              {company.name} - {formatDate(report.periodStartDate)} to {formatDate(report.periodEndDate)}
            </p>
            <p className="text-sm text-gray-500">
              Method: {report.method === "indirect" ? "Indirect" : "Direct"} | Currency: {report.currency}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="cash-flow-print"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="cash-flow-export"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Verification Status */}
      <div className={`border-b px-6 py-3 ${isBalanced ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Verified: Beginning Cash + Net Change in Cash = Ending Cash
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-sm font-medium text-red-800">
                Warning: Beginning Cash + Net Change in Cash does not equal Ending Cash
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
                <Tooltip content="Cash flow item or category description">
                  <span>Description</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Cash flow amount for the reporting period">
                  <span>Amount</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {/* Beginning Cash Balance */}
            <tr className="bg-gray-100">
              <td className="whitespace-nowrap px-6 py-3 text-sm font-bold text-gray-900">
                BEGINNING CASH BALANCE
              </td>
              <td className="whitespace-nowrap px-6 py-3 text-right font-mono text-sm font-bold text-gray-900">
                {formatMonetaryAmount(report.beginningCash)}
              </td>
            </tr>

            {/* Operating Activities */}
            <SectionHeader title="CASH FLOWS FROM OPERATING ACTIVITIES" />
            {report.operatingActivities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`operating-${idx}`}
                item={item}
                formatAmount={formatMonetaryAmount}
              />
            ))}
            <SectionTotalRow
              label="Net Cash from Operating Activities"
              amount={report.operatingActivities.netCashFlow}
              formatAmount={formatMonetaryAmount}
            />

            {/* Investing Activities */}
            <SectionHeader title="CASH FLOWS FROM INVESTING ACTIVITIES" />
            {report.investingActivities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`investing-${idx}`}
                item={item}
                formatAmount={formatMonetaryAmount}
              />
            ))}
            <SectionTotalRow
              label="Net Cash from Investing Activities"
              amount={report.investingActivities.netCashFlow}
              formatAmount={formatMonetaryAmount}
            />

            {/* Financing Activities */}
            <SectionHeader title="CASH FLOWS FROM FINANCING ACTIVITIES" />
            {report.financingActivities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`financing-${idx}`}
                item={item}
                formatAmount={formatMonetaryAmount}
              />
            ))}
            <SectionTotalRow
              label="Net Cash from Financing Activities"
              amount={report.financingActivities.netCashFlow}
              formatAmount={formatMonetaryAmount}
            />

            {/* Exchange Rate Effect */}
            <tr className="bg-gray-50">
              <td className="whitespace-nowrap px-6 py-2 text-sm text-gray-900">
                Effect of Exchange Rate Changes on Cash
              </td>
              <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-900">
                {formatMonetaryAmount(report.exchangeRateEffect)}
              </td>
            </tr>

            {/* Net Change in Cash */}
            <tr className="border-t-2 border-gray-300 bg-gray-100">
              <td className="whitespace-nowrap px-6 py-3 text-sm font-bold text-gray-900">
                NET CHANGE IN CASH
              </td>
              <td className="whitespace-nowrap px-6 py-3 text-right font-mono text-sm font-bold text-gray-900">
                {formatMonetaryAmount(report.netChangeInCash)}
              </td>
            </tr>

            {/* Ending Cash Balance */}
            <tr className="border-t-2 border-gray-300 bg-blue-50">
              <td className="whitespace-nowrap px-6 py-3 text-sm font-bold text-gray-900">
                ENDING CASH BALANCE
              </td>
              <td className="whitespace-nowrap px-6 py-3 text-right font-mono text-sm font-bold text-gray-900">
                {formatMonetaryAmount(report.endingCash)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function SectionHeader({ title }: { readonly title: string }) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={2} className="px-6 py-2 text-sm font-bold text-gray-900">
        {title}
      </td>
    </tr>
  )
}

function LineItemRow({
  item,
  formatAmount
}: {
  readonly item: CashFlowLineItem
  readonly formatAmount: (amount: MonetaryAmount) => string
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
        {item.description}
      </td>
      <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-900">
        {formatAmount(item.amount)}
      </td>
    </tr>
  )
}

function SectionTotalRow({
  label,
  amount,
  formatAmount
}: {
  readonly label: string
  readonly amount: MonetaryAmount
  readonly formatAmount: (amount: MonetaryAmount) => string
}) {
  return (
    <tr className="border-t border-gray-200 bg-gray-50">
      <td className="whitespace-nowrap px-6 py-2 text-sm font-semibold text-gray-900">
        {label}
      </td>
      <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm font-semibold text-gray-900">
        {formatAmount(amount)}
      </td>
    </tr>
  )
}
