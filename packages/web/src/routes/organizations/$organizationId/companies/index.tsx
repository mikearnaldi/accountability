import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { CompanyHierarchyTree, type Company } from "@/components/company/CompanyHierarchyTree"
import { NoCompaniesEmptyState } from "@/components/ui/EmptyState"
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
// Types
// =============================================================================

type StatusFilter = "all" | "active" | "inactive"
type ConsolidationMethodType = "FullConsolidation" | "EquityMethod" | "CostMethod" | "VariableInterestEntity"

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

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

  return (
    <div className="min-h-screen bg-gray-50" data-testid="companies-list-page">
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500" data-testid="companies-count">
              {companiesTotal} compan{companiesTotal !== 1 ? "ies" : "y"} in {organization.name}
            </p>

            {/* Status Filter */}
            {companies.length > 0 && (
              <div className="flex items-center gap-2" data-testid="status-filter">
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

          <Button
            onClick={() => setShowCreateForm(true)}
            data-testid="create-company-button"
          >
            <svg
              className="mr-2 h-4 w-4"
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
          </Button>
        </div>

        {/* Create Company Modal */}
        {showCreateForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            data-testid="create-company-modal"
          >
            <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Create Company
              </h2>
              <CreateCompanyForm
                organizationId={params.organizationId}
                defaultCurrency={organization.reportingCurrency}
                existingCompanies={companies}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        )}

        {/* Companies List - Hierarchy Tree View */}
        {companies.length === 0 ? (
          <NoCompaniesEmptyState
            action={
              <Button onClick={() => setShowCreateForm(true)}>
                <svg
                  className="mr-2 h-5 w-5"
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
              </Button>
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
      </main>
    </div>
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

// =============================================================================
// Create Company Form Component
// =============================================================================

function CreateCompanyForm({
  organizationId,
  defaultCurrency,
  existingCompanies,
  onCancel
}: {
  readonly organizationId: string
  readonly defaultCurrency: string
  readonly existingCompanies: readonly Company[]
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
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(null)
  const [ownershipPercentage, setOwnershipPercentage] = useState<number | null>(null)
  const [consolidationMethod, setConsolidationMethod] = useState<ConsolidationMethodType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter existing companies for parent selection (only active companies)
  const availableParents = useMemo(
    () => existingCompanies.filter((c) => c.isActive),
    [existingCompanies]
  )

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

    // Validate subsidiary fields
    if (parentCompanyId !== null) {
      if (ownershipPercentage === null || ownershipPercentage <= 0 || ownershipPercentage > 100) {
        setError("Ownership percentage must be between 1 and 100 for subsidiaries")
        return
      }
      if (!consolidationMethod) {
        setError("Consolidation method is required for subsidiaries")
        return
      }
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
          parentCompanyId,
          ownershipPercentage,
          consolidationMethod
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

  // Auto-set consolidation method based on ownership percentage
  const handleOwnershipChange = (value: number | null) => {
    setOwnershipPercentage(value)
    if (value !== null) {
      if (value > 50) {
        setConsolidationMethod("FullConsolidation")
      } else if (value >= 20) {
        setConsolidationMethod("EquityMethod")
      } else {
        setConsolidationMethod("CostMethod")
      }
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

      {/* Parent Company Section (Hierarchy) */}
      {availableParents.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="mb-3 text-sm font-medium text-gray-900">
            Parent Company (Optional)
          </h4>

          {/* Parent Company Select */}
          <div>
            <label htmlFor="company-parent" className="block text-sm font-medium text-gray-700">
              Parent Company
            </label>
            <select
              id="company-parent"
              value={parentCompanyId ?? ""}
              onChange={(e) => {
                const value = e.target.value
                setParentCompanyId(value === "" ? null : value)
                if (value === "") {
                  setOwnershipPercentage(null)
                  setConsolidationMethod(null)
                }
              }}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              data-testid="company-parent-select"
            >
              <option value="">None (Top-level company)</option>
              {availableParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ownership and Consolidation (shown when parent selected) */}
          {parentCompanyId !== null && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="company-ownership" className="block text-sm font-medium text-gray-700">
                  Ownership %
                </label>
                <input
                  id="company-ownership"
                  type="number"
                  min="1"
                  max="100"
                  step="0.01"
                  value={ownershipPercentage ?? ""}
                  onChange={(e) => {
                    const value = e.target.value
                    handleOwnershipChange(value === "" ? null : Number(value))
                  }}
                  disabled={isSubmitting}
                  placeholder="e.g. 100"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  data-testid="company-ownership-input"
                />
              </div>
              <div>
                <label htmlFor="company-consolidation" className="block text-sm font-medium text-gray-700">
                  Consolidation Method
                </label>
                <select
                  id="company-consolidation"
                  value={consolidationMethod ?? ""}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === "") {
                      setConsolidationMethod(null)
                    } else if (
                      value === "FullConsolidation" ||
                      value === "EquityMethod" ||
                      value === "CostMethod" ||
                      value === "VariableInterestEntity"
                    ) {
                      setConsolidationMethod(value)
                    }
                  }}
                  disabled={isSubmitting}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  data-testid="company-consolidation-select"
                >
                  <option value="">Select method</option>
                  <option value="FullConsolidation">Full Consolidation (&gt;50%)</option>
                  <option value="EquityMethod">Equity Method (20-50%)</option>
                  <option value="CostMethod">Cost Method (&lt;20%)</option>
                  <option value="VariableInterestEntity">Variable Interest Entity</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

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

