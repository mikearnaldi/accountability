/**
 * Input Component
 *
 * A polished input component with label, error state, and icons.
 * Features:
 * - Label and helper text support
 * - Error state with message
 * - Left and right icon slots
 * - Consistent focus ring
 * - Smooth transitions
 */

import * as React from "react"

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  readonly label?: string
  readonly error?: string | undefined
  readonly helperText?: string
  readonly leftIcon?: React.ReactNode
  readonly rightIcon?: React.ReactNode
  readonly inputSize?: "sm" | "md" | "lg"
  readonly errorTestId?: string
}

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base"
}

const iconSizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-5 w-5"
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      inputSize = "md",
      errorTestId,
      className = "",
      id,
      ...props
    },
    ref
  ) {
    const inputId = id ?? React.useId()
    const hasError = Boolean(error)

    const baseInputClasses = [
      "block w-full rounded-lg",
      "border bg-white",
      "transition-all duration-200",
      "placeholder:text-gray-400",
      "focus:outline-none focus:ring-2 focus:ring-offset-0"
    ].join(" ")

    const stateClasses = hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20"

    const disabledClasses = props.disabled
      ? "bg-gray-50 text-gray-500 cursor-not-allowed"
      : ""

    const paddingClasses = [
      sizeClasses[inputSize],
      leftIcon ? "pl-10" : "",
      rightIcon ? "pr-10" : ""
    ].join(" ")

    return (
      <div className={className}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className={`text-gray-400 ${iconSizeClasses[inputSize]}`}>
                {leftIcon}
              </span>
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`${baseInputClasses} ${stateClasses} ${disabledClasses} ${paddingClasses}`}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />
          {rightIcon && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <span className={`text-gray-400 ${iconSizeClasses[inputSize]}`}>
                {rightIcon}
              </span>
            </div>
          )}
        </div>
        {hasError && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-red-600"
            data-testid={errorTestId}
          >
            {error}
          </p>
        )}
        {helperText && !hasError && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
