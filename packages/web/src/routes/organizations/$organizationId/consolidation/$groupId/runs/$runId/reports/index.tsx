/**
 * Consolidated Reports Hub Route
 *
 * Shows available consolidated financial reports for a completed consolidation run.
 * Provides access to Balance Sheet, Income Statement, Cash Flow, and Equity Statement.
 *
 * Route: /organizations/:organizationId/consolidation/:groupId/runs/:runId/reports
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  ArrowRight,
  ArrowLeft,
  AlertTriangle
} from "lucide-react"
import { useMemo } from "react"

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

// =============================================================================
// Server Functions
// =============================================================================

const fetchConsolidatedReportsData = createServerFn({ method: "GET" })
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

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${params.runId}/reports`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchConsolidatedReportsData({
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
  component: ConsolidatedReportsHubPage
})

// =============================================================================
// Report Cards
// =============================================================================

interface ReportCard {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: typeof BarChart3
  readonly iconColor: string
  readonly bgColor: string
  readonly hoverBgColor: string
  readonly route: string
}

function getReportCards(): readonly ReportCard[] {
  return [
    {
      id: "balance-sheet",
      name: "Consolidated Balance Sheet",
      description: "View consolidated assets, liabilities, and equity including non-controlling interests per ASC 810",
      icon: BarChart3,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
      hoverBgColor: "group-hover:bg-green-200",
      route: "balance-sheet"
    },
    {
      id: "income-statement",
      name: "Consolidated Income Statement",
      description: "View consolidated revenue, expenses, and net income with NCI attribution per ASC 220",
      icon: TrendingUp,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100",
      hoverBgColor: "group-hover:bg-purple-200",
      route: "income-statement"
    },
    {
      id: "cash-flow",
      name: "Consolidated Cash Flow Statement",
      description: "View consolidated cash flows from operating, investing, and financing activities per ASC 230",
      icon: DollarSign,
      iconColor: "text-teal-600",
      bgColor: "bg-teal-100",
      hoverBgColor: "group-hover:bg-teal-200",
      route: "cash-flow"
    },
    {
      id: "equity-statement",
      name: "Consolidated Statement of Changes in Equity",
      description: "View changes in equity including retained earnings, AOCI, and non-controlling interests",
      icon: PieChart,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-100",
      hoverBgColor: "group-hover:bg-orange-200",
      route: "equity-statement"
    }
  ]
}

// =============================================================================
// Page Component
// =============================================================================

function ConsolidatedReportsHubPage() {
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

  const reportCards = useMemo(() => getReportCards(), [])

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
    }
  ]

  // Check if run is completed
  const isRunCompleted = run.status === "Completed"

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="consolidated-reports-hub-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/consolidation/$groupId/runs/$runId"
            params={{
              organizationId: params.organizationId,
              groupId: params.groupId,
              runId: params.runId
            }}
            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Run Details
          </Link>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Consolidated Financial Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {group.name} • {run.periodRef.year} Period {run.periodRef.period} • As of {run.asOfDate}
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
                  Consolidated reports are only available after a consolidation run has completed successfully.
                  Current status: {run.status}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reports Grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {reportCards.map((report) => (
            <ReportCardComponent
              key={report.id}
              report={report}
              params={params}
              disabled={!isRunCompleted}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Report Card Component
// =============================================================================

function ReportCardComponent({
  report,
  params,
  disabled
}: {
  readonly report: ReportCard
  readonly params: {
    readonly organizationId: string
    readonly groupId: string
    readonly runId: string
  }
  readonly disabled: boolean
}) {
  const Icon = report.icon

  // Build the route path based on report ID
  const getReportRoute = () => {
    const routes: Record<string, string> = {
      "balance-sheet": "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/balance-sheet",
      "income-statement": "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/income-statement",
      "cash-flow": "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/cash-flow",
      "equity-statement": "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/equity-statement"
    }
    return routes[report.id] ?? "/organizations/$organizationId/consolidation/$groupId/runs/$runId/reports/balance-sheet"
  }

  // Show disabled state when run is not completed
  if (disabled) {
    return (
      <div
        className="rounded-lg border border-gray-200 bg-white p-6 opacity-60"
        data-testid={`report-card-${report.id}`}
      >
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${report.bgColor}`}
        >
          <Icon className={`h-6 w-6 ${report.iconColor}`} />
        </div>
        <h3 className="font-semibold text-gray-900">{report.name}</h3>
        <p className="mt-2 text-sm text-gray-500">{report.description}</p>
        <div className="mt-4">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            Run Not Completed
          </span>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={getReportRoute()}
      params={{
        organizationId: params.organizationId,
        groupId: params.groupId,
        runId: params.runId
      }}
      className="group block rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
      data-testid={`report-card-${report.id}`}
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${report.bgColor} ${report.hoverBgColor}`}
      >
        <Icon className={`h-6 w-6 ${report.iconColor}`} />
      </div>
      <h3 className="font-semibold text-gray-900">{report.name}</h3>
      <p className="mt-2 text-sm text-gray-500">{report.description}</p>
      <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
        View Report
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}
