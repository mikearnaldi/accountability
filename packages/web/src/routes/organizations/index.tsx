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

import { createFileRoute, redirect, useRouter, Link, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { Building2, Search, Plus, Globe, Calendar, Users } from "lucide-react"

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
    readonly useFiscalYear: boolean
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

// =============================================================================
// Server Functions
// =============================================================================

const fetchOrganizationsWithStats = createServerFn({ method: "GET" }).handler(async (): Promise<LoaderResult> => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
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

    if (error || !data) {
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
  beforeLoad: async ({ context }) => {
    if (!context.user) {
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
    if (result.shouldAutoRedirect && result.autoRedirectId) {
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
  const [searchQuery, setSearchQuery] = useState("")

  // Filter organizations based on search query
  const filteredOrganizations = useMemo(() => {
    if (!searchQuery.trim()) {
      return organizations
    }
    const query = searchQuery.toLowerCase()
    return organizations.filter((org) =>
      org.name.toLowerCase().includes(query) ||
      org.reportingCurrency.toLowerCase().includes(query)
    )
  }, [organizations, searchQuery])

  return (
    <div className="min-h-screen bg-gray-50" data-testid="organizations-page">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-xl font-bold text-gray-900">
                Accountability
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
      </main>
    </div>
  )
}

// =============================================================================
// Empty State Component
// =============================================================================

function EmptyState() {
  const [showForm, setShowForm] = useState(false)

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

      {showForm ? (
        <CreateOrganizationForm onCancel={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          data-testid="create-organization-button"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Create Organization
        </button>
      )}
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
  const [showForm, setShowForm] = useState(false)

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
        <button
          onClick={() => setShowForm(true)}
          data-testid="new-organization-button"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Organization
        </button>
      </div>

      {/* Search Bar */}
      {totalCount > 1 && (
        <div className="relative" data-testid="organizations-search-container">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="organizations-search-input"
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Create Organization
            </h2>
            <CreateOrganizationForm onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {/* Organizations Grid */}
      {organizations.length === 0 && searchQuery ? (
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

// =============================================================================
// Create Organization Form Component
// =============================================================================

function CreateOrganizationForm({ onCancel }: { readonly onCancel: () => void }) {
  const router = useRouter()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [reportingCurrency, setReportingCurrency] = useState("USD")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Organization name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { data, error: apiError } = await api.POST("/api/v1/organizations", {
        body: {
          name: trimmedName,
          reportingCurrency,
          settings: null
        }
      })

      if (apiError) {
        // Extract error message
        let errorMessage = "Failed to create organization"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Navigate to the new organization's dashboard
      if (data?.id) {
        navigate({
          to: "/organizations/$organizationId/dashboard",
          params: { organizationId: data.id }
        })
      } else {
        // Fallback: revalidate and close form
        await router.invalidate()
        onCancel()
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-organization-form">
      {/* Error Message */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Name Field */}
      <div>
        <label htmlFor="org-name" className="block text-sm font-medium text-gray-700">
          Organization Name
        </label>
        <input
          id="org-name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
          placeholder="My Organization"
          data-testid="org-name-input"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* Currency Field */}
      <div>
        <label htmlFor="org-currency" className="block text-sm font-medium text-gray-700">
          Reporting Currency
        </label>
        <select
          id="org-currency"
          value={reportingCurrency}
          onChange={(e) => setReportingCurrency(e.target.value)}
          disabled={isSubmitting}
          data-testid="org-currency-select"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        >
          <option value="USD">USD - US Dollar</option>
          <option value="EUR">EUR - Euro</option>
          <option value="GBP">GBP - British Pound</option>
          <option value="JPY">JPY - Japanese Yen</option>
          <option value="CHF">CHF - Swiss Franc</option>
          <option value="CAD">CAD - Canadian Dollar</option>
          <option value="AUD">AUD - Australian Dollar</option>
        </select>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="cancel-create-org-button"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="submit-create-org-button"
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating...
            </span>
          ) : (
            "Create"
          )}
        </button>
      </div>
    </form>
  )
}
