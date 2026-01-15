import { createFileRoute, redirect, Link } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo } from "react"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { Tooltip } from "@/components/ui/Tooltip"

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

interface FiscalPeriod {
  readonly id: string
  readonly fiscalYearId: string
  readonly periodNumber: number
  readonly name: string
  readonly periodType: string
  readonly startDate: LocalDate
  readonly endDate: LocalDate
  readonly status: string
}

interface FiscalYear {
  readonly id: string
  readonly companyId: string
  readonly name: string
  readonly startDate: LocalDate
  readonly endDate: LocalDate
  readonly status: string
  readonly periods: readonly FiscalPeriod[]
}

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
        fiscalYears: [],
        error: "unauthorized" as const
      }
    }

    try {
      // Create server API client with dynamic base URL from request context
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      // Fetch journal entries, company, organization, and fiscal years in parallel
      const [entriesResult, companyResult, orgResult, fiscalYearsResult] = await Promise.all([
        serverApi.GET("/api/v1/journal-entries", {
          params: { query: { companyId: data.companyId, limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/companies/{id}", {
          params: { path: { id: data.companyId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/organizations/{id}", {
          params: { path: { id: data.organizationId } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/fiscal/fiscal-years", {
          params: { query: { companyId: data.companyId, limit: "100" } },
          headers: { Authorization }
        })
      ])

      if (companyResult.error) {
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error && companyResult.error._tag === "NotFoundError") {
          return {
            entries: [],
            total: 0,
            company: null,
            organization: null,
            fiscalYears: [],
            error: "not_found" as const
          }
        }
        return {
          entries: [],
          total: 0,
          company: null,
          organization: null,
          fiscalYears: [],
          error: "failed" as const
        }
      }

      if (orgResult.error || entriesResult.error) {
        return {
          entries: [],
          total: 0,
          company: null,
          organization: null,
          fiscalYears: [],
          error: "failed" as const
        }
      }

      return {
        entries: entriesResult.data?.entries ?? [],
        total: entriesResult.data?.total ?? 0,
        company: companyResult.data,
        organization: orgResult.data,
        fiscalYears: fiscalYearsResult.data?.fiscalYears ?? [],
        error: null
      }
    } catch {
      return {
        entries: [],
        total: 0,
        company: null,
        organization: null,
        fiscalYears: [],
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
      organization: result.organization,
      fiscalYears: result.fiscalYears
    }
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Accountability
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to="/organizations"
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              Organizations
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-medium text-red-800">Error</h2>
          <p className="mt-2 text-red-700">{error.message}</p>
          <Link
            to="/organizations"
            className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            Back to Organizations
          </Link>
        </div>
      </main>
    </div>
  ),
  component: JournalEntriesPage
})

// =============================================================================
// Journal Entries Page Component
// =============================================================================

function JournalEntriesPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const entries = loaderData.entries as readonly JournalEntry[]
  const total = loaderData.total as number
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  const fiscalYears = loaderData.fiscalYears as readonly FiscalYear[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const user = context.user

  // UI State - Filters
  const [filterStatus, setFilterStatus] = useState<JournalEntryStatus | "All">("All")
  const [filterType, setFilterType] = useState<JournalEntryType | "All">("All")
  const [filterFiscalYear, setFilterFiscalYear] = useState<string>("All")
  const [filterFiscalPeriod, setFilterFiscalPeriod] = useState<string>("All")
  const [filterFromDate, setFilterFromDate] = useState<string>("")
  const [filterToDate, setFilterToDate] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

  // Get available periods for selected fiscal year
  const availablePeriods = useMemo(() => {
    if (filterFiscalYear === "All") return []
    const selectedYear = fiscalYears.find(fy => fy.id === filterFiscalYear)
    return selectedYear?.periods ?? []
  }, [filterFiscalYear, fiscalYears])

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

    // Filter by fiscal year
    if (filterFiscalYear !== "All") {
      const selectedYear = fiscalYears.find(fy => fy.id === filterFiscalYear)
      if (selectedYear) {
        const yearNum = parseInt(selectedYear.name.replace(/\D/g, ""), 10)
        result = result.filter((entry) => entry.fiscalPeriod.year === yearNum)
      }
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
  }, [entries, filterStatus, filterType, filterFiscalYear, filterFiscalPeriod, filterFromDate, filterToDate, searchQuery, fiscalYears])

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

            <Link
              to="/organizations/$organizationId/companies/$companyId/journal-entries/new"
              params={{
                organizationId: params.organizationId,
                companyId: params.companyId
              }}
              data-testid="create-journal-entry-button"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Entry
            </Link>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 space-y-4" data-testid="journal-entries-toolbar">
          {/* Search and Count Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                data-testid="journal-entries-search-input"
                className="w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <span className="text-sm text-gray-500" data-testid="journal-entries-count">
              {filteredEntries.length} of {total} entries
            </span>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-4" data-testid="journal-entries-filters">
            {/* Filter by Status */}
            <select
              value={filterStatus}
              onChange={(e) => {
                const value = e.target.value
                if (isEntryStatusFilter(value)) {
                  setFilterStatus(value)
                }
              }}
              data-testid="journal-entries-filter-status"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="PendingApproval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Posted">Posted</option>
              <option value="Reversed">Reversed</option>
            </select>

            {/* Filter by Entry Type */}
            <select
              value={filterType}
              onChange={(e) => {
                const value = e.target.value
                if (isEntryTypeFilter(value)) {
                  setFilterType(value)
                }
              }}
              data-testid="journal-entries-filter-type"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Standard">Standard</option>
              <option value="Adjusting">Adjusting</option>
              <option value="Closing">Closing</option>
              <option value="Opening">Opening</option>
              <option value="Reversing">Reversing</option>
              <option value="Recurring">Recurring</option>
              <option value="Intercompany">Intercompany</option>
              <option value="Revaluation">Revaluation</option>
              <option value="Elimination">Elimination</option>
              <option value="System">System</option>
            </select>

            {/* Filter by Fiscal Year */}
            <select
              value={filterFiscalYear}
              onChange={(e) => {
                setFilterFiscalYear(e.target.value)
                setFilterFiscalPeriod("All") // Reset period when year changes
              }}
              data-testid="journal-entries-filter-fiscal-year"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Fiscal Years</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.name}
                </option>
              ))}
            </select>

            {/* Filter by Fiscal Period */}
            <select
              value={filterFiscalPeriod}
              onChange={(e) => setFilterFiscalPeriod(e.target.value)}
              disabled={filterFiscalYear === "All"}
              data-testid="journal-entries-filter-fiscal-period"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="All">All Periods</option>
              {availablePeriods.map((period) => (
                <option key={period.id} value={period.periodNumber.toString()}>
                  {period.name}
                </option>
              ))}
            </select>

            {/* Date Range Filters */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">From:</label>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                data-testid="journal-entries-filter-from-date"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">To:</label>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                data-testid="journal-entries-filter-to-date"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                data-testid="journal-entries-clear-filters"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Journal Entries List */}
        {entries.length === 0 ? (
          <JournalEntriesEmptyState
            organizationId={params.organizationId}
            companyId={params.companyId}
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
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
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
  companyId
}: {
  readonly organizationId: string
  readonly companyId: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" data-testid="journal-entries-empty-state">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
        <svg
          className="h-6 w-6 text-blue-600"
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
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        No journal entries yet
      </h3>
      <p className="mb-6 text-gray-500">
        Journal entries will appear here once created.
      </p>
      <Link
        to="/organizations/$organizationId/companies/$companyId/journal-entries/new"
        params={{
          organizationId,
          companyId
        }}
        data-testid="create-journal-entry-empty-button"
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create Journal Entry
      </Link>
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
