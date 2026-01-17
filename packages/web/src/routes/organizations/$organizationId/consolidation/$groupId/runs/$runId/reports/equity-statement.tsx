/**
 * Consolidated Statement of Changes in Equity Report Route
 *
 * Displays the consolidated statement of changes in equity from a completed consolidation run,
 * showing movements in equity components including non-controlling interests.
 *
 * Route: /organizations/:organizationId/consolidation/:groupId/runs/:runId/reports/equity-statement
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
  exportToExcel,
  exportToPdf,
  printReport,
  generateFilename,
  formatAmount,
  type TableExportConfig,
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

interface EquityMovementRow {
  readonly description: string
  readonly commonStock: number
  readonly additionalPaidInCapital: number
  readonly retainedEarnings: number
  readonly accumulatedOCI: number
  readonly nonControllingInterest: number
  readonly total: number
}

interface ConsolidatedEquityStatementReport {
  readonly runId: string
  readonly groupName: string
  readonly periodRef: { year: number; period: number }
  readonly asOfDate: string
  readonly currency: string
  readonly openingBalance: EquityMovementRow
  readonly movements: readonly EquityMovementRow[]
  readonly closingBalance: EquityMovementRow
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

const fetchEquityStatementData = createServerFn({ method: "GET" })
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

const fetchEquityStatementReport = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; runId: string }) => data)
  .handler(async ({ data: { organizationId, runId } }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { report: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const result = await serverApi.GET("/api/v1/consolidation/runs/{id}/reports/equity-statement", {
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
  "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/equity-statement"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}/reports/equity-statement`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchEquityStatementData({
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
  component: ConsolidatedEquityStatementPage
})

// =============================================================================
// Page Component
// =============================================================================

function ConsolidatedEquityStatementPage() {
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

  const [report, setReport] = useState<ConsolidatedEquityStatementReport | null>(null)
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
      label: "Equity Statement",
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}/reports/equity-statement`
    }
  ]

  const isRunCompleted = run.status === "Completed"

  // Handle loading the report
  const handleLoadReport = async () => {
    if (!isRunCompleted) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchEquityStatementReport({
        data: { organizationId: params.organizationId, runId: params.runId }
      })

      if (result.error === "not_implemented") {
        setError("Consolidated equity statement generation is not yet implemented. The report will be available in a future release.")
      } else if (result.error || !result.report) {
        setError("Failed to load the equity statement report. Please try again.")
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
      <div data-testid="consolidated-equity-statement-page">
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
            Consolidated Statement of Changes in Equity
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
              {isLoading ? "Loading Report..." : "Load Equity Statement"}
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

        {/* Equity Statement Report */}
        {report && (
          <EquityStatementReportDisplay report={report} />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Equity Statement Report Display Component
// =============================================================================

function EquityStatementReportDisplay({
  report
}: {
  readonly report: ConsolidatedEquityStatementReport
}) {
  const formatAmountLocal = (amount: number): string => {
    if (amount === 0) return "—"
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Convert a row to export format
  const rowToExportArray = (label: string, row: EquityMovementRow): (string | number)[] => [
    label,
    row.commonStock || "",
    row.additionalPaidInCapital || "",
    row.retainedEarnings || "",
    row.accumulatedOCI || "",
    row.nonControllingInterest || "",
    row.total || ""
  ]

  // Export handlers
  const handlePrint = () => {
    printReport()
  }

  const handleExportExcel = () => {
    const metadata: ReportMetadata = {
      title: "Consolidated Statement of Changes in Equity",
      subtitle: report.groupName,
      asOfDate: `${report.periodRef.year} Period ${report.periodRef.period}`,
      currency: report.currency,
      generatedAt: new Date().toISOString()
    }

    const config: TableExportConfig = {
      headers: ["Description", "Common Stock", "APIC", "Retained Earnings", "AOCI", "NCI", "Total"],
      rows: [
        rowToExportArray("Balance at Beginning of Period", report.openingBalance),
        ...report.movements.map((m) => rowToExportArray(m.description, m)),
        rowToExportArray("Balance at End of Period", report.closingBalance)
      ],
      metadata
    }

    const filename = generateFilename(`${report.groupName}-consolidated-equity-statement`, report.asOfDate)
    exportToExcel(config, filename)
  }

  const handleExportPdf = () => {
    const metadata: ReportMetadata = {
      title: "Consolidated Statement of Changes in Equity",
      subtitle: report.groupName,
      asOfDate: `${report.periodRef.year} Period ${report.periodRef.period}`,
      currency: report.currency,
      generatedAt: new Date().toISOString()
    }

    const config: TableExportConfig = {
      headers: ["Description", "Common Stock", "APIC", "Retained Earnings", "AOCI", "NCI", "Total"],
      rows: [
        ["Balance at Beginning of Period", formatAmount(report.openingBalance.commonStock), formatAmount(report.openingBalance.additionalPaidInCapital), formatAmount(report.openingBalance.retainedEarnings), formatAmount(report.openingBalance.accumulatedOCI), formatAmount(report.openingBalance.nonControllingInterest), formatAmount(report.openingBalance.total)],
        ...report.movements.map((m) => [m.description, formatAmount(m.commonStock), formatAmount(m.additionalPaidInCapital), formatAmount(m.retainedEarnings), formatAmount(m.accumulatedOCI), formatAmount(m.nonControllingInterest), formatAmount(m.total)]),
        ["Balance at End of Period", formatAmount(report.closingBalance.commonStock), formatAmount(report.closingBalance.additionalPaidInCapital), formatAmount(report.closingBalance.retainedEarnings), formatAmount(report.closingBalance.accumulatedOCI), formatAmount(report.closingBalance.nonControllingInterest), formatAmount(report.closingBalance.total)]
      ],
      metadata
    }

    const filename = generateFilename(`${report.groupName}-consolidated-equity-statement`, report.asOfDate)
    exportToPdf(config, filename)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="equity-statement-report">
      {/* Report Header */}
      <div className="border-b border-gray-200 px-6 py-4 print-hide">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Consolidated Statement of Changes in Equity
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
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sticky left-0 bg-gray-50">
                <Tooltip content="Movement description">
                  <span className="cursor-help border-b border-dotted border-gray-400">Description</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Common stock capital">
                  <span className="cursor-help border-b border-dotted border-gray-400">Common Stock</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Additional paid-in capital (APIC)">
                  <span className="cursor-help border-b border-dotted border-gray-400">APIC</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Retained earnings">
                  <span className="cursor-help border-b border-dotted border-gray-400">Retained Earnings</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Accumulated other comprehensive income">
                  <span className="cursor-help border-b border-dotted border-gray-400">AOCI</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Non-controlling interest">
                  <span className="cursor-help border-b border-dotted border-gray-400">NCI</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                <Tooltip content="Total equity">
                  <span className="cursor-help border-b border-dotted border-gray-400">Total</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {/* Opening Balance */}
            <EquityMovementRowComponent
              row={report.openingBalance}
              formatAmount={formatAmountLocal}
              isTotal
              label="Balance at Beginning of Period"
            />

            {/* Movements */}
            {report.movements.map((movement, idx) => (
              <EquityMovementRowComponent
                key={`movement-${idx}`}
                row={movement}
                formatAmount={formatAmountLocal}
              />
            ))}

            {/* Closing Balance */}
            <EquityMovementRowComponent
              row={report.closingBalance}
              formatAmount={formatAmountLocal}
              isTotal
              highlight
              label="Balance at End of Period"
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

function EquityMovementRowComponent({
  row,
  formatAmount,
  isTotal = false,
  highlight = false,
  label
}: {
  readonly row: EquityMovementRow
  readonly formatAmount: (amount: number) => string
  readonly isTotal?: boolean
  readonly highlight?: boolean
  readonly label?: string
}) {
  const baseClasses = isTotal
    ? highlight
      ? "bg-blue-50 border-t-2 border-gray-300"
      : "bg-gray-100 border-t border-gray-200"
    : "hover:bg-gray-50"

  const fontClasses = isTotal ? "font-bold" : ""

  return (
    <tr className={baseClasses}>
      <td className={`whitespace-nowrap px-4 py-2 text-sm text-gray-900 sticky left-0 ${isTotal ? "bg-inherit" : "bg-white"} ${fontClasses}`}>
        {label ?? row.description}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right font-mono text-sm text-gray-900 ${fontClasses}`}>
        {formatAmount(row.commonStock)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right font-mono text-sm text-gray-900 ${fontClasses}`}>
        {formatAmount(row.additionalPaidInCapital)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right font-mono text-sm text-gray-900 ${fontClasses}`}>
        {formatAmount(row.retainedEarnings)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right font-mono text-sm text-gray-900 ${fontClasses}`}>
        {formatAmount(row.accumulatedOCI)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right font-mono text-sm text-gray-900 ${fontClasses}`}>
        {formatAmount(row.nonControllingInterest)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right font-mono text-sm text-gray-900 ${fontClasses}`}>
        {formatAmount(row.total)}
      </td>
    </tr>
  )
}
