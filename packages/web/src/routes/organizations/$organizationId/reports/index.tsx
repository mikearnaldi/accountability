/**
 * Reports Hub Route
 *
 * Organization-level reports hub showing available financial reports.
 * Provides quick access to common reports and allows selecting a company
 * to view company-specific reports.
 *
 * Route: /organizations/:organizationId/reports
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import {
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  DollarSign,
  Building
} from "lucide-react"

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

const fetchReportsData = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        organization: null,
        companies: [],
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return {
            organization: null,
            companies: [],
            error: "not_found" as const
          }
        }
        return {
          organization: null,
          companies: [],
          error: "failed" as const
        }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        error: null
      }
    } catch {
      return {
        organization: null,
        companies: [],
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/reports/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/reports`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchReportsData({ data: params.organizationId })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: result.organization,
      companies: result.companies
    }
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Accountability
            </Link>
            <span className="text-gray-400">/</span>
            <Link to="/organizations" className="text-xl text-gray-600 hover:text-gray-900">
              Organizations
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-medium text-red-800">Error</h2>
          <p className="mt-2 text-red-700">{error.message}</p>
          <Link
            to="/organizations"
            className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            Back to Organizations
          </Link>
        </div>
      </main>
    </div>
  ),
  component: ReportsHubPage
})

// =============================================================================
// Report Type Cards
// =============================================================================

interface ReportType {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: typeof FileText
  readonly iconColor: string
  readonly bgColor: string
}

const REPORT_TYPES: readonly ReportType[] = [
  {
    id: "trial-balance",
    name: "Trial Balance",
    description: "View account balances and verify debits equal credits",
    icon: FileText,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  {
    id: "balance-sheet",
    name: "Balance Sheet",
    description: "Assets, liabilities, and equity at a point in time",
    icon: BarChart3,
    iconColor: "text-green-600",
    bgColor: "bg-green-100"
  },
  {
    id: "income-statement",
    name: "Income Statement",
    description: "Revenue and expenses over a period",
    icon: TrendingUp,
    iconColor: "text-purple-600",
    bgColor: "bg-purple-100"
  },
  {
    id: "cash-flow",
    name: "Cash Flow Statement",
    description: "Cash inflows and outflows by activity",
    icon: DollarSign,
    iconColor: "text-teal-600",
    bgColor: "bg-teal-100"
  },
  {
    id: "equity-statement",
    name: "Statement of Equity",
    description: "Changes in owner's equity over a period",
    icon: PieChart,
    iconColor: "text-orange-600",
    bgColor: "bg-orange-100"
  }
]

// =============================================================================
// Reports Hub Page Component
// =============================================================================

function ReportsHubPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user

  if (!organization) {
    return null
  }

  // Filter to active companies only
  const activeCompanies = companies.filter((c) => c.isActive)

  // Breadcrumb items
  const breadcrumbItems = [
    {
      label: "Reports",
      href: `/organizations/${params.organizationId}/reports`
    }
  ]

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  return (
    <AppLayout
      user={user}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="reports-hub-page">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Financial Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and view financial reports for your companies
          </p>
        </div>

        {/* No Companies Message */}
        {activeCompanies.length === 0 ? (
          <div
            className="rounded-lg border border-gray-200 bg-white p-8 text-center"
            data-testid="reports-no-companies"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Building className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No companies available
            </h3>
            <p className="mb-6 text-gray-500">
              Create a company first to generate financial reports.
            </p>
            <Link
              to="/organizations/$organizationId/companies"
              params={{ organizationId: params.organizationId }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              <Building className="h-4 w-4" />
              View Companies
            </Link>
          </div>
        ) : (
          <>
            {/* Report Types Grid */}
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Available Reports
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {REPORT_TYPES.map((report) => (
                  <ReportTypeCard key={report.id} report={report} />
                ))}
              </div>
            </div>

            {/* Companies Selection */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Select a Company
              </h2>
              <p className="mb-4 text-sm text-gray-500">
                Choose a company to view its financial reports
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeCompanies.map((company) => (
                  <CompanyReportCard
                    key={company.id}
                    company={company}
                    organizationId={params.organizationId}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Report Type Card Component
// =============================================================================

function ReportTypeCard({ report }: { readonly report: ReportType }) {
  const Icon = report.icon
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-6"
      data-testid={`report-type-${report.id}`}
    >
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${report.bgColor}`}
      >
        <Icon className={`h-5 w-5 ${report.iconColor}`} />
      </div>
      <h3 className="font-medium text-gray-900">{report.name}</h3>
      <p className="mt-1 text-sm text-gray-500">{report.description}</p>
    </div>
  )
}

// =============================================================================
// Company Report Card Component
// =============================================================================

function CompanyReportCard({
  company,
  organizationId
}: {
  readonly company: Company
  readonly organizationId: string
}) {
  return (
    <Link
      to="/organizations/$organizationId/companies/$companyId/reports"
      params={{ organizationId, companyId: company.id }}
      className="group block rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
      data-testid={`company-report-card-${company.id}`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 transition-colors group-hover:bg-blue-200">
        <Building className="h-5 w-5 text-blue-600" />
      </div>
      <h3 className="font-medium text-gray-900">{company.name}</h3>
      <p className="mt-1 text-sm text-gray-500">
        Currency: {company.functionalCurrency}
      </p>
      <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
        View Reports
        <svg
          className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  )
}
