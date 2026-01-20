/**
 * Create Consolidation Group Route
 *
 * Form for creating a new consolidation group with initial members.
 *
 * Route: /organizations/:organizationId/consolidation/new
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox"
import { usePermissions } from "@/hooks/usePermissions"
import { ArrowLeft, Plus, Trash2, ShieldAlert } from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

interface Company {
  readonly id: string
  readonly name: string
  readonly functionalCurrency: string
  readonly isActive: boolean
}

interface Currency {
  readonly code: string
  readonly name: string
}

interface MemberInput {
  readonly companyId: string
  readonly ownershipPercentage: string
  readonly consolidationMethod: string
  readonly acquisitionDate: string
}

// Consolidation method options
const CONSOLIDATION_METHODS = [
  { value: "FullConsolidation", label: "Full Consolidation" },
  { value: "EquityMethod", label: "Equity Method" },
  { value: "CostMethod", label: "Cost Method" },
  { value: "VariableInterestEntity", label: "Variable Interest Entity (VIE)" }
]

// =============================================================================
// Server Functions
// =============================================================================

const fetchFormData = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], currencies: [], error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, currenciesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/currencies", {
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], currencies: [], error: "not_found" as const }
        }
        return { organization: null, companies: [], currencies: [], error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        currencies: currenciesResult.data?.currencies ?? [],
        error: null
      }
    } catch {
      return { organization: null, companies: [], currencies: [], error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/consolidation/new")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation/new`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchFormData({ data: params.organizationId })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      currencies: result.currencies
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: CreateConsolidationGroupPage
})

// =============================================================================
// Page Component
// =============================================================================

function CreateConsolidationGroupPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []
  const { canPerform } = usePermissions()
  const canCreateGroup = canPerform("consolidation_group:create")

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const currencies = loaderData.currencies as readonly Currency[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Form state
  const [name, setName] = useState("")
  const [reportingCurrency, setReportingCurrency] = useState(organization?.reportingCurrency ?? "")
  const [consolidationMethod, setConsolidationMethod] = useState("FullConsolidation")
  const [parentCompanyId, setParentCompanyId] = useState("")
  const [members, setMembers] = useState<MemberInput[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Validation state
  const [errors, setErrors] = useState<{
    name?: string
    reportingCurrency?: string
    parentCompanyId?: string
    members?: string
  }>({})

  // Get active companies only for selection
  const activeCompanies = useMemo(
    () => companies.filter((c) => c.isActive),
    [companies]
  )

  // Companies available for member selection (not already selected and not the parent)
  const availableCompaniesForMembers = useMemo(() => {
    const selectedIds = new Set(members.map((m) => m.companyId))
    return activeCompanies.filter(
      (c) => c.id !== parentCompanyId && !selectedIds.has(c.id)
    )
  }, [activeCompanies, parentCompanyId, members])

  // Convert active companies to Combobox options for parent company selection
  const parentCompanyOptions: ComboboxOption[] = useMemo(() => {
    return activeCompanies.map((company) => ({
      value: company.id,
      label: `${company.name} (${company.functionalCurrency})`,
      searchText: `${company.name} ${company.functionalCurrency}`
    }))
  }, [activeCompanies])

  // Convert available companies to Combobox options for member selection
  const memberCompanyOptions = useMemo((): ComboboxOption[] => {
    return availableCompaniesForMembers.map((company) => ({
      value: company.id,
      label: company.name,
      searchText: `${company.name} ${company.functionalCurrency}`
    }))
  }, [availableCompaniesForMembers])

  // Get options for a specific member row (includes currently selected company)
  const getMemberCompanyOptions = (memberIndex: number): ComboboxOption[] => {
    const currentMember = members[memberIndex]
    const currentCompany = currentMember?.companyId
      ? activeCompanies.find((c) => c.id === currentMember.companyId)
      : null

    // Start with available companies
    const options = [...memberCompanyOptions]

    // If this member has a selected company, add it to the options
    if (currentCompany) {
      const alreadyInOptions = options.some((o) => o.value === currentCompany.id)
      if (!alreadyInOptions) {
        options.unshift({
          value: currentCompany.id,
          label: currentCompany.name,
          searchText: `${currentCompany.name} ${currentCompany.functionalCurrency}`
        })
      }
    }

    return options
  }

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Consolidation",
      href: `/organizations/${params.organizationId}/consolidation`
    },
    {
      label: "New Group",
      href: `/organizations/${params.organizationId}/consolidation/new`
    }
  ]

  // Permission denied state
  if (!canCreateGroup) {
    return (
      <AppLayout
        user={user}
        organizations={organizations}
        currentOrganization={organization}
        breadcrumbItems={breadcrumbItems}
        companies={companiesForSidebar}
      >
        <div data-testid="permission-denied" className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Permission Denied</h2>
          <p className="mt-2 text-sm text-gray-600">
            You do not have permission to create consolidation groups.
          </p>
          <Link
            to="/organizations/$organizationId/consolidation"
            params={{ organizationId: params.organizationId }}
          >
            <Button variant="secondary" className="mt-4">
              Back to Consolidation Groups
            </Button>
          </Link>
        </div>
      </AppLayout>
    )
  }

  // Validation
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    if (!name.trim()) {
      newErrors.name = "Name is required"
    }

    if (!reportingCurrency) {
      newErrors.reportingCurrency = "Reporting currency is required"
    }

    if (!parentCompanyId) {
      newErrors.parentCompanyId = "Parent company is required"
    }

    // Validate members
    for (const member of members) {
      const ownership = parseFloat(member.ownershipPercentage)
      if (isNaN(ownership) || ownership < 0 || ownership > 100) {
        newErrors.members = "Ownership percentage must be between 0 and 100"
        break
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle add member
  const handleAddMember = () => {
    if (availableCompaniesForMembers.length === 0) return

    // Default acquisition date to today
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

    setMembers([
      ...members,
      {
        companyId: "",
        ownershipPercentage: "100",
        consolidationMethod: "FullConsolidation",
        acquisitionDate: todayStr
      }
    ])
  }

  // Handle remove member
  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
  }

  // Handle member change
  const handleMemberChange = (
    index: number,
    field: keyof MemberInput,
    value: string
  ) => {
    const updatedMembers = [...members]
    updatedMembers[index] = { ...updatedMembers[index], [field]: value }
    setMembers(updatedMembers)
  }

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    setApiError(null)

    try {
      // Helper function to safely convert consolidation method using object lookup
      type ConsolidationMethodType = "FullConsolidation" | "EquityMethod" | "CostMethod" | "VariableInterestEntity"
      const methodLookup: Record<string, ConsolidationMethodType> = {
        FullConsolidation: "FullConsolidation",
        EquityMethod: "EquityMethod",
        CostMethod: "CostMethod",
        VariableInterestEntity: "VariableInterestEntity"
      }
      const toMethodType = (method: string): ConsolidationMethodType => methodLookup[method] ?? "FullConsolidation"

      // Filter out members without a company selected
      const validMembers = members
        .filter((m) => m.companyId)
        .map((m) => {
          const member: {
            companyId: string
            ownershipPercentage: number
            consolidationMethod: ConsolidationMethodType
            acquisitionDate?: string
          } = {
            companyId: m.companyId,
            ownershipPercentage: parseFloat(m.ownershipPercentage),
            consolidationMethod: toMethodType(m.consolidationMethod)
          }
          if (m.acquisitionDate) {
            member.acquisitionDate = m.acquisitionDate
          }
          return member
        })

      const { data, error } = await api.POST("/api/v1/consolidation/groups", {
        body: {
          organizationId: params.organizationId,
          name: name.trim(),
          reportingCurrency,
          consolidationMethod: toMethodType(consolidationMethod),
          parentCompanyId,
          members: validMembers
        }
      })

      if (error) {
        let errorMessage = "Failed to create consolidation group"
        if (typeof error === "object" && error !== null) {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message
          }
        }
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Navigate to the new group's detail page
      if (data?.group?.id) {
        await router.navigate({
          to: `/organizations/${params.organizationId}/consolidation/${data.group.id}`
        })
      } else {
        await router.navigate({
          to: `/organizations/${params.organizationId}/consolidation`
        })
      }
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    router.navigate({
      to: `/organizations/${params.organizationId}/consolidation`
    })
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="create-consolidation-group-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/consolidation"
            params={{ organizationId: params.organizationId }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Consolidation Groups
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900" data-testid="page-title">
            New Consolidation Group
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a consolidation group to combine financial statements from multiple companies.
          </p>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Group Information</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Name */}
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., North America Holdings"
                  className="mt-1"
                  data-testid="group-name-input"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Reporting Currency */}
              <div>
                <label htmlFor="reportingCurrency" className="block text-sm font-medium text-gray-700">
                  Reporting Currency <span className="text-red-500">*</span>
                </label>
                <Select
                  id="reportingCurrency"
                  value={reportingCurrency}
                  onChange={(e) => setReportingCurrency(e.target.value)}
                  className="mt-1"
                  data-testid="reporting-currency-select"
                >
                  <option value="">Select currency...</option>
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </Select>
                {errors.reportingCurrency && (
                  <p className="mt-1 text-sm text-red-600">{errors.reportingCurrency}</p>
                )}
              </div>

              {/* Consolidation Method */}
              <div>
                <label htmlFor="consolidationMethod" className="block text-sm font-medium text-gray-700">
                  Default Consolidation Method <span className="text-red-500">*</span>
                </label>
                <Select
                  id="consolidationMethod"
                  value={consolidationMethod}
                  onChange={(e) => setConsolidationMethod(e.target.value)}
                  className="mt-1"
                  data-testid="consolidation-method-select"
                >
                  {CONSOLIDATION_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  This is the default method. Each member can have a different method.
                </p>
              </div>

              {/* Parent Company */}
              <div className="sm:col-span-2">
                <label htmlFor="parentCompanyId" className="block text-sm font-medium text-gray-700">
                  Parent Company <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={parentCompanyId}
                  onChange={(value) => {
                    setParentCompanyId(value)
                    // Remove any members that match the new parent
                    setMembers(members.filter((m) => m.companyId !== value))
                  }}
                  options={parentCompanyOptions}
                  placeholder="Search companies..."
                  className="mt-1"
                  data-testid="parent-company-select"
                />
                {errors.parentCompanyId && (
                  <p className="mt-1 text-sm text-red-600">{errors.parentCompanyId}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  The parent company is the controlling entity that owns the subsidiaries.
                </p>
              </div>
            </div>
          </div>

          {/* Members Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Subsidiary Companies</h2>
                <p className="text-sm text-gray-500">
                  Add the subsidiary companies to include in this consolidation group.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddMember}
                disabled={availableCompaniesForMembers.length === 0 || !parentCompanyId}
                icon={<Plus className="h-4 w-4" />}
                data-testid="add-member-button"
              >
                Add Member
              </Button>
            </div>

            {errors.members && (
              <p className="mb-4 text-sm text-red-600">{errors.members}</p>
            )}

            {members.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                <p className="text-sm text-gray-500">
                  {parentCompanyId
                    ? "No subsidiary companies added yet. Click 'Add Member' to add subsidiaries."
                    : "Select a parent company first, then add subsidiary companies."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-t-lg text-xs font-medium text-gray-500 uppercase">
                  <div className="sm:col-span-4">Company</div>
                  <div className="sm:col-span-2">Ownership %</div>
                  <div className="sm:col-span-2">Acquisition Date</div>
                  <div className="sm:col-span-3">Consolidation Method</div>
                  <div className="sm:col-span-1"></div>
                </div>

                {/* Member Rows */}
                {members.map((member, index) => (
                  <div
                    key={index}
                    className="grid sm:grid-cols-12 gap-4 px-4 py-3 border border-gray-200 rounded-lg"
                    data-testid={`member-row-${index}`}
                  >
                    {/* Company Select */}
                    <div className="sm:col-span-4">
                      <label className="sm:hidden text-xs font-medium text-gray-500 mb-1 block">
                        Company
                      </label>
                      <Combobox
                        value={member.companyId}
                        onChange={(value) => handleMemberChange(index, "companyId", value)}
                        options={getMemberCompanyOptions(index)}
                        placeholder="Search companies..."
                        data-testid={`member-company-select-${index}`}
                      />
                    </div>

                    {/* Ownership % */}
                    <div className="sm:col-span-2">
                      <label className="sm:hidden text-xs font-medium text-gray-500 mb-1 block">
                        Ownership %
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={member.ownershipPercentage}
                        onChange={(e) => handleMemberChange(index, "ownershipPercentage", e.target.value)}
                        data-testid={`member-ownership-input-${index}`}
                      />
                    </div>

                    {/* Acquisition Date */}
                    <div className="sm:col-span-2">
                      <label className="sm:hidden text-xs font-medium text-gray-500 mb-1 block">
                        Acquisition Date
                      </label>
                      <Input
                        type="date"
                        value={member.acquisitionDate}
                        onChange={(e) => handleMemberChange(index, "acquisitionDate", e.target.value)}
                        data-testid={`member-acquisition-date-${index}`}
                      />
                    </div>

                    {/* Consolidation Method */}
                    <div className="sm:col-span-3">
                      <label className="sm:hidden text-xs font-medium text-gray-500 mb-1 block">
                        Method
                      </label>
                      <Select
                        value={member.consolidationMethod}
                        onChange={(e) => handleMemberChange(index, "consolidationMethod", e.target.value)}
                        data-testid={`member-method-select-${index}`}
                      >
                        {CONSOLIDATION_METHODS.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {/* Remove Button */}
                    <div className="sm:col-span-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(index)}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Remove member"
                        data-testid={`remove-member-button-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-button"
            >
              {isSubmitting ? "Creating..." : "Create Consolidation Group"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
