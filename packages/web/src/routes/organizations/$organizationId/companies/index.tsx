import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { Plus } from "lucide-react"
import { createServerApi } from "@/api/server"
import { CompanyHierarchyTree, type Company } from "@/components/company/CompanyHierarchyTree"
import { NoCompaniesEmptyState } from "@/components/ui/EmptyState"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { usePermissions } from "@/hooks/usePermissions"

// =============================================================================
// Server Functions: Fetch organization and companies from API with cookie auth
// =============================================================================

const fetchOrganization = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    // Get the session cookie to forward to API
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, error: "unauthorized" as const }
    }

    try {
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      // Forward session token to API using Authorization Bearer header
      const { data, error } = await serverApi.GET("/api/v1/organizations/{id}", {
        params: { path: { id: organizationId } },
        headers: { Authorization: `Bearer ${sessionToken}` }
      })

      if (error) {
        if (typeof error === "object" && "status" in error && error.status === 404) {
          return { organization: null, error: "not_found" as const }
        }
        return { organization: null, error: "failed" as const }
      }

      return { organization: data, error: null }
    } catch {
      return { organization: null, error: "failed" as const }
    }
  })

const fetchCompanies = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    // Get the session cookie to forward to API
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { companies: [], total: 0, error: "unauthorized" as const }
    }

    try {
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      // Forward session token to API using Authorization Bearer header
      const { data, error } = await serverApi.GET("/api/v1/companies", {
        params: { query: { organizationId } },
        headers: { Authorization: `Bearer ${sessionToken}` }
      })

      if (error) {
        return { companies: [], total: 0, error: "failed" as const }
      }

      return {
        companies: data?.companies ?? [],
        total: data?.total ?? 0,
        error: null
      }
    } catch {
      return { companies: [], total: 0, error: "failed" as const }
    }
  })


// =============================================================================
// Companies List Route
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/companies/")({
  beforeLoad: async ({ context }) => {
    // Redirect to login if not authenticated
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/organizations"
        }
      })
    }
  },
  loader: async ({ params }) => {
    // Fetch organization and companies in parallel
    const [orgResult, companiesResult] = await Promise.all([
      fetchOrganization({ data: params.organizationId }),
      fetchCompanies({ data: params.organizationId })
    ])

    if (orgResult.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: orgResult.organization,
      companies: companiesResult.companies,
      companiesTotal: companiesResult.total
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: CompaniesListPage
})

// =============================================================================
// Types
// =============================================================================

type StatusFilter = "all" | "active" | "inactive"

// =============================================================================
// Companies List Page Component
// =============================================================================

function CompaniesListPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const organization = loaderData.organization as {
    readonly id: string
    readonly name: string
    readonly reportingCurrency: string
  } | null
  const companies = loaderData.companies as readonly Company[]
  const companiesTotal = loaderData.companiesTotal as number
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Permission checks for UI element visibility
  const { canPerform } = usePermissions()
  const canCreateCompany = canPerform("company:create")

  // Filter companies by status
  const filteredCompanies = useMemo(() => {
    if (statusFilter === "all") return companies
    return companies.filter((company) =>
      statusFilter === "active" ? company.isActive : !company.isActive
    )
  }, [companies, statusFilter])

  // Count active/inactive for filter badges
  const activeCount = useMemo(
    () => companies.filter((c) => c.isActive).length,
    [companies]
  )
  const inactiveCount = companies.length - activeCount

  if (!organization) {
    return null
  }

  // Breadcrumb items for Companies page
  const breadcrumbItems = [
    {
      label: "Companies",
      href: `/organizations/${params.organizationId}/companies`
    }
  ]

  // Map companies for AppLayout sidebar quick actions
  const companiesForSidebar = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies]
  )

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="companies-list-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Companies
              </h1>
              <p className="mt-1 text-sm text-gray-500" data-testid="companies-count">
                {companiesTotal} compan{companiesTotal !== 1 ? "ies" : "y"} in {organization.name}
              </p>
            </div>

            {canCreateCompany && (
              <Link
                to="/organizations/$organizationId/companies/new"
                params={{ organizationId: params.organizationId }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                data-testid="create-company-button"
              >
                <Plus className="h-4 w-4" />
                <span>New Company</span>
              </Link>
            )}
          </div>

          {/* Status Filter */}
          {companies.length > 0 && (
            <div className="mt-4 flex items-center gap-2" data-testid="status-filter">
              <StatusFilterButton
                label="All"
                count={companies.length}
                isActive={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                data-testid="filter-all"
              />
              <StatusFilterButton
                label="Active"
                count={activeCount}
                isActive={statusFilter === "active"}
                onClick={() => setStatusFilter("active")}
                data-testid="filter-active"
              />
              <StatusFilterButton
                label="Inactive"
                count={inactiveCount}
                isActive={statusFilter === "inactive"}
                onClick={() => setStatusFilter("inactive")}
                data-testid="filter-inactive"
              />
            </div>
          )}
        </div>

        {/* Companies List - Hierarchy Tree View */}
        {companies.length === 0 ? (
          <NoCompaniesEmptyState
            action={
              canCreateCompany ? (
                <Link
                  to="/organizations/$organizationId/companies/new"
                  params={{ organizationId: params.organizationId }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  data-testid="create-company-empty-button"
                >
                  <Plus className="h-5 w-5" />
                  <span>Create Company</span>
                </Link>
              ) : undefined
            }
          />
        ) : filteredCompanies.length === 0 ? (
          <div
            className="rounded-lg border border-gray-200 bg-white p-8 text-center"
            data-testid="no-filtered-results"
          >
            <p className="text-gray-500">
              No {statusFilter === "active" ? "active" : "inactive"} companies found.
            </p>
            <button
              onClick={() => setStatusFilter("all")}
              className="mt-2 text-blue-600 hover:text-blue-700"
            >
              Show all companies
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white">
            <CompanyHierarchyTree
              companies={filteredCompanies}
              organizationId={params.organizationId}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Status Filter Button Component
// =============================================================================

interface StatusFilterButtonProps {
  readonly label: string
  readonly count: number
  readonly isActive: boolean
  readonly onClick: () => void
  readonly "data-testid"?: string
}

function StatusFilterButton({
  label,
  count,
  isActive,
  onClick,
  "data-testid": testId
}: StatusFilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
      data-testid={testId}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs ${
          isActive ? "bg-blue-200 text-blue-900" : "bg-gray-200 text-gray-700"
        }`}
      >
        {count}
      </span>
    </button>
  )
}
