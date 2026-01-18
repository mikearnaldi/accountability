/**
 * Authorization Audit Log Route
 *
 * Displays authorization denial entries for security audit and compliance.
 * Shows denied access attempts with user, action, resource, denial reason, and context.
 *
 * Route: /organizations/:organizationId/settings/authorization-audit
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useEffect, useRef, useCallback } from "react"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Tooltip } from "@/components/ui/Tooltip"
import { ShieldAlert, User, Calendar, ChevronLeft, ChevronRight, RefreshCw, Globe, Monitor, Ban } from "lucide-react"

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

interface AuthorizationDenialEntry {
  readonly id: string
  readonly userId: string
  readonly userEmail: string | null
  readonly userDisplayName: string | null
  readonly action: string
  readonly resourceType: string
  readonly resourceId: string | null
  readonly denialReason: string
  readonly matchedPolicyIds: readonly string[]
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly createdAt: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchOrganization = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data: organizationId }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { organization: null, error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
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
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return { companies: [], error: "unauthorized" as const }
    }

    try {
      const serverApi = createServerApi()
      const { data, error } = await serverApi.GET("/api/v1/companies", {
        params: { query: { organizationId } },
        headers: { Authorization: `Bearer ${sessionToken}` }
      })

      if (error) {
        return { companies: [], error: "failed" as const }
      }

      return { companies: data?.companies ?? [], error: null }
    } catch {
      return { companies: [], error: "failed" as const }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/settings/authorization-audit")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/settings/authorization-audit`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const [orgResult, companiesResult] = await Promise.all([
      fetchOrganization({ data: params.organizationId }),
      fetchCompanies({ data: params.organizationId })
    ])

    if (orgResult.error === "not_found") {
      throw new Error("Organization not found")
    }

    return {
      organization: orgResult.organization,
      companies: companiesResult.companies
    }
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: AuthorizationAuditPage
})

// =============================================================================
// Page Component
// =============================================================================

const RESOURCE_TYPES = ["organization", "company", "account", "journal_entry", "fiscal_period", "exchange_rate", "consolidation_group", "report", "audit_log"]

const PAGE_SIZE = 25

function AuthorizationAuditPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Filter state
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all")
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [entries, setEntries] = useState<readonly AuthorizationDenialEntry[]>([])
  const [total, setTotal] = useState(0)

  // Debounce timeout ref for date inputs
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch with current filters
  const fetchWithCurrentFilters = useCallback(async (
    page: number,
    resourceType: string,
    from: string,
    to: string
  ) => {
    setIsLoading(true)
    try {
      const query: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      }
      if (resourceType !== "all") query.resourceType = resourceType
      if (from) query.fromDate = new Date(from).toISOString()
      if (to) query.toDate = new Date(to).toISOString()

      const { data, error } = await api.GET("/api/v1/organizations/{orgId}/authorization-audit", {
        params: {
          path: { orgId: params.organizationId },
          query
        }
      })

      if (!error && data) {
        /* eslint-disable @typescript-eslint/consistent-type-assertions -- API response typing */
        setEntries(data.entries as readonly AuthorizationDenialEntry[])
        /* eslint-enable @typescript-eslint/consistent-type-assertions */
        setTotal(data.total)
      }
    } catch {
      // Keep existing data on error
    }
    setIsLoading(false)
  }, [params.organizationId])

  // Load entries on mount
  useEffect(() => {
    fetchWithCurrentFilters(0, resourceTypeFilter, fromDate, toDate).catch(() => {})
  }, [])

  // Handle resource type filter change
  const handleResourceTypeChange = (value: string) => {
    setResourceTypeFilter(value)
    setCurrentPage(0)
    fetchWithCurrentFilters(0, value, fromDate, toDate).catch(() => {})
  }

  // Handle date filter changes - debounced
  const handleFromDateChange = (value: string) => {
    setFromDate(value)
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }
    dateDebounceRef.current = setTimeout(() => {
      setCurrentPage(0)
      fetchWithCurrentFilters(0, resourceTypeFilter, value, toDate).catch(() => {})
    }, 500)
  }

  const handleToDateChange = (value: string) => {
    setToDate(value)
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }
    dateDebounceRef.current = setTimeout(() => {
      setCurrentPage(0)
      fetchWithCurrentFilters(0, resourceTypeFilter, fromDate, value).catch(() => {})
    }, 500)
  }

  // Handle page change
  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage)
    await fetchWithCurrentFilters(newPage, resourceTypeFilter, fromDate, toDate)
  }

  // Clear filters
  const handleClearFilters = () => {
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }
    setResourceTypeFilter("all")
    setFromDate("")
    setToDate("")
    setCurrentPage(0)
    fetchWithCurrentFilters(0, "all", "", "").catch(() => {})
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (dateDebounceRef.current) {
        clearTimeout(dateDebounceRef.current)
      }
    }
  }, [])

  // Refresh data
  const handleRefresh = async () => {
    setIsLoading(true)
    await router.invalidate()
    await fetchWithCurrentFilters(currentPage, resourceTypeFilter, fromDate, toDate)
    setIsLoading(false)
  }

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Settings",
      href: `/organizations/${params.organizationId}/settings`
    },
    {
      label: "Authorization Audit",
      href: `/organizations/${params.organizationId}/settings/authorization-audit`
    }
  ]

  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  const hasFilters = resourceTypeFilter !== "all" || fromDate !== "" || toDate !== ""
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="authorization-audit-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Authorization Audit Log
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Security audit of denied access attempts
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={isLoading}
              icon={<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />}
              data-testid="refresh-button"
            >
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="authorization-filters">
            <Select
              value={resourceTypeFilter}
              onChange={(e) => handleResourceTypeChange(e.target.value)}
              className="w-44"
              data-testid="filter-resource-type"
            >
              <option value="all">All Resources</option>
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>{formatResourceType(type)}</option>
              ))}
            </Select>

            <Input
              type="date"
              value={fromDate}
              onChange={(e) => handleFromDateChange(e.target.value)}
              className="w-40"
              placeholder="From Date"
              data-testid="filter-from-date"
            />

            <Input
              type="date"
              value={toDate}
              onChange={(e) => handleToDateChange(e.target.value)}
              className="w-40"
              placeholder="To Date"
              data-testid="filter-to-date"
            />

            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-blue-600 hover:text-blue-700"
                data-testid="clear-filters-button"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading && entries.length === 0 ? (
          <LoadingState />
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Denial Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200" data-testid="authorization-audit-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The user who was denied access">
                        <span className="cursor-help">User</span>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The action that was attempted">
                        <span className="cursor-help">Action</span>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The type of resource the user tried to access">
                        <span className="cursor-help">Resource</span>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The reason access was denied">
                        <span className="cursor-help">Reason</span>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="When the denial occurred">
                        <span className="cursor-help">Timestamp</span>
                      </Tooltip>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Request context (IP address, browser)">
                        <span className="cursor-help">Context</span>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50"
                      data-testid={`denial-row-${entry.id}`}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {entry.userDisplayName || "Unknown User"}
                            </div>
                            {entry.userEmail && (
                              <div className="text-xs text-gray-500">{entry.userEmail}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          <Ban className="h-3 w-3" />
                          {formatAction(entry.action)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {formatResourceType(entry.resourceType)}
                        </span>
                        {entry.resourceId && (
                          <div className="font-mono text-xs text-gray-500">
                            {entry.resourceId.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate text-sm text-gray-600" title={entry.denialReason}>
                          {entry.denialReason}
                        </div>
                        {entry.matchedPolicyIds.length > 0 && (
                          <div className="mt-1 text-xs text-gray-400">
                            {entry.matchedPolicyIds.length} {entry.matchedPolicyIds.length === 1 ? "policy" : "policies"} matched
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          {formatTimestamp(entry.createdAt)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col gap-1 text-xs text-gray-500">
                          {entry.ipAddress && (
                            <div className="flex items-center gap-1" title={`IP: ${entry.ipAddress}`}>
                              <Globe className="h-3 w-3" />
                              {entry.ipAddress}
                            </div>
                          )}
                          {entry.userAgent && (
                            <div className="flex items-center gap-1 truncate max-w-[150px]" title={entry.userAgent}>
                              <Monitor className="h-3 w-3" />
                              {formatUserAgent(entry.userAgent)}
                            </div>
                          )}
                          {!entry.ipAddress && !entry.userAgent && (
                            <span className="text-gray-400">No context</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {currentPage * PAGE_SIZE + 1} to {Math.min((currentPage + 1) * PAGE_SIZE, total)} of {total} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0 || isLoading}
                    icon={<ChevronLeft className="h-4 w-4" />}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1 || isLoading}
                    icon={<ChevronRight className="h-4 w-4" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function LoadingState() {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-12 text-center"
      data-testid="loading-state"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <RefreshCw className="h-8 w-8 text-gray-600 animate-spin" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">Loading authorization audit...</h3>
      <p className="mt-2 max-w-md mx-auto text-gray-500">
        Please wait while we fetch the security audit data.
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-12 text-center"
      data-testid="empty-state"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <ShieldAlert className="h-8 w-8 text-green-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">No access denials</h3>
      <p className="mt-2 max-w-md mx-auto text-gray-500">
        Great news! There have been no authorization denials recorded for this organization.
        This log will show any denied access attempts when users try to perform actions
        they don&apos;t have permission for.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto text-left">
        <FeatureCard
          icon={User}
          title="User Tracking"
          description="See who attempted unauthorized actions"
        />
        <FeatureCard
          icon={ShieldAlert}
          title="Security Audit"
          description="Monitor access control violations"
        />
        <FeatureCard
          icon={Globe}
          title="Request Context"
          description="IP addresses and browser info"
        />
      </div>
    </div>
  )
}

interface FeatureCardProps {
  readonly icon: typeof ShieldAlert
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

function formatResourceType(type: string): string {
  const mapping: Record<string, string> = {
    organization: "Organization",
    company: "Company",
    account: "Account",
    journal_entry: "Journal Entry",
    fiscal_period: "Fiscal Period",
    exchange_rate: "Exchange Rate",
    consolidation_group: "Consolidation Group",
    report: "Report",
    audit_log: "Audit Log"
  }
  return mapping[type] || type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
}

function formatAction(action: string): string {
  // Format action like "journal_entry:create" to "Create"
  const parts = action.split(":")
  if (parts.length === 2) {
    return parts[1].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
  }
  return action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  } catch {
    return timestamp
  }
}

function formatUserAgent(userAgent: string): string {
  // Extract browser name from user agent
  if (userAgent.includes("Chrome")) return "Chrome"
  if (userAgent.includes("Firefox")) return "Firefox"
  if (userAgent.includes("Safari")) return "Safari"
  if (userAgent.includes("Edge")) return "Edge"
  return "Browser"
}
