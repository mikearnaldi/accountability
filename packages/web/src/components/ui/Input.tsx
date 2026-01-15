/**
 * Input component
 *
 * Reusable text input with label and error support.
 * Features:
 * - Label support (connects via htmlFor)
 * - Error state with message
 * - Optional helper text
 * - Icon prefix/suffix support
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react"

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Input label */
  readonly label?: string
  /** Error message */
  readonly error?: string
  /** Helper text below input */
  readonly helperText?: string
  /** Icon or element to show at start of input */
  readonly inputPrefix?: ReactNode
  /** Icon or element to show at end of input */
  readonly inputSuffix?: ReactNode
  /** Container class name */
  readonly containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, inputPrefix, inputSuffix, containerClassName, className, id, ...props },
  ref
) {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined)
  const hasError = Boolean(error)

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
          data-testid={inputId ? `${inputId}-label` : undefined}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {inputPrefix && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{inputPrefix}</div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full rounded-lg border px-3 py-2 text-gray-900 placeholder-gray-500",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
            hasError
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
            inputPrefix && "pl-10",
            inputSuffix && "pr-10",
            className
          )}
          aria-describedby={
            hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          aria-invalid={hasError}
          data-testid={inputId}
          {...props}
        />
        {inputSuffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{inputSuffix}</div>
        )}
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-sm text-red-600"
          data-testid={`${inputId}-error`}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p
          id={`${inputId}-helper`}
          className="mt-1 text-sm text-gray-500"
          data-testid={`${inputId}-helper`}
        >
          {helperText}
        </p>
      )}
    </div>
  )
})
