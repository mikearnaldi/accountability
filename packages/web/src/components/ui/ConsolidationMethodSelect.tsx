/**
 * ConsolidationMethodSelect component
 *
 * A dropdown select for consolidation methods per ASC 810.
 * Features:
 * - Options: Full Consolidation, Equity Method, Cost Method, Variable Interest Entity
 * - Shows ownership threshold guidance
 * - Label and error message support
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { forwardRef, type SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"

// Consolidation method options with descriptions
export const CONSOLIDATION_METHODS = [
  {
    value: "FullConsolidation",
    label: "Full Consolidation",
    description: "For >50% ownership - 100% consolidated with NCI"
  },
  {
    value: "EquityMethod",
    label: "Equity Method",
    description: "For 20-50% ownership - Single line, share of earnings"
  },
  {
    value: "CostMethod",
    label: "Cost Method",
    description: "For <20% ownership - Investment recorded at cost"
  },
  {
    value: "VariableInterestEntity",
    label: "Variable Interest Entity (VIE)",
    description: "Primary beneficiary rules regardless of ownership"
  }
] as const

export type ConsolidationMethodType = typeof CONSOLIDATION_METHODS[number]["value"]

interface ConsolidationMethodSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Select label */
  readonly label?: string
  /** Error message */
  readonly error?: string
  /** Helper text below select */
  readonly helperText?: string
  /** Placeholder option text */
  readonly placeholder?: string
  /** Container class name */
  readonly containerClassName?: string
  /** Ownership percentage to suggest method */
  readonly ownershipPercentage?: number | null
}

/**
 * Get suggested consolidation method based on ownership percentage
 */
export function getSuggestedMethod(ownershipPercentage: number | null): ConsolidationMethodType | null {
  if (ownershipPercentage === null) return null
  if (ownershipPercentage > 50) return "FullConsolidation"
  if (ownershipPercentage >= 20) return "EquityMethod"
  return "CostMethod"
}

export const ConsolidationMethodSelect = forwardRef<HTMLSelectElement, ConsolidationMethodSelectProps>(
  function ConsolidationMethodSelect(
    {
      label,
      error,
      helperText,
      placeholder = "Select consolidation method...",
      containerClassName,
      className,
      id,
      disabled,
      ownershipPercentage,
      ...props
    },
    ref
  ) {
    const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : "consolidation-method-select")
    const hasError = Boolean(error)
    const suggestedMethod = getSuggestedMethod(ownershipPercentage ?? null)

    // Generate helper text showing suggested method
    const derivedHelperText = helperText ?? (
      suggestedMethod
        ? `Suggested: ${CONSOLIDATION_METHODS.find((m) => m.value === suggestedMethod)?.label} (based on ownership %)`
        : undefined
    )

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
            disabled={disabled}
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
              hasError ? `${selectId}-error` : derivedHelperText ? `${selectId}-helper` : undefined
            }
            aria-invalid={hasError}
            data-testid={selectId}
            {...props}
          >
            <option value="">{placeholder}</option>
            {CONSOLIDATION_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
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
        {derivedHelperText && !error && (
          <p
            id={`${selectId}-helper`}
            className="mt-1 text-sm text-gray-500"
            data-testid={`${selectId}-helper`}
          >
            {derivedHelperText}
          </p>
        )}
      </div>
    )
  }
)
