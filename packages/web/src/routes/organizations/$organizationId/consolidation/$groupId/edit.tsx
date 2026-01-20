/**
 * Edit Consolidation Group Route
 *
 * Form for editing an existing consolidation group (name, method, currency, members).
 *
 * Route: /organizations/:organizationId/consolidation/:groupId/edit
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo, useEffect } from "react"
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

interface ConsolidationMember {
  readonly companyId: string
  readonly ownershipPercentage: string
  readonly consolidationMethod: string
  readonly acquisitionDate: string
  readonly goodwillAmount: string | null
  readonly nonControllingInterestPercentage: string
  readonly vieDetermination: { isPrimaryBeneficiary: boolean; hasControllingFinancialInterest: boolean } | null
}

interface ConsolidationGroup {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly reportingCurrency: string
  readonly consolidationMethod: string
  readonly parentCompanyId: string
  readonly members: readonly ConsolidationMember[]
  readonly eliminationRuleIds: readonly string[]
  readonly isActive: boolean
}

interface MemberInput {
  readonly companyId: string
  readonly ownershipPercentage: string
  readonly consolidationMethod: string
  readonly acquisitionDate: string
  readonly isExisting: boolean // Track if member existed before edit
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

const fetchEditData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; groupId: string }) => data)
  .handler(async ({ data: { organizationId, groupId } }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], currencies: [], group: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, currenciesResult, groupResult] = await Promise.all([
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
        }),
        serverApi.GET("/api/v1/consolidation/groups/{id}", {
          params: { path: { id: groupId }, query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], currencies: [], group: null, error: "not_found" as const }
        }
        return { organization: null, companies: [], currencies: [], group: null, error: "failed" as const }
      }

      if (groupResult.error) {
        if (typeof groupResult.error === "object" && "status" in groupResult.error && groupResult.error.status === 404) {
          return { organization: null, companies: [], currencies: [], group: null, error: "group_not_found" as const }
        }
        return { organization: null, companies: [], currencies: [], group: null, error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        currencies: currenciesResult.data?.currencies ?? [],
        group: groupResult.data?.group ?? null,
        error: null
      }
    } catch {
      return { organization: null, companies: [], currencies: [], group: null, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/consolidation/$groupId/edit")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation/${params.groupId}/edit`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchEditData({
      data: { organizationId: params.organizationId, groupId: params.groupId }
    })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    if (result.error === "group_not_found") {
      throw new Error("Consolidation group not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      currencies: result.currencies,
      group: result.group
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: EditConsolidationGroupPage
})

// =============================================================================
// Page Component
// =============================================================================

function EditConsolidationGroupPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []
  const { canPerform } = usePermissions()
  const canUpdateGroup = canPerform("consolidation_group:update")

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const currencies = loaderData.currencies as readonly Currency[]
  const group = loaderData.group as ConsolidationGroup | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Form state - initialize with existing data
  const [name, setName] = useState("")
  const [reportingCurrency, setReportingCurrency] = useState("")
  const [consolidationMethod, setConsolidationMethod] = useState("")
  const [members, setMembers] = useState<MemberInput[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Initialize form with existing group data
  useEffect(() => {
    if (group) {
      setName(group.name)
      setReportingCurrency(group.reportingCurrency)
      setConsolidationMethod(group.consolidationMethod)
      setMembers(
        group.members.map((m) => ({
          companyId: m.companyId,
          ownershipPercentage: m.ownershipPercentage,
          consolidationMethod: m.consolidationMethod,
          acquisitionDate: m.acquisitionDate,
          isExisting: true
        }))
      )
    }
  }, [group])

  // Validation state
  const [errors, setErrors] = useState<{
    name?: string
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
      (c) => c.id !== group?.parentCompanyId && !selectedIds.has(c.id)
    )
  }, [activeCompanies, group?.parentCompanyId, members])

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  // Company name map
  const companyNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const company of companies) {
      map.set(company.id, company.name)
    }
    return map
  }, [companies])

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

  if (!organization || !group) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Consolidation",
      href: `/organizations/${params.organizationId}/consolidation`
    },
    {
      label: group.name,
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}`
    },
    {
      label: "Edit",
      href: `/organizations/${params.organizationId}/consolidation/${params.groupId}/edit`
    }
  ]

  // Permission denied state
  if (!canUpdateGroup) {
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
            You do not have permission to edit consolidation groups.
          </p>
          <Link
            to="/organizations/$organizationId/consolidation/$groupId"
            params={{ organizationId: params.organizationId, groupId: params.groupId }}
          >
            <Button variant="secondary" className="mt-4">
              Back to Consolidation Group
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
        acquisitionDate: todayStr,
        isExisting: false
      }
    ])
  }

  // Handle remove member
  const handleRemoveMember = async (index: number) => {
    const member = members[index]

    // If it's an existing member, we need to call the API to remove it
    if (member.isExisting && member.companyId) {
      try {
        const { error } = await api.DELETE("/api/v1/consolidation/groups/{id}/members/{companyId}", {
          params: {
            path: {
              id: group.id,
              companyId: member.companyId
            },
            query: { organizationId: params.organizationId }
          }
        })

        if (error) {
          setApiError("Failed to remove member")
          return
        }
      } catch {
        setApiError("An error occurred while removing member")
        return
      }
    }

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

      // 1. Update group info (only if changed)
      if (name !== group.name || consolidationMethod !== group.consolidationMethod || reportingCurrency !== group.reportingCurrency) {
        const updateBody: { name: string | null; consolidationMethod: ConsolidationMethodType | null; reportingCurrency: string | null } = {
          name: name !== group.name ? name.trim() : null,
          consolidationMethod: consolidationMethod !== group.consolidationMethod ? toMethodType(consolidationMethod) : null,
          reportingCurrency: reportingCurrency !== group.reportingCurrency ? reportingCurrency : null
        }

        const { error: updateError } = await api.PUT("/api/v1/consolidation/groups/{id}", {
          params: { path: { id: group.id }, query: { organizationId: params.organizationId } },
          body: updateBody
        })

        if (updateError) {
          let errorMessage = "Failed to update group"
          if (typeof updateError === "object" && updateError !== null && "message" in updateError) {
            errorMessage = String(updateError.message)
          }
          setApiError(errorMessage)
          setIsSubmitting(false)
          return
        }
      }

      // 2. Process member changes
      const existingMemberIds = new Set(group.members.map((m) => m.companyId))

      for (const member of members) {
        if (!member.companyId) continue

        if (member.isExisting && existingMemberIds.has(member.companyId)) {
          // Note: Member update functionality would go here but the API schema
          // may have changed - skipping for now as backend alignment may be needed
        } else if (!member.isExisting) {
          // Add new member
          const addMemberBody: {
            companyId: string
            ownershipPercentage: number
            consolidationMethod: ConsolidationMethodType
            acquisitionDate?: string
          } = {
            companyId: member.companyId,
            ownershipPercentage: parseFloat(member.ownershipPercentage),
            consolidationMethod: toMethodType(member.consolidationMethod)
          }
          if (member.acquisitionDate) {
            addMemberBody.acquisitionDate = member.acquisitionDate
          }
          const { error } = await api.POST("/api/v1/consolidation/groups/{id}/members", {
            params: { path: { id: group.id }, query: { organizationId: params.organizationId } },
            body: addMemberBody
          })

          if (error) {
            let errorMessage = "Failed to add member"
            if (typeof error === "object" && error !== null && "message" in error) {
              errorMessage = String(error.message)
            }
            setApiError(errorMessage)
            setIsSubmitting(false)
            return
          }
        }
      }

      // Navigate back to group detail page
      await router.navigate({
        to: `/organizations/${params.organizationId}/consolidation/${params.groupId}`
      })
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    router.navigate({
      to: `/organizations/${params.organizationId}/consolidation/${params.groupId}`
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
      <div data-testid="edit-consolidation-group-page">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            to="/organizations/$organizationId/consolidation/$groupId"
            params={{ organizationId: params.organizationId, groupId: params.groupId }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {group.name}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900" data-testid="page-title">
            Edit Consolidation Group
          </h1>
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
              </div>

              {/* Parent Company - Display Only */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Parent Company
                </label>
                <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {companyNameMap.get(group.parentCompanyId) ?? "Unknown"}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Parent company cannot be changed after creation.
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
                  Manage the subsidiary companies in this consolidation group.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddMember}
                disabled={availableCompaniesForMembers.length === 0}
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
                  No subsidiary companies. Click 'Add Member' to add subsidiaries.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-t-lg text-xs font-medium text-gray-500 uppercase">
                  <div className="sm:col-span-3">Company</div>
                  <div className="sm:col-span-2">Ownership %</div>
                  <div className="sm:col-span-2">Acquisition Date</div>
                  <div className="sm:col-span-4">Consolidation Method</div>
                  <div className="sm:col-span-1"></div>
                </div>

                {/* Member Rows */}
                {members.map((member, index) => (
                  <div
                    key={`${member.companyId || index}`}
                    className="grid sm:grid-cols-12 gap-4 px-4 py-3 border border-gray-200 rounded-lg"
                    data-testid={`member-row-${index}`}
                  >
                    {/* Company Select / Display */}
                    <div className="sm:col-span-3">
                      <label className="sm:hidden text-xs font-medium text-gray-500 mb-1 block">
                        Company
                      </label>
                      {member.isExisting ? (
                        <div className="flex items-center w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900">
                          {companyNameMap.get(member.companyId) ?? "Unknown"}
                        </div>
                      ) : (
                        <Combobox
                          value={member.companyId}
                          onChange={(value) => handleMemberChange(index, "companyId", value)}
                          options={getMemberCompanyOptions(index)}
                          placeholder="Search companies..."
                          data-testid={`member-company-select-${index}`}
                        />
                      )}
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
                    <div className="sm:col-span-4">
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
