import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
// eslint-disable-next-line local/no-server-functions -- Required for SSR: need server-side access to httpOnly cookies
import { createServerFn } from "@tanstack/react-start"
import { getCookie, getRequestUrl } from "@tanstack/react-start/server"
import { useState } from "react"
import { api } from "@/api/interceptor"

// =============================================================================
// Server Function: Fetch organizations from API with cookie auth
// =============================================================================

// eslint-disable-next-line local/no-server-functions -- Required for SSR: TanStack Start server functions are the only way to access httpOnly cookies during SSR
const fetchOrganizations = createServerFn({ method: "GET" }).handler(async () => {
  // Get the session token from the httpOnly cookie
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return { organizations: [], total: 0, error: "unauthorized" as const }
  }

  try {
    // Get the current request URL to determine the correct host/port for API calls
    const requestUrl = getRequestUrl()
    const apiBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`

    // Call the API with the session token as Bearer auth
    // eslint-disable-next-line local/no-direct-fetch -- Required for SSR: must use native fetch with dynamic baseUrl from request context
    const response = await fetch(`${apiBaseUrl}/api/v1/organizations`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (!response.ok) {
      return { organizations: [], total: 0, error: "failed" as const }
    }

    const data = await response.json()
    return {
      organizations: data?.organizations ?? [],
      total: data?.total ?? 0,
      error: null
    }
  } catch {
    return { organizations: [], total: 0, error: "failed" as const }
  }
})

// =============================================================================
// Organizations List Route
// =============================================================================

export const Route = createFileRoute("/organizations/")({
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
  loader: async () => {
    // Fetch organizations from API with SSR using server function
    const result = await fetchOrganizations()

    if (result.error) {
      // On auth error or failure, return empty state (UI will show empty state)
      return {
        organizations: [],
        total: 0
      }
    }

    return {
      organizations: result.organizations,
      total: result.total
    }
  },
  component: OrganizationsPage
})

// =============================================================================
// Organization Type (extracted from API response)
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
  readonly createdAt: {
    readonly epochMillis: number
  }
}

// =============================================================================
// Organizations Page Component
// =============================================================================

function OrganizationsPage() {
  const { organizations } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-xl font-bold text-gray-900">
                Accountability
              </Link>
              <span className="text-gray-400">/</span>
              <h1 className="text-xl font-semibold text-gray-900">Organizations</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {organizations.length === 0 ? (
          <EmptyState />
        ) : (
          <OrganizationsList organizations={organizations} />
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
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <svg
          className="h-6 w-6 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">No organizations</h3>
      <p className="mb-6 text-gray-500">
        Get started by creating your first organization.
      </p>

      {showForm ? (
        <CreateOrganizationForm onCancel={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Organization
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Organizations List Component
// =============================================================================

function OrganizationsList({ organizations }: { readonly organizations: readonly Organization[] }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {organizations.length} organization{organizations.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Organization
        </button>
      </div>

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <OrganizationCard key={org.id} organization={org} />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Organization Card Component
// =============================================================================

function OrganizationCard({ organization }: { readonly organization: Organization }) {
  const createdDate = new Date(organization.createdAt.epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })

  // Note: Link to organization detail page will be added when that route exists
  return (
    <div className="block rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <h3 className="font-medium text-gray-900">{organization.name}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {organization.reportingCurrency}
        </span>
      </div>
      <p className="text-sm text-gray-500">Created {createdDate}</p>
    </div>
  )
}

// =============================================================================
// Create Organization Form Component
// =============================================================================

function CreateOrganizationForm({ onCancel }: { readonly onCancel: () => void }) {
  const router = useRouter()

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
      const { error: apiError } = await api.POST("/api/v1/organizations", {
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

      // Revalidate to show new organization in list
      await router.invalidate()

      // Close form after successful creation
      // Organization detail page navigation will be added when that route exists
      onCancel()
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
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
