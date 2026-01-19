import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { api } from "@/api/client"
import type { paths } from "@/api/schema"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"
import { usePermissions } from "@/hooks/usePermissions"

// Type for CompanyType from the API schema
type CompanyType = NonNullable<paths["/api/v1/organizations/{organizationId}/companies/{id}"]["put"]["requestBody"]["content"]["application/json"]["companyType"]>

// Valid company types lookup for type-safe conversion
const VALID_COMPANY_TYPES: Record<string, CompanyType> = {
  Corporation: "Corporation",
  LLC: "LLC",
  Partnership: "Partnership",
  SoleProprietorship: "SoleProprietorship",
  NonProfit: "NonProfit",
  Cooperative: "Cooperative",
  Branch: "Branch",
  Other: "Other"
}

// =============================================================================
// Server Functions: Fetch company from API with cookie auth
// =============================================================================

const fetchCompanyData = createServerFn({ method: "GET" })
  .inputValidator((data: { companyId: string; organizationId: string }) => data)
  .handler(async ({ data }) => {
    // Get the session cookie to forward to API
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { company: null, organization: null, subsidiaries: [], parentCompany: null, allCompanies: [], error: "unauthorized" as const }
    }

    try {
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`
      // Fetch company, organization, and all companies in parallel
      const [companyResult, orgResult, allCompaniesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId: data.organizationId } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        // Check for domain-specific NotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error &&
            companyResult.error._tag === "CompanyNotFoundError") {
          return { company: null, organization: null, subsidiaries: [], parentCompany: null, allCompanies: [], error: "not_found" as const }
        }
        return { company: null, organization: null, subsidiaries: [], parentCompany: null, allCompanies: [], error: "failed" as const }
      }

      if (orgResult.error) {
        return { company: null, organization: null, subsidiaries: [], parentCompany: null, allCompanies: [], error: "failed" as const }
      }

      // Fetch subsidiaries (companies with this company as parent)
      const subsidiariesResult = await serverApi.GET("/api/v1/companies", {
        params: {
          query: {
            organizationId: data.organizationId,
            parentCompanyId: data.companyId
          }
        },
        headers: { Authorization }
      })

      // Fetch parent company if this company has a parent
      let parentCompany = null
      const company = companyResult.data
      if (company?.parentCompanyId) {
        const parentResult = await serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: company.parentCompanyId } },
          headers: { Authorization }
        })
        if (!parentResult.error) {
          parentCompany = parentResult.data
        }
      }

      return {
        company: companyResult.data,
        organization: orgResult.data,
        subsidiaries: subsidiariesResult.data?.companies ?? [],
        parentCompany,
        allCompanies: allCompaniesResult.data?.companies ?? [],
        error: null
      }
    } catch {
      return { company: null, organization: null, subsidiaries: [], parentCompany: null, allCompanies: [], error: "failed" as const }
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
    const result = await fetchCompanyData({
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
      organization: result.organization,
      subsidiaries: result.subsidiaries,
      parentCompany: result.parentCompany,
      allCompanies: result.allCompanies
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: CompanyDetailsPage
})

// =============================================================================
// Types (extracted from API response schema)
// =============================================================================

interface AddressData {
  readonly street1: string | null
  readonly street2: string | null
  readonly city: string | null
  readonly state: string | null
  readonly postalCode: string | null
  readonly country: string | null
}

interface Company {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly legalName: string
  readonly jurisdiction: string
  readonly taxId: string | null
  readonly incorporationDate: {
    readonly year: number
    readonly month: number
    readonly day: number
  } | null
  readonly registrationNumber: string | null
  readonly registeredAddress: AddressData | null
  readonly industryCode: string | null
  readonly companyType: string | null
  readonly incorporationJurisdiction: string | null
  readonly functionalCurrency: string
  readonly reportingCurrency: string
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
  readonly parentCompanyId: string | null
  readonly ownershipPercentage: number | null
  readonly isActive: boolean
  readonly createdAt: {
    readonly epochMillis: number
  }
}

// =============================================================================
// Company Details Page Component
// =============================================================================

function CompanyDetailsPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as {
    readonly id: string
    readonly name: string
    readonly reportingCurrency: string
  } | null
  const subsidiaries = loaderData.subsidiaries as readonly Company[]
  const parentCompany = loaderData.parentCompany as Company | null
  const allCompanies = loaderData.allCompanies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []
  const [isEditing, setIsEditing] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  // Permission checks for UI element visibility
  const { canPerform } = usePermissions()
  const canUpdateCompany = canPerform("company:update")
  const canDeleteCompany = canPerform("company:delete")

  // Map companies for sidebar
  const companiesForSidebar = useMemo(
    () => allCompanies.map((c) => ({ id: c.id, name: c.name })),
    [allCompanies]
  )

  if (!company || !organization) {
    return null
  }

  const fiscalYearEndDate = formatFiscalYearEnd(company.fiscalYearEnd)
  const createdDate = new Date(company.createdAt.epochMillis).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
  // Format incorporation date manually to avoid timezone issues
  // LocalDate stores {year, month, day} directly so we format without Date object
  const formatIncorporationDate = (date: { year: number; month: number; day: number } | null): string | null => {
    if (!date) return null
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    return `${months[date.month - 1]} ${date.day}, ${date.year}`
  }
  const incorporationDateFormatted = formatIncorporationDate(company.incorporationDate)

  // Determine hierarchy position
  const isParentCompany = subsidiaries.length > 0
  const isSubsidiary = !!company.parentCompanyId

  // Breadcrumb items
  const breadcrumbItems = [
    {
      label: "Companies",
      href: `/organizations/${params.organizationId}/companies`
    },
    {
      label: company.name,
      href: `/organizations/${params.organizationId}/companies/${params.companyId}`
    }
  ]

  // Handle activate/deactivate
  const handleToggleActive = async () => {
    if (isToggling) return
    setIsToggling(true)

    try {
      if (company.isActive) {
        // Deactivate using DELETE endpoint
        const { error } = await api.DELETE("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: params.organizationId, id: company.id } }
        })

        if (error) {
          let errorMessage = "Failed to deactivate company"
          if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
          alert(errorMessage)
          setIsToggling(false)
          return
        }
      } else {
        // Activate using PUT endpoint
        const { error } = await api.PUT("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: params.organizationId, id: company.id } },
          body: {
            isActive: true,
            name: null,
            legalName: null,
            taxId: null,
            incorporationDate: null,
            registrationNumber: null,
            registeredAddress: null,
            industryCode: null,
            companyType: null,
            incorporationJurisdiction: null,
            reportingCurrency: null,
            fiscalYearEnd: null,
            parentCompanyId: null,
            ownershipPercentage: null
          }
        })

        if (error) {
          let errorMessage = "Failed to activate company"
          if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
          alert(errorMessage)
          setIsToggling(false)
          return
        }
      }

      await router.invalidate()
      setIsToggling(false)
    } catch {
      alert("An unexpected error occurred")
      setIsToggling(false)
    }
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div className="space-y-6" data-testid="company-details-page">
          {/* Company Header Card with Name, Status Badge, and Jurisdiction */}
          <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="company-header-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900" data-testid="company-name">{company.name}</h1>
                  <span
                    data-testid="company-status-badge"
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                      company.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {company.isActive ? "Active" : "Inactive"}
                  </span>
                  <span
                    data-testid="company-jurisdiction-badge"
                    className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                  >
                    {formatJurisdiction(company.jurisdiction)}
                  </span>
                </div>
                <p className="mt-1 text-gray-500" data-testid="company-legal-name">{company.legalName}</p>
                <p className="mt-1 text-sm text-gray-500">Created {createdDate}</p>
              </div>
              <div className="flex items-center gap-3">
                {canUpdateCompany && (
                  <button
                    onClick={() => setIsEditing(true)}
                    data-testid="edit-company-button"
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                )}
                {canDeleteCompany && (
                  <button
                    onClick={handleToggleActive}
                    disabled={isToggling}
                    data-testid="toggle-active-button"
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      company.isActive
                        ? "border border-red-300 bg-white text-red-700 hover:bg-red-50"
                        : "border border-green-300 bg-white text-green-700 hover:bg-green-50"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {isToggling ? "..." : company.isActive ? "Deactivate" : "Activate"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Info Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Currencies Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="currencies-card">
              <h3 className="text-sm font-medium text-gray-500">Currencies</h3>
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-xs text-gray-400">Functional</span>
                  <p className="text-lg font-semibold text-gray-900" data-testid="functional-currency">
                    {company.functionalCurrency}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Reporting</span>
                  <p className="text-lg font-semibold text-gray-900" data-testid="reporting-currency">
                    {company.reportingCurrency}
                  </p>
                </div>
              </div>
            </div>

            {/* Fiscal Year Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="fiscal-year-card">
              <h3 className="text-sm font-medium text-gray-500">Fiscal Year End</h3>
              <p className="mt-2 text-lg font-semibold text-gray-900" data-testid="fiscal-year-end">
                {fiscalYearEndDate}
              </p>
              {company.taxId && (
                <div className="mt-2">
                  <span className="text-xs text-gray-400">Tax ID</span>
                  <p className="font-mono text-sm text-gray-600" data-testid="company-tax-id">{company.taxId}</p>
                </div>
              )}
              {incorporationDateFormatted && (
                <div className="mt-2">
                  <span className="text-xs text-gray-400">Incorporated</span>
                  <p className="text-sm text-gray-600" data-testid="company-incorporation-date">{incorporationDateFormatted}</p>
                </div>
              )}
              {company.registrationNumber && (
                <div className="mt-2">
                  <span className="text-xs text-gray-400">Registration Number</span>
                  <p className="font-mono text-sm text-gray-600" data-testid="company-registration-number">{company.registrationNumber}</p>
                </div>
              )}
            </div>

            {/* Hierarchy Position Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="hierarchy-card">
              <h3 className="text-sm font-medium text-gray-500">Hierarchy Position</h3>
              <div className="mt-2">
                {isParentCompany && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                      Parent
                    </span>
                    <span className="text-sm text-gray-600" data-testid="subsidiaries-count">
                      {subsidiaries.length} subsidiar{subsidiaries.length !== 1 ? "ies" : "y"}
                    </span>
                  </div>
                )}
                {isSubsidiary && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Subsidiary
                    </span>
                    {company.ownershipPercentage !== null && (
                      <span className="text-sm text-gray-600" data-testid="ownership-percentage">
                        {company.ownershipPercentage}% owned
                      </span>
                    )}
                  </div>
                )}
                {!isParentCompany && !isSubsidiary && (
                  <p className="text-sm text-gray-600">Standalone company</p>
                )}
              </div>
            </div>

            {/* Company ID Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid="company-id-card">
              <h3 className="text-sm font-medium text-gray-500">Company ID</h3>
              <p className="mt-2 font-mono text-xs text-gray-600 break-all" data-testid="company-id">
                {company.id}
              </p>
            </div>
          </div>

          {/* Parent Company Section - shown if subsidiary */}
          {isSubsidiary && parentCompany && (
            <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="parent-company-section">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Parent Company</h2>
              <Link
                to="/organizations/$organizationId/companies/$companyId"
                params={{
                  organizationId: params.organizationId,
                  companyId: parentCompany.id
                }}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                data-testid="parent-company-link"
              >
                <div>
                  <p className="font-medium text-gray-900">{parentCompany.name}</p>
                  <p className="text-sm text-gray-500">{parentCompany.legalName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900" data-testid="parent-ownership">
                    {company.ownershipPercentage}% ownership
                  </p>
                </div>
              </Link>

              {/* Consolidation Settings Notice */}
              <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3" data-testid="consolidation-notice">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Note:</span> Acquisition date and consolidation method are configured in{" "}
                  <Link
                    to="/organizations/$organizationId/consolidation"
                    params={{ organizationId: params.organizationId }}
                    className="font-medium underline hover:text-blue-800"
                    data-testid="consolidation-link"
                  >
                    Consolidation Groups
                  </Link>
                  , not on the company itself.
                </p>
              </div>
            </div>
          )}

          {/* Subsidiaries Section - shown if parent company */}
          {isParentCompany && (
            <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="subsidiaries-section">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Subsidiaries ({subsidiaries.length})
              </h2>
              <div className="space-y-3">
                {subsidiaries.map((subsidiary) => (
                  <Link
                    key={subsidiary.id}
                    to="/organizations/$organizationId/companies/$companyId"
                    params={{
                      organizationId: params.organizationId,
                      companyId: subsidiary.id
                    }}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                    data-testid={`subsidiary-${subsidiary.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{subsidiary.name}</p>
                        <p className="text-sm text-gray-500">{formatJurisdiction(subsidiary.jurisdiction)}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          subsidiary.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {subsidiary.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {subsidiary.ownershipPercentage}%
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Edit Company Modal */}
          {isEditing && (
            <EditCompanyModal
              company={company}
              organizationId={params.organizationId}
              onClose={() => setIsEditing(false)}
            />
          )}

          {/* Quick Links Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="quick-links-section">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Company Data</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Chart of Accounts */}
              <NavigationCard
                to="/organizations/$organizationId/companies/$companyId/accounts"
                params={{
                  organizationId: params.organizationId,
                  companyId: params.companyId
                }}
                title="Chart of Accounts"
                description="Manage accounts and account hierarchy"
                testId="nav-accounts"
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
                to="/organizations/$organizationId/companies/$companyId/journal-entries"
                params={{
                  organizationId: params.organizationId,
                  companyId: params.companyId
                }}
                title="Journal Entries"
                description="Create and manage journal entries"
                testId="nav-journal-entries"
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
                to="/organizations/$organizationId/companies/$companyId/reports"
                params={{
                  organizationId: params.organizationId,
                  companyId: params.companyId
                }}
                title="Reports"
                description="Financial statements and reports"
                testId="nav-reports"
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

              {/* Fiscal Periods */}
              <NavigationCard
                to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
                params={{
                  organizationId: params.organizationId,
                  companyId: params.companyId
                }}
                title="Fiscal Periods"
                description="Manage fiscal years and periods"
                testId="nav-fiscal-periods"
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                }
                linkText="Manage Periods"
              />
            </div>
          </div>
        </div>
    </AppLayout>
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
  linkText,
  testId
}: {
  readonly to?: string
  readonly params?: { readonly organizationId: string; readonly companyId: string }
  readonly title: string
  readonly description: string
  readonly icon: React.ReactNode
  readonly linkText: string
  readonly testId?: string
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
        data-testid={testId}
      >
        {content}
      </Link>
    )
  }

  return (
    <div
      className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
      data-testid={testId}
    >
      {content}
    </div>
  )
}

// =============================================================================
// Edit Company Modal Component
// =============================================================================

function EditCompanyModal({
  company,
  organizationId,
  onClose
}: {
  readonly company: Company
  readonly organizationId: string
  readonly onClose: () => void
}) {
  const router = useRouter()

  const [name, setName] = useState(company.name)
  const [legalName, setLegalName] = useState(company.legalName)
  const [taxId, setTaxId] = useState(company.taxId ?? "")
  const [registrationNumber, setRegistrationNumber] = useState(company.registrationNumber ?? "")
  const [industryCode, setIndustryCode] = useState(company.industryCode ?? "")
  const [companyType, setCompanyType] = useState(company.companyType ?? "")
  const [addressStreet1, setAddressStreet1] = useState(company.registeredAddress?.street1 ?? "")
  const [addressStreet2, setAddressStreet2] = useState(company.registeredAddress?.street2 ?? "")
  const [addressCity, setAddressCity] = useState(company.registeredAddress?.city ?? "")
  const [addressState, setAddressState] = useState(company.registeredAddress?.state ?? "")
  const [addressPostalCode, setAddressPostalCode] = useState(company.registeredAddress?.postalCode ?? "")
  const [addressCountry, setAddressCountry] = useState(company.registeredAddress?.country ?? "")
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
    const trimmedRegistrationNumber = registrationNumber.trim()
    const trimmedIndustryCode = industryCode.trim()

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

    // Build registered address if any fields are filled
    const hasAddressData = addressStreet1.trim() || addressStreet2.trim() ||
      addressCity.trim() || addressState.trim() ||
      addressPostalCode.trim() || addressCountry.trim()

    const registeredAddress = hasAddressData
      ? {
          street1: addressStreet1.trim() || null,
          street2: addressStreet2.trim() || null,
          city: addressCity.trim() || null,
          state: addressState.trim() || null,
          postalCode: addressPostalCode.trim() || null,
          country: addressCountry.trim() || null
        }
      : null

    try {
      const { error: apiError } = await api.PUT("/api/v1/organizations/{organizationId}/companies/{id}", {
        params: { path: { organizationId, id: company.id } },
        body: {
          name: trimmedName,
          legalName: trimmedLegalName,
          taxId: trimmedTaxId || null,
          incorporationDate: null,
          registrationNumber: trimmedRegistrationNumber || null,
          registeredAddress,
          industryCode: trimmedIndustryCode || null,
          companyType: VALID_COMPANY_TYPES[companyType] ?? null,
          incorporationJurisdiction: null,
          reportingCurrency,
          fiscalYearEnd: {
            month: fiscalYearEndMonth,
            day: fiscalYearEndDay
          },
          parentCompanyId: null,
          ownershipPercentage: null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="edit-company-modal">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Edit Company</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3" data-testid="edit-company-error">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Name Field */}
          <Input
            id="edit-company-name"
            label="Company Name"
            type="text"
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            data-testid="edit-company-name-input"
          />

          {/* Legal Name Field */}
          <Input
            id="edit-company-legal-name"
            label="Legal Name"
            type="text"
            required
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            disabled={isSubmitting}
            data-testid="edit-company-legal-name-input"
          />

          {/* Tax ID Field */}
          <Input
            id="edit-company-tax-id"
            label="Tax ID (optional)"
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            disabled={isSubmitting}
            placeholder="EIN, VAT number, etc."
            data-testid="edit-company-tax-id-input"
          />

          {/* Registration Number Field */}
          <Input
            id="edit-company-registration-number"
            label="Registration Number (optional)"
            type="text"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            disabled={isSubmitting}
            placeholder="Company registration number"
            data-testid="edit-company-registration-number-input"
          />

          {/* Company Type Field */}
          <Select
            id="edit-company-type"
            label="Company Type (optional)"
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value)}
            disabled={isSubmitting}
            data-testid="edit-company-type-select"
          >
            <option value="">Select type...</option>
            <option value="Corporation">Corporation</option>
            <option value="LLC">Limited Liability Company (LLC)</option>
            <option value="Partnership">Partnership</option>
            <option value="SoleProprietorship">Sole Proprietorship</option>
            <option value="NonProfit">Non-Profit Organization</option>
            <option value="Cooperative">Cooperative</option>
            <option value="Branch">Branch Office</option>
            <option value="Other">Other</option>
          </Select>

          {/* Industry Code Field */}
          <Input
            id="edit-company-industry-code"
            label="Industry Code (optional)"
            type="text"
            value={industryCode}
            onChange={(e) => setIndustryCode(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. 541512 (NAICS)"
            data-testid="edit-company-industry-code-input"
          />

          {/* Registered Address Section */}
          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700">Registered Address (optional)</h3>

            <Input
              id="edit-address-street1"
              label="Street Address"
              type="text"
              value={addressStreet1}
              onChange={(e) => setAddressStreet1(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. 123 Main Street"
              data-testid="edit-address-street1-input"
            />

            <Input
              id="edit-address-street2"
              label="Address Line 2"
              type="text"
              value={addressStreet2}
              onChange={(e) => setAddressStreet2(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Suite 100"
              data-testid="edit-address-street2-input"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="edit-address-city"
                label="City"
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. San Francisco"
                data-testid="edit-address-city-input"
              />

              <Input
                id="edit-address-state"
                label="State/Province"
                type="text"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. California"
                data-testid="edit-address-state-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="edit-address-postal"
                label="Postal Code"
                type="text"
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. 94102"
                data-testid="edit-address-postal-input"
              />

              <Input
                id="edit-address-country"
                label="Country"
                type="text"
                value={addressCountry}
                onChange={(e) => setAddressCountry(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. United States"
                data-testid="edit-address-country-input"
              />
            </div>
          </div>

          {/* Functional Currency Field (Read-only - ASC 830) */}
          <Input
            id="edit-company-functional-currency"
            label="Functional Currency"
            type="text"
            value={company.functionalCurrency}
            disabled
            helperText="Functional currency cannot be changed after creation (ASC 830)"
            data-testid="edit-company-functional-currency-input"
          />

          {/* Reporting Currency Field */}
          <Select
            id="edit-company-currency"
            label="Reporting Currency"
            value={reportingCurrency}
            onChange={(e) => setReportingCurrency(e.target.value)}
            disabled={isSubmitting}
            data-testid="edit-company-currency-select"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="JPY">JPY - Japanese Yen</option>
            <option value="CHF">CHF - Swiss Franc</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
          </Select>

          {/* Fiscal Year End */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="edit-company-fy-month"
              label="Fiscal Year End Month"
              value={fiscalYearEndMonth}
              onChange={(e) => setFiscalYearEndMonth(Number(e.target.value))}
              disabled={isSubmitting}
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
            </Select>
            <Select
              id="edit-company-fy-day"
              label="Fiscal Year End Day"
              value={fiscalYearEndDay}
              onChange={(e) => setFiscalYearEndDay(Number(e.target.value))}
              disabled={isSubmitting}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </Select>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
              data-testid="company-form-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="flex-1"
            >
              Save Changes
            </Button>
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
