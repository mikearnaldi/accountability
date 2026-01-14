/**
 * Select Component
 *
 * A polished select/dropdown component.
 * Features:
 * - Label and error state
 * - Consistent styling with Input
 * - Size variants
 */

import * as React from "react"

interface SelectOption {
  readonly value: string
  readonly label: string
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  readonly label?: string
  readonly error?: string
  readonly helperText?: string
  readonly options: ReadonlyArray<SelectOption>
  readonly selectSize?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base"
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      error,
      helperText,
      options,
      selectSize = "md",
      className = "",
      id,
      ...props
    },
    ref
  ) {
    const selectId = id ?? React.useId()
    const hasError = Boolean(error)

    const baseSelectClasses = [
      "block w-full rounded-lg",
      "border bg-white",
      "transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-offset-0",
      "appearance-none bg-no-repeat bg-right",
      // Custom chevron background
      "bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20fill%3d%22none%22%20viewBox%3d%220%200%2024%2024%22%20stroke%3d%22%239ca3af%22%3e%3cpath%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%20stroke-width%3d%222%22%20d%3d%22M19%209l-7%207-7-7%22%2f%3e%3c%2fsvg%3e')]",
      "bg-[length:20px_20px]",
      "pr-10"
    ].join(" ")

    const stateClasses = hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20"

    const disabledClasses = props.disabled
      ? "bg-gray-50 text-gray-500 cursor-not-allowed"
      : ""

    return (
      <div className={className}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`${baseSelectClasses} ${stateClasses} ${disabledClasses} ${sizeClasses[selectSize]}`}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
          }
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hasError && (
          <p id={`${selectId}-error`} className="mt-1.5 text-sm text-red-600">
            {error}
          </p>
        )}
        {helperText && !hasError && (
          <p id={`${selectId}-helper`} className="mt-1.5 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
