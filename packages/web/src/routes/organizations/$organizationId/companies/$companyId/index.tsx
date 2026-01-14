import { createFileRoute, redirect, Link } from "@tanstack/react-router"
// eslint-disable-next-line local/no-server-functions -- Required for SSR: need server-side access to httpOnly cookies
import { createServerFn } from "@tanstack/react-start"
import { getCookie, getRequestUrl } from "@tanstack/react-start/server"

// =============================================================================
// Server Functions: Fetch company from API with cookie auth
// =============================================================================

// eslint-disable-next-line local/no-server-functions -- Required for SSR: TanStack Start server functions are the only way to access httpOnly cookies during SSR
const fetchCompany = createServerFn({ method: "GET" })
  .inputValidator((data: { companyId: string; organizationId: string }) => data)
  .handler(async ({ data }) => {
    // Get the session token from the httpOnly cookie
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { company: null, organization: null, error: "unauthorized" as const }
    }

    try {
      // Get the current request URL to determine the correct host/port for API calls
      const requestUrl = getRequestUrl()
      const apiBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`

      // Fetch company and organization in parallel
      /* eslint-disable local/no-direct-fetch -- Required for SSR: must use native fetch with dynamic baseUrl from request context */
      const [companyResponse, orgResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/companies/${data.companyId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` }
        }),
        fetch(`${apiBaseUrl}/api/v1/organizations/${data.organizationId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` }
        })
      ])
      /* eslint-enable local/no-direct-fetch */

      if (!companyResponse.ok) {
        if (companyResponse.status === 404) {
          return { company: null, organization: null, error: "not_found" as const }
        }
        return { company: null, organization: null, error: "failed" as const }
      }

      if (!orgResponse.ok) {
        return { company: null, organization: null, error: "failed" as const }
      }

      const company = await companyResponse.json()
      const organization = await orgResponse.json()

      return { company, organization, error: null }
    } catch {
      return { company: null, organization: null, error: "failed" as const }
    }
  })

// =============================================================================
// Company Details Route
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/companies/$companyId/")({
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
    const result = await fetchCompany({
      data: {
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Company not found")
    }

    return {
      company: result.company,
      organization: result.organization
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
  component: CompanyDetailsPage
})

// =============================================================================
// Company Details Page Component
// =============================================================================

function CompanyDetailsPage() {
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const company = loaderData.company as {
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
  } | null
  const organization = loaderData.organization as {
    readonly id: string
    readonly name: string
  } | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()

  if (!company || !organization) {
    return null
  }

  const fiscalYearEndDate = formatFiscalYearEnd(company.fiscalYearEnd)
  const createdDate = new Date(company.createdAt.epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })

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
            <Link
              to="/organizations/$organizationId/companies"
              params={{ organizationId: params.organizationId }}
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              Companies
            </Link>
            <span className="text-gray-400">/</span>
            <h1 className="text-xl font-semibold text-gray-900">{company.name}</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {/* Company Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <p className="mt-1 text-gray-500">{company.legalName}</p>
              <p className="mt-1 text-sm text-gray-500">Created {createdDate}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                company.isActive
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {company.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Company Details Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Functional Currency</dt>
              <dd className="mt-1 text-lg font-medium text-gray-900">
                {company.functionalCurrency}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Reporting Currency</dt>
              <dd className="mt-1 text-lg font-medium text-gray-900">
                {company.reportingCurrency}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Fiscal Year End</dt>
              <dd className="mt-1 text-lg font-medium text-gray-900">
                {fiscalYearEndDate}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Jurisdiction</dt>
              <dd className="mt-1 text-lg font-medium text-gray-900">
                {company.jurisdiction}
              </dd>
            </div>
            {company.taxId && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Tax ID</dt>
                <dd className="mt-1 font-mono text-sm text-gray-900">
                  {company.taxId}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Company ID</dt>
              <dd className="mt-1 font-mono text-sm text-gray-600">{company.id}</dd>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatFiscalYearEnd(fiscalYearEnd: { month: number; day: number }): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]
  return `${monthNames[fiscalYearEnd.month - 1]} ${fiscalYearEnd.day}`
}
