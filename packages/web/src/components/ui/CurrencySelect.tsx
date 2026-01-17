/**
 * CurrencySelect component
 *
 * A dropdown select for currencies that fetches from /api/v1/currencies.
 * Features:
 * - Async loading of currencies from API
 * - Loading state with spinner
 * - Error state
 * - Label and error message support
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { forwardRef, type SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"

interface CurrencyOption {
  readonly code: string
  readonly name: string
  readonly symbol: string
  readonly decimalPlaces: number
  readonly isActive: boolean
}

interface CurrencySelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
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
}

export const CurrencySelect = forwardRef<HTMLSelectElement, CurrencySelectProps>(
  function CurrencySelect(
    {
      label,
      error,
      helperText,
      currencies,
      isLoading = false,
      placeholder = "Select currency...",
      containerClassName,
      className,
      id,
      disabled,
      ...props
    },
    ref
  ) {
    const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : "currency-select")
    const hasError = Boolean(error)
    const isDisabled = disabled || isLoading

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
          <select
            ref={ref}
            id={selectId}
            disabled={isDisabled}
            className={clsx(
              "w-full rounded-lg border py-2 pl-3 pr-9 text-gray-900 bg-white",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
              "appearance-none cursor-pointer",
              hasError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
              className
            )}
            aria-describedby={
              hasError ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
            }
            aria-invalid={hasError}
            data-testid={selectId}
            {...props}
          >
            <option value="" disabled>
              {isLoading ? "Loading currencies..." : placeholder}
            </option>
            {currencies.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} - {currency.name} ({currency.symbol})
              </option>
            ))}
          </select>
          {isLoading ? (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
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
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              aria-hidden="true"
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
)
