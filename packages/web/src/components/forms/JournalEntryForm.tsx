/**
 * JournalEntryForm Component
 *
 * Multi-line journal entry creation form with:
 * - Header fields: Date, Reference, Description, Entry Type
 * - Line items table with account dropdown, memo, debit/credit
 * - Real-time balance validation (green=balanced, red=unbalanced)
 * - Multi-currency support with exchange rate field
 * - Save as Draft and Submit for Approval buttons
 * - Computed fiscal period display (based on transaction date and company FY end)
 */

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "@tanstack/react-router"
import { Plus, Calendar, Info } from "lucide-react"
import { api } from "@/api/client"
import {
  JournalEntryLineEditor,
  type Account,
  type JournalEntryLine
} from "@/components/journal/JournalEntryLineEditor"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Tooltip } from "@/components/ui/Tooltip"
import {
  PeriodDatePicker,
  type PeriodsSummary,
  getAdjustmentPeriodForDate,
  getFirstOpenDate
} from "@/components/forms/PeriodDatePicker"

// =============================================================================
// Types
// =============================================================================

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

interface JournalEntryFormProps {
  readonly organizationId: string
  readonly companyId: string
  readonly functionalCurrency: string
  readonly accounts: readonly Account[]
  readonly currencies: readonly CurrencyInfo[]
  readonly fiscalYearEnd: FiscalYearEnd
  /** Fiscal periods summary for date picker constraints (optional for backward compatibility) */
  readonly periodsSummary?: PeriodsSummary
  readonly onSuccess: () => void
  readonly onCancel: () => void
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function createEmptyLine(currency: string): JournalEntryLine {
  return {
    id: generateLineId(),
    accountId: "",
    debitAmount: "",
    creditAmount: "",
    memo: "",
    currency
  }
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
  // For calendar year (Dec 31): FY = calendar year
  // For non-calendar year: FY = year containing the FY end
  let fiscalYear: number
  if (fyEndMonth === 12 && fyEndDay === 31) {
    fiscalYear = year
  } else {
    // Check if we're past the fiscal year end in the current calendar year
    const isPastFYEnd = month > fyEndMonth || (month === fyEndMonth && day > fyEndDay)
    fiscalYear = isPastFYEnd ? year + 1 : year
  }

  // Determine fiscal year start
  let fyStartYear: number
  let fyStartMonth: number

  if (fyEndMonth === 12 && fyEndDay === 31) {
    // Calendar year starts Jan 1
    fyStartYear = fiscalYear
    fyStartMonth = 1
  } else {
    // Non-calendar year starts day after previous FY end
    const prevEndMonth = fyEndMonth
    const prevEndDay = Math.min(fyEndDay, daysInMonth(fiscalYear - 1, prevEndMonth))
    const prevEndDate = new Date(Date.UTC(fiscalYear - 1, prevEndMonth - 1, prevEndDay))
    prevEndDate.setUTCDate(prevEndDate.getUTCDate() + 1)
    fyStartYear = prevEndDate.getUTCFullYear()
    fyStartMonth = prevEndDate.getUTCMonth() + 1
  }

  // Determine period number (1-12)
  // Period 1 starts at FY start month, each period is one calendar month
  let periodNumber: number
  if (fyStartMonth === 1) {
    // Calendar year: period = month
    periodNumber = month
  } else {
    // Calculate months from FY start
    let monthsFromStart: number
    if (year === fyStartYear) {
      monthsFromStart = month - fyStartMonth
    } else {
      // Date is in the following calendar year
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
      {/* Fixed min-width to prevent layout shift when period changes (e.g., "P1 FY2025" vs "P13 FY2025 (Adjustment Period)") */}
      <div className="flex min-w-[280px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <Calendar className="h-4 w-4 flex-shrink-0 text-gray-400" />
        <span className="text-sm font-medium text-gray-900" data-testid="computed-fiscal-period">
          {period.periodName} FY{period.fiscalYear}
        </span>
        <span className="text-xs text-gray-500">
          ({period.periodDisplayName})
        </span>
      </div>
      <Tooltip
        content={`Fiscal period is automatically determined from the transaction date. Company fiscal year ends ${fyEndDisplay}.`}
        position="top"
        maxWidth="240px"
      >
        <Info className="h-4 w-4 cursor-help text-gray-400" />
      </Tooltip>
    </div>
  )
}

// =============================================================================
// JournalEntryForm Component
// =============================================================================

export function JournalEntryForm({
  organizationId,
  companyId,
  functionalCurrency,
  accounts,
  currencies,
  fiscalYearEnd,
  periodsSummary,
  onSuccess,
  onCancel
}: JournalEntryFormProps) {
  const router = useRouter()

  // Header fields
  const [transactionDate, setTransactionDate] = useState(() => {
    // If we have periodsSummary, try to default to first open date
    if (periodsSummary) {
      const firstOpen = getFirstOpenDate(periodsSummary)
      if (firstOpen) return firstOpen
    }
    // Fall back to today
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [referenceNumber, setReferenceNumber] = useState("")
  const [description, setDescription] = useState("")
  const [entryType, setEntryType] = useState<JournalEntryType>("Standard")

  // Period 13 (Adjustment) selection
  const [useAdjustmentPeriod, setUseAdjustmentPeriod] = useState(false)

  // Check if P13 is available for the selected date
  const adjustmentPeriod = useMemo(() => {
    if (!periodsSummary) return undefined
    return getAdjustmentPeriodForDate(transactionDate, periodsSummary.periods)
  }, [transactionDate, periodsSummary])

  const canPostToAdjustmentPeriod = adjustmentPeriod !== undefined

  // Reset P13 selection when date changes to a date without P13 available
  useMemo(() => {
    if (!canPostToAdjustmentPeriod) {
      setUseAdjustmentPeriod(false)
    }
  }, [canPostToAdjustmentPeriod])

  // Computed fiscal period (derived from transaction date)
  const computedPeriod = useMemo(() => {
    const basePeriod = computeFiscalPeriod(transactionDate, fiscalYearEnd)

    // If user selected P13, override the period number
    if (useAdjustmentPeriod && adjustmentPeriod) {
      return {
        ...basePeriod,
        periodNumber: 13,
        periodName: "P13",
        periodDisplayName: "Adjustment Period"
      }
    }

    return basePeriod
  }, [transactionDate, fiscalYearEnd, useAdjustmentPeriod, adjustmentPeriod])

  // Multi-currency fields
  const [currency, setCurrency] = useState(functionalCurrency)
  const [exchangeRate, setExchangeRate] = useState("1.00")
  const [showMultiCurrency, setShowMultiCurrency] = useState(false)

  // Line items - start with 2 empty lines (minimum required)
  const [lines, setLines] = useState<JournalEntryLine[]>(() => [
    createEmptyLine(functionalCurrency),
    createEmptyLine(functionalCurrency)
  ])

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitAction, setSubmitAction] = useState<"draft" | "submit" | null>(null)

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
    setLines((prev) => [...prev, createEmptyLine(currency)])
  }, [currency])

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
  const handleSubmit = async (action: "draft" | "submit") => {
    setError(null)

    if (!validateForm()) {
      return
    }

    // For submit action, entry must be balanced
    if (action === "submit" && !isBalanced) {
      setError("Entry must be balanced to submit for approval")
      return
    }

    setIsSubmitting(true)
    setSubmitAction(action)

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

      // Create the journal entry
      const { error: apiError } = await api.POST("/api/v1/journal-entries", {
        body: {
          organizationId,
          companyId,
          description: description.trim(),
          transactionDate,
          documentDate: null,
          fiscalPeriod: {
            year: computedPeriod.fiscalYear,
            period: computedPeriod.periodNumber
          },
          entryType,
          sourceModule: "GeneralLedger",
          referenceNumber: referenceNumber.trim() || null,
          sourceDocumentRef: null,
          lines: validLines
        }
      })

      if (apiError) {
        let errorMessage = "Failed to create journal entry"
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }
        setError(errorMessage)
        setIsSubmitting(false)
        setSubmitAction(null)
        return
      }

      // If submit for approval, call the submit endpoint
      // Note: For now we just create as draft, the submit action
      // would require another API call after getting the created entry ID

      await router.invalidate()
      onSuccess()
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
      setSubmitAction(null)
    }
  }

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit("draft")
      }}
      className="space-y-6"
      data-testid="journal-entry-form"
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
          {/* Transaction Date - use PeriodDatePicker if periodsSummary is available */}
          <div>
            {periodsSummary ? (
              <PeriodDatePicker
                value={transactionDate}
                onChange={setTransactionDate}
                periodsSummary={periodsSummary}
                disabled={isSubmitting}
                label="Date"
                required
                data-testid="journal-entry-date"
              />
            ) : (
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
            )}
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
              <ComputedPeriodDisplay
                period={computedPeriod}
                fiscalYearEnd={fiscalYearEnd}
              />
            </div>

            {/* Period 13 checkbox - only shown when date is fiscal year end and P13 is open */}
            {canPostToAdjustmentPeriod && (
              <div className="mt-2" data-testid="adjustment-period-section">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAdjustmentPeriod}
                    onChange={(e) => setUseAdjustmentPeriod(e.target.checked)}
                    disabled={isSubmitting}
                    data-testid="use-adjustment-period-checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Post to adjustment period (P13)
                  </span>
                </label>
                <p className="ml-6 text-xs text-gray-500">
                  Use for year-end adjustments and audit entries
                </p>
              </div>
            )}
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
        <div className="grid grid-cols-[2.5rem_1fr_1fr_8rem_8rem_2.5rem] gap-2 border-b border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-500">
          <div className="text-center">#</div>
          <div className="text-left">Account</div>
          <div className="text-left">Memo</div>
          <div className="text-right">Debit</div>
          <div className="text-right">Credit</div>
          <div></div>
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
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="journal-entry-cancel"
        >
          Cancel
        </Button>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => handleSubmit("draft")}
            loading={isSubmitting && submitAction === "draft"}
            disabled={isSubmitting}
            data-testid="journal-entry-save-draft"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            Save as Draft
          </Button>

          <Button
            onClick={() => handleSubmit("submit")}
            loading={isSubmitting && submitAction === "submit"}
            disabled={isSubmitting || !isBalanced}
            data-testid="journal-entry-submit"
            title={
              !isBalanced
                ? "Entry must be balanced to submit for approval"
                : "Submit for approval"
            }
          >
            Submit for Approval
          </Button>
        </div>
      </div>
    </form>
  )
}
