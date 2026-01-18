/**
 * Audit Log Route
 *
 * Displays audit trail of all changes made within the organization.
 *
 * Route: /organizations/:organizationId/audit-log
 */

import { createFileRoute, redirect, useRouter, Link } from "@tanstack/react-router"
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
import { ClipboardList, FileText, User, Calendar, Search, ChevronLeft, ChevronRight, RefreshCw, ChevronDown, ChevronUp, Copy, Check, Clock, Download, ExternalLink } from "lucide-react"

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
  readonly entityName: string | null
  readonly action: AuditAction
  readonly userId: string | null
  /** Denormalized user display name at time of action */
  readonly userDisplayName: string | null
  /** Denormalized user email at time of action */
  readonly userEmail: string | null
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

// Date preset helpers
type DatePreset = "today" | "7days" | "30days" | "thisMonth"

function getDatePresetRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date()
  const toDate = today.toISOString().split("T")[0]

  switch (preset) {
    case "today": {
      return { from: toDate, to: toDate }
    }
    case "7days": {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return { from: weekAgo.toISOString().split("T")[0], to: toDate }
    }
    case "30days": {
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 30)
      return { from: monthAgo.toISOString().split("T")[0], to: toDate }
    }
    case "thisMonth": {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: firstOfMonth.toISOString().split("T")[0], to: toDate }
    }
  }
}

const DATE_PRESETS: readonly DatePreset[] = ["today", "7days", "30days", "thisMonth"]

function getActivePreset(from: string, to: string): DatePreset | null {
  if (!from && !to) return null

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  // Check each preset
  for (const preset of DATE_PRESETS) {
    const range = getDatePresetRange(preset)
    if (from === range.from && to === range.to) {
      return preset
    }
  }

  // Check if "today" with only from date set to today
  if (from === todayStr && to === todayStr) {
    return "today"
  }

  return null
}

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
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [entries, setEntries] = useState<readonly AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Debounce timeout refs
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch with current filters (memoized to avoid recreating on every render)
  const fetchWithCurrentFilters = useCallback(async (
    page: number,
    entityType: string,
    action: string,
    from: string,
    to: string,
    search: string
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
      if (search.trim()) query.search = search.trim()

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
    fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, fromDate, toDate, searchTerm).catch(() => {})
  }, [])

  // Handle entity type filter change - auto-apply immediately
  const handleEntityTypeChange = (value: string) => {
    setEntityTypeFilter(value)
    setCurrentPage(0)
    fetchWithCurrentFilters(0, value, actionFilter, fromDate, toDate, searchTerm).catch(() => {})
  }

  // Handle action filter change - auto-apply immediately
  const handleActionChange = (value: string) => {
    setActionFilter(value)
    setCurrentPage(0)
    fetchWithCurrentFilters(0, entityTypeFilter, value, fromDate, toDate, searchTerm).catch(() => {})
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
      fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, value, toDate, searchTerm).catch(() => {})
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
      fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, fromDate, value, searchTerm).catch(() => {})
    }, 500)
  }

  // Handle date preset selection
  const handleDatePreset = (preset: DatePreset) => {
    // Clear existing debounce timer
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }

    const range = getDatePresetRange(preset)
    setFromDate(range.from)
    setToDate(range.to)
    setCurrentPage(0)
    fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, range.from, range.to, searchTerm).catch(() => {})
  }

  // Handle search change - debounced with 300ms per spec
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)

    // Clear existing debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    // Debounce the API call for 300ms (per spec)
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(0)
      fetchWithCurrentFilters(0, entityTypeFilter, actionFilter, fromDate, toDate, value).catch(() => {})
    }, 300)
  }

  // Handle page change
  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage)
    await fetchWithCurrentFilters(newPage, entityTypeFilter, actionFilter, fromDate, toDate, searchTerm)
  }

  // Clear filters
  const handleClearFilters = () => {
    // Clear any pending debounce
    if (dateDebounceRef.current) {
      clearTimeout(dateDebounceRef.current)
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    setEntityTypeFilter("all")
    setActionFilter("all")
    setFromDate("")
    setToDate("")
    setSearchTerm("")
    setCurrentPage(0)
    fetchWithCurrentFilters(0, "all", "all", "", "", "").catch(() => {})
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (dateDebounceRef.current) {
        clearTimeout(dateDebounceRef.current)
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
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

  const hasFilters = entityTypeFilter !== "all" || actionFilter !== "all" || fromDate !== "" || toDate !== "" || searchTerm !== ""
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

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => exportToCSV(entries, organization.name)}
                disabled={entries.length === 0}
                icon={<Download className="h-4 w-4" />}
                data-testid="export-csv-button"
              >
                Export CSV
              </Button>
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
          </div>

          {/* Filters - auto-apply on change */}
          <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="audit-filters">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by entity name or ID..."
              className="w-64"
              inputPrefix={<Search className="h-4 w-4 text-gray-400" />}
              data-testid="search-input"
            />

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

            {/* Date range presets */}
            <DatePresetButtons
              activePreset={getActivePreset(fromDate, toDate)}
              onPresetSelect={handleDatePreset}
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
                      <Tooltip content="The name or identifier of the affected entity">
                        <span className="cursor-help">Entity</span>
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
                        organizationId={params.organizationId}
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

interface DatePresetButtonsProps {
  readonly activePreset: DatePreset | null
  readonly onPresetSelect: (preset: DatePreset) => void
}

function DatePresetButtons({ activePreset, onPresetSelect }: DatePresetButtonsProps) {
  const presets: { id: DatePreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "7days", label: "Last 7 days" },
    { id: "30days", label: "Last 30 days" },
    { id: "thisMonth", label: "This month" }
  ]

  return (
    <div className="flex items-center gap-1" data-testid="date-presets">
      <Clock className="h-4 w-4 text-gray-400" />
      {presets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onPresetSelect(preset.id)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            activePreset === preset.id
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          data-testid={`date-preset-${preset.id}`}
        >
          {preset.label}
        </button>
      ))}
    </div>
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


/**
 * Type guard to check if a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Type guard for Option.None: { "_id": "Option", "_tag": "None" }
 */
function isOptionNone(obj: Record<string, unknown>): boolean {
  return obj._id === "Option" && obj._tag === "None"
}

/**
 * Type guard for Option.Some: { "_id": "Option", "_tag": "Some", "value": ... }
 */
function isOptionSome(obj: Record<string, unknown>): obj is { _id: "Option"; _tag: "Some"; value: unknown } {
  return obj._id === "Option" && obj._tag === "Some" && "value" in obj
}

/**
 * Type guard for DateTime with epochMillis
 */
function hasEpochMillis(obj: Record<string, unknown>): obj is { epochMillis: number } {
  return "epochMillis" in obj && typeof obj.epochMillis === "number"
}

/**
 * Type guard for Date with day/month only (fiscal year end)
 */
function isDayMonthOnly(obj: Record<string, unknown>): obj is { day: number; month: number } {
  return "day" in obj && "month" in obj &&
         typeof obj.day === "number" && typeof obj.month === "number" &&
         !("year" in obj)
}

/**
 * Type guard for full Date with year/month/day
 */
function isFullDate(obj: Record<string, unknown>): obj is { year: number; month: number; day: number } {
  return "year" in obj && "month" in obj && "day" in obj &&
         typeof obj.year === "number" && typeof obj.month === "number" && typeof obj.day === "number"
}

/**
 * Type guard for BigDecimal-like objects
 */
function isBigDecimal(obj: Record<string, unknown>): obj is { value: string } {
  return "value" in obj && typeof obj.value === "string" && /^-?\d+(\.\d+)?$/.test(obj.value)
}

/**
 * Formats Effect-TS and domain values for human-readable display.
 * Detects common patterns and renders them appropriately.
 *
 * @example
 * // Option.None → "—"
 * // Option.Some("Active") → "Active"
 * // { epochMillis: 1768774143932 } → "Jan 18, 2026, 9:29 AM"
 * // { day: 31, month: 12 } → "December 31"
 * // true → "Yes"
 * // false → "No"
 */
function formatEffectValue(value: unknown): string {
  // Handle null/undefined
  if (value === null || value === undefined) return "—"

  // Handle primitives
  if (typeof value === "string") return value
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "boolean") return value ? "Yes" : "No"

  // Handle objects
  if (isObject(value)) {
    // Option.None: { "_id": "Option", "_tag": "None" }
    if (isOptionNone(value)) {
      return "—"
    }

    // Option.Some: { "_id": "Option", "_tag": "Some", "value": ... }
    if (isOptionSome(value)) {
      return formatEffectValue(value.value)
    }

    // DateTime (epochMillis): { "epochMillis": 1768774143932 }
    if (hasEpochMillis(value)) {
      return new Date(value.epochMillis).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    }

    // Date with day/month (no year): { "day": 31, "month": 12 }
    // This is for fiscal year end dates
    if (isDayMonthOnly(value)) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ]
      return `${monthNames[value.month - 1]} ${value.day}`
    }

    // Date with year/month/day: { "year": 2026, "month": 1, "day": 15 }
    if (isFullDate(value)) {
      const date = new Date(value.year, value.month - 1, value.day)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      })
    }

    // BigDecimal: { "value": "1000.50" } or similar patterns
    if (isBigDecimal(value)) {
      return parseFloat(value.value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    // Fallback: pretty-print JSON for other objects
    return JSON.stringify(value, null, 2)
  }

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

/**
 * Exports audit log entries to CSV format
 */
function exportToCSV(entries: readonly AuditLogEntry[], organizationName: string): void {
  // CSV headers
  const headers = [
    "Timestamp",
    "Action",
    "Entity Type",
    "Entity Name",
    "Entity ID",
    "User Name",
    "User Email",
    "User ID",
    "Changes"
  ]

  // Helper to escape CSV fields (handle commas, quotes, newlines)
  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // Format changes for CSV using human-readable formatting
  const formatChangesForCSV = (changes: Record<string, { from: unknown; to: unknown }> | null): string => {
    if (!changes || Object.keys(changes).length === 0) return ""
    return Object.entries(changes)
      .map(([field, { from, to }]) => `${field}: ${formatEffectValue(from)} → ${formatEffectValue(to)}`)
      .join("; ")
  }

  // Build CSV content
  const csvRows = [
    headers.map(escapeCSV).join(","),
    ...entries.map((entry) => [
      escapeCSV(formatFullTimestamp(entry.timestamp)),
      escapeCSV(entry.action),
      escapeCSV(formatEntityType(entry.entityType)),
      escapeCSV(entry.entityName ?? ""),
      escapeCSV(entry.entityId),
      escapeCSV(entry.userDisplayName ?? "System"),
      escapeCSV(entry.userEmail ?? ""),
      escapeCSV(entry.userId ?? ""),
      escapeCSV(formatChangesForCSV(entry.changes))
    ].join(","))
  ]

  const csvContent = csvRows.join("\n")

  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  const timestamp = new Date().toISOString().split("T")[0]
  link.setAttribute("download", `audit-log-${organizationName.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generates the URL for an entity based on its type
 * Returns null if the entity type doesn't have a detail page
 */
function getEntityUrl(
  entityType: AuditEntityType,
  entityId: string,
  organizationId: string,
  changes: Record<string, { from: unknown; to: unknown }> | null
): string | null {
  // For company-scoped entities, we need the companyId from changes
  const getCompanyId = (): string | null => {
    if (!changes) return null
    // Look for companyId in changes (it's stored during create/update)
    const companyIdChange = changes.companyId
    if (companyIdChange?.to && typeof companyIdChange.to === "string") {
      return companyIdChange.to
    }
    if (companyIdChange?.from && typeof companyIdChange.from === "string") {
      return companyIdChange.from
    }
    return null
  }

  switch (entityType) {
    case "Organization":
      return `/organizations/${entityId}/dashboard`
    case "Company":
      return `/organizations/${organizationId}/companies/${entityId}`
    case "Account": {
      const companyId = getCompanyId()
      if (companyId) {
        return `/organizations/${organizationId}/companies/${companyId}/accounts`
      }
      // If no companyId, can't link to specific account
      return null
    }
    case "JournalEntry": {
      const companyId = getCompanyId()
      if (companyId) {
        return `/organizations/${organizationId}/companies/${companyId}/journal-entries/${entityId}`
      }
      return null
    }
    case "ConsolidationGroup":
      return `/organizations/${organizationId}/consolidation/${entityId}`
    case "ExchangeRate":
      return `/organizations/${organizationId}/exchange-rates`
    case "FiscalYear":
      return `/organizations/${organizationId}/settings/fiscal-periods`
    case "FiscalPeriod":
      return `/organizations/${organizationId}/settings/fiscal-periods`
    // These entity types don't have detail pages
    case "JournalEntryLine":
    case "ConsolidationRun":
    case "EliminationRule":
    case "IntercompanyTransaction":
    case "User":
    case "Session":
      return null
    default:
      return null
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
  readonly organizationId: string
}

function AuditLogRow({ entry, isExpanded, onToggle, onKeyDown, organizationId }: AuditLogRowProps) {
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
          {entry.entityName ? (
            <div>
              <span className="text-sm font-medium text-gray-900">{entry.entityName}</span>
              <div className="font-mono text-xs text-gray-400">{entry.entityId.slice(0, 8)}...</div>
            </div>
          ) : (
            <span className="font-mono text-sm text-gray-500">
              {entry.entityId.slice(0, 8)}...
            </span>
          )}
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
            <AuditLogDetailPanel entry={entry} organizationId={organizationId} />
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
  readonly organizationId: string
}

function AuditLogDetailPanel({ entry, organizationId }: AuditLogDetailPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Get entity URL for "View Entity" button
  const entityUrl = getEntityUrl(entry.entityType, entry.entityId, organizationId, entry.changes)

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

        {/* Entity Name */}
        {entry.entityName && (
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Entity Name</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{entry.entityName}</p>
          </div>
        )}

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

        {/* User */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">User</p>
          <div className="mt-1">
            {entry.userId ? (
              <div className="space-y-1">
                {entry.userDisplayName ? (
                  <Tooltip content={entry.userEmail ?? entry.userId}>
                    <span className="cursor-help text-sm font-medium text-gray-900">
                      {entry.userDisplayName}
                    </span>
                  </Tooltip>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-sm text-gray-900">{entry.userId}</code>
                    <CopyButton
                      value={entry.userId}
                      fieldName="userId"
                      copiedField={copiedField}
                      onCopy={handleCopy}
                    />
                  </div>
                )}
                {entry.userEmail && entry.userDisplayName && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{entry.userEmail}</span>
                    <CopyButton
                      value={entry.userEmail}
                      fieldName="userEmail"
                      copiedField={copiedField}
                      onCopy={handleCopy}
                    />
                  </div>
                )}
              </div>
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

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        {/* View Entity button - only shown if entity has a detail page */}
        {entityUrl && entry.action !== "Delete" && (
          <Link
            to={entityUrl}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            onClick={(e) => e.stopPropagation()}
            data-testid="view-entity-button"
          >
            <ExternalLink className="h-4 w-4" />
            View Entity
          </Link>
        )}

        {/* Copy as JSON button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCopy(JSON.stringify(entry, null, 2), "json").catch(() => {})
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          data-testid="copy-json-button"
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
  const formattedValue = formatEffectValue(value)
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
