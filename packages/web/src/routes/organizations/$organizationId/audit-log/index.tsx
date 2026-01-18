/**
 * Audit Log Route
 *
 * Displays audit trail of all changes made within the organization.
 *
 * Route: /organizations/:organizationId/audit-log
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
import { ClipboardList, FileText, User, Calendar, Search, ChevronLeft, ChevronRight, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"

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

type AuditEntityType = "Organization" | "Company" | "Account" | "JournalEntry" | "JournalEntryLine" | "FiscalYear" | "FiscalPeriod" | "ExchangeRate" | "ConsolidationGroup" | "ConsolidationRun" | "EliminationRule" | "IntercompanyTransaction" | "User" | "Session"

type AuditAction = "Create" | "Update" | "Delete" | "StatusChange"

interface AuditLogEntry {
  readonly id: string
  readonly entityType: AuditEntityType
  readonly entityId: string
  readonly action: AuditAction
  readonly userId: string | null
  readonly timestamp: string
  readonly changes: Record<string, { from: unknown; to: unknown }> | null
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

export const Route = createFileRoute("/organizations/$organizationId/audit-log/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/audit-log`
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
  component: AuditLogPage
})

// =============================================================================
// Page Component
// =============================================================================

const ENTITY_TYPES: AuditEntityType[] = ["Organization", "Company", "Account", "JournalEntry", "JournalEntryLine", "FiscalYear", "FiscalPeriod", "ExchangeRate", "ConsolidationGroup", "ConsolidationRun", "EliminationRule", "IntercompanyTransaction", "User", "Session"]

const ACTIONS: AuditAction[] = ["Create", "Update", "Delete", "StatusChange"]

const PAGE_SIZE = 25

function AuditLogPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Loader data typing */
  const organization = loaderData.organization as Organization | null
  const companies = loaderData.companies as readonly Company[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Filter state
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [entries, setEntries] = useState<readonly AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Debounce timeout ref for date inputs
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch with current filters (memoized to avoid recreating on every render)
  const fetchWithCurrentFilters = useCallback(async (
    page: number,
    entityType: string,
    action: string,
    from: string,
    to: string
  ) => {
    setIsLoading(true)
    try {
      const query: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      }
      if (entityType !== "all") query.entityType = entityType
      if (action !== "all") query.action = action
      if (from) query.fromDate = new Date(from).toISOString()
      if (to) query.toDate = new Date(to).toISOString()

      // Use organization-scoped endpoint for security
      const { data, error } = await api.GET("/api/v1/audit-log/{organizationId}", {
        params: {
          path: { organizationId: params.organizationId },
          query
        }
      })

      if (!error && data) {
        /* eslint-disable @typescript-eslint/consistent-type-assertions -- API response typing */
        setEntries(data.entries as readonly AuditLogEntry[])
        /* eslint-enable @typescript-eslint/consistent-type-assertions */
        setTotal(data.total)
      }
    } catch {
      // Keep existing data on error
    }
    setIsLoading(false)
  }, [params.organizationId])

  // Load audit entries on mount (empty deps for initial load only)
  useEffect(() => {
    fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, fromDate, toDate).catch(() => {})
  }, [])

  // Handle entity type filter change - auto-apply immediately
  const handleEntityTypeChange = (value: string) => {
    setEntityTypeFilter(value)
    setCurrentPage(0)
    fetchWithCurrentFilters(0, value, actionFilter, fromDate, toDate).catch(() => {})
  }

  // Handle action filter change - auto-apply immediately
  const handleActionChange = (value: string) => {
    setActionFilter(value)
    setCurrentPage(0)
    fetchWithCurrentFilters(0, entityTypeFilter, value, fromDate, toDate).catch(() => {})
  }

  // Handle date filter changes - debounced to avoid excessive API calls
  const handleFromDateChange = (value: string) => {
    setFromDate(value)

    // Clear existing debounce timer
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }

    // Debounce the API call for 500ms
    dateDebounceRef.current = setTimeout(() => {
      setCurrentPage(0)
      fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, value, toDate).catch(() => {})
    }, 500)
  }

  const handleToDateChange = (value: string) => {
    setToDate(value)

    // Clear existing debounce timer
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }

    // Debounce the API call for 500ms
    dateDebounceRef.current = setTimeout(() => {
      setCurrentPage(0)
      fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, fromDate, value).catch(() => {})
    }, 500)
  }

  // Handle page change
  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage)
    await fetchWithCurrentFilters(newPage, entityTypeFilter, actionFilter, fromDate, toDate)
  }

  // Clear filters
  const handleClearFilters = () => {
    // Clear any pending debounce
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }

    setEntityTypeFilter("all")
    setActionFilter("all")
    setFromDate("")
    setToDate("")
    setCurrentPage(0)
    fetchWithCurrentFilters(0, "all", "all", "", "").catch(() => {})
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (dateDebounceRef.current) {
        clearTimeout(dateDebounceRef.current)
      }
    }
  }, [])

  // Toggle row expansion
  const toggleRowExpansion = (entryId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  // Handle keyboard navigation for row expansion
  const handleRowKeyDown = (e: React.KeyboardEvent, entryId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggleRowExpansion(entryId)
    }
  }

  // Refresh data
  const handleRefresh = async () => {
    setIsLoading(true)
    await router.invalidate()
    setIsLoading(false)
  }

  if (!organization) {
    return null
  }

  const breadcrumbItems = [
    {
      label: "Audit Log",
      href: `/organizations/${params.organizationId}/audit-log`
    }
  ]

  // Map companies for sidebar
  const companiesForSidebar = companies.map((c) => ({ id: c.id, name: c.name }))

  const hasFilters = entityTypeFilter !== "all" || actionFilter !== "all" || fromDate !== "" || toDate !== ""
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="audit-log-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Audit Log
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track all changes made within your organization
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

          {/* Filters - auto-apply on change */}
          <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="audit-filters">
            <Select
              value={actionFilter}
              onChange={(e) => handleActionChange(e.target.value)}
              className="w-40"
              data-testid="filter-action"
            >
              <option value="all">All Actions</option>
              {ACTIONS.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </Select>

            <Select
              value={entityTypeFilter}
              onChange={(e) => handleEntityTypeChange(e.target.value)}
              className="w-44"
              data-testid="filter-entity-type"
            >
              <option value="all">All Entities</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>{formatEntityType(type)}</option>
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
            {/* Audit Log Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200" data-testid="audit-log-table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The type of action performed: Create, Update, Delete, or StatusChange">
                        <span className="cursor-help">Action</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The type of entity that was affected (e.g., Organization, Company, Account, Journal Entry)">
                        <span className="cursor-help">Entity Type</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="The unique identifier of the affected entity">
                        <span className="cursor-help">Entity ID</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="When the change occurred">
                        <span className="cursor-help">Timestamp</span>
                      </Tooltip>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <Tooltip content="Summary of what was changed (for updates)">
                        <span className="cursor-help">Changes</span>
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {entries.map((entry) => {
                    const isExpanded = expandedRows.has(entry.id)
                    return (
                      <AuditLogRow
                        key={entry.id}
                        entry={entry}
                        isExpanded={isExpanded}
                        onToggle={() => toggleRowExpansion(entry.id)}
                        onKeyDown={(e) => handleRowKeyDown(e, entry.id)}
                      />
                    )
                  })}
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
      <h3 className="mt-4 text-lg font-semibold text-gray-900">Loading audit entries...</h3>
      <p className="mt-2 max-w-md mx-auto text-gray-500">
        Please wait while we fetch the audit log data.
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
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <ClipboardList className="h-8 w-8 text-gray-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">No audit entries yet</h3>
      <p className="mt-2 max-w-md mx-auto text-gray-500">
        The audit log tracks all changes made to your accounting data,
        including who made changes and when. This helps maintain compliance
        and provides a complete history of your financial records.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4 max-w-3xl mx-auto text-left">
        <FeatureCard
          icon={FileText}
          title="All Changes"
          description="Every create, update, and delete is recorded"
        />
        <FeatureCard
          icon={User}
          title="User Tracking"
          description="See who made each change"
        />
        <FeatureCard
          icon={Calendar}
          title="Timestamps"
          description="Exact date and time of each action"
        />
        <FeatureCard
          icon={Search}
          title="Searchable"
          description="Filter by action, entity, user, or date"
        />
      </div>
    </div>
  )
}

interface FeatureCardProps {
  readonly icon: typeof ClipboardList
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

function ActionBadge({ action }: { readonly action: AuditAction }) {
  const colors: Record<AuditAction, string> = {
    Create: "bg-green-100 text-green-800",
    Update: "bg-blue-100 text-blue-800",
    Delete: "bg-red-100 text-red-800",
    StatusChange: "bg-purple-100 text-purple-800"
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[action]}`}>
      {action}
    </span>
  )
}

function formatEntityType(type: AuditEntityType): string {
  const mapping: Record<AuditEntityType, string> = {
    Organization: "Organization",
    Company: "Company",
    Account: "Account",
    JournalEntry: "Journal Entry",
    JournalEntryLine: "JE Line",
    FiscalYear: "Fiscal Year",
    FiscalPeriod: "Fiscal Period",
    ExchangeRate: "Exchange Rate",
    ConsolidationGroup: "Consolidation Group",
    ConsolidationRun: "Consolidation Run",
    EliminationRule: "Elimination Rule",
    IntercompanyTransaction: "Intercompany Txn",
    User: "User",
    Session: "Session"
  }
  return mapping[type] || type
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


function formatFullValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return String(value)
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

function formatFullTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    })
  } catch {
    return timestamp
  }
}

// =============================================================================
// Expandable Row Components
// =============================================================================

interface AuditLogRowProps {
  readonly entry: AuditLogEntry
  readonly isExpanded: boolean
  readonly onToggle: () => void
  readonly onKeyDown: (e: React.KeyboardEvent) => void
}

function AuditLogRow({ entry, isExpanded, onToggle, onKeyDown }: AuditLogRowProps) {
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${isExpanded ? "bg-blue-50" : "hover:bg-gray-50"}`}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        data-testid={`audit-row-${entry.id}`}
      >
        <td className="px-3 py-4">
          <div className="flex items-center justify-center">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-4">
          <ActionBadge action={entry.action} />
        </td>
        <td className="whitespace-nowrap px-4 py-4">
          <span className="text-sm font-medium text-gray-900">
            {formatEntityType(entry.entityType)}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-4">
          <span className="font-mono text-sm text-gray-500">
            {entry.entityId.slice(0, 8)}...
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            {formatTimestamp(entry.timestamp)}
          </div>
        </td>
        <td className="px-4 py-4">
          <ChangesSummary changes={entry.changes} action={entry.action} />
        </td>
      </tr>
      {isExpanded && (
        <tr data-testid={`audit-detail-${entry.id}`}>
          <td colSpan={6} className="bg-gray-50 px-6 py-4">
            <AuditLogDetailPanel entry={entry} />
          </td>
        </tr>
      )}
    </>
  )
}

interface ChangesSummaryProps {
  readonly changes: Record<string, { from: unknown; to: unknown }> | null
  readonly action: AuditAction
}

function ChangesSummary({ changes, action }: ChangesSummaryProps) {
  if (action === "Create") {
    return <span className="text-sm text-green-600">Entity created</span>
  }
  if (action === "Delete") {
    return <span className="text-sm text-red-600">Entity deleted</span>
  }
  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-sm text-gray-400">—</span>
  }

  const count = Object.keys(changes).length
  return (
    <span className="text-sm text-blue-600">
      {count} field{count !== 1 ? "s" : ""} changed
    </span>
  )
}

interface AuditLogDetailPanelProps {
  readonly entry: AuditLogEntry
}

function AuditLogDetailPanel({ entry }: AuditLogDetailPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleCopy = async (value: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Clipboard not available
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with timestamp */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {formatFullTimestamp(entry.timestamp)}
          </p>
        </div>
        <ActionBadge action={entry.action} />
      </div>

      {/* Entry Information Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Entry ID */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Entry ID</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-sm text-gray-900">{entry.id}</code>
            <CopyButton
              value={entry.id}
              fieldName="entryId"
              copiedField={copiedField}
              onCopy={handleCopy}
            />
          </div>
        </div>

        {/* Entity Type */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Entity Type</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{formatEntityType(entry.entityType)}</p>
        </div>

        {/* Entity ID */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Entity ID</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-sm text-gray-900">{entry.entityId}</code>
            <CopyButton
              value={entry.entityId}
              fieldName="entityId"
              copiedField={copiedField}
              onCopy={handleCopy}
            />
          </div>
        </div>

        {/* User ID */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">User</p>
          <div className="mt-1 flex items-center gap-2">
            {entry.userId ? (
              <>
                <code className="flex-1 truncate text-sm text-gray-900">{entry.userId}</code>
                <CopyButton
                  value={entry.userId}
                  fieldName="userId"
                  copiedField={copiedField}
                  onCopy={handleCopy}
                />
              </>
            ) : (
              <span className="text-sm text-gray-500 italic">System</span>
            )}
          </div>
        </div>
      </div>

      {/* Changes Table */}
      {entry.changes && Object.keys(entry.changes).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h4 className="text-sm font-medium text-gray-900">Changes</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Field
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Before
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    After
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(entry.changes).map(([field, { from, to }]) => (
                  <tr key={field}>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="text-sm font-medium text-gray-900">{field}</span>
                    </td>
                    <td className="px-4 py-2">
                      <ChangeValue value={from} type="from" />
                    </td>
                    <td className="px-4 py-2">
                      <ChangeValue value={to} type="to" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Copy as JSON button */}
      <div className="flex justify-end">
        <button
          onClick={() => handleCopy(JSON.stringify(entry, null, 2), "json")}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {copiedField === "json" ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy as JSON
            </>
          )}
        </button>
      </div>
    </div>
  )
}

interface CopyButtonProps {
  readonly value: string
  readonly fieldName: string
  readonly copiedField: string | null
  readonly onCopy: (value: string, fieldName: string) => Promise<void>
}

function CopyButton({ value, fieldName, copiedField, onCopy }: CopyButtonProps) {
  const isCopied = copiedField === fieldName

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onCopy(value, fieldName).catch(() => {})
      }}
      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      title={isCopied ? "Copied!" : "Copy to clipboard"}
    >
      {isCopied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  )
}

interface ChangeValueProps {
  readonly value: unknown
  readonly type: "from" | "to"
}

function ChangeValue({ value, type }: ChangeValueProps) {
  const formattedValue = formatFullValue(value)
  const isNull = value === null || value === undefined
  const isLongValue = formattedValue.length > 100

  if (isNull) {
    return <span className="text-sm italic text-gray-400">—</span>
  }

  if (type === "from") {
    return (
      <span className={`text-sm text-red-600 ${isLongValue ? "" : "line-through"}`}>
        {isLongValue ? (
          <details className="cursor-pointer">
            <summary className="line-through">{formattedValue.slice(0, 50)}...</summary>
            <pre className="mt-1 whitespace-pre-wrap text-xs">{formattedValue}</pre>
          </details>
        ) : (
          formattedValue
        )}
      </span>
    )
  }

  return (
    <span className="text-sm text-green-600">
      {isLongValue ? (
        <details className="cursor-pointer">
          <summary>{formattedValue.slice(0, 50)}...</summary>
          <pre className="mt-1 whitespace-pre-wrap text-xs">{formattedValue}</pre>
        </details>
      ) : (
        formattedValue
      )}
    </span>
  )
}
