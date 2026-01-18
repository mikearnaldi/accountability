/**
 * Consolidation Groups List Route
 *
 * Displays a list of consolidation groups for multi-company financial statement consolidation.
 *
 * Route: /organizations/:organizationId/consolidation
 */

import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Tooltip } from "@/components/ui/Tooltip"
import { usePermissions } from "@/hooks/usePermissions"
import {
  Globe2,
  Plus,
  Building,
  ArrowRight,
  ChevronRight
} from "lucide-react"

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

type StatusFilter = "all" | "active" | "inactive"

// =============================================================================
// Server Functions
// =============================================================================

const fetchConsolidationData = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], groups: [], total: 0, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, groupsResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/consolidation/groups", {
          params: { query: { organizationId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], groups: [], total: 0, error: "not_found" as const }
        }
        return { organization: null, companies: [], groups: [], total: 0, error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        groups: groupsResult.data?.groups ?? [],
        total: groupsResult.data?.total ?? 0,
        error: null
      }
    } catch {
      return { organization: null, companies: [], groups: [], total: 0, error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/consolidation/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchConsolidationData({ data: params.organizationId })

    if (result.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: result.organization,
      companies: result.companies,
      groups: result.groups,
      total: result.total
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: ConsolidationPage
})

// =============================================================================
// Page Component
// =============================================================================

function ConsolidationPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const { canPerform } = usePermissions()
  const canCreateGroup = canPerform("consolidation_group:create")

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const groups = loaderData.groups as readonly ConsolidationGroup[]
  const total = loaderData.total as number
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Create a map of company IDs to names for lookup
  const companyNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const company of companies) {
      map.set(company.id, company.name)
    }
    return map
  }, [companies])

  // Filter groups by status
  const filteredGroups = useMemo(() => {
    if (statusFilter === "all") return groups
    return groups.filter((group) =>
      statusFilter === "active" ? group.isActive : !group.isActive
    )
  }, [groups, statusFilter])

  // Count active/inactive for filter badges
  const activeCount = useMemo(
    () => groups.filter((g) => g.isActive).length,
    [groups]
  )
  const inactiveCount = groups.length - activeCount

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Consolidation",
      href: `/organizations/${params.organizationId}/consolidation`
    }
  ]

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  // Helper function to format consolidation method display
  const formatConsolidationMethod = (method: string): string => {
    switch (method) {
      case "FullConsolidation":
        return "Full Consolidation"
      case "EquityMethod":
        return "Equity Method"
      case "CostMethod":
        return "Cost Method"
      case "VariableInterestEntity":
        return "VIE"
      default:
        return method
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
      <div data-testid="consolidation-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Consolidation
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {total > 0
                  ? `${total} consolidation group${total !== 1 ? "s" : ""} in ${organization.name}`
                  : "Consolidate financial statements across multiple companies"}
              </p>
            </div>

            {groups.length > 0 && canCreateGroup && (
              <Link
                to="/organizations/$organizationId/consolidation/new"
                params={{ organizationId: params.organizationId }}
              >
                <Button icon={<Plus className="h-4 w-4" />} data-testid="create-group-button">
                  New Consolidation Group
                </Button>
              </Link>
            )}
          </div>

          {/* Status Filter */}
          {groups.length > 0 && (
            <div className="mt-4 flex items-center gap-2" data-testid="status-filter">
              <StatusFilterButton
                label="All"
                count={groups.length}
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

        {/* Groups List or Empty State */}
        {groups.length === 0 ? (
          <EmptyState organizationId={params.organizationId} canCreateGroup={canCreateGroup} />
        ) : filteredGroups.length === 0 ? (
          <div
            className="rounded-lg border border-gray-200 bg-white p-8 text-center"
            data-testid="no-filtered-results"
          >
            <p className="text-gray-500">
              No {statusFilter === "active" ? "active" : "inactive"} consolidation groups found.
            </p>
            <button
              onClick={() => setStatusFilter("all")}
              className="mt-2 text-blue-600 hover:text-blue-700"
            >
              Show all groups
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden" data-testid="groups-table">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The name identifying this consolidation group">
                        <span className="cursor-help border-b border-dotted border-gray-400">Name</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The parent company that owns the subsidiaries in this group">
                        <span className="cursor-help border-b border-dotted border-gray-400">Parent Company</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Number of subsidiary companies included in this consolidation">
                        <span className="cursor-help border-b border-dotted border-gray-400">Members</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The currency used for consolidated financial statements">
                        <span className="cursor-help border-b border-dotted border-gray-400">Currency</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The default consolidation method for this group (Full Consolidation, Equity Method, Cost Method, VIE)">
                        <span className="cursor-help border-b border-dotted border-gray-400">Method</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Whether this group is active and can be used for consolidation runs">
                        <span className="cursor-help border-b border-dotted border-gray-400">Status</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredGroups.map((group) => (
                    <tr
                      key={group.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.navigate({ to: `/organizations/${params.organizationId}/consolidation/${group.id}` })}
                      data-testid={`group-row-${group.id}`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{group.name}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {companyNameMap.get(group.parentCompanyId) ?? "Unknown"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {group.members.length} {group.members.length === 1 ? "company" : "companies"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-700">{group.reportingCurrency}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {formatConsolidationMethod(group.consolidationMethod)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            group.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {group.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Helper Components
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

interface FeatureCardProps {
  readonly icon: typeof Globe2
  readonly title: string
  readonly description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <Icon className="h-5 w-5 text-gray-600" />
      <h4 className="mt-2 font-medium text-gray-900">{title}</h4>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}

interface EmptyStateProps {
  readonly organizationId: string
  readonly canCreateGroup: boolean
}

function EmptyState({ organizationId, canCreateGroup }: EmptyStateProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-12 text-center"
      data-testid="empty-state"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
        <Globe2 className="h-8 w-8 text-purple-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">No consolidation groups yet</h3>
      <p className="mt-2 max-w-md mx-auto text-gray-500">
        Consolidation groups allow you to combine financial statements from multiple companies
        into a single consolidated view. This feature supports elimination entries,
        currency translation, and minority interest calculations.
      </p>

      {canCreateGroup && (
        <div className="mt-6">
          <Link
            to="/organizations/$organizationId/consolidation/new"
            params={{ organizationId }}
          >
            <Button icon={<Plus className="h-4 w-4" />} data-testid="create-first-group-button">
              Create First Consolidation Group
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto text-left">
        <FeatureCard
          icon={Building}
          title="Multi-Company"
          description="Combine statements from parent and subsidiary companies"
        />
        <FeatureCard
          icon={Globe2}
          title="Currency Translation"
          description="Automatic translation using configured exchange rates"
        />
        <FeatureCard
          icon={ArrowRight}
          title="Eliminations"
          description="Automatic intercompany transaction elimination"
        />
      </div>
    </div>
  )
}
