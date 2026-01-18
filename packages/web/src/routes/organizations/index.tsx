/**
 * Organizations Selection Page
 *
 * Entry point for selecting an organization. This is the first screen after login.
 * User must select an org to access org-scoped features.
 *
 * Features:
 * - Card-based layout showing user's organizations with:
 *   - Organization name (prominent)
 *   - Reporting currency
 *   - Companies count
 *   - Last accessed date (using createdAt for now)
 * - Click card → navigate to /organizations/:id/dashboard
 * - Create new organization button
 * - If user has only 1 org: Auto-redirect to that org's dashboard
 * - If user has 0 orgs: Show create organization prompt
 * - Search/filter orgs (client-side for small lists)
 *
 * Route: /organizations
 */

import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { Building2, Search, Plus, Globe, Calendar, Users } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
  readonly createdAt: {
    readonly epochMillis: number
  }
  readonly settings: {
    readonly defaultLocale: string
    readonly defaultTimezone: string
    readonly defaultDecimalPlaces: number
  }
}

interface OrganizationWithStats extends Organization {
  readonly companiesCount: number
}

export interface LoaderResult {
  readonly organizations: readonly OrganizationWithStats[]
  readonly total: number
  readonly shouldAutoRedirect: boolean
  readonly autoRedirectId: string | null
}

export interface OrganizationsSearchParams {
  readonly org?: string | undefined
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchOrganizationsWithStats = createServerFn({ method: "GET" }).handler(async (): Promise<LoaderResult> => {
  const sessionToken = getCookie("accountability_session")

  if (sessionToken === undefined || sessionToken === null || sessionToken === "") {
    return {
      organizations: [],
      total: 0,
      shouldAutoRedirect: false,
      autoRedirectId: null
    }
  }

  try {
    const serverApi = createServerApi()
    const headers = { Authorization: `Bearer ${sessionToken}` }

    // Fetch organizations
    const { data, error } = await serverApi.GET("/api/v1/organizations", { headers })

    if (error !== undefined || data === undefined) {
      return {
        organizations: [],
        total: 0,
        shouldAutoRedirect: false,
        autoRedirectId: null
      }
    }

    const organizations = data.organizations ?? []

    // Fetch companies count for each organization (in parallel)
    const orgsWithStats: OrganizationWithStats[] = await Promise.all(
      organizations.map(async (org) => {
        try {
          const companiesResult = await serverApi.GET("/api/v1/companies", {
            params: { query: { organizationId: org.id } },
            headers
          })
          return {
            ...org,
            companiesCount: companiesResult.data?.total ?? 0
          }
        } catch {
          return {
            ...org,
            companiesCount: 0
          }
        }
      })
    )

    // If exactly 1 organization, prepare for auto-redirect
    const shouldAutoRedirect = orgsWithStats.length === 1
    const autoRedirectId = shouldAutoRedirect ? orgsWithStats[0].id : null

    return {
      organizations: orgsWithStats,
      total: orgsWithStats.length,
      shouldAutoRedirect,
      autoRedirectId
    }
  } catch {
    return {
      organizations: [],
      total: 0,
      shouldAutoRedirect: false,
      autoRedirectId: null
    }
  }
})

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/")({
  validateSearch: (search: Record<string, unknown>): OrganizationsSearchParams => {
    return {
      org: typeof search.org === "string" ? search.org : undefined
    }
  },
  beforeLoad: async ({ context }) => {
    if (context.user === null) {
      throw redirect({
        to: "/login",
        search: {
          redirect: "/organizations"
        }
      })
    }
  },
  loader: async () => {
    const result = await fetchOrganizationsWithStats()

    // If exactly one org, redirect to its dashboard immediately
    if (result.shouldAutoRedirect && result.autoRedirectId !== null) {
      throw redirect({
        to: "/organizations/$organizationId/dashboard",
        params: { organizationId: result.autoRedirectId }
      })
    }

    return result
  },
  component: OrganizationsPage
})

// =============================================================================
// Organizations Page Component
// =============================================================================

function OrganizationsPage() {
  const { organizations, total } = Route.useLoaderData()
  const { org: currentOrgId } = Route.useSearch()
  const context = Route.useRouteContext()
  const [searchQuery, setSearchQuery] = useState("")

  const user = context.user

  // Find the current organization from the search param, or default to first org
  const currentOrganization = currentOrgId !== undefined
    ? organizations.find((o) => o.id === currentOrgId) ?? organizations[0] ?? null
    : organizations[0] ?? null

  // Filter organizations based on search query
  const filteredOrganizations = useMemo(() => {
    if (searchQuery.trim() === "") {
      return organizations
    }
    const query = searchQuery.toLowerCase()
    return organizations.filter((org) =>
      org.name.toLowerCase().includes(query) ||
      org.reportingCurrency.toLowerCase().includes(query)
    )
  }, [organizations, searchQuery])

  // Custom breadcrumb items for this page
  const breadcrumbItems = [
    { label: "Organizations", href: "/organizations" }
  ]

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={currentOrganization}
      showBreadcrumbs={true}
      breadcrumbItems={breadcrumbItems}
    >
      <div data-testid="organizations-page">
        {total === 0 ? (
          <EmptyState />
        ) : (
          <OrganizationsList
            organizations={filteredOrganizations}
            totalCount={total}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Empty State Component
// =============================================================================

function EmptyState() {
  return (
    <div
      className="mx-auto max-w-lg rounded-lg border border-gray-200 bg-white p-8 text-center"
      data-testid="organizations-empty-state"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <Building2 className="h-8 w-8 text-blue-600" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">No organizations</h2>
      <p className="mb-6 text-gray-500">
        Get started by creating your first organization.
      </p>

      <Link
        to="/organizations/new"
        data-testid="create-organization-button"
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-5 w-5" />
        Create Organization
      </Link>
    </div>
  )
}

// =============================================================================
// Organizations List Component
// =============================================================================

interface OrganizationsListProps {
  readonly organizations: readonly OrganizationWithStats[]
  readonly totalCount: number
  readonly searchQuery: string
  readonly onSearchChange: (query: string) => void
}

function OrganizationsList({
  organizations,
  totalCount,
  searchQuery,
  onSearchChange
}: OrganizationsListProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6" data-testid="organizations-list-container">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Select an Organization</h1>
          <p className="mt-1 text-sm text-gray-500" data-testid="organizations-count">
            {totalCount} organization{totalCount !== 1 ? "s" : ""} available
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate({ to: "/organizations/new" })}
          data-testid="new-organization-button"
        >
          New Organization
        </Button>
      </div>

      {/* Search Bar */}
      {totalCount > 1 && (
        <Input
          type="text"
          placeholder="Search organizations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          inputPrefix={<Search className="h-5 w-5" />}
          containerClassName="data-testid-organizations-search-container"
          data-testid="organizations-search-input"
        />
      )}

      {/* Organizations Grid */}
      {organizations.length === 0 && searchQuery !== "" ? (
        <div
          className="rounded-lg border border-gray-200 bg-white p-8 text-center"
          data-testid="organizations-no-results"
        >
          <Search className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No results found</h3>
          <p className="mt-2 text-gray-500">
            No organizations match "{searchQuery}". Try a different search term.
          </p>
          <button
            onClick={() => onSearchChange("")}
            className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="organizations-grid"
        >
          {organizations.map((org) => (
            <OrganizationCard key={org.id} organization={org} />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Organization Card Component
// =============================================================================

interface OrganizationCardProps {
  readonly organization: OrganizationWithStats
}

function OrganizationCard({ organization }: OrganizationCardProps) {
  const navigate = useNavigate()

  // Format last accessed date (using createdAt for now)
  const lastAccessedDate = new Date(organization.createdAt.epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })

  const handleClick = () => {
    navigate({
      to: "/organizations/$organizationId/dashboard",
      params: { organizationId: organization.id }
    })
  }

  return (
    <button
      onClick={handleClick}
      data-testid={`organization-card-${organization.id}`}
      className="block w-full rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-300 hover:shadow-md focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      {/* Organization Name */}
      <h3
        className="text-lg font-semibold text-gray-900"
        data-testid={`organization-name-${organization.id}`}
      >
        {organization.name}
      </h3>

      {/* Stats Row */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Reporting Currency */}
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-400" />
          <span
            className="text-sm font-medium text-gray-700"
            data-testid={`organization-currency-${organization.id}`}
          >
            {organization.reportingCurrency}
          </span>
        </div>

        {/* Companies Count */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span
            className="text-sm text-gray-600"
            data-testid={`organization-companies-count-${organization.id}`}
          >
            {organization.companiesCount} {organization.companiesCount === 1 ? "company" : "companies"}
          </span>
        </div>
      </div>

      {/* Last Accessed Date */}
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <Calendar className="h-4 w-4 text-gray-400" />
        <span
          className="text-sm text-gray-500"
          data-testid={`organization-last-accessed-${organization.id}`}
        >
          Created {lastAccessedDate}
        </span>
      </div>
    </button>
  )
}

