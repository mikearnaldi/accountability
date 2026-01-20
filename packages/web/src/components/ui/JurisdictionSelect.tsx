/**
 * JurisdictionSelect component
 *
 * A searchable dropdown select for jurisdictions that uses Combobox internally.
 * Features:
 * - Type to search/filter jurisdictions by name or code
 * - Loading state with spinner
 * - Label and error message support
 * - Shows country code and name
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { useMemo } from "react"
import { Combobox, type ComboboxOption } from "./Combobox.tsx"

export interface JurisdictionOption {
  readonly code: string
  readonly name: string
  readonly defaultCurrency: string
}

interface JurisdictionSelectProps {
  /** Select label */
  readonly label?: string
  /** Error message */
  readonly error?: string
  /** Helper text below select */
  readonly helperText?: string
  /** Jurisdictions to display (from loader) */
  readonly jurisdictions: readonly JurisdictionOption[]
  /** Whether jurisdictions are loading */
  readonly isLoading?: boolean
  /** Placeholder option text */
  readonly placeholder?: string
  /** Container class name */
  readonly containerClassName?: string
  /** Additional class name for the combobox */
  readonly className?: string
  /** Currently selected jurisdiction code */
  readonly value?: string
  /** Callback when jurisdiction changes */
  readonly onChange?: (value: string) => void
  /** Whether the select is disabled */
  readonly disabled?: boolean
  /** ID for the select */
  readonly id?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function JurisdictionSelect({
  label,
  error,
  helperText,
  jurisdictions,
  isLoading = false,
  placeholder = "Search jurisdictions...",
  containerClassName,
  className,
  value = "",
  onChange,
  disabled,
  id,
  "data-testid": testId
}: JurisdictionSelectProps) {
  const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : "jurisdiction-select")
  const hasError = Boolean(error)
  const isDisabled = disabled || isLoading

  // Convert jurisdictions to Combobox options
  const options: ComboboxOption[] = useMemo(() => {
    return jurisdictions.map((jurisdiction) => ({
      value: jurisdiction.code,
      label: `${jurisdiction.name} (${jurisdiction.code})`,
      // Include additional search terms
      searchText: `${jurisdiction.code} ${jurisdiction.defaultCurrency}`
    }))
  }, [jurisdictions])

  const handleChange = (newValue: string) => {
    onChange?.(newValue)
  }

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
          data-testid={`${selectId}-label`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {isLoading ? (
          // Show loading state
          <div
            className={clsx(
              "w-full rounded-lg border py-2 pl-3 pr-9 text-gray-500 bg-gray-50",
              "flex items-center justify-between",
              hasError ? "border-red-300" : "border-gray-300",
              className
            )}
            data-testid={testId ?? selectId}
          >
            <span>Loading jurisdictions...</span>
            <svg
              className="h-4 w-4 animate-spin text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : (
          <Combobox
            value={value}
            onChange={handleChange}
            options={options}
            placeholder={placeholder}
            disabled={isDisabled}
            className={clsx(
              hasError && "border-red-300 focus-within:border-red-500 focus-within:ring-red-500",
              className
            )}
            data-testid={testId ?? selectId}
          />
        )}
      </div>
      {error && (
        <p
          id={`${selectId}-error`}
          className="mt-1 text-sm text-red-600"
          data-testid={`${selectId}-error`}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${selectId}-helper`}
          className="mt-1 text-sm text-gray-500"
          data-testid={`${selectId}-helper`}
        >
          {helperText}
        </p>
      )}
    </div>
  )
}
