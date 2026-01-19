import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { Plus, FileText, Search, ChevronRight } from "lucide-react"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Tooltip } from "@/components/ui/Tooltip"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { usePermissions } from "@/hooks/usePermissions"

// =============================================================================
// Types (extracted from API response schema)
// =============================================================================

type JournalEntryStatus = "Draft" | "PendingApproval" | "Approved" | "Posted" | "Reversed"
type JournalEntryType = "Standard" | "Adjusting" | "Closing" | "Opening" | "Reversing" | "Recurring" | "Intercompany" | "Revaluation" | "Elimination" | "System"

// Type guards for validating select values
const ENTRY_STATUSES: readonly JournalEntryStatus[] = [
  "Draft",
  "PendingApproval",
  "Approved",
  "Posted",
  "Reversed"
]
const ENTRY_STATUS_FILTERS: readonly (JournalEntryStatus | "All")[] = [
  "All",
  ...ENTRY_STATUSES
]

const ENTRY_TYPES: readonly JournalEntryType[] = [
  "Standard",
  "Adjusting",
  "Closing",
  "Opening",
  "Reversing",
  "Recurring",
  "Intercompany",
  "Revaluation",
  "Elimination",
  "System"
]
const ENTRY_TYPE_FILTERS: readonly (JournalEntryType | "All")[] = [
  "All",
  ...ENTRY_TYPES
]

function isEntryStatusFilter(value: string): value is JournalEntryStatus | "All" {
  return ENTRY_STATUS_FILTERS.some((t) => t === value)
}

function isEntryTypeFilter(value: string): value is JournalEntryType | "All" {
  return ENTRY_TYPE_FILTERS.some((t) => t === value)
}

interface FiscalPeriodRef {
  readonly year: number
  readonly period: number
}

interface LocalDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface Timestamp {
  readonly epochMillis: number
}

interface JournalEntry {
  readonly id: string
  readonly companyId: string
  readonly entryNumber: number | null
  readonly referenceNumber: string | null
  readonly description: string
  readonly transactionDate: LocalDate
  readonly postingDate: LocalDate | null
  readonly documentDate: LocalDate | null
  readonly fiscalPeriod: FiscalPeriodRef
  readonly entryType: JournalEntryType
  readonly sourceModule: string
  readonly sourceDocumentRef: string | null
  readonly isMultiCurrency: boolean
  readonly status: JournalEntryStatus
  readonly isReversing: boolean
  readonly reversedEntryId: string | null
  readonly reversingEntryId: string | null
  readonly createdBy: string
  readonly createdAt: Timestamp
  readonly postedBy: string | null
  readonly postedAt: Timestamp | null
}

interface Company {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly legalName: string
  readonly functionalCurrency: string
}

interface Organization {
  readonly id: string
  readonly name: string
}

// Note: FiscalYear and FiscalPeriod are now computed automatically from transaction dates (Issue 33/34)
// The filtering uses the fiscal year/period stored on each journal entry

// =============================================================================
// Server Functions: Fetch journal entries, company, organization and fiscal data
// =============================================================================

const fetchJournalEntriesData = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { companyId: string; organizationId: string }) => data
  )
  .handler(async ({ data }) => {
    // Get the session cookie to forward to API
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        entries: [],
        total: 0,
        company: null,
        organization: null,
        error: "unauthorized" as const
      }
    }

    try {
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      // Fetch journal entries, company, and organization in parallel
      // Note: Fiscal periods are now computed automatically, no longer persisted (Issue 33/34)
      const [entriesResult, companyResult, orgResult] = await Promise.all([
        serverApi.GET("/api/v1/journal-entries", {
          params: { query: { organizationId: data.organizationId, companyId: data.companyId, limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{id}", {
          params: { path: { organizationId: data.organizationId, id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        // Check for domain-specific NotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error &&
            companyResult.error._tag === "CompanyNotFoundError") {
          return {
            entries: [],
            total: 0,
            company: null,
            organization: null,
            error: "not_found" as const
          }
        }
        return {
          entries: [],
          total: 0,
          company: null,
          organization: null,
          error: "failed" as const
        }
      }

      if (orgResult.error || entriesResult.error) {
        return {
          entries: [],
          total: 0,
          company: null,
          organization: null,
          error: "failed" as const
        }
      }

      return {
        entries: entriesResult.data?.entries ?? [],
        total: entriesResult.data?.total ?? 0,
        company: companyResult.data,
        organization: orgResult.data,
        error: null
      }
    } catch {
      return {
        entries: [],
        total: 0,
        company: null,
        organization: null,
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Journal Entries Route
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/journal-entries/"
)({
  beforeLoad: async ({ context }) => {
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
    const result = await fetchJournalEntriesData({
      data: {
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Company not found")
    }

    return {
      entries: result.entries,
      total: result.total,
      company: result.company,
      organization: result.organization
    }
  },
  errorComponent: ({ error }) => (
    <MinimalRouteError error={error} />
  ),
  component: JournalEntriesPage
})

// =============================================================================
// Journal Entries Page Component
// =============================================================================

function JournalEntriesPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const navigate = useNavigate()
  const { canPerform } = usePermissions()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const entries = loaderData.entries as readonly JournalEntry[]
  const total = loaderData.total as number
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  // Permission checks
  const canCreateEntry = canPerform("journal_entry:create")

  // Compute available fiscal years from entries (since fiscal periods are now computed, Issue 33/34)
  const availableFiscalYears = useMemo(() => {
    const years = new Set<number>()
    for (const entry of entries) {
      years.add(entry.fiscalPeriod.year)
    }
    return Array.from(years).sort((a, b) => b - a) // Sort descending (most recent first)
  }, [entries])
  const params = Route.useParams()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  // UI State - Filters
  const [filterStatus, setFilterStatus] = useState<JournalEntryStatus | "All">("All")
  const [filterType, setFilterType] = useState<JournalEntryType | "All">("All")
  const [filterFiscalYear, setFilterFiscalYear] = useState<string>("All")
  const [filterFiscalPeriod, setFilterFiscalPeriod] = useState<string>("All")
  const [filterFromDate, setFilterFromDate] = useState<string>("")
  const [filterToDate, setFilterToDate] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

  // Get available periods for selected fiscal year (computed from entries)
  const availablePeriods = useMemo(() => {
    if (filterFiscalYear === "All") return []
    const yearNum = parseInt(filterFiscalYear, 10)
    const periods = new Set<number>()
    for (const entry of entries) {
      if (entry.fiscalPeriod.year === yearNum) {
        periods.add(entry.fiscalPeriod.period)
      }
    }
    return Array.from(periods).sort((a, b) => a - b) // Sort ascending
  }, [filterFiscalYear, entries])

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = [...entries]

    // Filter by status
    if (filterStatus !== "All") {
      result = result.filter((entry) => entry.status === filterStatus)
    }

    // Filter by entry type
    if (filterType !== "All") {
      result = result.filter((entry) => entry.entryType === filterType)
    }

    // Filter by fiscal year (computed from entry's fiscalPeriod.year)
    if (filterFiscalYear !== "All") {
      const yearNum = parseInt(filterFiscalYear, 10)
      result = result.filter((entry) => entry.fiscalPeriod.year === yearNum)
    }

    // Filter by fiscal period
    if (filterFiscalPeriod !== "All") {
      const periodNum = parseInt(filterFiscalPeriod, 10)
      result = result.filter((entry) => entry.fiscalPeriod.period === periodNum)
    }

    // Filter by date range
    if (filterFromDate) {
      const fromDate = new Date(filterFromDate)
      result = result.filter((entry) => {
        const entryDate = new Date(entry.transactionDate.year, entry.transactionDate.month - 1, entry.transactionDate.day)
        return entryDate >= fromDate
      })
    }
    if (filterToDate) {
      const toDate = new Date(filterToDate)
      result = result.filter((entry) => {
        const entryDate = new Date(entry.transactionDate.year, entry.transactionDate.month - 1, entry.transactionDate.day)
        return entryDate <= toDate
      })
    }

    // Search by reference, description, or entry number
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(
        (entry) =>
          entry.description.toLowerCase().includes(query) ||
          (entry.referenceNumber?.toLowerCase().includes(query) ?? false) ||
          (entry.entryNumber?.toString().includes(query) ?? false)
      )
    }

    // Sort by transaction date descending, then by entry number
    result.sort((a, b) => {
      const dateA = new Date(a.transactionDate.year, a.transactionDate.month - 1, a.transactionDate.day)
      const dateB = new Date(b.transactionDate.year, b.transactionDate.month - 1, b.transactionDate.day)
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime()
      }
      return (b.entryNumber ?? 0) - (a.entryNumber ?? 0)
    })

    return result
  }, [entries, filterStatus, filterType, filterFiscalYear, filterFiscalPeriod, filterFromDate, filterToDate, searchQuery])

  // Clear all filters
  const clearFilters = () => {
    setFilterStatus("All")
    setFilterType("All")
    setFilterFiscalYear("All")
    setFilterFiscalPeriod("All")
    setFilterFromDate("")
    setFilterToDate("")
    setSearchQuery("")
  }

  // Check if any filter is active
  const hasActiveFilters = filterStatus !== "All" ||
    filterType !== "All" ||
    filterFiscalYear !== "All" ||
    filterFiscalPeriod !== "All" ||
    filterFromDate !== "" ||
    filterToDate !== "" ||
    searchQuery !== ""

  if (!company || !organization) {
    return null
  }

  // Pass current company to sidebar for quick actions
  const companiesForSidebar = useMemo(
    () => [{ id: company.id, name: company.name }],
    [company.id, company.name]
  )

  // Breadcrumb items for Journal Entries page
  const breadcrumbItems = [
    {
      label: "Companies",
      href: `/organizations/${params.organizationId}/companies`
    },
    {
      label: company.name,
      href: `/organizations/${params.organizationId}/companies/${params.companyId}`
    },
    {
      label: "Journal Entries",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries`
    }
  ]

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div data-testid="journal-entries-page">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
                Journal Entries
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {company.name} - {company.functionalCurrency}
              </p>
            </div>

            {canCreateEntry && entries.length > 0 && (
              <Button
                icon={<Plus className="h-4 w-4" />}
                data-testid="create-journal-entry-button"
                onClick={() => {
                  navigate({
                    to: "/organizations/$organizationId/companies/$companyId/journal-entries/new",
                    params: { organizationId: params.organizationId, companyId: params.companyId }
                  })
                }}
              >
                New Entry
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 space-y-4" data-testid="journal-entries-toolbar">
          {/* Search and Count Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              id="journal-entries-search-input"
              data-testid="journal-entries-search-input"
              inputPrefix={<Search className="h-4 w-4" />}
              className="w-64 text-sm"
            />

            <span className="text-sm text-gray-500" data-testid="journal-entries-count">
              {filteredEntries.length} of {total} entries
            </span>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-4" data-testid="journal-entries-filters">
            {/* Filter by Status */}
            <Select
              value={filterStatus}
              onChange={(e) => {
                const value = e.target.value
                if (isEntryStatusFilter(value)) {
                  setFilterStatus(value)
                }
              }}
              id="journal-entries-filter-status"
              data-testid="journal-entries-filter-status"
              className="text-sm"
              options={[
                { value: "All", label: "All Statuses" },
                { value: "Draft", label: "Draft" },
                { value: "PendingApproval", label: "Pending Approval" },
                { value: "Approved", label: "Approved" },
                { value: "Posted", label: "Posted" },
                { value: "Reversed", label: "Reversed" }
              ]}
            />

            {/* Filter by Entry Type */}
            <Select
              value={filterType}
              onChange={(e) => {
                const value = e.target.value
                if (isEntryTypeFilter(value)) {
                  setFilterType(value)
                }
              }}
              id="journal-entries-filter-type"
              data-testid="journal-entries-filter-type"
              className="text-sm"
              options={[
                { value: "All", label: "All Types" },
                { value: "Standard", label: "Standard" },
                { value: "Adjusting", label: "Adjusting" },
                { value: "Closing", label: "Closing" },
                { value: "Opening", label: "Opening" },
                { value: "Reversing", label: "Reversing" },
                { value: "Recurring", label: "Recurring" },
                { value: "Intercompany", label: "Intercompany" },
                { value: "Revaluation", label: "Revaluation" },
                { value: "Elimination", label: "Elimination" },
                { value: "System", label: "System" }
              ]}
            />

            {/* Filter by Fiscal Year */}
            <Select
              value={filterFiscalYear}
              onChange={(e) => {
                setFilterFiscalYear(e.target.value)
                setFilterFiscalPeriod("All") // Reset period when year changes
              }}
              id="journal-entries-filter-fiscal-year"
              data-testid="journal-entries-filter-fiscal-year"
              className="text-sm"
            >
              <option value="All">All Fiscal Years</option>
              {availableFiscalYears.map((year) => (
                <option key={year} value={year.toString()}>
                  FY {year}
                </option>
              ))}
            </Select>

            {/* Filter by Fiscal Period */}
            <Select
              value={filterFiscalPeriod}
              onChange={(e) => setFilterFiscalPeriod(e.target.value)}
              disabled={filterFiscalYear === "All"}
              id="journal-entries-filter-fiscal-period"
              data-testid="journal-entries-filter-fiscal-period"
              className="text-sm"
            >
              <option value="All">All Periods</option>
              {availablePeriods.map((periodNum) => (
                <option key={periodNum} value={periodNum.toString()}>
                  P{periodNum}
                </option>
              ))}
            </Select>

            {/* Date Range Filters */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">From:</label>
              <Input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                id="journal-entries-filter-from-date"
                data-testid="journal-entries-filter-from-date"
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">To:</label>
              <Input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                id="journal-entries-filter-to-date"
                data-testid="journal-entries-filter-to-date"
                className="text-sm"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="secondary"
                onClick={clearFilters}
                data-testid="journal-entries-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Journal Entries List */}
        {entries.length === 0 ? (
          <JournalEntriesEmptyState
            organizationId={params.organizationId}
            companyId={params.companyId}
            canCreateEntry={canCreateEntry}
          />
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" data-testid="journal-entries-no-results">
            <p className="text-gray-500">No journal entries match your filter criteria.</p>
            <button
              onClick={clearFilters}
              data-testid="journal-entries-clear-filters-inline"
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <JournalEntriesTable
            entries={filteredEntries}
            organizationId={params.organizationId}
            companyId={params.companyId}
          />
        )}
      </div>
    </AppLayout>
  )
}

// =============================================================================
// Journal Entries Table Component
// =============================================================================

function JournalEntriesTable({
  entries,
  organizationId,
  companyId
}: {
  readonly entries: readonly JournalEntry[]
  readonly organizationId: string
  readonly companyId: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden" data-testid="journal-entries-table">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium uppercase tracking-wider text-gray-500" data-testid="journal-entries-table-header">
        <div className="col-span-2" data-testid="header-date">
          <Tooltip content="Transaction date when the entry occurred">
            <span className="cursor-help">Date</span>
          </Tooltip>
        </div>
        <div className="col-span-2" data-testid="header-reference">
          <Tooltip content="Entry reference number (user-defined) or system-generated entry number">
            <span className="cursor-help">Reference</span>
          </Tooltip>
        </div>
        <div className="col-span-3" data-testid="header-description">
          <Tooltip content="Description of the journal entry transaction">
            <span className="cursor-help">Description</span>
          </Tooltip>
        </div>
        <div className="col-span-1" data-testid="header-type">
          <Tooltip content="Entry type: Standard, Adjusting, Closing, Opening, Reversing, etc.">
            <span className="cursor-help">Type</span>
          </Tooltip>
        </div>
        <div className="col-span-2" data-testid="header-period">
          <Tooltip content="Fiscal period (year and period number) to which this entry is posted">
            <span className="cursor-help">Period</span>
          </Tooltip>
        </div>
        <div className="col-span-1" data-testid="header-status">
          <Tooltip content="Current state: Draft, Pending Approval, Approved, Posted, or Reversed">
            <span className="cursor-help">Status</span>
          </Tooltip>
        </div>
        <div className="col-span-1"></div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <JournalEntryRow
            key={entry.id}
            entry={entry}
            organizationId={organizationId}
            companyId={companyId}
          />
        ))}
      </div>
    </div>
  )
}

function JournalEntryRow({
  entry,
  organizationId,
  companyId
}: {
  readonly entry: JournalEntry
  readonly organizationId: string
  readonly companyId: string
}) {
  const formattedDate = formatLocalDate(entry.transactionDate)
  // Show reference number (user-defined) if available, otherwise entry number (system-generated)
  const primaryRef = entry.referenceNumber ?? (entry.entryNumber ? `#${entry.entryNumber}` : "—")
  // If both exist, show entry number as secondary
  const secondaryRef = entry.referenceNumber && entry.entryNumber ? `#${entry.entryNumber}` : null
  const entryIdentifier = entry.referenceNumber ?? (entry.entryNumber ? String(entry.entryNumber) : entry.id)

  return (
    <Link
      to="/organizations/$organizationId/companies/$companyId/journal-entries/$entryId"
      params={{
        organizationId,
        companyId,
        entryId: entry.id
      }}
      className="grid grid-cols-12 items-center gap-4 px-4 py-3 hover:bg-gray-50"
      data-testid={`journal-entry-row-${entryIdentifier}`}
    >
      {/* Date */}
      <div className="col-span-2 text-sm text-gray-900" data-testid={`journal-entry-date-${entryIdentifier}`}>
        {formattedDate}
      </div>

      {/* Reference */}
      <div className="col-span-2" data-testid={`journal-entry-reference-${entryIdentifier}`}>
        <span className="font-mono text-sm text-gray-700">{primaryRef}</span>
        {secondaryRef && (
          <span className="ml-1 text-xs text-gray-500">({secondaryRef})</span>
        )}
        {entry.isReversing && (
          <span className="ml-2 text-xs text-orange-600">(Reversal)</span>
        )}
      </div>

      {/* Description */}
      <div className="col-span-3 truncate text-sm text-gray-900" data-testid={`journal-entry-description-${entryIdentifier}`}>
        {entry.description}
      </div>

      {/* Type */}
      <div className="col-span-1" data-testid={`journal-entry-type-${entryIdentifier}`}>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getEntryTypeColor(entry.entryType)}`}
        >
          {formatEntryType(entry.entryType)}
        </span>
      </div>

      {/* Period */}
      <div className="col-span-2 text-sm text-gray-600" data-testid={`journal-entry-period-${entryIdentifier}`}>
        {entry.fiscalPeriod.year} P{entry.fiscalPeriod.period}
      </div>

      {/* Status */}
      <div className="col-span-1" data-testid={`journal-entry-status-${entryIdentifier}`}>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(entry.status)}`}
        >
          {formatStatus(entry.status)}
        </span>
      </div>

      {/* View indicator */}
      <div className="col-span-1 text-right">
        <span className="text-gray-400" data-testid={`journal-entry-view-${entryIdentifier}`}>
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}

// =============================================================================
// Empty State Component
// =============================================================================

function JournalEntriesEmptyState({
  organizationId,
  companyId,
  canCreateEntry
}: {
  readonly organizationId: string
  readonly companyId: string
  readonly canCreateEntry: boolean
}) {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" data-testid="journal-entries-empty-state">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <FileText className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        No journal entries yet
      </h3>
      <p className="mb-6 text-gray-500">
        Journal entries will appear here once created.
      </p>
      {canCreateEntry && (
        <Button
          icon={<Plus className="h-5 w-5" />}
          data-testid="create-journal-entry-empty-button"
          onClick={() => {
            navigate({
              to: "/organizations/$organizationId/companies/$companyId/journal-entries/new",
              params: { organizationId, companyId }
            })
          }}
        >
          Create Journal Entry
        </Button>
      )}
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatLocalDate(date: LocalDate): string {
  // Use UTC date to avoid timezone shifts
  // LocalDate represents a calendar date, not a moment in time
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day))
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"  // Format in UTC to preserve the date
  })
}

function getStatusColor(status: JournalEntryStatus): string {
  const colors: Record<JournalEntryStatus, string> = {
    Draft: "bg-gray-100 text-gray-800",
    PendingApproval: "bg-yellow-100 text-yellow-800",
    Approved: "bg-blue-100 text-blue-800",
    Posted: "bg-green-100 text-green-800",
    Reversed: "bg-red-100 text-red-800"
  }
  return colors[status]
}

function formatStatus(status: JournalEntryStatus): string {
  const names: Record<JournalEntryStatus, string> = {
    Draft: "Draft",
    PendingApproval: "Pending",
    Approved: "Approved",
    Posted: "Posted",
    Reversed: "Reversed"
  }
  return names[status]
}

function getEntryTypeColor(type: JournalEntryType): string {
  const colors: Record<JournalEntryType, string> = {
    Standard: "bg-gray-100 text-gray-800",
    Adjusting: "bg-purple-100 text-purple-800",
    Closing: "bg-orange-100 text-orange-800",
    Opening: "bg-blue-100 text-blue-800",
    Reversing: "bg-red-100 text-red-800",
    Recurring: "bg-teal-100 text-teal-800",
    Intercompany: "bg-indigo-100 text-indigo-800",
    Revaluation: "bg-yellow-100 text-yellow-800",
    Elimination: "bg-pink-100 text-pink-800",
    System: "bg-gray-100 text-gray-800"
  }
  return colors[type]
}

function formatEntryType(type: JournalEntryType): string {
  const names: Record<JournalEntryType, string> = {
    Standard: "Std",
    Adjusting: "Adj",
    Closing: "Close",
    Opening: "Open",
    Reversing: "Rev",
    Recurring: "Rec",
    Intercompany: "IC",
    Revaluation: "Reval",
    Elimination: "Elim",
    System: "Sys"
  }
  return names[type]
}
