/**
 * Select component
 *
 * Reusable dropdown select with label and error support.
 * Features:
 * - Label support (connects via htmlFor)
 * - Error state with message
 * - Optional helper text
 * - Option groups support
 * - Data-testid attributes for E2E testing
 * - Custom chevron icon for consistent styling
 */

import { clsx } from "clsx"
import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

interface SelectOption {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

interface SelectOptionGroup {
  readonly label: string
  readonly options: readonly SelectOption[]
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Select label */
  readonly label?: string
  /** Error message */
  readonly error?: string
  /** Helper text below select */
  readonly helperText?: string
  /** Options to display */
  readonly options?: readonly SelectOption[]
  /** Option groups */
  readonly optionGroups?: readonly SelectOptionGroup[]
  /** Placeholder option */
  readonly placeholder?: string
  /** Container class name */
  readonly containerClassName?: string
  /** Custom children (overrides options/optionGroups) */
  readonly children?: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    helperText,
    options,
    optionGroups,
    placeholder,
    containerClassName,
    className,
    id,
    children,
    ...props
  },
  ref
) {
  const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined)
  const hasError = Boolean(error)

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
          data-testid={selectId ? `${selectId}-label` : undefined}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
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
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children
            ? children
            : optionGroups
              ? optionGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))
              : options?.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
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
})
