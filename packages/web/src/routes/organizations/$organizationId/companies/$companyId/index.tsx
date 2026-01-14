import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState } from "react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"

// =============================================================================
// Server Functions: Fetch company from API with cookie auth
// =============================================================================

const fetchCompany = createServerFn({ method: "GET" })
  .inputValidator((data: { companyId: string; organizationId: string }) => data)
  .handler(async ({ data }) => {
    // Get the session cookie to forward to API
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { company: null, organization: null, error: "unauthorized" as const }
    }

    try {
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`
      // Fetch company and organization in parallel using api client with Bearer auth
      const [companyResult, orgResult] = await Promise.all([
        serverApi.GET("/api/v1/companies/{id}", {
          params: { path: { id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        // Check for NotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error && companyResult.error._tag === "NotFoundError") {
          return { company: null, organization: null, error: "not_found" as const }
        }
        return { company: null, organization: null, error: "failed" as const }
      }

      if (orgResult.error) {
        return { company: null, organization: null, error: "failed" as const }
      }

      return { company: companyResult.data, organization: orgResult.data, error: null }
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
// Company Details Page Component
// =============================================================================

function CompanyDetailsPage() {
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as {
    readonly id: string
    readonly name: string
  } | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const [isEditing, setIsEditing] = useState(false)

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
        <div className="space-y-8">
          {/* Company Details Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            {/* Company Header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                <p className="mt-1 text-gray-500">{company.legalName}</p>
                <p className="mt-1 text-sm text-gray-500">Created {createdDate}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                    company.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {company.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
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
                  {formatJurisdiction(company.jurisdiction)}
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

          {/* Edit Company Modal */}
          {isEditing && (
            <EditCompanyModal
              company={company}
              onClose={() => setIsEditing(false)}
            />
          )}

          {/* Navigation Links */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Company Data</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Chart of Accounts */}
              <NavigationCard
                to="/organizations/$organizationId/companies/$companyId/accounts"
                params={{
                  organizationId: params.organizationId,
                  companyId: params.companyId
                }}
                title="Chart of Accounts"
                description="Manage accounts and account hierarchy"
                icon={
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                }
                linkText="View Accounts"
              />

              {/* Journal Entries */}
              <NavigationCard
                title="Journal Entries"
                description="Create and manage journal entries"
                icon={
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
                linkText="View Entries"
              />

              {/* Reports */}
              <NavigationCard
                title="Reports"
                description="Financial statements and reports"
                icon={
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                }
                linkText="View Reports"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// =============================================================================
// Navigation Card Component
// =============================================================================

function NavigationCard({
  to,
  params,
  title,
  description,
  icon,
  linkText
}: {
  readonly to?: string
  readonly params?: { readonly organizationId: string; readonly companyId: string }
  readonly title: string
  readonly description: string
  readonly icon: React.ReactNode
  readonly linkText: string
}) {
  const content = (
    <>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        {icon}
      </div>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <p className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700">
        {linkText} &rarr;
      </p>
    </>
  )

  if (to && params) {
    return (
      <Link
        to={to}
        params={params}
        className="block rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md">
      {content}
    </div>
  )
}

// =============================================================================
// Edit Company Modal Component
// =============================================================================

function EditCompanyModal({
  company,
  onClose
}: {
  readonly company: Company
  readonly onClose: () => void
}) {
  const router = useRouter()

  const [name, setName] = useState(company.name)
  const [legalName, setLegalName] = useState(company.legalName)
  const [taxId, setTaxId] = useState(company.taxId ?? "")
  const [reportingCurrency, setReportingCurrency] = useState(company.reportingCurrency)
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(company.fiscalYearEnd.month)
  const [fiscalYearEndDay, setFiscalYearEndDay] = useState(company.fiscalYearEnd.day)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    // Validate name
    const trimmedName = name.trim()
    const trimmedLegalName = legalName.trim()
    const trimmedTaxId = taxId.trim()

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
      const { error: apiError } = await api.PUT("/api/v1/companies/{id}", {
        params: { path: { id: company.id } },
        body: {
          name: trimmedName,
          legalName: trimmedLegalName,
          taxId: trimmedTaxId || null,
          reportingCurrency,
          fiscalYearEnd: {
            month: fiscalYearEndMonth,
            day: fiscalYearEndDay
          },
          parentCompanyId: null,
          ownershipPercentage: null,
          consolidationMethod: null,
          isActive: null
        }
      })

      if (apiError) {
        let errorMessage = "Failed to update company"
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
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Company</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label htmlFor="edit-company-name" className="block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              id="edit-company-name"
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Legal Name Field */}
          <div>
            <label htmlFor="edit-company-legal-name" className="block text-sm font-medium text-gray-700">
              Legal Name
            </label>
            <input
              id="edit-company-legal-name"
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Tax ID Field */}
          <div>
            <label htmlFor="edit-company-tax-id" className="block text-sm font-medium text-gray-700">
              Tax ID (optional)
            </label>
            <input
              id="edit-company-tax-id"
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              disabled={isSubmitting}
              placeholder="EIN, VAT number, etc."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Reporting Currency Field */}
          <div>
            <label htmlFor="edit-company-currency" className="block text-sm font-medium text-gray-700">
              Reporting Currency
            </label>
            <select
              id="edit-company-currency"
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

          {/* Fiscal Year End */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-company-fy-month" className="block text-sm font-medium text-gray-700">
                Fiscal Year End Month
              </label>
              <select
                id="edit-company-fy-month"
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
              <label htmlFor="edit-company-fy-day" className="block text-sm font-medium text-gray-700">
                Fiscal Year End Day
              </label>
              <select
                id="edit-company-fy-day"
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
              onClick={onClose}
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
// Helper Functions
// =============================================================================

function formatFiscalYearEnd(fiscalYearEnd: { month: number; day: number }): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]
  return `${monthNames[fiscalYearEnd.month - 1]} ${fiscalYearEnd.day}`
}

const jurisdictionNames: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  CA: "Canada",
  AU: "Australia",
  CH: "Switzerland"
}

function formatJurisdiction(code: string): string {
  return jurisdictionNames[code] ?? code
}
