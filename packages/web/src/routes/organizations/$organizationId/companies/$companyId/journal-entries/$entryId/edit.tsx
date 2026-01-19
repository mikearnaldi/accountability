/**
 * Edit Journal Entry Page
 *
 * SSR page for editing draft journal entries with:
 * - Pre-populated form with existing entry data
 * - Multi-line entry form with real-time balance validation
 * - Only allows editing entries in Draft status
 * - Computed fiscal period based on transaction date and company's fiscal year end
 */

import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { useState, useMemo, useCallback } from "react"
import { Plus, Calendar, Info, ArrowLeft } from "lucide-react"
import { createServerApi } from "@/api/server"
import { api } from "@/api/client"
import { AppLayout } from "@/components/layout/AppLayout"
import { MinimalRouteError } from "@/components/ui/RouteError"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import {
  JournalEntryLineEditor,
  type Account,
  type JournalEntryLine
} from "@/components/journal/JournalEntryLineEditor"
import { usePermissions } from "@/hooks/usePermissions"

// =============================================================================
// Types
// =============================================================================

type JournalEntryStatus = "Draft" | "PendingApproval" | "Approved" | "Posted" | "Reversed"
type JournalEntryType =
  | "Standard"
  | "Adjusting"
  | "Closing"
  | "Opening"
  | "Reversing"
  | "Recurring"
  | "Intercompany"
  | "Revaluation"
  | "Elimination"
  | "System"

const JOURNAL_ENTRY_TYPES = [
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
] as const

function isJournalEntryType(value: string): value is JournalEntryType {
  return JOURNAL_ENTRY_TYPES.some((t) => t === value)
}

interface LocalDate {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface FiscalPeriodRef {
  readonly year: number
  readonly period: number
}

interface MonetaryAmount {
  readonly amount: string
  readonly currency: string
}

interface JournalEntry {
  readonly id: string
  readonly companyId: string
  readonly entryNumber: string | null
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
}

interface JournalEntryLineData {
  readonly id: string
  readonly journalEntryId: string
  readonly lineNumber: number
  readonly accountId: string
  readonly debitAmount: MonetaryAmount | null
  readonly creditAmount: MonetaryAmount | null
  readonly memo: string | null
}

interface Company {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly legalName: string
  readonly functionalCurrency: string
  readonly fiscalYearEnd: {
    readonly month: number
    readonly day: number
  }
}

interface Organization {
  readonly id: string
  readonly name: string
}

interface CurrencyInfo {
  readonly code: string
  readonly name: string
  readonly symbol: string
}

interface FiscalYearEnd {
  readonly month: number
  readonly day: number
}

interface ComputedPeriod {
  readonly fiscalYear: number
  readonly periodNumber: number
  readonly periodName: string
  readonly periodDisplayName: string
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function parseAmount(value: string): number {
  if (!value || value.trim() === "") return 0
  const parsed = parseFloat(value.replace(/[^0-9.-]/g, ""))
  return isNaN(parsed) ? 0 : parsed
}

function formatAmount(value: number): string {
  if (value === 0) return "0.00"
  return value.toFixed(2)
}

function formatLocalDateToString(date: LocalDate): string {
  const year = date.year
  const month = String(date.month).padStart(2, "0")
  const day = String(date.day).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

/**
 * Get the number of days in a month
 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Compute fiscal period from a date and fiscal year end setting
 */
function computeFiscalPeriod(
  dateStr: string,
  fiscalYearEnd: FiscalYearEnd
): ComputedPeriod {
  // Parse the date string
  const [yearStr, monthStr, dayStr] = dateStr.split("-")
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  const { month: fyEndMonth, day: fyEndDay } = fiscalYearEnd

  // Determine fiscal year
  let fiscalYear: number
  if (fyEndMonth === 12 && fyEndDay === 31) {
    fiscalYear = year
  } else {
    const isPastFYEnd = month > fyEndMonth || (month === fyEndMonth && day > fyEndDay)
    fiscalYear = isPastFYEnd ? year + 1 : year
  }

  // Determine fiscal year start
  let fyStartYear: number
  let fyStartMonth: number

  if (fyEndMonth === 12 && fyEndDay === 31) {
    fyStartYear = fiscalYear
    fyStartMonth = 1
  } else {
    const prevEndMonth = fyEndMonth
    const prevEndDay = Math.min(fyEndDay, daysInMonth(fiscalYear - 1, prevEndMonth))
    const prevEndDate = new Date(Date.UTC(fiscalYear - 1, prevEndMonth - 1, prevEndDay))
    prevEndDate.setUTCDate(prevEndDate.getUTCDate() + 1)
    fyStartYear = prevEndDate.getUTCFullYear()
    fyStartMonth = prevEndDate.getUTCMonth() + 1
  }

  // Determine period number (1-12)
  let periodNumber: number
  if (fyStartMonth === 1) {
    periodNumber = month
  } else {
    let monthsFromStart: number
    if (year === fyStartYear) {
      monthsFromStart = month - fyStartMonth
    } else {
      monthsFromStart = (12 - fyStartMonth) + month
    }
    periodNumber = monthsFromStart + 1
  }

  // Clamp period to 1-12
  periodNumber = Math.max(1, Math.min(12, periodNumber))

  // Calculate period start date for display
  const periodStartMonth = ((fyStartMonth - 1 + periodNumber - 1) % 12) + 1
  let periodStartYear = fyStartYear
  if (fyStartMonth + periodNumber - 1 > 12) {
    periodStartYear = fyStartYear + 1
  }

  const periodName = `P${periodNumber}`
  const periodDisplayName = `${MONTH_NAMES[periodStartMonth - 1]} ${periodStartYear}`

  return {
    fiscalYear,
    periodNumber,
    periodName,
    periodDisplayName
  }
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchEditJournalEntryData = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { entryId: string; companyId: string; organizationId: string }) => data
  )
  .handler(async ({ data }) => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return {
        entry: null,
        lines: [],
        company: null,
        organization: null,
        accounts: [],
        currencies: [],
        error: "unauthorized" as const
      }
    }

    try {
      const serverApi = createServerApi()
      const Authorization = `Bearer ${sessionToken}`

      // Fetch journal entry, company, organization, accounts, and currencies in parallel
      const [entryResult, companyResult, orgResult, accountsResult, currenciesResult] = await Promise.all([
        serverApi.GET("/api/v1/journal-entries/{id}", {
          params: { path: { id: data.entryId }, query: { organizationId: data.organizationId } },
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
        serverApi.GET("/api/v1/accounts", {
          params: { query: { organizationId: data.organizationId, companyId: data.companyId, isPostable: "true", limit: "1000" } },
          headers: { Authorization }
        }),
        serverApi.GET("/api/v1/currencies", {
          params: { query: { isActive: "true" } },
          headers: { Authorization }
        })
      ])

      if (entryResult.error) {
        // Check for domain-specific JournalEntryNotFoundError using _tag (from Effect Schema TaggedError)
        if (typeof entryResult.error === "object" && "_tag" in entryResult.error &&
            entryResult.error._tag === "JournalEntryNotFoundError") {
          return {
            entry: null,
            lines: [],
            company: null,
            organization: null,
            accounts: [],
            currencies: [],
            error: "not_found" as const
          }
        }
        return {
          entry: null,
          lines: [],
          company: null,
          organization: null,
          accounts: [],
          currencies: [],
          error: "failed" as const
        }
      }

      if (companyResult.error || orgResult.error) {
        return {
          entry: null,
          lines: [],
          company: null,
          organization: null,
          accounts: [],
          currencies: [],
          error: "failed" as const
        }
      }

      return {
        entry: entryResult.data?.entry ?? null,
        lines: entryResult.data?.lines ?? [],
        company: companyResult.data,
        organization: orgResult.data,
        accounts: accountsResult.data?.accounts ?? [],
        currencies: currenciesResult.data?.currencies ?? [],
        error: null
      }
    } catch {
      return {
        entry: null,
        lines: [],
        company: null,
        organization: null,
        accounts: [],
        currencies: [],
        error: "failed" as const
      }
    }
  })

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute(
  "/organizations/$organizationId/companies/$companyId/journal-entries/$entryId/edit"
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
    const result = await fetchEditJournalEntryData({
      data: {
        entryId: params.entryId,
        companyId: params.companyId,
        organizationId: params.organizationId
      }
    })

    if (result.error === "not_found") {
      throw new Error("Journal entry not found")
    }

    return result
  },
  errorComponent: ({ error }) => <MinimalRouteError error={error} />,
  component: EditJournalEntryPage
})

// =============================================================================
// Balance Indicator Component
// =============================================================================

function BalanceIndicator({
  totalDebits,
  totalCredits,
  currency
}: {
  readonly totalDebits: number
  readonly totalCredits: number
  readonly currency: string
}) {
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01
  const difference = Math.abs(totalDebits - totalCredits)

  return (
    <div
      data-testid="balance-indicator"
      className={`rounded-lg border-2 p-4 ${
        isBalanced
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              data-testid="balance-indicator-balanced"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              data-testid="balance-indicator-unbalanced"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          <span
            className={`font-medium ${
              isBalanced ? "text-green-700" : "text-red-700"
            }`}
          >
            {isBalanced ? "Entry is balanced" : "Entry is unbalanced"}
          </span>
        </div>

        {!isBalanced && (
          <span className="text-sm text-red-600" data-testid="balance-difference">
            Difference: {currency} {formatAmount(difference)}
          </span>
        )}
      </div>

      {/* Totals Row */}
      <div className="mt-3 grid grid-cols-2 gap-4 border-t border-gray-200 pt-3">
        <div className="text-right">
          <span className="text-sm text-gray-500">Total Debits:</span>
          <span
            className="ml-2 font-mono font-medium text-gray-900"
            data-testid="total-debits"
          >
            {currency} {formatAmount(totalDebits)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">Total Credits:</span>
          <span
            className="ml-2 font-mono font-medium text-gray-900"
            data-testid="total-credits"
          >
            {currency} {formatAmount(totalCredits)}
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Computed Period Display Component
// =============================================================================

function ComputedPeriodDisplay({
  period,
  fiscalYearEnd
}: {
  readonly period: ComputedPeriod
  readonly fiscalYearEnd: FiscalYearEnd
}) {
  const fyEndDisplay = `${MONTH_NAMES[fiscalYearEnd.month - 1]} ${fiscalYearEnd.day}`

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900" data-testid="computed-fiscal-period">
          {period.periodName} FY{period.fiscalYear}
        </span>
        <span className="text-xs text-gray-500">
          ({period.periodDisplayName})
        </span>
      </div>
      <div className="group relative">
        <Info className="h-4 w-4 cursor-help text-gray-400" />
        <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          <p className="text-xs text-gray-600">
            Fiscal period is automatically determined from the transaction date.
            Company fiscal year ends {fyEndDisplay}.
          </p>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Page Component
// =============================================================================

function EditJournalEntryPage() {
  const context = Route.useRouteContext()
  const loaderData = Route.useLoaderData()
  const { canPerform } = usePermissions()
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for loader data typing */
  const entry = loaderData.entry as JournalEntry | null
  const entryLines = loaderData.lines as readonly JournalEntryLineData[]
  const company = loaderData.company as Company | null
  const organization = loaderData.organization as Organization | null
  const accounts = loaderData.accounts as readonly Account[]
  const currencies = loaderData.currencies as readonly CurrencyInfo[]
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  const params = Route.useParams()
  const navigate = useNavigate()
  const user = context.user
  // Organizations come from the parent layout route's beforeLoad
  const organizations = context.organizations ?? []

  // Permission check
  const canUpdateEntry = canPerform("journal_entry:update")

  // Check if entry is editable (only Draft entries can be edited)
  const isEditable = entry?.status === "Draft"

  // Initialize form state from entry data
  const [transactionDate, setTransactionDate] = useState(() => {
    if (entry?.transactionDate) {
      return formatLocalDateToString(entry.transactionDate)
    }
    const today = new Date()
    return today.toISOString().split("T")[0]
  })

  const [referenceNumber, setReferenceNumber] = useState(entry?.referenceNumber ?? "")
  const [description, setDescription] = useState(entry?.description ?? "")
  const [entryType, setEntryType] = useState<JournalEntryType>(entry?.entryType ?? "Standard")

  // Multi-currency fields
  const functionalCurrency = company?.functionalCurrency ?? "USD"
  const [currency, setCurrency] = useState(() => {
    // Determine currency from first line
    const firstLine = entryLines[0]
    const lineCurrency = firstLine?.debitAmount?.currency ?? firstLine?.creditAmount?.currency
    return lineCurrency ?? functionalCurrency
  })
  const [exchangeRate, setExchangeRate] = useState("1.00")
  const [showMultiCurrency, setShowMultiCurrency] = useState(() => {
    // Show multi-currency if any line has a different currency
    const firstLine = entryLines[0]
    const lineCurrency = firstLine?.debitAmount?.currency ?? firstLine?.creditAmount?.currency
    return lineCurrency !== undefined && lineCurrency !== functionalCurrency
  })

  // Initialize lines from entry data
  const [lines, setLines] = useState<JournalEntryLine[]>(() => {
    if (entryLines.length > 0) {
      return entryLines.map((line) => ({
        id: generateLineId(),
        accountId: line.accountId,
        debitAmount: line.debitAmount?.amount ?? "",
        creditAmount: line.creditAmount?.amount ?? "",
        memo: line.memo ?? "",
        currency: line.debitAmount?.currency ?? line.creditAmount?.currency ?? functionalCurrency
      }))
    }
    // Fallback to empty lines
    return [
      { id: generateLineId(), accountId: "", debitAmount: "", creditAmount: "", memo: "", currency: functionalCurrency },
      { id: generateLineId(), accountId: "", debitAmount: "", creditAmount: "", memo: "", currency: functionalCurrency }
    ]
  })

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Computed fiscal period (derived from transaction date)
  const computedPeriod = useMemo(
    () => company ? computeFiscalPeriod(transactionDate, company.fiscalYearEnd) : null,
    [transactionDate, company]
  )

  // Calculate totals
  const { totalDebits, totalCredits, isBalanced } = useMemo(() => {
    let debits = 0
    let credits = 0

    for (const line of lines) {
      debits += parseAmount(line.debitAmount)
      credits += parseAmount(line.creditAmount)
    }

    return {
      totalDebits: debits,
      totalCredits: credits,
      isBalanced: Math.abs(debits - credits) < 0.01
    }
  }, [lines])

  // Update line handler
  const handleUpdateLine = useCallback(
    (lineId: string, field: keyof JournalEntryLine, value: string) => {
      setLines((prev) =>
        prev.map((line) =>
          line.id === lineId ? { ...line, [field]: value } : line
        )
      )
    },
    []
  )

  // Delete line handler
  const handleDeleteLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((line) => line.id !== lineId))
  }, [])

  // Add new line
  const handleAddLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { id: generateLineId(), accountId: "", debitAmount: "", creditAmount: "", memo: "", currency }
    ])
  }, [currency])

  // Toggle multi-currency
  const handleToggleMultiCurrency = () => {
    if (showMultiCurrency) {
      // Reset to functional currency
      setCurrency(functionalCurrency)
      setExchangeRate("1.00")
      setLines((prev) =>
        prev.map((line) => ({ ...line, currency: functionalCurrency }))
      )
    }
    setShowMultiCurrency(!showMultiCurrency)
  }

  // Handle currency change
  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency)
    // Update all lines to new currency
    setLines((prev) =>
      prev.map((line) => ({ ...line, currency: newCurrency }))
    )
    // Reset exchange rate if same as functional currency
    if (newCurrency === functionalCurrency) {
      setExchangeRate("1.00")
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    // Check description
    if (!description.trim()) {
      setError("Description is required")
      return false
    }

    // Check that all lines have accounts selected
    const linesWithAccounts = lines.filter((line) => line.accountId)
    if (linesWithAccounts.length < 2) {
      setError("At least 2 lines with accounts are required")
      return false
    }

    // Check that all lines have either debit or credit
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.accountId) {
        const hasDebit = parseAmount(line.debitAmount) > 0
        const hasCredit = parseAmount(line.creditAmount) > 0
        if (!hasDebit && !hasCredit) {
          setError(`Line ${i + 1} must have either a debit or credit amount`)
          return false
        }
      }
    }

    return true
  }

  // Submit handler
  const handleSubmit = async () => {
    setError(null)

    if (!entry) {
      setError("Entry not found")
      return
    }

    if (!isEditable) {
      setError("Only draft entries can be edited")
      return
    }

    if (!validateForm()) {
      return
    }

    // Entry must be balanced
    if (!isBalanced) {
      setError("Entry must be balanced to save")
      return
    }

    setIsSubmitting(true)

    try {
      // Filter to lines with accounts and prepare for API
      const validLines = lines
        .filter((line) => line.accountId)
        .map((line) => {
          const debit = parseAmount(line.debitAmount)
          const credit = parseAmount(line.creditAmount)

          return {
            accountId: line.accountId,
            debitAmount:
              debit > 0
                ? { amount: formatAmount(debit), currency: line.currency }
                : null,
            creditAmount:
              credit > 0
                ? { amount: formatAmount(credit), currency: line.currency }
                : null,
            memo: line.memo.trim() || null,
            dimensions: null,
            intercompanyPartnerId: null
          }
        })

      // Update the journal entry
      const { error: apiError } = await api.PUT("/api/v1/journal-entries/{id}", {
        params: { path: { id: entry.id } },
        body: {
          organizationId: params.organizationId,
          description: description.trim(),
          transactionDate,
          documentDate: null,
          fiscalPeriod: computedPeriod ? {
            year: computedPeriod.fiscalYear,
            period: computedPeriod.periodNumber
          } : null,
          referenceNumber: referenceNumber.trim() || null,
          sourceDocumentRef: null,
          lines: validLines
        }
      })

      if (apiError) {
        let errorMessage = "Failed to update journal entry"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Navigate back to entry detail page
      navigate({
        to: "/organizations/$organizationId/companies/$companyId/journal-entries/$entryId",
        params: {
          organizationId: params.organizationId,
          companyId: params.companyId,
          entryId: params.entryId
        }
      })
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    navigate({
      to: "/organizations/$organizationId/companies/$companyId/journal-entries/$entryId",
      params: {
        organizationId: params.organizationId,
        companyId: params.companyId,
        entryId: params.entryId
      }
    })
  }

  if (!entry || !company || !organization) {
    return null
  }

  // Permission denied check
  if (!canUpdateEntry) {
    return (
      <AppLayout
        user={user}
        organizations={organizations}
        currentOrganization={organization}
        breadcrumbItems={[
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
          },
          {
            label: entry.referenceNumber ?? entry.entryNumber ?? "Entry",
            href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries/${params.entryId}`
          }
        ]}
        companies={[{ id: company.id, name: company.name }]}
      >
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" data-testid="permission-denied">
          <h2 className="text-lg font-medium text-red-800">Permission Denied</h2>
          <p className="mt-2 text-red-700">
            You do not have permission to edit journal entries.
          </p>
          <Button
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mt-4"
            onClick={() => {
              navigate({
                to: "/organizations/$organizationId/companies/$companyId/journal-entries/$entryId",
                params: { organizationId: params.organizationId, companyId: params.companyId, entryId: params.entryId }
              })
            }}
          >
            Back to Entry
          </Button>
        </div>
      </AppLayout>
    )
  }

  // Show error if entry is not editable
  if (!isEditable) {
    return (
      <AppLayout
        user={user}
        organizations={organizations}
        currentOrganization={organization}
        breadcrumbItems={[
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
          },
          {
            label: entry.referenceNumber ?? entry.entryNumber ?? "Entry",
            href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries/${params.entryId}`
          },
          {
            label: "Edit",
            href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries/${params.entryId}/edit`
          }
        ]}
        companies={[{ id: company.id, name: company.name }]}
      >
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center" data-testid="not-editable-warning">
          <h2 className="text-lg font-medium text-yellow-800">Cannot Edit Entry</h2>
          <p className="mt-2 text-yellow-700">
            Only draft journal entries can be edited. This entry has status: <strong>{entry.status}</strong>
          </p>
          <Link
            to="/organizations/$organizationId/companies/$companyId/journal-entries/$entryId"
            params={{
              organizationId: params.organizationId,
              companyId: params.companyId,
              entryId: params.entryId
            }}
            className="mt-4 inline-block rounded-lg bg-yellow-600 px-4 py-2 font-medium text-white hover:bg-yellow-700"
          >
            Back to Entry
          </Link>
        </div>
      </AppLayout>
    )
  }

  // Breadcrumb items for Edit Journal Entry page
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
    },
    {
      label: entry.referenceNumber ?? entry.entryNumber ?? "Entry",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries/${params.entryId}`
    },
    {
      label: "Edit",
      href: `/organizations/${params.organizationId}/companies/${params.companyId}/journal-entries/${params.entryId}/edit`
    }
  ]

  return (
    <AppLayout
      user={user}
      organizations={organizations}
      currentOrganization={organization}
      breadcrumbItems={breadcrumbItems}
      companies={[{ id: company.id, name: company.name }]}
    >
      <div data-testid="edit-journal-entry-page">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
            Edit Journal Entry
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Editing {entry.referenceNumber ?? entry.entryNumber ?? "draft entry"} for {company.name} ({company.functionalCurrency})
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-6"
          data-testid="journal-entry-edit-form"
        >
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              data-testid="journal-entry-form-error"
              className="rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Header Fields */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-700">Entry Details</h3>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {/* Transaction Date */}
              <div>
                <Input
                  id="transaction-date"
                  type="date"
                  label="Date *"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="journal-entry-date"
                  className="text-sm"
                />
              </div>

              {/* Reference Number */}
              <div>
                <Input
                  id="reference-number"
                  type="text"
                  label="Reference"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g., INV-001"
                  data-testid="journal-entry-reference"
                  className="text-sm"
                />
              </div>

              {/* Entry Type */}
              <div>
                <Select
                  id="entry-type"
                  label="Type *"
                  value={entryType}
                  onChange={(e) => {
                    const value = e.target.value
                    if (isJournalEntryType(value)) {
                      setEntryType(value)
                    }
                  }}
                  disabled={isSubmitting}
                  data-testid="journal-entry-type"
                  className="text-sm"
                >
                  <option value="Standard">Standard</option>
                  <option value="Adjusting">Adjusting</option>
                  <option value="Closing">Closing</option>
                  <option value="Opening">Opening</option>
                  <option value="Reversing">Reversing</option>
                  <option value="Recurring">Recurring</option>
                  <option value="Intercompany">Intercompany</option>
                  <option value="Revaluation">Revaluation</option>
                </Select>
              </div>

              {/* Computed Fiscal Period (Read-only) */}
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                >
                  Fiscal Period
                </label>
                <div className="mt-1">
                  {computedPeriod && (
                    <ComputedPeriodDisplay
                      period={computedPeriod}
                      fiscalYearEnd={company.fiscalYearEnd}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <Input
                id="description"
                type="text"
                label="Description *"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                placeholder="Enter a description for this journal entry"
                data-testid="journal-entry-description"
                className="text-sm"
              />
            </div>

            {/* Foreign Currency Toggle */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="multi-currency-toggle"
                    type="checkbox"
                    checked={showMultiCurrency}
                    onChange={handleToggleMultiCurrency}
                    disabled={isSubmitting}
                    data-testid="journal-entry-multi-currency-toggle"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="multi-currency-toggle"
                    className="text-sm text-gray-700"
                  >
                    Foreign currency entry
                  </label>
                </div>

                {showMultiCurrency && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Currency:</span>
                      <Select
                        id="currency-select"
                        value={currency}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                        disabled={isSubmitting}
                        data-testid="journal-entry-currency"
                        className="py-1 text-sm"
                      >
                        {currencies.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {currency !== functionalCurrency && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Rate:</span>
                        <Input
                          id="exchange-rate"
                          type="text"
                          inputMode="decimal"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          disabled={isSubmitting}
                          data-testid="journal-entry-exchange-rate"
                          className="w-24 py-1 text-right text-sm"
                        />
                        <span className="text-xs text-gray-500">
                          1 {currency} = {exchangeRate} {functionalCurrency}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Helper text always visible */}
              <p className="mt-2 text-xs text-gray-500">
                Enable to record this entry in a foreign currency. All line items will use the selected currency and be converted to {functionalCurrency} at the exchange rate.
              </p>

              {/* Info banner when foreign currency is enabled and different from functional */}
              {showMultiCurrency && currency !== functionalCurrency && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-xs text-blue-700">
                      <p className="font-medium">Recording in {currency}</p>
                      <p className="mt-0.5">
                        All amounts will be entered in {currency} and converted to the functional currency ({functionalCurrency}) using the exchange rate above.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-medium text-gray-700">Line Items</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddLine}
                disabled={isSubmitting}
                icon={<Plus className="h-4 w-4" />}
                data-testid="journal-entry-add-line"
              >
                Add Line
              </Button>
            </div>

            {/* Lines Header */}
            <div className="grid grid-cols-12 gap-2 border-b border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-500">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4">Account</div>
              <div className="col-span-2">Memo</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-1"></div>
            </div>

            {/* Line Items */}
            <div data-testid="journal-entry-lines">
              {lines.map((line, index) => (
                <JournalEntryLineEditor
                  key={line.id}
                  line={line}
                  lineIndex={index}
                  accounts={accounts}
                  currency={currency}
                  onUpdate={handleUpdateLine}
                  onDelete={handleDeleteLine}
                  canDelete={lines.length > 2}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Balance Indicator */}
          <BalanceIndicator
            totalDebits={totalDebits}
            totalCredits={totalCredits}
            currency={currency}
          />

          {/* Form Actions */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
              data-testid="journal-entry-cancel"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting || !isBalanced}
              data-testid="journal-entry-save"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
