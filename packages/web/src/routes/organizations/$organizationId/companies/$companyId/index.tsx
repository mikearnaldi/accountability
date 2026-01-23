import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import {
  CreditCard,
  FileText,
  Calendar,
  BarChart3,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { api } from "@/api/client"
import type { paths } from "@/api/schema"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"
import { usePermissions } from "@/hooks/usePermissions"
import { InfoRow } from "@/components/company/CompanyInfoCard"
import { QuickActionLink } from "@/components/company/QuickActionLink"

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

// Company type display names
const COMPANY_TYPE_LABELS: Record<string, string> = {
  Corporation: "Corporation",
  LLC: "Limited Liability Company (LLC)",
  Partnership: "Partnership",
  SoleProprietorship: "Sole Proprietorship",
  NonProfit: "Non-Profit Organization",
  Cooperative: "Cooperative",
  Branch: "Branch Office",
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
      return { company: null, organization: null, allCompanies: [], accounts: [], journalEntryCount: 0, error: "unauthorized" as const }
    }

    try {
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`
      // Fetch company, organization, all companies, accounts, and journal entries count in parallel
      const [companyResult, orgResult, allCompaniesResult, accountsResult, journalEntriesResult] = await Promise.all([
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
        }),
        serverApi.GET("/api/v1/accounts", {
          params: { query: { organizationId: data.organizationId, companyId: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/journal-entries", {
          params: {
            query: {
              organizationId: data.organizationId,
              companyId: data.companyId,
              limit: "1",
              offset: "0"
            }
          },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        // Check for domain-specific NotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error &&
            companyResult.error._tag === "CompanyNotFoundError") {
          return { company: null, organization: null, allCompanies: [], accounts: [], journalEntryCount: 0, error: "not_found" as const }
        }
        return { company: null, organization: null, allCompanies: [], accounts: [], journalEntryCount: 0, error: "failed" as const }
      }

      if (orgResult.error) {
        return { company: null, organization: null, allCompanies: [], accounts: [], journalEntryCount: 0, error: "failed" as const }
      }

      return {
        company: companyResult.data,
        organization: orgResult.data,
        allCompanies: allCompaniesResult.data?.companies ?? [],
        accounts: accountsResult.data?.accounts ?? [],
        journalEntryCount: journalEntriesResult.data?.total ?? 0,
        error: null
      }
    } catch {
      return { company: null, organization: null, allCompanies: [], accounts: [], journalEntryCount: 0, error: "failed" as const }
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
      allCompanies: result.allCompanies,
      accounts: result.accounts,
      journalEntryCount: result.journalEntryCount
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
  readonly retainedEarningsAccountId: string | null
  readonly isActive: boolean
  readonly createdAt: {
    readonly epochMillis: number
  }
}

interface Account {
  readonly id: string
  readonly number: string
  readonly name: string
  readonly accountType: string
  readonly accountCategory: string
  readonly isActive: boolean
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
  const allCompanies = loaderData.allCompanies as readonly Company[]
  const accounts = loaderData.accounts as readonly Account[]
  const journalEntryCount = loaderData.journalEntryCount as number
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []
  const [isEditing, setIsEditing] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  // Permission checks for UI element visibility
  const { canPerform } = usePermissions()
  const canUpdateCompany = canPerform("company:update")
  const canDeleteCompany = canPerform("company:delete")

  // Map companies for sidebar
  const companiesForSidebar = useMemo(
    () => allCompanies.map((c) => ({ id: c.id, name: c.name })),
    [allCompanies]
  )

  // Account count
  const accountCount = accounts.length

  // Find the retained earnings account for display
  const retainedEarningsAccount = useMemo(
    () => accounts.find((a) => a.id === company?.retainedEarningsAccountId),
    [accounts, company?.retainedEarningsAccountId]
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

  // Check if address has any data
  const hasAddressData = (addr: AddressData | null): boolean => {
    if (!addr) return false
    return Boolean(addr.street1 || addr.street2 || addr.city || addr.state || addr.postalCode || addr.country)
  }

  // Format company type for display
  const formatCompanyType = (type: string | null): string | null => {
    if (!type) return null
    return COMPANY_TYPE_LABELS[type] ?? type
  }

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
            retainedEarningsAccountId: null
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
        {/* Company Header Card with Name, Status Badge, Jurisdiction, and Company Type */}
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
              <p className="mt-1 text-gray-600" data-testid="company-legal-name">{company.legalName}</p>
              <p className="mt-1 text-sm text-gray-500">
                Created {createdDate}
                {company.companyType && (
                  <> &middot; {formatCompanyType(company.companyType)}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canUpdateCompany && (
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                  data-testid="edit-company-button"
                >
                  Edit
                </Button>
              )}
              {canDeleteCompany && (
                <Button
                  variant={company.isActive ? "danger" : "secondary"}
                  onClick={handleToggleActive}
                  disabled={isToggling}
                  data-testid="toggle-active-button"
                >
                  {isToggling ? "..." : company.isActive ? "Deactivate" : "Activate"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions - Horizontal row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionLink
            to="/organizations/$organizationId/companies/$companyId/accounts"
            params={params}
            icon={<CreditCard className="h-5 w-5" />}
            title="Chart of Accounts"
            subtitle={`${accountCount} accounts`}
            testId="nav-accounts"
          />
          <QuickActionLink
            to="/organizations/$organizationId/companies/$companyId/journal-entries"
            params={params}
            icon={<FileText className="h-5 w-5" />}
            title="Journal Entries"
            subtitle={`${journalEntryCount} entries`}
            testId="nav-journal-entries"
          />
          <QuickActionLink
            to="/organizations/$organizationId/companies/$companyId/reports"
            params={params}
            icon={<BarChart3 className="h-5 w-5" />}
            title="Reports"
            subtitle="Financial statements"
            testId="nav-reports"
          />
          <QuickActionLink
            to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
            params={params}
            icon={<Calendar className="h-5 w-5" />}
            title="Fiscal Periods"
            subtitle="Year-end closing"
            testId="nav-fiscal-periods"
          />
        </div>

        {/* Company Information - Single organized card */}
        <div className="rounded-lg border border-gray-200 bg-white" data-testid="company-info-card">
          {/* Three-column grid for information sections */}
          <div className="grid divide-y divide-gray-100 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {/* Legal & Tax Section */}
            <div className="p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Legal & Tax
              </h3>
              <dl className="space-y-3">
                <DescriptionItem label="Tax ID" value={company.taxId} mono testId="company-tax-id" />
                <DescriptionItem label="Registration" value={company.registrationNumber} mono testId="company-registration-number" />
                <DescriptionItem label="Incorporated" value={incorporationDateFormatted} testId="company-incorporation-date" />
                <DescriptionItem label="Company Type" value={formatCompanyType(company.companyType)} testId="company-type" />
                <DescriptionItem label="Industry Code" value={company.industryCode} mono testId="company-industry-code" />
                {!company.taxId && !company.registrationNumber && !company.incorporationDate && !company.companyType && !company.industryCode && (
                  <p className="text-sm text-gray-400 italic">Not provided</p>
                )}
              </dl>
            </div>

            {/* Financial Section */}
            <div className="p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Financial
              </h3>
              <dl className="space-y-3">
                <DescriptionItem label="Functional Currency" value={company.functionalCurrency} />
                <DescriptionItem label="Reporting Currency" value={company.reportingCurrency} />
                <DescriptionItem label="Fiscal Year End" value={fiscalYearEndDate} />
                <DescriptionItem
                  label="Retained Earnings"
                  value={retainedEarningsAccount ? `${retainedEarningsAccount.number} - ${retainedEarningsAccount.name}` : null}
                  placeholder="Not configured"
                />
              </dl>
            </div>

            {/* Address Section */}
            <div className="p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Registered Address
              </h3>
              {hasAddressData(company.registeredAddress) ? (
                <address className="not-italic text-sm text-gray-900" data-testid="company-address">
                  {company.registeredAddress?.street1 && <p>{company.registeredAddress.street1}</p>}
                  {company.registeredAddress?.street2 && <p>{company.registeredAddress.street2}</p>}
                  {(company.registeredAddress?.city || company.registeredAddress?.state || company.registeredAddress?.postalCode) && (
                    <p>
                      {[
                        company.registeredAddress?.city,
                        company.registeredAddress?.state,
                        company.registeredAddress?.postalCode
                      ].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {company.registeredAddress?.country && <p>{company.registeredAddress.country}</p>}
                </address>
              ) : (
                <p className="text-sm text-gray-400 italic">Not provided</p>
              )}
            </div>
          </div>
        </div>

        {/* Technical Details - Collapsible */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-500 hover:bg-gray-50"
            data-testid="technical-details-toggle"
          >
            <span>Technical Details</span>
            {showTechnicalDetails ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showTechnicalDetails && (
            <div className="border-t border-gray-200 px-4 py-3">
              <InfoRow label="Company ID" value={company.id} mono />
              <InfoRow label="Organization ID" value={company.organizationId} mono />
            </div>
          )}
        </div>

        {/* Edit Company Modal */}
        {isEditing && (
          <EditCompanyModal
            company={company}
            organizationId={params.organizationId}
            accounts={accounts}
            onClose={() => setIsEditing(false)}
          />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Edit Company Modal Component with Tabs
// =============================================================================

type EditTab = "basic" | "financial" | "address"

function EditCompanyModal({
  company,
  organizationId,
  accounts,
  onClose
}: {
  readonly company: Company
  readonly organizationId: string
  readonly accounts: readonly Account[]
  readonly onClose: () => void
}) {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<EditTab>("basic")
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
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState(company.retainedEarningsAccountId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter accounts to only show Equity accounts for retained earnings selector
  const equityAccounts = useMemo(() =>
    accounts.filter((a) => a.accountType === "Equity" && a.isActive),
    [accounts]
  )

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
      setActiveTab("basic")
      return
    }
    if (!trimmedLegalName) {
      setError("Legal name is required")
      setActiveTab("basic")
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
          retainedEarningsAccountId: retainedEarningsAccountId || null,
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

  const tabs: Array<{ id: EditTab; label: string }> = [
    { id: "basic", label: "Basic Info" },
    { id: "financial", label: "Financial" },
    { id: "address", label: "Address" }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="edit-company-modal">
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Modal Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit Company</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`edit-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Tab Content */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            {/* Error Message */}
            {error && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3" data-testid="edit-company-error">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Basic Info Tab */}
            {activeTab === "basic" && (
              <div className="space-y-4">
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
              </div>
            )}

            {/* Financial Tab */}
            {activeTab === "financial" && (
              <div className="space-y-4">
                <Input
                  id="edit-company-functional-currency"
                  label="Functional Currency"
                  type="text"
                  value={company.functionalCurrency}
                  disabled
                  helperText="Functional currency cannot be changed after creation (ASC 830)"
                  data-testid="edit-company-functional-currency-input"
                />

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

                <div className="space-y-2 rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-medium text-gray-700">Year-End Closing</h3>
                  <Select
                    id="edit-company-retained-earnings"
                    label="Retained Earnings Account"
                    value={retainedEarningsAccountId}
                    onChange={(e) => setRetainedEarningsAccountId(e.target.value)}
                    disabled={isSubmitting}
                    data-testid="edit-company-retained-earnings-select"
                  >
                    <option value="">Select account...</option>
                    {equityAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.number} - {account.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-500">
                    Net income will be posted to this account during year-end close.
                    {equityAccounts.length === 0 && (
                      <span className="block mt-1 text-amber-600">
                        No equity accounts found. Create an equity account or apply a Chart of Accounts template first.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Address Tab */}
            {activeTab === "address" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Enter the company's registered address for legal and compliance purposes.
                </p>

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
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="company-form-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
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
// Description Item Component
// =============================================================================

function DescriptionItem({
  label,
  value,
  mono,
  placeholder,
  testId
}: {
  readonly label: string
  readonly value: string | null | undefined
  readonly mono?: boolean
  readonly placeholder?: string
  readonly testId?: string
}) {
  const displayValue = value ?? placeholder
  const isEmpty = !value

  return (
    <div className="flex flex-col" data-testid={testId}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-sm ${isEmpty ? "text-gray-400 italic" : "text-gray-900"} ${mono && !isEmpty ? "font-mono" : ""}`}>
        {displayValue ?? "—"}
      </dd>
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
  CH: "Switzerland",
  SG: "Singapore",
  HK: "Hong Kong",
  NL: "Netherlands",
  IE: "Ireland"
}

function formatJurisdiction(code: string): string {
  return jurisdictionNames[code] ?? code
}
