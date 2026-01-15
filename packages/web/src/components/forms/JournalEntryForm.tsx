/**
 * JournalEntryForm Component
 *
 * Multi-line journal entry creation form with:
 * - Header fields: Date, Reference, Description, Entry Type
 * - Line items table with account dropdown, memo, debit/credit
 * - Real-time balance validation (green=balanced, red=unbalanced)
 * - Multi-currency support with exchange rate field
 * - Save as Draft and Submit for Approval buttons
 */

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "@tanstack/react-router"
import { api } from "@/api/client"
import {
  JournalEntryLineEditor,
  type Account,
  type JournalEntryLine
} from "@/components/journal/JournalEntryLineEditor"

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

interface FiscalPeriodOption {
  readonly year: number
  readonly period: number
  readonly label: string
}

interface JournalEntryFormProps {
  readonly companyId: string
  readonly functionalCurrency: string
  readonly accounts: readonly Account[]
  readonly currencies: readonly CurrencyInfo[]
  readonly fiscalPeriods: readonly FiscalPeriodOption[]
  readonly defaultFiscalPeriod?: FiscalPeriodOption
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
// JournalEntryForm Component
// =============================================================================

export function JournalEntryForm({
  companyId,
  functionalCurrency,
  accounts,
  currencies,
  fiscalPeriods,
  defaultFiscalPeriod,
  onSuccess,
  onCancel
}: JournalEntryFormProps) {
  const router = useRouter()

  // Header fields
  const [transactionDate, setTransactionDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [referenceNumber, setReferenceNumber] = useState("")
  const [description, setDescription] = useState("")
  const [entryType, setEntryType] = useState<JournalEntryType>("Standard")
  const [fiscalYear, setFiscalYear] = useState<number>(
    defaultFiscalPeriod?.year ?? new Date().getFullYear()
  )
  const [fiscalPeriod, setFiscalPeriod] = useState<number>(
    defaultFiscalPeriod?.period ?? 1
  )

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

  // Get unique fiscal years from periods
  const availableFiscalYears = useMemo(() => {
    const years = new Set(fiscalPeriods.map((p) => p.year))
    return Array.from(years).sort((a, b) => b - a)
  }, [fiscalPeriods])

  // Get periods for selected year
  const availablePeriodsForYear = useMemo(() => {
    return fiscalPeriods.filter((p) => p.year === fiscalYear)
  }, [fiscalPeriods, fiscalYear])

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
          companyId,
          description: description.trim(),
          transactionDate,
          documentDate: null,
          fiscalPeriod: { year: fiscalYear, period: fiscalPeriod },
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
          {/* Transaction Date */}
          <div>
            <label
              htmlFor="transaction-date"
              className="block text-sm font-medium text-gray-700"
            >
              Date *
            </label>
            <input
              id="transaction-date"
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              disabled={isSubmitting}
              data-testid="journal-entry-date"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Reference Number */}
          <div>
            <label
              htmlFor="reference-number"
              className="block text-sm font-medium text-gray-700"
            >
              Reference
            </label>
            <input
              id="reference-number"
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g., INV-001"
              data-testid="journal-entry-reference"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Entry Type */}
          <div>
            <label
              htmlFor="entry-type"
              className="block text-sm font-medium text-gray-700"
            >
              Type *
            </label>
            <select
              id="entry-type"
              value={entryType}
              onChange={(e) => {
                const value = e.target.value
                if (isJournalEntryType(value)) {
                  setEntryType(value)
                }
              }}
              disabled={isSubmitting}
              data-testid="journal-entry-type"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="Standard">Standard</option>
              <option value="Adjusting">Adjusting</option>
              <option value="Closing">Closing</option>
              <option value="Opening">Opening</option>
              <option value="Reversing">Reversing</option>
              <option value="Recurring">Recurring</option>
              <option value="Intercompany">Intercompany</option>
              <option value="Revaluation">Revaluation</option>
            </select>
          </div>

          {/* Fiscal Period */}
          <div>
            <label
              htmlFor="fiscal-period"
              className="block text-sm font-medium text-gray-700"
            >
              Period *
            </label>
            <div className="mt-1 flex gap-2">
              <select
                id="fiscal-year"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                data-testid="journal-entry-fiscal-year"
                className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {availableFiscalYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <select
                id="fiscal-period"
                value={fiscalPeriod}
                onChange={(e) => setFiscalPeriod(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                data-testid="journal-entry-fiscal-period"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {availablePeriodsForYear.map((p) => (
                  <option key={p.period} value={p.period}>
                    P{p.period}
                  </option>
                ))}
                {availablePeriodsForYear.length === 0 && (
                  <option value={fiscalPeriod}>P{fiscalPeriod}</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Description *
          </label>
          <input
            id="description"
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            placeholder="Enter a description for this journal entry"
            data-testid="journal-entry-description"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Multi-Currency Toggle */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
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
              Multi-currency entry
            </label>
          </div>

          {showMultiCurrency && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="currency-select"
                  className="text-sm text-gray-500"
                >
                  Currency:
                </label>
                <select
                  id="currency-select"
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="journal-entry-currency"
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {currency !== functionalCurrency && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="exchange-rate"
                    className="text-sm text-gray-500"
                  >
                    Rate:
                  </label>
                  <input
                    id="exchange-rate"
                    type="text"
                    inputMode="decimal"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    disabled={isSubmitting}
                    data-testid="journal-entry-exchange-rate"
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <span className="text-xs text-gray-500">
                    1 {currency} = {exchangeRate} {functionalCurrency}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-medium text-gray-700">Line Items</h3>
          <button
            type="button"
            onClick={handleAddLine}
            disabled={isSubmitting}
            data-testid="journal-entry-add-line"
            className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
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
            Add Line
          </button>
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
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="journal-entry-cancel"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("draft")}
            disabled={isSubmitting}
            data-testid="journal-entry-save-draft"
            className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && submitAction === "draft" ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    opacity="0.25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </span>
            ) : (
              "Save as Draft"
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit("submit")}
            disabled={isSubmitting || !isBalanced}
            data-testid="journal-entry-submit"
            title={
              !isBalanced
                ? "Entry must be balanced to submit for approval"
                : "Submit for approval"
            }
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {isSubmitting && submitAction === "submit" ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    opacity="0.25"
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </span>
            ) : (
              "Submit for Approval"
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
