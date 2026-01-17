/**
 * Consolidated Cash Flow Statement Report Route
 *
 * Displays the consolidated cash flow statement from a completed consolidation run,
 * showing Operating, Investing, and Financing activities per ASC 230.
 *
 * Route: /organizations/:organizationId/consolidation/:groupId/runs/:runId/reports/cash-flow
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Tooltip } from "@/components/ui/Tooltip"
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Printer,
  AlertTriangle,
  RefreshCw
} from "lucide-react"
import {
  exportMultiSectionToExcel,
  exportMultiSectionToPdf,
  printReport,
  generateFilename,
  formatAmount,
  type ReportSection,
  type ReportRow,
  type ReportMetadata
} from "@/utils/report-export"

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
}

interface ConsolidationGroup {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface ConsolidationRun {
  readonly id: string
  readonly groupId: string
  readonly periodRef: { year: number; period: number }
  readonly asOfDate: string
  readonly status: "Pending" | "InProgress" | "Completed" | "Failed" | "Cancelled"
}

interface ConsolidatedReportLineItem {
  readonly description: string
  readonly amount: number
  readonly style: "Normal" | "Subtotal" | "Total" | "Header"
  readonly indentLevel: number
}

interface ConsolidatedReportSection {
  readonly title: string
  readonly lineItems: readonly ConsolidatedReportLineItem[]
  readonly subtotal: number
}

interface ConsolidatedCashFlowReport {
  readonly runId: string
  readonly groupName: string
  readonly periodRef: { year: number; period: number }
  readonly asOfDate: string
  readonly currency: string
  readonly operatingActivities: ConsolidatedReportSection
  readonly investingActivities: ConsolidatedReportSection
  readonly financingActivities: ConsolidatedReportSection
  readonly netChangeInCash: number
  readonly beginningCash: number
  readonly endingCash: number
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Type guard to check if a value is an object with a message property
 */
function isErrorWithMessage(value: unknown): value is { message: string } {
  if (typeof value !== "object" || value === null) {
    return false
  }
  if (!("message" in value)) {
    return false
  }
  // After the 'in' check, TypeScript knows value has a message property
  const maybeError = value
  return typeof maybeError.message === "string"
}

/**
 * Safely extract error message from an unknown error object
 */
function getErrorMessage(error: unknown): string | null {
  if (isErrorWithMessage(error)) {
    return error.message
  }
  return null
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchCashFlowData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; groupId: string; runId: string }) => data)
  .handler(async ({ data: { organizationId, groupId, runId } }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], group: null, run: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, groupResult, runResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/consolidation/groups/{id}", {
          params: { path: { id: groupId }, query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/consolidation/runs/{id}", {
          params: { path: { id: runId }, query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        return { organization: null, companies: [], group: null, run: null, error: "not_found" as const }
      }

      if (groupResult.error) {
        return { organization: null, companies: [], group: null, run: null, error: "group_not_found" as const }
      }

      if (runResult.error) {
        return { organization: null, companies: [], group: null, run: null, error: "run_not_found" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        group: groupResult.data?.group ?? null,
        run: runResult.data,
        error: null
      }
    } catch {
      return { organization: null, companies: [], group: null, run: null, error: "failed" as const }
    }
  })

const fetchCashFlowReport = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; runId: string }) => data)
  .handler(async ({ data: { organizationId, runId } }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { report: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const result = await serverApi.GET("/api/v1/consolidation/runs/{id}/reports/cash-flow", {
        params: { path: { id: runId }, query: { organizationId } },
        headers: { Authorization }
      })

      if (result.error) {
        // Check if it's a NOT_IMPLEMENTED error using type-safe property access
        const errorObj: unknown = result.error
        const errorMessage = getErrorMessage(errorObj)
        if (errorMessage && errorMessage.includes("not yet implemented")) {
          return { report: null, error: "not_implemented" as const }
        }
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
  "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/cash-flow"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}/reports/cash-flow`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchCashFlowData({
      data: {
        organizationId: params.organizationId,
        groupId: params.groupId,
        runId: params.runId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    if (result.error === "group_not_found") {
      throw new Error("Consolidation group not found")
    }

    if (result.error === "run_not_found") {
      throw new Error("Consolidation run not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      group: result.group,
      run: result.run
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: ConsolidatedCashFlowPage
})

// =============================================================================
// Page Component
// =============================================================================

function ConsolidatedCashFlowPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const group = loaderData.group as ConsolidationGroup | null
  const run = loaderData.run as ConsolidationRun | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [report, setReport] = useState<ConsolidatedCashFlowReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  if (!organization || !group || !run) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Consolidation",
      href: `/organizations/${params.organizationId}/consolidation`
    },
    {
      label: group.name,
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}`
    },
    {
      label: `${run.periodRef.year} P${run.periodRef.period}`,
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}`
    },
    {
      label: "Reports",
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}/reports`
    },
    {
      label: "Cash Flow Statement",
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}/reports/cash-flow`
    }
  ]

  const isRunCompleted = run.status === "Completed"

  // Handle loading the report
  const handleLoadReport = async () => {
    if (!isRunCompleted) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchCashFlowReport({
        data: { organizationId: params.organizationId, runId: params.runId }
      })

      if (result.error === "not_implemented") {
        setError("Consolidated cash flow statement generation is not yet implemented. The report will be available in a future release.")
      } else if (result.error || !result.report) {
        setError("Failed to load the cash flow statement report. Please try again.")
      } else {
        setReport(result.report)
      }
      setHasLoaded(true)
    } catch {
      setError("An unexpected error occurred.")
      setHasLoaded(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="consolidated-cash-flow-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports"
            params={{
              organizationId: params.organizationId,
              groupId: params.groupId,
              runId: params.runId
            }}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Consolidated Cash Flow Statement
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {group.name} • {run.periodRef.year} Period {run.periodRef.period} • {group.reportingCurrency}
          </p>
        </div>

        {/* Run Status Warning */}
        {!isRunCompleted && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Run Not Completed</p>
                <p className="text-sm text-yellow-700">
                  This report is only available after the consolidation run has completed successfully.
                  Current status: {run.status}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Load Report Button */}
        {isRunCompleted && !hasLoaded && (
          <div className="mb-6">
            <Button
              onClick={handleLoadReport}
              disabled={isLoading}
              icon={isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}
              data-testid="load-report-button"
            >
              {isLoading ? "Loading Report..." : "Load Cash Flow Statement"}
            </Button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Unable to Generate Report</p>
                <p className="text-sm text-red-700">{error}</p>
                {hasLoaded && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLoadReport}
                    className="mt-3"
                    disabled={isLoading}
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cash Flow Statement Report */}
        {report && (
          <CashFlowReportDisplay report={report} />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Cash Flow Statement Report Display Component
// =============================================================================

function CashFlowReportDisplay({
  report
}: {
  readonly report: ConsolidatedCashFlowReport
}) {
  const formatAmountLocal = (amount: number): string => {
    if (amount === 0) return "—"
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Convert report sections to export format
  const convertSectionToExport = (
    title: string,
    section: ConsolidatedReportSection,
    subtotalLabel: string
  ): ReportSection => {
    const rows: ReportRow[] = section.lineItems.map((item) => ({
      cells: [item.description, formatAmount(item.amount)],
      style: item.style === "Header" ? "header" : item.style === "Subtotal" ? "subtotal" : item.style === "Total" ? "total" : "normal"
    }))

    rows.push({
      cells: [subtotalLabel, formatAmount(section.subtotal)],
      style: "subtotal"
    })

    return { title, rows }
  }

  // Export handlers
  const handlePrint = () => {
    printReport()
  }

  const handleExportExcel = () => {
    const metadata: ReportMetadata = {
      title: "Consolidated Statement of Cash Flows",
      subtitle: report.groupName,
      asOfDate: `${report.periodRef.year} Period ${report.periodRef.period}`,
      currency: report.currency,
      generatedAt: new Date().toISOString()
    }

    const sections: ReportSection[] = [
      convertSectionToExport("CASH FLOWS FROM OPERATING ACTIVITIES", report.operatingActivities, "Net Cash Provided by Operating Activities"),
      convertSectionToExport("CASH FLOWS FROM INVESTING ACTIVITIES", report.investingActivities, "Net Cash Used in Investing Activities"),
      convertSectionToExport("CASH FLOWS FROM FINANCING ACTIVITIES", report.financingActivities, "Net Cash Used in Financing Activities"),
      { title: "", rows: [{ cells: ["NET INCREASE (DECREASE) IN CASH", formatAmount(report.netChangeInCash)], style: "total" }] },
      {
        title: "",
        rows: [
          { cells: ["Cash at Beginning of Period", formatAmount(report.beginningCash)], style: "normal" },
          { cells: ["CASH AT END OF PERIOD", formatAmount(report.endingCash)], style: "total" }
        ]
      }
    ]

    const filename = generateFilename(`${report.groupName}-consolidated-cash-flow`, report.asOfDate)
    exportMultiSectionToExcel(sections, metadata, filename)
  }

  const handleExportPdf = () => {
    const metadata: ReportMetadata = {
      title: "Consolidated Statement of Cash Flows",
      subtitle: report.groupName,
      asOfDate: `${report.periodRef.year} Period ${report.periodRef.period}`,
      currency: report.currency,
      generatedAt: new Date().toISOString()
    }

    const sections: ReportSection[] = [
      convertSectionToExport("CASH FLOWS FROM OPERATING ACTIVITIES", report.operatingActivities, "Net Cash Provided by Operating Activities"),
      convertSectionToExport("CASH FLOWS FROM INVESTING ACTIVITIES", report.investingActivities, "Net Cash Used in Investing Activities"),
      convertSectionToExport("CASH FLOWS FROM FINANCING ACTIVITIES", report.financingActivities, "Net Cash Used in Financing Activities"),
      { title: "", rows: [{ cells: ["NET INCREASE (DECREASE) IN CASH", formatAmount(report.netChangeInCash)], style: "total" }] },
      {
        title: "",
        rows: [
          { cells: ["Cash at Beginning of Period", formatAmount(report.beginningCash)], style: "normal" },
          { cells: ["CASH AT END OF PERIOD", formatAmount(report.endingCash)], style: "total" }
        ]
      }
    ]

    const filename = generateFilename(`${report.groupName}-consolidated-cash-flow`, report.asOfDate)
    exportMultiSectionToPdf(sections, metadata, filename)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="cash-flow-report">
      {/* Report Header */}
      <div className="border-b border-gray-200 px-6 py-4 print-hide">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Consolidated Statement of Cash Flows
            </h2>
            <p className="text-sm text-gray-500">
              {report.groupName} • {report.periodRef.year} Period {report.periodRef.period}
            </p>
            <p className="text-sm text-gray-500">Currency: {report.currency}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="print-button"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="export-excel-button"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              data-testid="export-pdf-button"
            >
              <FileText className="h-4 w-4" />
              PDF
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
                <Tooltip content="Activity or line item description">
                  <span className="cursor-help border-b border-dotted border-gray-400">Description</span>
                </Tooltip>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Cash flow amount in reporting currency">
                  <span className="cursor-help border-b border-dotted border-gray-400">Amount ({report.currency})</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {/* Operating Activities */}
            <SectionHeader title="CASH FLOWS FROM OPERATING ACTIVITIES" />
            {report.operatingActivities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`operating-${idx}`}
                item={item}
                formatAmount={formatAmountLocal}
              />
            ))}
            <SubtotalRow
              label="Net Cash Provided by Operating Activities"
              amount={report.operatingActivities.subtotal}
              formatAmount={formatAmountLocal}
            />

            {/* Spacer */}
            <tr className="h-2"><td colSpan={2} /></tr>

            {/* Investing Activities */}
            <SectionHeader title="CASH FLOWS FROM INVESTING ACTIVITIES" />
            {report.investingActivities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`investing-${idx}`}
                item={item}
                formatAmount={formatAmountLocal}
              />
            ))}
            <SubtotalRow
              label="Net Cash Used in Investing Activities"
              amount={report.investingActivities.subtotal}
              formatAmount={formatAmountLocal}
            />

            {/* Spacer */}
            <tr className="h-2"><td colSpan={2} /></tr>

            {/* Financing Activities */}
            <SectionHeader title="CASH FLOWS FROM FINANCING ACTIVITIES" />
            {report.financingActivities.lineItems.map((item, idx) => (
              <LineItemRow
                key={`financing-${idx}`}
                item={item}
                formatAmount={formatAmountLocal}
              />
            ))}
            <SubtotalRow
              label="Net Cash Used in Financing Activities"
              amount={report.financingActivities.subtotal}
              formatAmount={formatAmountLocal}
            />

            {/* Spacer */}
            <tr className="h-4"><td colSpan={2} /></tr>

            {/* Net Change in Cash */}
            <TotalRow
              label="NET INCREASE (DECREASE) IN CASH"
              amount={report.netChangeInCash}
              formatAmount={formatAmountLocal}
            />

            {/* Beginning/Ending Cash */}
            <tr className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-2 text-sm text-gray-900">
                Cash at Beginning of Period
              </td>
              <td className="whitespace-nowrap px-6 py-2 text-right font-mono text-sm text-gray-900">
                {formatAmountLocal(report.beginningCash)}
              </td>
            </tr>

            <TotalRow
              label="CASH AT END OF PERIOD"
              amount={report.endingCash}
              formatAmount={formatAmountLocal}
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
  readonly item: ConsolidatedReportLineItem
  readonly formatAmount: (amount: number) => string
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

function SubtotalRow({
  label,
  amount,
  formatAmount
}: {
  readonly label: string
  readonly amount: number
  readonly formatAmount: (amount: number) => string
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

function TotalRow({
  label,
  amount,
  formatAmount,
  highlight = false
}: {
  readonly label: string
  readonly amount: number
  readonly formatAmount: (amount: number) => string
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
    </tr>
  )
}
