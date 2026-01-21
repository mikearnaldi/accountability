/**
 * Fiscal Period Management Page
 *
 * Lists fiscal years and periods with status management:
 * - Fiscal year list with year, status, date range
 * - Period list with status, dates, and transition actions
 * - Create fiscal year modal
 * - Period status transitions (Open, Soft Close, Close, Lock, Reopen)
 *
 * Route: /organizations/:organizationId/companies/:companyId/fiscal-periods
 */

import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo, useEffect } from "react"
import {
  Calendar,
  Plus,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
  Play,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X
} from "lucide-react"
import { clsx } from "clsx"
import { api } from "@/api/client"
import { createServerApi } from "@/api/server"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { usePermissions } from "@/hooks/usePermissions"

// =============================================================================
// Types
// =============================================================================

type FiscalYearStatus = "Open" | "Closed"
type FiscalPeriodStatus = "Open" | "Closed"
type FiscalPeriodType = "Regular" | "Adjustment" | "Closing"

interface LocalDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface FiscalYear {
  readonly id: string
  readonly companyId: string
  readonly name: string
  readonly year: number
  readonly status: FiscalYearStatus
  readonly startDate: LocalDate
  readonly endDate: LocalDate
}

interface FiscalPeriod {
  readonly id: string
  readonly fiscalYearId: string
  readonly periodNumber: number
  readonly name: string
  readonly periodType: FiscalPeriodType
  readonly startDate: LocalDate
  readonly endDate: LocalDate
  readonly status: FiscalPeriodStatus
}

interface Company {
  readonly id: string
  readonly name: string
  readonly functionalCurrency: string
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
}

interface Organization {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchFiscalData = createServerFn({ method: "GET" })
  .inputValidator((data: { organizationId: string; companyId: string }) => data)
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        fiscalYears: [],
        company: null,
        organization: null,
        allCompanies: [],
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      const [fiscalYearsResult, companyResult, orgResult, allCompaniesResult] = await Promise.all([
        serverApi.GET("/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years", {
          params: { path: { organizationId: data.organizationId, companyId: data.companyId } },
          headers: { Authorization }
        }),
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
        })
      ])

      if (companyResult.error) {
        // Check for domain-specific NotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof companyResult.error === "object" && "_tag" in companyResult.error &&
            companyResult.error._tag === "CompanyNotFoundError") {
          return { fiscalYears: [], company: null, organization: null, allCompanies: [], error: "not_found" as const }
        }
        return { fiscalYears: [], company: null, organization: null, allCompanies: [], error: "failed" as const }
      }

      return {
        fiscalYears: fiscalYearsResult.data?.fiscalYears ?? [],
        company: companyResult.data,
        organization: orgResult.data,
        allCompanies: allCompaniesResult.data?.companies ?? [],
        error: null
      }
    } catch {
      return { fiscalYears: [], company: null, organization: null, allCompanies: [], error: "failed" as const }
    }
  })

// =============================================================================
// Constants
// =============================================================================

const YEAR_STATUS_STYLES: Record<FiscalYearStatus, { bg: string; text: string; icon: typeof Lock }> = {
  Open: { bg: "bg-green-100", text: "text-green-700", icon: Play },
  Closed: { bg: "bg-gray-100", text: "text-gray-700", icon: Lock }
}

const PERIOD_STATUS_STYLES: Record<FiscalPeriodStatus, { bg: string; text: string; icon: typeof Lock }> = {
  Open: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
  Closed: { bg: "bg-gray-100", text: "text-gray-700", icon: Lock }
}

const PERIOD_STATUS_LABELS: Record<FiscalPeriodStatus, string> = {
  Open: "Open",
  Closed: "Closed"
}

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/companies/$companyId/fiscal-periods/")({
  beforeLoad: async ({ context, params }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/organizations/${params.organizationId}/companies/${params.companyId}/fiscal-periods`
        }
      })
    }
  },
  loader: async ({ params }) => {
    const result = await fetchFiscalData({
      data: { organizationId: params.organizationId, companyId: params.companyId }
    })

    if (result.error === "not_found") {
      throw new Error("Company not found")
    }

    return result
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: FiscalPeriodsPage
})

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(date: LocalDate): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${months[date.month - 1]} ${date.day}, ${date.year}`
}

function parseLocalDate(dateStr: string): LocalDate | null {
  const parts = dateStr.split("-")
  if (parts.length !== 3) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  return { year, month, day }
}

// =============================================================================
// Create Fiscal Year Modal
// =============================================================================

interface CreateFiscalYearModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  companyId: string
  fiscalYearEnd: { month: number; day: number }
  onCreated: () => Promise<void>
}

function CreateFiscalYearModal({
  isOpen,
  onClose,
  organizationId,
  companyId,
  fiscalYearEnd,
  onCreated
}: CreateFiscalYearModalProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear.toString())
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate default dates based on fiscal year end
  const computedStartDate = useMemo(() => {
    const yearNum = parseInt(year, 10)
    if (isNaN(yearNum)) return ""
    // If fiscal year end is Dec 31, start date is Jan 1 of the same year
    // Otherwise, start date is the day after the fiscal year end of the previous year
    if (fiscalYearEnd.month === 12 && fiscalYearEnd.day === 31) {
      return `${yearNum}-01-01`
    }
    // For non-calendar years, start is the day after the fiscal year end
    const startMonth = fiscalYearEnd.month
    const startDay = fiscalYearEnd.day + 1
    // Simple calculation - may need adjustment for month overflow
    return `${yearNum - 1}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`
  }, [year, fiscalYearEnd])

  const computedEndDate = useMemo(() => {
    const yearNum = parseInt(year, 10)
    if (isNaN(yearNum)) return ""
    return `${yearNum}-${String(fiscalYearEnd.month).padStart(2, "0")}-${String(fiscalYearEnd.day).padStart(2, "0")}`
  }, [year, fiscalYearEnd])

  const [startDate, setStartDate] = useState(computedStartDate)
  const [endDate, setEndDate] = useState(computedEndDate)

  // Update dates when year changes
  useMemo(() => {
    setStartDate(computedStartDate)
    setEndDate(computedEndDate)
  }, [computedStartDate, computedEndDate])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const yearNum = parseInt(year, 10)
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2999) {
      setError("Year must be between 1900 and 2999")
      setIsSubmitting(false)
      return
    }

    const parsedStart = parseLocalDate(startDate)
    const parsedEnd = parseLocalDate(endDate)

    if (!parsedStart || !parsedEnd) {
      setError("Invalid date format")
      setIsSubmitting(false)
      return
    }

    try {
      const { error: apiError } = await api.POST(
        "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years",
        {
          params: { path: { organizationId, companyId } },
          body: {
            year: yearNum,
            name: name.trim() || null,
            startDate: parsedStart,
            endDate: parsedEnd
          }
        }
      )

      if (apiError) {
        if (typeof apiError === "object" && "message" in apiError && typeof apiError.message === "string") {
          setError(apiError.message)
        } else {
          setError("Failed to create fiscal year")
        }
        setIsSubmitting(false)
        return
      }

      await onCreated()
      onClose()
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="create-fiscal-year-modal">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create Fiscal Year</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500" data-testid="close-modal-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Year *</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={1900}
              max={2999}
              required
              data-testid="fiscal-year-input"
            />
            <p className="mt-1 text-xs text-gray-500">The fiscal year number (e.g., 2025)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Name (optional)</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`FY ${year}`}
              data-testid="fiscal-year-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date *</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                data-testid="fiscal-year-start-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date *</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                data-testid="fiscal-year-end-date"
              />
            </div>
          </div>

          {/* Info box explaining 13 periods will be created */}
          <div className="rounded-md bg-blue-50 p-3" data-testid="period-13-info">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">This will create 13 periods:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>Periods 1-12: Regular monthly periods</li>
                  <li>Period 13: Adjustment period for year-end entries</li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600" data-testid="error-message">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="create-fiscal-year-submit">
              {isSubmitting ? "Creating..." : "Create Fiscal Year"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// Fiscal Year Card with Periods
// =============================================================================

interface FiscalYearCardProps {
  fiscalYear: FiscalYear
  organizationId: string
  companyId: string
  onRefresh: () => void
  canManage: boolean
}

// Preview response type from API schema
interface YearEndClosePreviewResponse {
  readonly fiscalYearId: string
  readonly fiscalYearName: string
  readonly totalRevenue: { readonly amount: string; readonly currency: string }
  readonly totalExpenses: { readonly amount: string; readonly currency: string }
  readonly netIncome: { readonly amount: string; readonly currency: string }
  readonly retainedEarningsAccount: { readonly id: string; readonly number: string; readonly name: string } | null
  readonly canProceed: boolean
  readonly blockers: readonly string[]
}

function FiscalYearCard({ fiscalYear, organizationId, companyId, onRefresh, canManage }: FiscalYearCardProps) {
  const [isExpanded, setIsExpanded] = useState(fiscalYear.status === "Open")
  const [periods, setPeriods] = useState<FiscalPeriod[]>([])
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false)
  const [periodsLoaded, setPeriodsLoaded] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Year-end close confirmation state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closePreview, setClosePreview] = useState<YearEndClosePreviewResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const StatusIcon = YEAR_STATUS_STYLES[fiscalYear.status].icon

  // Auto-load periods when card starts expanded (e.g., for Open fiscal years)
  useEffect(() => {
    if (isExpanded && !periodsLoaded && !isLoadingPeriods) {
      fetchPeriods()
    }
  }, []) // Only on mount - intentionally empty deps to avoid re-triggering

  // Fetch periods from API (always fetches fresh data)
  const fetchPeriods = async () => {
    setIsLoadingPeriods(true)
    try {
      const { data, error } = await api.GET(
        "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods",
        {
          params: { path: { organizationId, companyId, fiscalYearId: fiscalYear.id } }
        }
      )
      if (!error && data) {
        setPeriods(data.periods)
        setPeriodsLoaded(true)
      }
    } catch {
      // Fetch error handled below
    } finally {
      setIsLoadingPeriods(false)
    }
  }

  // Load periods when expanded (only on first expand)
  const loadPeriods = async () => {
    if (periodsLoaded) return
    await fetchPeriods()
  }

  const handleToggle = () => {
    if (!isExpanded) {
      loadPeriods()
    }
    setIsExpanded(!isExpanded)
  }

  // Period status transitions
  const handlePeriodAction = async (
    period: FiscalPeriod,
    action: "open" | "close"
  ) => {
    setActionLoading(period.id)
    setActionError(null)
    const endpoint = `/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/periods/{periodId}/${action}` as const

    const actionLabels: Record<string, string> = {
      open: "open",
      close: "close"
    }

    try {
      const { error } = await api.POST(endpoint, {
        params: {
          path: {
            organizationId,
            companyId,
            fiscalYearId: fiscalYear.id,
            periodId: period.id
          }
        }
      })

      if (error) {
        const errorMessage = typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : `Failed to ${actionLabels[action]} period`
        setActionError(errorMessage)
      } else {
        // Force reload periods after successful action
        await fetchPeriods()
      }
    } catch {
      setActionError(`Failed to ${actionLabels[action]} period. Please try again.`)
    } finally {
      setActionLoading(null)
    }
  }

  // Year-level actions - fetch preview first
  const handleCloseYearClick = async () => {
    setPreviewLoading(true)
    setActionError(null)
    try {
      const { data, error } = await api.GET(
        "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/close/preview",
        {
          params: { path: { organizationId, companyId, fiscalYearId: fiscalYear.id } }
        }
      )
      if (error) {
        const errorMessage = typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to fetch year-end close preview"
        setActionError(errorMessage)
      } else if (data) {
        // Map API response to our local interface shape
        const preview: YearEndClosePreviewResponse = {
          fiscalYearId: data.fiscalYearId,
          fiscalYearName: data.fiscalYearName,
          totalRevenue: data.totalRevenue,
          totalExpenses: data.totalExpenses,
          netIncome: data.netIncome,
          retainedEarningsAccount: data.retainedEarningsAccount ?? null,
          canProceed: data.canProceed,
          blockers: data.blockers
        }
        setClosePreview(preview)
        setShowCloseConfirm(true)
      }
    } catch {
      setActionError("Failed to fetch year-end close preview. Please try again.")
    } finally {
      setPreviewLoading(false)
    }
  }

  // Execute the actual close after confirmation
  const handleConfirmCloseYear = async () => {
    setActionLoading("year-close")
    setActionError(null)
    try {
      const { error } = await api.POST(
        "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/close",
        {
          params: { path: { organizationId, companyId, fiscalYearId: fiscalYear.id } }
        }
      )
      if (error) {
        const errorMessage = typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to close fiscal year"
        setActionError(errorMessage)
        setShowCloseConfirm(false)
      } else {
        setShowCloseConfirm(false)
        setClosePreview(null)
        onRefresh()
      }
    } catch {
      setActionError("Failed to close fiscal year. Please try again.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelCloseYear = () => {
    setShowCloseConfirm(false)
    setClosePreview(null)
  }

  const handleReopenYear = async () => {
    setActionLoading("year-reopen")
    setActionError(null)
    try {
      const { error } = await api.POST(
        "/api/v1/organizations/{organizationId}/companies/{companyId}/fiscal-years/{fiscalYearId}/reopen",
        {
          params: { path: { organizationId, companyId, fiscalYearId: fiscalYear.id } }
        }
      )
      if (error) {
        const errorMessage = typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to reopen fiscal year"
        setActionError(errorMessage)
      } else {
        onRefresh()
      }
    } catch {
      setActionError("Failed to reopen fiscal year. Please try again.")
    } finally {
      setActionLoading(null)
    }
  }

  // Get available actions for a period based on its status
  // Simple 2-state model: Open ←→ Closed
  const getAvailableActions = (period: FiscalPeriod) => {
    const actions: Array<{ action: "open" | "close"; label: string; icon: typeof Lock }> = []

    if (period.status === "Open") {
      actions.push({ action: "close", label: "Close", icon: Lock })
    } else {
      actions.push({ action: "open", label: "Open", icon: Unlock })
    }

    return actions
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid={`fiscal-year-${fiscalYear.year}`}>
      {/* Fiscal Year Header */}
      <div
        className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
        onClick={handleToggle}
        data-testid={`fiscal-year-header-${fiscalYear.year}`}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{fiscalYear.name}</span>
              <span
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  YEAR_STATUS_STYLES[fiscalYear.status].bg,
                  YEAR_STATUS_STYLES[fiscalYear.status].text
                )}
                data-testid={`fiscal-year-status-${fiscalYear.year}`}
              >
                <StatusIcon className="h-3 w-3" />
                {fiscalYear.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {formatDate(fiscalYear.startDate)} - {formatDate(fiscalYear.endDate)}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {fiscalYear.status === "Open" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCloseYearClick}
                disabled={actionLoading === "year-close" || previewLoading}
                data-testid={`close-year-${fiscalYear.year}`}
              >
                {previewLoading ? "Loading..." : "Close Year"}
              </Button>
            )}
            {fiscalYear.status === "Closed" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReopenYear}
                disabled={actionLoading === "year-reopen"}
                data-testid={`reopen-year-${fiscalYear.year}`}
              >
                Reopen
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Periods List */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Error banner */}
          {actionError && (
            <div className="m-4 rounded-md bg-red-50 p-3" data-testid="action-error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-600">{actionError}</p>
                <button
                  onClick={() => setActionError(null)}
                  className="ml-auto text-red-600 hover:text-red-800"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {isLoadingPeriods ? (
            <div className="p-4 text-center text-sm text-gray-500">
              <RefreshCw className="mx-auto h-5 w-5 animate-spin" />
              <p className="mt-2">Loading periods...</p>
            </div>
          ) : periods.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No periods found for this fiscal year.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Period</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Date Range</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  {canManage && (
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {periods.map((period) => {
                  const PeriodStatusIcon = PERIOD_STATUS_STYLES[period.status].icon
                  const availableActions = getAvailableActions(period)

                  return (
                    <tr key={period.id} data-testid={`period-row-${period.periodNumber}`}>
                      <td className="px-4 py-3 text-sm text-gray-900">{period.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{period.periodType}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                            PERIOD_STATUS_STYLES[period.status].bg,
                            PERIOD_STATUS_STYLES[period.status].text
                          )}
                          data-testid={`period-status-${period.periodNumber}`}
                        >
                          <PeriodStatusIcon className="h-3 w-3" />
                          {PERIOD_STATUS_LABELS[period.status]}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {availableActions.map(({ action, label, icon: ActionIcon }) => (
                              <Button
                                key={action}
                                variant="ghost"
                                size="sm"
                                icon={<ActionIcon className="h-4 w-4" />}
                                onClick={() => handlePeriodAction(period, action)}
                                disabled={actionLoading === period.id}
                                data-testid={`period-${action}-${period.periodNumber}`}
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Year-End Close Confirmation Dialog */}
      {showCloseConfirm && closePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="close-year-confirm-modal">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {closePreview.canProceed ? "Close Fiscal Year?" : "Cannot Close Year"}
              </h2>
              <button onClick={handleCancelCloseYear} className="text-gray-400 hover:text-gray-500" data-testid="close-confirm-cancel-x">
                <X className="h-5 w-5" />
              </button>
            </div>

            {closePreview.canProceed ? (
              <>
                <div className="space-y-4">
                  {/* Net income summary */}
                  <div className="rounded-md bg-blue-50 p-4">
                    <p className="text-sm text-blue-700">
                      Net income of <strong className="font-semibold">{closePreview.netIncome.currency} {parseFloat(closePreview.netIncome.amount).toLocaleString()}</strong> will be posted to{" "}
                      {closePreview.retainedEarningsAccount ? (
                        <strong className="font-semibold">{closePreview.retainedEarningsAccount.name} ({closePreview.retainedEarningsAccount.number})</strong>
                      ) : (
                        <span className="text-red-600">No account configured</span>
                      )}.
                    </p>
                  </div>

                  {/* What will happen */}
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">This will:</p>
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                      <li>Close all revenue accounts</li>
                      <li>Close all expense accounts</li>
                      <li>Close all open periods</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="secondary" onClick={handleCancelCloseYear} disabled={actionLoading === "year-close"}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmCloseYear} disabled={actionLoading === "year-close"} data-testid="confirm-close-year-btn">
                    {actionLoading === "year-close" ? "Closing..." : "Close Year"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Blockers list */}
                <div className="space-y-4">
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                      <div>
                        <p className="text-sm font-medium text-red-800">The following issues must be resolved:</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700">
                          {closePreview.blockers.map((blocker: string, idx: number) => (
                            <li key={idx}>{blocker}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button variant="secondary" onClick={handleCancelCloseYear}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function FiscalPeriodsPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const params = Route.useParams()
  const router = useRouter()
  const user = context.user
  const organizations = context.organizations ?? []

  /* eslint-disable @typescript-eslint/consistent-type-assertions */
  const fiscalYears = loaderData.fiscalYears as FiscalYear[]
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  const allCompanies = loaderData.allCompanies as Array<{ id: string; name: string }>
  /* eslint-enable @typescript-eslint/consistent-type-assertions */

  const [showCreateModal, setShowCreateModal] = useState(false)

  // Permission checks
  const { canPerform } = usePermissions()
  const canManagePeriods = canPerform("fiscal_period:manage")

  const companiesForSidebar = useMemo(
    () => allCompanies.map((c) => ({ id: c.id, name: c.name })),
    [allCompanies]
  )

  if (!company || !organization) {
    return null
  }

  const breadcrumbItems = [
    { label: "Companies", href: `/organizations/${params.organizationId}/companies` },
    { label: company.name, href: `/organizations/${params.organizationId}/companies/${params.companyId}` },
    { label: "Fiscal Periods", href: `/organizations/${params.organizationId}/companies/${params.companyId}/fiscal-periods` }
  ]

  const handleRefresh = async () => {
    await router.invalidate()
  }

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={companiesForSidebar}
    >
      <div className="space-y-6" data-testid="fiscal-periods-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fiscal Periods</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage fiscal years and periods for {company.name}
            </p>
          </div>
          {canManagePeriods && (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreateModal(true)}
              data-testid="create-fiscal-year-btn"
            >
              Create Fiscal Year
            </Button>
          )}
        </div>

        {/* Info banner */}
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Fiscal Period Management</p>
              <p className="text-sm text-blue-700">
                Periods are either <strong>Open</strong> (accepts journal entries) or <strong>Closed</strong> (no entries allowed).
              </p>
            </div>
          </div>
        </div>

        {/* Fiscal Years List */}
        {fiscalYears.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Fiscal Years</h3>
            <p className="mt-2 text-sm text-gray-500">
              Create your first fiscal year to start managing accounting periods.
            </p>
            {canManagePeriods && (
              <Button
                className="mt-4"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setShowCreateModal(true)}
                data-testid="create-first-fiscal-year"
              >
                Create Fiscal Year
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {fiscalYears.map((fy) => (
              <FiscalYearCard
                key={fy.id}
                fiscalYear={fy}
                organizationId={params.organizationId}
                companyId={params.companyId}
                onRefresh={handleRefresh}
                canManage={canManagePeriods}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Fiscal Year Modal */}
      <CreateFiscalYearModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        organizationId={params.organizationId}
        companyId={params.companyId}
        fiscalYearEnd={company.fiscalYearEnd}
        onCreated={handleRefresh}
      />
    </AppLayout>
  )
}
