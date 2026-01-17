/**
 * FiscalYearEndPicker component
 *
 * A combined month/day picker for fiscal year end with preset options.
 * Features:
 * - Month and day dropdowns
 * - Preset buttons for common dates (Dec 31, Mar 31, Jun 30, Sep 30)
 * - Validation for valid day/month combinations
 * - Label and error message support
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { ChevronDown } from "lucide-react"

interface FiscalYearEndPickerProps {
  /** Component label */
  readonly label?: string
  /** Error message */
  readonly error?: string
  /** Helper text below picker */
  readonly helperText?: string
  /** Selected month (1-12) */
  readonly month: number
  /** Selected day (1-31) */
  readonly day: number
  /** Called when month changes */
  readonly onMonthChange: (month: number) => void
  /** Called when day changes */
  readonly onDayChange: (day: number) => void
  /** Whether picker is disabled */
  readonly disabled?: boolean
  /** Container class name */
  readonly containerClassName?: string
  /** ID prefix for form elements */
  readonly id?: string
}

// Month names for display
const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
]

// Common fiscal year end presets
const PRESETS = [
  { month: 12, day: 31, label: "Dec 31" },
  { month: 3, day: 31, label: "Mar 31" },
  { month: 6, day: 30, label: "Jun 30" },
  { month: 9, day: 30, label: "Sep 30" }
]

// Get maximum days for a given month
function getMaxDays(month: number): number {
  switch (month) {
    case 2:
      return 29 // Allow Feb 29 for leap years
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
    default:
      return 31
  }
}

export function FiscalYearEndPicker({
  label,
  error,
  helperText,
  month,
  day,
  onMonthChange,
  onDayChange,
  disabled = false,
  containerClassName,
  id = "fiscal-year-end"
}: FiscalYearEndPickerProps) {
  const hasError = Boolean(error)
  const maxDays = getMaxDays(month)

  // Ensure day is valid for the selected month
  const handleMonthChange = (newMonth: number) => {
    onMonthChange(newMonth)
    const newMaxDays = getMaxDays(newMonth)
    if (day > newMaxDays) {
      onDayChange(newMaxDays)
    }
  }

  // Apply a preset
  const handlePresetClick = (presetMonth: number, presetDay: number) => {
    onMonthChange(presetMonth)
    onDayChange(presetDay)
  }

  // Check if a preset is currently selected
  const isPresetSelected = (presetMonth: number, presetDay: number) => {
    return month === presetMonth && day === presetDay
  }

  return (
    <div className={containerClassName}>
      {label && (
        <label
          className="block text-sm font-medium text-gray-700 mb-1"
          data-testid={`${id}-label`}
        >
          {label}
        </label>
      )}

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-2" data-testid={`${id}-presets`}>
        {PRESETS.map((preset) => (
          <button
            key={`${preset.month}-${preset.day}`}
            type="button"
            onClick={() => handlePresetClick(preset.month, preset.day)}
            disabled={disabled}
            className={clsx(
              "px-3 py-1 text-sm rounded-md font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isPresetSelected(preset.month, preset.day)
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
            data-testid={`${id}-preset-${preset.month}-${preset.day}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Month and Day dropdowns */}
      <div className="grid grid-cols-2 gap-3">
        {/* Month dropdown */}
        <div>
          <label
            htmlFor={`${id}-month`}
            className="sr-only"
          >
            Month
          </label>
          <div className="relative">
            <select
              id={`${id}-month`}
              value={month}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              disabled={disabled}
              className={clsx(
                "w-full rounded-lg border py-2 pl-3 pr-9 text-gray-900 bg-white",
                "focus:outline-none focus:ring-2 focus:ring-offset-0",
                "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
                "appearance-none cursor-pointer",
                hasError
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              )}
              aria-describedby={hasError ? `${id}-error` : undefined}
              aria-invalid={hasError}
              data-testid={`${id}-month`}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Day dropdown */}
        <div>
          <label
            htmlFor={`${id}-day`}
            className="sr-only"
          >
            Day
          </label>
          <div className="relative">
            <select
              id={`${id}-day`}
              value={day}
              onChange={(e) => onDayChange(Number(e.target.value))}
              disabled={disabled}
              className={clsx(
                "w-full rounded-lg border py-2 pl-3 pr-9 text-gray-900 bg-white",
                "focus:outline-none focus:ring-2 focus:ring-offset-0",
                "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
                "appearance-none cursor-pointer",
                hasError
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              )}
              aria-describedby={hasError ? `${id}-error` : undefined}
              aria-invalid={hasError}
              data-testid={`${id}-day`}
            >
              {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-sm text-red-600"
          data-testid={`${id}-error`}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${id}-helper`}
          className="mt-1 text-sm text-gray-500"
          data-testid={`${id}-helper`}
        >
          {helperText}
        </p>
      )}
    </div>
  )
}
