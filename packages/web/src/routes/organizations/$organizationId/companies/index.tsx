import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
// eslint-disable-next-line local/no-server-functions -- Required for SSR: need server-side access to httpOnly cookies
import { createServerFn } from "@tanstack/react-start"
import { getCookie, getRequestUrl } from "@tanstack/react-start/server"
import { useState } from "react"
import { api } from "@/api/interceptor"

// =============================================================================
// Server Functions: Fetch organization and companies from API with cookie auth
// =============================================================================

// eslint-disable-next-line local/no-server-functions -- Required for SSR: TanStack Start server functions are the only way to access httpOnly cookies during SSR
const fetchOrganization = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    // Get the session token from the httpOnly cookie
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, error: "unauthorized" as const }
    }

    try {
      // Get the current request URL to determine the correct host/port for API calls
      const requestUrl = getRequestUrl()
      const apiBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`

      // Call the API with the session token as Bearer auth
      // eslint-disable-next-line local/no-direct-fetch -- Required for SSR: must use native fetch with dynamic baseUrl from request context
      const response = await fetch(`${apiBaseUrl}/api/v1/organizations/${organizationId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      })

      if (!response.ok) {
        if (response.status === 404) {
          return { organization: null, error: "not_found" as const }
        }
        return { organization: null, error: "failed" as const }
      }

      const data = await response.json()
      return { organization: data, error: null }
    } catch {
      return { organization: null, error: "failed" as const }
    }
  })

// eslint-disable-next-line local/no-server-functions -- Required for SSR: TanStack Start server functions are the only way to access httpOnly cookies during SSR
const fetchCompanies = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    // Get the session token from the httpOnly cookie
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { companies: [], total: 0, error: "unauthorized" as const }
    }

    try {
      // Get the current request URL to determine the correct host/port for API calls
      const requestUrl = getRequestUrl()
      const apiBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`

      // Call the API with the session token as Bearer auth
      // eslint-disable-next-line local/no-direct-fetch -- Required for SSR: must use native fetch with dynamic baseUrl from request context
      const response = await fetch(
        `${apiBaseUrl}/api/v1/companies?organizationId=${encodeURIComponent(organizationId)}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` }
        }
      )

      if (!response.ok) {
        return { companies: [], total: 0, error: "failed" as const }
      }

      const data = await response.json()
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
  component: CompaniesListPage
})

// =============================================================================
// Types (extracted from API response schema)
// =============================================================================

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
  readonly parentCompanyId: string | null
  readonly ownershipPercentage: number | null
  readonly consolidationMethod: string | null
  readonly isActive: boolean
  readonly createdAt: {
    readonly epochMillis: number
  }
}

// =============================================================================
// Companies List Page Component
// =============================================================================

function CompaniesListPage() {
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
  const [showCreateForm, setShowCreateForm] = useState(false)

  if (!organization) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <span className="text-gray-400">/</span>
            <Link
              to="/organizations/$organizationId"
              params={{ organizationId: params.organizationId }}
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              {organization.name}
            </Link>
            <span className="text-gray-400">/</span>
            <h1 className="text-xl font-semibold text-gray-900">Companies</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Actions Bar */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {companiesTotal} compan{companiesTotal !== 1 ? "ies" : "y"} in {organization.name}
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
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
            New Company
          </button>
        </div>

        {/* Create Company Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Create Company
              </h2>
              <CreateCompanyForm
                organizationId={params.organizationId}
                defaultCurrency={organization.reportingCurrency}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        )}

        {/* Companies List */}
        {companies.length === 0 ? (
          <CompaniesEmptyState onCreateClick={() => setShowCreateForm(true)} />
        ) : (
          <CompaniesGrid companies={companies} organizationId={params.organizationId} />
        )}
      </main>
    </div>
  )
}

// =============================================================================
// Companies Empty State Component
// =============================================================================

function CompaniesEmptyState({ onCreateClick }: { readonly onCreateClick: () => void }) {
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
      <h3 className="mb-2 text-lg font-medium text-gray-900">No companies</h3>
      <p className="mb-6 text-gray-500">
        Get started by creating your first company in this organization.
      </p>
      <button
        onClick={onCreateClick}
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
        Create Company
      </button>
    </div>
  )
}

// =============================================================================
// Companies Grid Component
// =============================================================================

function CompaniesGrid({
  companies,
  organizationId
}: {
  readonly companies: readonly Company[]
  readonly organizationId: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard
          key={company.id}
          company={company}
          organizationId={organizationId}
        />
      ))}
    </div>
  )
}

// =============================================================================
// Company Card Component
// =============================================================================

function CompanyCard({
  company,
  organizationId
}: {
  readonly company: Company
  readonly organizationId: string
}) {
  const fiscalYearEndDate = formatFiscalYearEnd(company.fiscalYearEnd)

  return (
    <Link
      to="/organizations/$organizationId/companies/$companyId"
      params={{ organizationId, companyId: company.id }}
      className="block rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-gray-900">{company.name}</h3>
          <p className="mt-1 truncate text-sm text-gray-500">{company.legalName}</p>
        </div>
        <span
          className={`ml-2 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            company.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {company.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Currency</span>
          <span className="font-medium text-gray-900">{company.functionalCurrency}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Fiscal Year End</span>
          <span className="font-medium text-gray-900">{fiscalYearEndDate}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Jurisdiction</span>
          <span className="font-medium text-gray-900">{company.jurisdiction}</span>
        </div>
      </div>
    </Link>
  )
}

// =============================================================================
// Create Company Form Component
// =============================================================================

function CreateCompanyForm({
  organizationId,
  defaultCurrency,
  onCancel
}: {
  readonly organizationId: string
  readonly defaultCurrency: string
  readonly onCancel: () => void
}) {
  const router = useRouter()

  const [name, setName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [jurisdiction, setJurisdiction] = useState("US")
  const [functionalCurrency, setFunctionalCurrency] = useState(defaultCurrency)
  const [reportingCurrency, setReportingCurrency] = useState(defaultCurrency)
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(12)
  const [fiscalYearEndDay, setFiscalYearEndDay] = useState(31)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    // Validate required fields
    const trimmedName = name.trim()
    const trimmedLegalName = legalName.trim()

    if (!trimmedName) {
      setError("Company name is required")
      return
    }
    if (!trimmedLegalName) {
      setError("Legal name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: apiError } = await api.POST("/api/v1/companies", {
        body: {
          organizationId,
          name: trimmedName,
          legalName: trimmedLegalName,
          jurisdiction,
          functionalCurrency,
          reportingCurrency,
          fiscalYearEnd: {
            month: fiscalYearEndMonth,
            day: fiscalYearEndDay
          },
          taxId: null,
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null
        }
      })

      if (apiError) {
        // Extract error message
        let errorMessage = "Failed to create company"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Revalidate to show new company in list
      await router.invalidate()

      // Close form after successful creation
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
        <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">
          Company Name
        </label>
        <input
          id="company-name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
          placeholder="Acme Corporation"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* Legal Name Field */}
      <div>
        <label htmlFor="company-legal-name" className="block text-sm font-medium text-gray-700">
          Legal Name
        </label>
        <input
          id="company-legal-name"
          type="text"
          required
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          disabled={isSubmitting}
          placeholder="Acme Corporation, Inc."
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {/* Jurisdiction Field */}
      <div>
        <label htmlFor="company-jurisdiction" className="block text-sm font-medium text-gray-700">
          Jurisdiction
        </label>
        <select
          id="company-jurisdiction"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          disabled={isSubmitting}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        >
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="DE">Germany</option>
          <option value="FR">France</option>
          <option value="JP">Japan</option>
          <option value="CA">Canada</option>
          <option value="AU">Australia</option>
          <option value="CH">Switzerland</option>
        </select>
      </div>

      {/* Currency Fields - Two columns */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="company-functional-currency" className="block text-sm font-medium text-gray-700">
            Functional Currency
          </label>
          <select
            id="company-functional-currency"
            value={functionalCurrency}
            onChange={(e) => setFunctionalCurrency(e.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="CHF">CHF</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>
        <div>
          <label htmlFor="company-reporting-currency" className="block text-sm font-medium text-gray-700">
            Reporting Currency
          </label>
          <select
            id="company-reporting-currency"
            value={reportingCurrency}
            onChange={(e) => setReportingCurrency(e.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
            <option value="CHF">CHF</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>
      </div>

      {/* Fiscal Year End */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="company-fy-month" className="block text-sm font-medium text-gray-700">
            Fiscal Year End Month
          </label>
          <select
            id="company-fy-month"
            value={fiscalYearEndMonth}
            onChange={(e) => setFiscalYearEndMonth(Number(e.target.value))}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value={1}>January</option>
            <option value={2}>February</option>
            <option value={3}>March</option>
            <option value={4}>April</option>
            <option value={5}>May</option>
            <option value={6}>June</option>
            <option value={7}>July</option>
            <option value={8}>August</option>
            <option value={9}>September</option>
            <option value={10}>October</option>
            <option value={11}>November</option>
            <option value={12}>December</option>
          </select>
        </div>
        <div>
          <label htmlFor="company-fy-day" className="block text-sm font-medium text-gray-700">
            Fiscal Year End Day
          </label>
          <select
            id="company-fy-day"
            value={fiscalYearEndDay}
            onChange={(e) => setFiscalYearEndDay(Number(e.target.value))}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
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
            "Create Company"
          )}
        </button>
      </div>
    </form>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatFiscalYearEnd(fiscalYearEnd: { month: number; day: number }): string {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ]
  return `${monthNames[fiscalYearEnd.month - 1]} ${fiscalYearEnd.day}`
}
