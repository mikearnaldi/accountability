import { createFileRoute, redirect, useRouter, Link, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { Plus, Building2 } from "lucide-react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"

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
        // Check if it's a 404-style error
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
// Organization Details Route
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/")({
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
  component: OrganizationDetailsPage
})

// =============================================================================
// Types (extracted from API response schema)
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
  readonly settings: {
    readonly defaultLocale: string
    readonly defaultTimezone: string
    readonly defaultDecimalPlaces: number
  }
  readonly createdAt: {
    readonly epochMillis: number
  }
}

interface Company {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly legalName: string
  readonly jurisdiction: string
  readonly taxId: string | null
  readonly functionalCurrency: string
  readonly reportingCurrency: string
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
  readonly isActive: boolean
  readonly createdAt: {
    readonly epochMillis: number
  }
}

// =============================================================================
// Organization Details Page Component
// =============================================================================

function OrganizationDetailsPage() {
  const context = Route.useRouteContext()
  const { organization, companies, companiesTotal } = Route.useLoaderData()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  if (!organization) {
    return null
  }

  const createdDate = new Date(organization.createdAt.epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  // Map companies to the minimal structure for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      companies={companiesForSidebar}
    >
      <div className="space-y-8">
        {/* Organization Details Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{organization.name}</h1>
              <p className="mt-1 text-sm text-gray-500">Created {createdDate}</p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              data-testid="edit-organization-button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Reporting Currency</dt>
              <dd className="mt-1 text-lg font-medium text-gray-900">
                {organization.reportingCurrency}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Organization ID</dt>
              <dd className="mt-1 font-mono text-sm text-gray-600">{organization.id}</dd>
            </div>
            {organization.settings && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Default Timezone</dt>
                <dd className="mt-1 text-lg font-medium text-gray-900">
                  {organization.settings.defaultTimezone}
                </dd>
              </div>
            )}
          </div>
        </div>

        {/* Edit Organization Modal */}
        {isEditing && (
          <EditOrganizationModal
            organization={organization}
            onClose={() => setIsEditing(false)}
          />
        )}

        {/* Companies Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="subsidiaries-section">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Companies</h3>
              <p className="text-sm text-gray-500">
                {companiesTotal} compan{companiesTotal !== 1 ? "ies" : "y"} in this organization
              </p>
            </div>
            {companies.length > 0 && (
              <div className="flex items-center gap-3">
                <Link
                  to="/organizations/$organizationId/companies"
                  params={{ organizationId: organization.id }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View all
                </Link>
                <Button
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    navigate({
                      to: "/organizations/$organizationId/companies/new",
                      params: { organizationId: organization.id }
                    })
                  }}
                >
                  New Company
                </Button>
              </div>
            )}
          </div>

          {companies.length === 0 ? (
            <CompaniesEmptyState organizationId={organization.id} />
          ) : (
            <CompaniesList companies={companies} organizationId={organization.id} />
          )}
        </div>
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Edit Organization Modal Component
// =============================================================================

function EditOrganizationModal({
  organization,
  onClose
}: {
  readonly organization: Organization
  readonly onClose: () => void
}) {
  const router = useRouter()

  const [name, setName] = useState(organization.name)
  const [reportingCurrency, setReportingCurrency] = useState(organization.reportingCurrency)
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
      const { error: apiError } = await api.PUT("/api/v1/organizations/{id}", {
        params: { path: { id: organization.id } },
        body: {
          name: trimmedName,
          reportingCurrency,
          settings: null
        }
      })

      if (apiError) {
        let errorMessage = "Failed to update organization"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Revalidate to show updated data
      await router.invalidate()
      onClose()
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Organization</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label htmlFor="edit-org-name" className="block text-sm font-medium text-gray-700">
              Organization Name
            </label>
            <input
              id="edit-org-name"
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Currency Field */}
          <div>
            <label
              htmlFor="edit-org-currency"
              className="block text-sm font-medium text-gray-700"
            >
              Reporting Currency
            </label>
            <select
              id="edit-org-currency"
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
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="org-form-cancel-button"
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
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      opacity="0.25"
                    />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// Companies Empty State Component
// =============================================================================

function CompaniesEmptyState({ organizationId }: { readonly organizationId: string }) {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Building2 className="h-6 w-6 text-gray-400" />
      </div>
      <h4 className="mb-2 font-medium text-gray-900">No companies yet</h4>
      <p className="mb-4 text-sm text-gray-500">
        Create your first company to start managing accounts and journal entries.
      </p>
      <Button
        icon={<Plus className="h-4 w-4" />}
        onClick={() => {
          navigate({
            to: "/organizations/$organizationId/companies/new",
            params: { organizationId }
          })
        }}
      >
        Create Company
      </Button>
    </div>
  )
}

// =============================================================================
// Companies List Component
// =============================================================================

function CompaniesList({
  companies,
  organizationId
}: {
  readonly companies: readonly Company[]
  readonly organizationId: string
}) {
  return (
    <div className="divide-y divide-gray-200">
      {companies.map((company) => (
        <CompanyRow key={company.id} company={company} organizationId={organizationId} />
      ))}
    </div>
  )
}

// =============================================================================
// Company Row Component
// =============================================================================

function CompanyRow({
  company,
  organizationId
}: {
  readonly company: Company
  readonly organizationId: string
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h4 className="truncate font-medium text-gray-900">{company.name}</h4>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              company.isActive
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {company.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
          <span>{company.legalName}</span>
          <span className="text-gray-300">|</span>
          <span>{company.jurisdiction}</span>
          <span className="text-gray-300">|</span>
          <span>{company.functionalCurrency}</span>
        </div>
      </div>
      <Link
        to="/organizations/$organizationId/companies/$companyId"
        params={{ organizationId, companyId: company.id }}
        className="ml-4 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        View
      </Link>
    </div>
  )
}
