/**
 * Consolidation Group Detail Route
 *
 * Shows details of a consolidation group including members and run history.
 *
 * Route: /organizations/:organizationId/consolidation/:groupId
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
import { Tooltip } from "@/components/ui/Tooltip"
import { usePermissions } from "@/hooks/usePermissions"
import {
  ArrowLeft,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Plus,
  Play,
  ChevronRight,
  Building,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Pause
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
  readonly functionalCurrency: string
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

interface ConsolidationRun {
  readonly id: string
  readonly groupId: string
  readonly periodRef: { year: number; period: number }
  readonly asOfDate: string
  readonly status: "Pending" | "InProgress" | "Completed" | "Failed" | "Cancelled"
  readonly initiatedBy: string
  readonly initiatedAt: string
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly totalDurationMs: number | null
  readonly errorMessage: string | null
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchGroupData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; groupId: string }) => data)
  .handler(async ({ data: { organizationId, groupId } }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, companies: [], group: null, runs: [], error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [orgResult, companiesResult, groupResult, runsResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies", {
          params: { query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/consolidation/groups/{id}", {
          params: { path: { id: groupId }, query: { organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/consolidation/runs", {
          params: { query: { organizationId, groupId } },
          headers: { Authorization }
        })
      ])

      if (orgResult.error) {
        if (typeof orgResult.error === "object" && "status" in orgResult.error && orgResult.error.status === 404) {
          return { organization: null, companies: [], group: null, runs: [], error: "not_found" as const }
        }
        return { organization: null, companies: [], group: null, runs: [], error: "failed" as const }
      }

      if (groupResult.error) {
        if (typeof groupResult.error === "object" && "status" in groupResult.error && groupResult.error.status === 404) {
          return { organization: null, companies: [], group: null, runs: [], error: "group_not_found" as const }
        }
        return { organization: null, companies: [], group: null, runs: [], error: "failed" as const }
      }

      return {
        organization: orgResult.data,
        companies: companiesResult.data?.companies ?? [],
        group: groupResult.data?.group ?? null,
        runs: runsResult.data?.runs ?? [],
        error: null
      }
    } catch {
      return { organization: null, companies: [], group: null, runs: [], error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/consolidation/$groupId/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/consolidation/${params.groupId}`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchGroupData({
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
      group: result.group,
      runs: result.runs
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: ConsolidationGroupDetailPage
})

// =============================================================================
// Page Component
// =============================================================================

function ConsolidationGroupDetailPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []
  const { canPerform } = usePermissions()

  // Permission checks
  const canUpdateGroup = canPerform("consolidation_group:update")
  const canDeleteGroup = canPerform("consolidation_group:delete")
  const canRunConsolidation = canPerform("consolidation_group:run")

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  const group = loaderData.group as ConsolidationGroup | null
  const runs = loaderData.runs as readonly ConsolidationRun[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showInitiateRunModal, setShowInitiateRunModal] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  // Create company name map
  const companyNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const company of companies) {
      map.set(company.id, company.name)
    }
    return map
  }, [companies])

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

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
    }
  ]

  // Format consolidation method display
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

  // Format duration
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "-"
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  // Status badge component
  const StatusBadge = ({ status }: { status: ConsolidationRun["status"] }) => {
    const config = {
      Pending: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock },
      InProgress: { bg: "bg-blue-100", text: "text-blue-800", icon: Loader2 },
      Completed: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle2 },
      Failed: { bg: "bg-red-100", text: "text-red-800", icon: XCircle },
      Cancelled: { bg: "bg-gray-100", text: "text-gray-800", icon: Pause }
    }
    const { bg, text, icon: Icon } = config[status]
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${bg} ${text}`}>
        <Icon className={`h-3 w-3 ${status === "InProgress" ? "animate-spin" : ""}`} />
        {status}
      </span>
    )
  }

  // Handle activate/deactivate
  const handleToggleActive = async () => {
    setActionError(null)

    if (group.isActive) {
      setIsDeactivating(true)
      try {
        const { error } = await api.POST("/api/v1/consolidation/groups/{id}/deactivate", {
          params: { path: { id: group.id }, query: { organizationId: params.organizationId } }
        })

        if (error) {
          setActionError("Failed to deactivate group")
          return
        }

        await router.invalidate()
      } catch {
        setActionError("An error occurred")
      } finally {
        setIsDeactivating(false)
      }
    } else {
      setIsActivating(true)
      try {
        const { error } = await api.POST("/api/v1/consolidation/groups/{id}/activate", {
          params: { path: { id: group.id }, query: { organizationId: params.organizationId } }
        })

        if (error) {
          setActionError("Failed to activate group")
          return
        }

        await router.invalidate()
      } catch {
        setActionError("An error occurred")
      } finally {
        setIsActivating(false)
      }
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (deleteConfirmText !== group.name) return

    setIsDeleting(true)
    setActionError(null)

    try {
      const { error } = await api.DELETE("/api/v1/consolidation/groups/{id}", {
        params: { path: { id: group.id }, query: { organizationId: params.organizationId } }
      })

      if (error) {
        let errorMessage = "Failed to delete group"
        if (typeof error === "object" && error !== null && "message" in error) {
          errorMessage = String(error.message)
        }
        setActionError(errorMessage)
        setIsDeleting(false)
        return
      }

      await router.navigate({
        to: `/organizations/${params.organizationId}/consolidation`
      })
    } catch {
      setActionError("An error occurred")
      setIsDeleting(false)
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
      <div data-testid="consolidation-group-detail-page">
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

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                  {group.name}
                </h1>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    group.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {group.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {formatConsolidationMethod(group.consolidationMethod)} • {group.reportingCurrency}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canUpdateGroup && (
                <Button
                  variant="secondary"
                  onClick={handleToggleActive}
                  disabled={isActivating || isDeactivating}
                  icon={group.isActive
                    ? <PowerOff className="h-4 w-4" />
                    : <Power className="h-4 w-4" />
                  }
                  data-testid="toggle-active-button"
                >
                  {isActivating || isDeactivating
                    ? "Processing..."
                    : group.isActive
                      ? "Deactivate"
                      : "Activate"
                  }
                </Button>
              )}
              {canUpdateGroup && (
                <Link
                  to="/organizations/$organizationId/consolidation/$groupId/edit"
                  params={{ organizationId: params.organizationId, groupId: params.groupId }}
                >
                  <Button
                    variant="secondary"
                    icon={<Edit className="h-4 w-4" />}
                    data-testid="edit-button"
                  >
                    Edit
                  </Button>
                </Link>
              )}
              {canDeleteGroup && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteModal(true)}
                  icon={<Trash2 className="h-4 w-4" />}
                  data-testid="delete-button"
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {actionError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{actionError}</p>
            </div>
          )}
        </div>

        {/* Group Info Card */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Group Information</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Parent Company</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <Link
                  to="/organizations/$organizationId/companies/$companyId"
                  params={{ organizationId: params.organizationId, companyId: group.parentCompanyId }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {companyNameMap.get(group.parentCompanyId) ?? "Unknown"}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Reporting Currency</dt>
              <dd className="mt-1 text-sm text-gray-900">{group.reportingCurrency}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Default Method</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatConsolidationMethod(group.consolidationMethod)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Members Table */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Members ({group.members.length})
            </h2>
            {canUpdateGroup && (
              <Link
                to="/organizations/$organizationId/consolidation/$groupId/edit"
                params={{ organizationId: params.organizationId, groupId: params.groupId }}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  data-testid="add-member-button"
                >
                  Add Member
                </Button>
              </Link>
            )}
          </div>

          {group.members.length === 0 ? (
            <div className="p-8 text-center">
              <Building className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">No subsidiary companies in this group yet.</p>
              {canUpdateGroup && (
                <Link
                  to="/organizations/$organizationId/consolidation/$groupId/edit"
                  params={{ organizationId: params.organizationId, groupId: params.groupId }}
                  className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-800"
                >
                  Add members →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The subsidiary company included in this consolidation">
                        <span className="cursor-help border-b border-dotted border-gray-400">Company</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Percentage of ownership held by the parent company">
                        <span className="cursor-help border-b border-dotted border-gray-400">Ownership %</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The accounting method used to consolidate this subsidiary">
                        <span className="cursor-help border-b border-dotted border-gray-400">Method</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Date when the subsidiary was acquired">
                        <span className="cursor-help border-b border-dotted border-gray-400">Acquisition Date</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Non-Controlling Interest percentage (100% - Ownership%)">
                        <span className="cursor-help border-b border-dotted border-gray-400">NCI %</span>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {group.members.map((member) => (
                    <tr key={member.companyId} data-testid={`member-row-${member.companyId}`}>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          to="/organizations/$organizationId/companies/$companyId"
                          params={{ organizationId: params.organizationId, companyId: member.companyId }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {companyNameMap.get(member.companyId) ?? "Unknown"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {member.ownershipPercentage}%
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {formatConsolidationMethod(member.consolidationMethod)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {member.acquisitionDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {member.nonControllingInterestPercentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Run History */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Consolidation Runs
            </h2>
            {canRunConsolidation && (
              <Button
                onClick={() => setShowInitiateRunModal(true)}
                disabled={!group.isActive}
                icon={<Play className="h-4 w-4" />}
                data-testid="initiate-run-button"
              >
                New Run
              </Button>
            )}
          </div>

          {runs.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">No consolidation runs yet.</p>
              {group.isActive && canRunConsolidation ? (
                <button
                  onClick={() => setShowInitiateRunModal(true)}
                  className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-800"
                >
                  Start your first run →
                </button>
              ) : !group.isActive ? (
                <p className="mt-3 text-xs text-gray-400">
                  Activate this group to run consolidations.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The fiscal period for this consolidation run">
                        <span className="cursor-help border-b border-dotted border-gray-400">Period</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The date as of which balances are consolidated">
                        <span className="cursor-help border-b border-dotted border-gray-400">As-of Date</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Current status of the consolidation run">
                        <span className="cursor-help border-b border-dotted border-gray-400">Status</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="When the run was started">
                        <span className="cursor-help border-b border-dotted border-gray-400">Initiated</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Total time taken to complete the run">
                        <span className="cursor-help border-b border-dotted border-gray-400">Duration</span>
                      </Tooltip>
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.navigate({
                        to: `/organizations/${params.organizationId}/consolidation/${params.groupId}/runs/${run.id}`
                      })}
                      data-testid={`run-row-${run.id}`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {run.periodRef.year} P{run.periodRef.period}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {run.asOfDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {new Date(run.initiatedAt).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {formatDuration(run.totalDurationMs)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="text-lg font-semibold">Delete Consolidation Group</h3>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                This action cannot be undone. All consolidation runs associated with this group
                will also be deleted.
              </p>
              <p className="mt-4 text-sm text-gray-600">
                Type <strong>{group.name}</strong> to confirm deletion:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Enter group name"
                data-testid="delete-confirm-input"
              />
              {actionError && (
                <p className="mt-2 text-sm text-red-600">{actionError}</p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteConfirmText("")
                    setActionError(null)
                  }}
                  data-testid="cancel-delete-button"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== group.name || isDeleting}
                  data-testid="confirm-delete-button"
                >
                  {isDeleting ? "Deleting..." : "Delete Group"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Initiate Run Modal - Placeholder for now */}
        {showInitiateRunModal && (
          <InitiateRunModal
            groupId={group.id}
            organizationId={params.organizationId}
            onClose={() => setShowInitiateRunModal(false)}
            onSuccess={async () => {
              setShowInitiateRunModal(false)
              await router.invalidate()
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Initiate Run Modal Component
// =============================================================================

interface InitiateRunModalProps {
  readonly groupId: string
  readonly organizationId: string
  readonly onClose: () => void
  readonly onSuccess: () => Promise<void>
}

function InitiateRunModal({
  groupId,
  organizationId,
  onClose,
  onSuccess
}: InitiateRunModalProps) {
  const router = useRouter()
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString())
  const [fiscalPeriod, setFiscalPeriod] = useState("1")
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0])
  const [skipValidation, setSkipValidation] = useState(false)
  const [continueOnWarnings, setContinueOnWarnings] = useState(true)
  const [includeEquityInvestments, setIncludeEquityInvestments] = useState(true)
  const [forceRegeneration, setForceRegeneration] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Note: initiatedBy would normally come from user context/session
      const { data, error: apiError } = await api.POST("/api/v1/consolidation/groups/{groupId}/runs", {
        params: { path: { groupId }, query: { organizationId } },
        body: {
          periodRef: {
            year: parseInt(fiscalYear, 10),
            period: parseInt(fiscalPeriod, 10)
          },
          asOfDate,
          initiatedBy: "00000000-0000-0000-0000-000000000000", // Placeholder - should come from user session
          skipValidation,
          continueOnWarnings,
          includeEquityMethodInvestments: includeEquityInvestments,
          forceRegeneration
        }
      })

      if (apiError) {
        let errorMessage = "Failed to initiate consolidation run"
        if (typeof apiError === "object" && apiError !== null && "message" in apiError) {
          errorMessage = String(apiError.message)
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Navigate to the new run's detail page
      if (data?.id) {
        await router.navigate({
          to: `/organizations/${organizationId}/consolidation/${groupId}/runs/${data.id}`
        })
      } else {
        await onSuccess()
      }
    } catch {
      setError("An unexpected error occurred")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Initiate Consolidation Run</h3>
        <p className="mt-1 text-sm text-gray-500">
          Start a new consolidation run for the selected period.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Period Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="fiscalYear" className="block text-sm font-medium text-gray-700">
                Fiscal Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="fiscalYear"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                min="2000"
                max="2100"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="fiscal-year-input"
              />
            </div>
            <div>
              <label htmlFor="fiscalPeriod" className="block text-sm font-medium text-gray-700">
                Fiscal Period <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="fiscalPeriod"
                value={fiscalPeriod}
                onChange={(e) => setFiscalPeriod(e.target.value)}
                min="1"
                max="13"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="fiscal-period-input"
              />
            </div>
          </div>

          {/* As-of Date */}
          <div>
            <label htmlFor="asOfDate" className="block text-sm font-medium text-gray-700">
              As-of Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="asOfDate"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="as-of-date-input"
            />
          </div>

          {/* Options */}
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700">Options</p>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={skipValidation}
                onChange={(e) => setSkipValidation(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Skip validation checks</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={continueOnWarnings}
                onChange={(e) => setContinueOnWarnings(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Continue on warnings</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeEquityInvestments}
                onChange={(e) => setIncludeEquityInvestments(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Include equity method investments</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={forceRegeneration}
                onChange={(e) => setForceRegeneration(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Force regeneration (overwrite existing)</span>
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              data-testid="cancel-run-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              icon={<Play className="h-4 w-4" />}
              data-testid="start-run-button"
            >
              {isSubmitting ? "Starting..." : "Start Run"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
