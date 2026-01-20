/**
 * PeriodDatePicker Component
 *
 * A date input that constrains selectable dates based on fiscal period status.
 * Used in journal entry forms to:
 * - Allow dates within open periods (clickable)
 * - Warn about dates in closed periods (shows warning)
 * - Warn about dates with no fiscal period defined
 *
 * The component validates dates on blur and shows appropriate messages.
 */

import { useState, useMemo, useCallback } from "react"
import { AlertTriangle, Calendar, Info } from "lucide-react"
import { Input } from "@/components/ui/Input"

// =============================================================================
// Types
// =============================================================================

export interface PeriodSummaryItem {
  readonly fiscalYearId: string
  readonly fiscalYear: number
  readonly periodId: string
  readonly periodNumber: number
  readonly periodName: string
  readonly periodType: "Regular" | "Adjustment" | "Closing"
  readonly startDate: string
  readonly endDate: string
  readonly status: "Open" | "Closed"
}

export interface DateRange {
  readonly startDate: string
  readonly endDate: string
}

export interface PeriodsSummary {
  readonly periods: readonly PeriodSummaryItem[]
  readonly openDateRanges: readonly DateRange[]
  readonly closedDateRanges: readonly DateRange[]
}

export type DateStatus = "open" | "closed" | "no-period"

export interface PeriodDatePickerProps {
  /** Current date value (YYYY-MM-DD format) */
  readonly value: string
  /** Called when date changes */
  readonly onChange: (date: string) => void
  /** Periods summary for validation */
  readonly periodsSummary: PeriodsSummary
  /** Whether the input is disabled */
  readonly disabled?: boolean
  /** Input label */
  readonly label?: string
  /** Whether the field is required */
  readonly required?: boolean
  /** Custom error message */
  readonly error?: string
  /** Data-testid for E2E testing */
  readonly "data-testid"?: string
}

// =============================================================================
// Date Helpers
// =============================================================================

/**
 * Check if a date falls within any of the given ranges
 */
function dateInRanges(dateStr: string, ranges: readonly DateRange[]): boolean {
  return ranges.some(
    (range) => dateStr >= range.startDate && dateStr <= range.endDate
  )
}

/**
 * Get the status of a date based on period summary
 */
function getDateStatus(
  dateStr: string,
  periodsSummary: PeriodsSummary
): DateStatus {
  // Check if date is in an open regular period
  const inOpenPeriod = dateInRanges(dateStr, periodsSummary.openDateRanges)
  if (inOpenPeriod) return "open"

  // Check if date is in a closed period
  const inClosedPeriod = dateInRanges(dateStr, periodsSummary.closedDateRanges)
  if (inClosedPeriod) return "closed"

  // Date has no fiscal period defined
  return "no-period"
}

/**
 * Get the period for a given date
 */
function getPeriodForDate(
  dateStr: string,
  periods: readonly PeriodSummaryItem[]
): PeriodSummaryItem | undefined {
  // First try to find a Regular period that matches (not Adjustment)
  const regularPeriod = periods.find(
    (p) =>
      p.periodType === "Regular" &&
      dateStr >= p.startDate &&
      dateStr <= p.endDate
  )
  if (regularPeriod) return regularPeriod

  // If no regular period, check for any period
  return periods.find(
    (p) => dateStr >= p.startDate && dateStr <= p.endDate
  )
}

/**
 * Get the first open date in the periods
 */
function getFirstOpenDate(periodsSummary: PeriodsSummary): string | undefined {
  const openRanges = periodsSummary.openDateRanges
  if (openRanges.length === 0) return undefined

  // Sort by start date and return the first one
  const sorted = [...openRanges].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  )
  return sorted[0].startDate
}

// =============================================================================
// Component
// =============================================================================

export function PeriodDatePicker({
  value,
  onChange,
  periodsSummary,
  disabled = false,
  label = "Date",
  required = false,
  error,
  "data-testid": testId = "period-date-picker"
}: PeriodDatePickerProps) {
  const [showWarning, setShowWarning] = useState(false)

  // Calculate date status
  const dateStatus = useMemo(
    () => getDateStatus(value, periodsSummary),
    [value, periodsSummary]
  )

  // Get period info for display
  const period = useMemo(
    () => getPeriodForDate(value, periodsSummary.periods),
    [value, periodsSummary.periods]
  )

  // Get warning message based on status
  const warningMessage = useMemo(() => {
    switch (dateStatus) {
      case "closed":
        return `This date falls in a closed period${
          period ? ` (${period.periodName} FY${period.fiscalYear})` : ""
        }. The journal entry will be rejected by the backend.`
      case "no-period":
        return "This date has no fiscal period defined. Create a fiscal year first."
      default:
        return undefined
    }
  }, [dateStatus, period])

  // Handle date change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = e.target.value
      onChange(newDate)

      // Check status and show warning if needed
      const status = getDateStatus(newDate, periodsSummary)
      setShowWarning(status !== "open")
    },
    [onChange, periodsSummary]
  )

  // Calculate available period range info for helper text
  const periodRangeInfo = useMemo(() => {
    if (periodsSummary.openDateRanges.length === 0) {
      return "No open periods available"
    }

    const sorted = [...periodsSummary.openDateRanges].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )

    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    return `Available: ${first.startDate} to ${last.endDate}`
  }, [periodsSummary.openDateRanges])

  return (
    <div className="space-y-2" data-testid={testId}>
      <Input
        type="date"
        id={testId}
        label={label + (required ? " *" : "")}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        {...(error !== undefined ? { error } : {})}
        data-testid={`${testId}-input`}
        className="text-sm"
      />

      {/* Period info and status indicator */}
      {value && (
        <div className="flex items-center gap-2">
          {dateStatus === "open" && period && (
            <div
              className="flex items-center gap-1.5 text-xs text-green-600"
              data-testid={`${testId}-status-open`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {period.periodName} FY{period.fiscalYear} (Open)
              </span>
            </div>
          )}

          {dateStatus === "closed" && (
            <div
              className="flex items-center gap-1.5 text-xs text-amber-600"
              data-testid={`${testId}-status-closed`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Period is closed</span>
            </div>
          )}

          {dateStatus === "no-period" && (
            <div
              className="flex items-center gap-1.5 text-xs text-red-600"
              data-testid={`${testId}-status-no-period`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>No fiscal period defined</span>
            </div>
          )}
        </div>
      )}

      {/* Warning message */}
      {showWarning && warningMessage && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-2"
          data-testid={`${testId}-warning`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-xs text-amber-700">{warningMessage}</p>
          </div>
        </div>
      )}

      {/* Helper text with available periods */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Info className="h-3 w-3" />
        <span>{periodRangeInfo}</span>
      </div>
    </div>
  )
}

/**
 * Check if adjustment period (P13) is available for a given date
 *
 * P13 is available when:
 * 1. The date matches the fiscal year end (P13 start date)
 * 2. P13 is Open
 */
export function getAdjustmentPeriodForDate(
  dateStr: string,
  periods: readonly PeriodSummaryItem[]
): PeriodSummaryItem | undefined {
  return periods.find(
    (p) =>
      p.periodType === "Adjustment" &&
      p.startDate === dateStr &&
      p.status === "Open"
  )
}

/**
 * Check if any open periods exist
 */
export function hasOpenPeriods(periodsSummary: PeriodsSummary): boolean {
  return periodsSummary.periods.some(
    (p) => p.status === "Open" && p.periodType === "Regular"
  )
}

/**
 * Check if any periods exist at all
 */
export function hasPeriods(periodsSummary: PeriodsSummary): boolean {
  return periodsSummary.periods.length > 0
}

export { getFirstOpenDate }
