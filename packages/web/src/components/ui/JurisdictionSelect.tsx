/**
 * JurisdictionSelect component
 *
 * A dropdown select for jurisdictions that uses data from /api/v1/jurisdictions.
 * Features:
 * - Loading state with spinner
 * - Label and error message support
 * - Shows country code and name
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { forwardRef, type SelectHTMLAttributes } from "react"

export interface JurisdictionOption {
  readonly code: string
  readonly name: string
  readonly defaultCurrency: string
}

interface JurisdictionSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
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
}

export const JurisdictionSelect = forwardRef<HTMLSelectElement, JurisdictionSelectProps>(
  function JurisdictionSelect(
    {
      label,
      error,
      helperText,
      jurisdictions,
      isLoading = false,
      placeholder = "Select jurisdiction...",
      containerClassName,
      className,
      id,
      disabled,
      ...props
    },
    ref
  ) {
    const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : "jurisdiction-select")
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
              "w-full rounded-lg border px-3 py-2 text-gray-900 bg-white",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
              hasError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
              isLoading && "pr-10",
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
              {isLoading ? "Loading jurisdictions..." : placeholder}
            </option>
            {jurisdictions.map((jurisdiction) => (
              <option key={jurisdiction.code} value={jurisdiction.code}>
                {jurisdiction.name} ({jurisdiction.code})
              </option>
            ))}
          </select>
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
