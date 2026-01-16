/**
 * Reports Hub Route
 *
 * Organization-level reports hub following the 3-step flow:
 * Step 1: Company Selection - Users must first select a company
 * Step 2: After company selection, navigate to company-level reports page
 * Step 3: User views specific reports for the selected company
 *
 * This page shows ONLY company selection (Step 1). Report types are shown
 * on the company-level reports page after a company is selected.
 *
 * Route: /organizations/:organizationId/reports
 */

import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Building, ChevronRight } from "lucide-react"

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
    <MinimalRouteError error={error} />
  ),
  component: ReportsHubPage
})

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
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

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
      organizations={organizations}
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
            Select a company to view and generate financial reports
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              1
            </span>
            <span className="font-medium text-gray-900">Select Company</span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500">
              2
            </span>
            <span className="text-gray-500">Choose Report</span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-500">
              3
            </span>
            <span className="text-gray-500">View Report</span>
          </div>
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
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Select a Company
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              Choose which company&apos;s financial reports you want to view.
              Each company has its own set of reports based on its chart of accounts and journal entries.
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
        )}
      </div>
    </AppLayout>
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
      className="group block rounded-lg border border-gray-200 bg-white p-6 transition-all hover:border-blue-300 hover:shadow-md"
      data-testid={`company-report-card-${company.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 transition-colors group-hover:bg-blue-200">
          <Building className="h-6 w-6 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
            {company.name}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {company.functionalCurrency} • Active
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-4 text-sm font-medium text-blue-600 group-hover:text-blue-700">
        Select &amp; View Reports
        <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  )
}
