/**
 * CurrencySelect component
 *
 * A searchable dropdown select for currencies that uses Combobox internally.
 * Features:
 * - Type to search/filter currencies by code, name, or symbol
 * - Loading state with spinner
 * - Error state
 * - Label and error message support
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { useMemo } from "react"
import { Combobox, type ComboboxOption } from "./Combobox.tsx"

interface CurrencyOption {
  readonly code: string
  readonly name: string
  readonly symbol: string
  readonly decimalPlaces: number
  readonly isActive: boolean
}

interface CurrencySelectProps {
  /** Select label */
  readonly label?: string
  /** Error message */
  readonly error?: string
  /** Helper text below select */
  readonly helperText?: string
  /** Currencies to display (from loader) */
  readonly currencies: readonly CurrencyOption[]
  /** Whether currencies are loading */
  readonly isLoading?: boolean
  /** Placeholder option text */
  readonly placeholder?: string
  /** Container class name */
  readonly containerClassName?: string
  /** Additional class name for the combobox */
  readonly className?: string
  /** Currently selected currency code */
  readonly value?: string
  /** Callback when currency changes */
  readonly onChange?: (value: string) => void
  /** Whether the select is disabled */
  readonly disabled?: boolean
  /** ID for the select */
  readonly id?: string
  /** Name attribute */
  readonly name?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function CurrencySelect({
  label,
  error,
  helperText,
  currencies,
  isLoading = false,
  placeholder = "Search currencies...",
  containerClassName,
  className,
  value = "",
  onChange,
  disabled,
  id,
  "data-testid": testId
}: CurrencySelectProps) {
  const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : "currency-select")
  const hasError = Boolean(error)
  const isDisabled = disabled || isLoading

  // Convert currencies to Combobox options
  const options: ComboboxOption[] = useMemo(() => {
    return currencies.map((currency) => ({
      value: currency.code,
      label: `${currency.code} - ${currency.name} (${currency.symbol})`,
      // Include additional search terms
      searchText: `${currency.name} ${currency.symbol}`
    }))
  }, [currencies])

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
            <span>Loading currencies...</span>
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
