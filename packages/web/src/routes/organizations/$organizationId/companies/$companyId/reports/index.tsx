/**
 * Company Reports Hub Route
 *
 * Company-level reports hub showing available financial reports for a specific company.
 * Provides access to Trial Balance, Balance Sheet, Income Statement, Cash Flow, and Equity Statement.
 *
 * Route: /organizations/:organizationId/companies/:companyId/reports
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import {
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  DollarSign,
  ArrowRight,
  ChevronRight,
  Check
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
  readonly functionalCurrency: string
  readonly isActive: boolean
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchCompanyReportsData = createServerFn({ method: "GET" })
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

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/reports/"
)({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/companies/${params.companyId}/reports`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchCompanyReportsData({
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
  component: CompanyReportsPage
})

// =============================================================================
// Report Cards
// =============================================================================

interface ReportCard {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: typeof FileText
  readonly iconColor: string
  readonly bgColor: string
  readonly hoverBgColor: string
}

function getReportCards(): readonly ReportCard[] {
  return [
    {
      id: "trial-balance",
      name: "Trial Balance",
      description: "View account balances and verify debits equal credits for a specific period",
      icon: FileText,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100",
      hoverBgColor: "group-hover:bg-blue-200"
    },
    {
      id: "balance-sheet",
      name: "Balance Sheet",
      description: "View assets, liabilities, and equity at a specific point in time",
      icon: BarChart3,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
      hoverBgColor: "group-hover:bg-green-200"
    },
    {
      id: "income-statement",
      name: "Income Statement",
      description: "View revenue and expenses over a period to determine net income",
      icon: TrendingUp,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100",
      hoverBgColor: "group-hover:bg-purple-200"
    },
    {
      id: "cash-flow",
      name: "Cash Flow Statement",
      description: "View cash inflows and outflows categorized by operating, investing, and financing activities",
      icon: DollarSign,
      iconColor: "text-teal-600",
      bgColor: "bg-teal-100",
      hoverBgColor: "group-hover:bg-teal-200"
    },
    {
      id: "equity-statement",
      name: "Statement of Changes in Equity",
      description: "View changes in owner's equity including retained earnings and capital contributions",
      icon: PieChart,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-100",
      hoverBgColor: "group-hover:bg-orange-200"
    }
  ]
}

// =============================================================================
// Company Reports Page Component
// =============================================================================

function CompanyReportsPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as Organization | null
  const company = loaderData.company as Company | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  const reportCards = useMemo(() => getReportCards(), [])

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
    }
  ]

  // Map companies for sidebar
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
      <div data-testid="company-reports-page">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Financial Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {company.name} • {company.functionalCurrency}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs text-white">
              <Check className="h-3 w-3" />
            </span>
            <span className="text-gray-500">Select Company</span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              2
            </span>
            <span className="font-medium text-gray-900">Choose Report</span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500">
              3
            </span>
            <span className="text-gray-500">View Report</span>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reportCards.map((report) => (
            <ReportCardComponent
              key={report.id}
              report={report}
              organizationId={params.organizationId}
              companyId={params.companyId}
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
  organizationId,
  companyId
}: {
  readonly report: ReportCard
  readonly organizationId: string
  readonly companyId: string
}) {
  const Icon = report.icon

  // Build the route path based on report ID
  const getReportRoute = () => {
    const routes: Record<string, string> = {
      "trial-balance": "/organizations/$organizationId/companies/$companyId/reports/trial-balance",
      "balance-sheet": "/organizations/$organizationId/companies/$companyId/reports/balance-sheet",
      "income-statement": "/organizations/$organizationId/companies/$companyId/reports/income-statement",
      "cash-flow": "/organizations/$organizationId/companies/$companyId/reports/cash-flow",
      "equity-statement": "/organizations/$organizationId/companies/$companyId/reports/equity-statement"
    }
    return routes[report.id] ?? "/organizations/$organizationId/companies/$companyId/reports/trial-balance"
  }

  return (
    <Link
      to={getReportRoute()}
      params={{ organizationId, companyId }}
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
        Generate Report
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}
