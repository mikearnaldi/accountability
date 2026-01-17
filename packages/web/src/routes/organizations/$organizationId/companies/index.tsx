import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { Plus } from "lucide-react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { CompanyHierarchyTree, type Company } from "@/components/company/CompanyHierarchyTree"
import { CompanyForm, type CompanyFormData, type CurrencyOption } from "@/components/forms/CompanyForm"
import type { JurisdictionOption } from "@/components/ui/JurisdictionSelect"
import { NoCompaniesEmptyState } from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/Button"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"

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

const fetchCurrencies = createServerFn({ method: "GET" }).handler(async () => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return { currencies: [], error: "unauthorized" as const }
  }

  try {
    const serverApi = createServerApi()
    const { data, error } = await serverApi.GET("/api/v1/currencies", {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (error || !data) {
      return { currencies: [], error: "failed" as const }
    }

    return { currencies: data.currencies, error: null }
  } catch {
    return { currencies: [], error: "failed" as const }
  }
})

const fetchJurisdictions = createServerFn({ method: "GET" }).handler(async () => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return { jurisdictions: [], error: "unauthorized" as const }
  }

  try {
    const serverApi = createServerApi()
    const { data, error } = await serverApi.GET("/api/v1/jurisdictions", {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (error || !data) {
      return { jurisdictions: [], error: "failed" as const }
    }

    return { jurisdictions: data.jurisdictions, error: null }
  } catch {
    return { jurisdictions: [], error: "failed" as const }
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
    // Fetch organization, companies, currencies, and jurisdictions in parallel
    const [orgResult, companiesResult, currenciesResult, jurisdictionsResult] = await Promise.all([
      fetchOrganization({ data: params.organizationId }),
      fetchCompanies({ data: params.organizationId }),
      fetchCurrencies(),
      fetchJurisdictions()
    ])

    if (orgResult.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: orgResult.organization,
      companies: companiesResult.companies,
      companiesTotal: companiesResult.total,
      currencies: currenciesResult.currencies,
      jurisdictions: jurisdictionsResult.jurisdictions
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
  const currencies = loaderData.currencies as readonly CurrencyOption[]
  const jurisdictions = loaderData.jurisdictions as readonly JurisdictionOption[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

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

  // Map companies to parent options (only active companies, name and id)
  const existingCompaniesForParent = useMemo(
    () =>
      companies
        .filter((c) => c.isActive)
        .map((c) => ({ id: c.id, name: c.name })),
    [companies]
  )

  // Handle company form submission
  const handleCreateCompany = async (formData: CompanyFormData) => {
    setIsSubmitting(true)
    setApiError(null)

    // Convert ISO date string to LocalDate object for API
    let incorporationDate: { year: number; month: number; day: number } | null = null
    if (formData.incorporationDate) {
      const [year, month, day] = formData.incorporationDate.split("-").map(Number)
      incorporationDate = { year, month, day }
    }

    try {
      const { error } = await api.POST("/api/v1/companies", {
        body: {
          organizationId: params.organizationId,
          name: formData.name,
          legalName: formData.legalName,
          jurisdiction: formData.jurisdiction,
          taxId: formData.taxId,
          incorporationDate,
          registrationNumber: formData.registrationNumber,
          functionalCurrency: formData.functionalCurrency,
          reportingCurrency: formData.reportingCurrency,
          fiscalYearEnd: formData.fiscalYearEnd,
          parentCompanyId: formData.parentCompanyId,
          ownershipPercentage: formData.ownershipPercentage
        }
      })

      if (error) {
        let errorMessage = "Failed to create company"
        if (typeof error === "object" && error !== null) {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
        }
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Revalidate to show new company in list
      await router.invalidate()

      // Close form after successful creation
      setShowCreateForm(false)
      setIsSubmitting(false)
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleCancelForm = () => {
    setShowCreateForm(false)
    setApiError(null)
  }

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

            <Button
              onClick={() => setShowCreateForm(true)}
              icon={<Plus className="h-4 w-4" />}
              data-testid="create-company-button"
            >
              New Company
            </Button>
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

        {/* Create Company Modal */}
        {showCreateForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            data-testid="create-company-modal"
          >
            <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Create Company
              </h2>
              <CompanyForm
                currencies={currencies}
                jurisdictions={jurisdictions}
                existingCompanies={existingCompaniesForParent}
                defaultCurrency={organization.reportingCurrency}
                onSubmit={handleCreateCompany}
                onCancel={handleCancelForm}
                apiError={apiError}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* Companies List - Hierarchy Tree View */}
        {companies.length === 0 ? (
          <NoCompaniesEmptyState
            action={
              <Button
                onClick={() => setShowCreateForm(true)}
                icon={<Plus className="h-5 w-5" />}
              >
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
