/**
 * Report Parameter Form Component
 *
 * Provides a consistent, professional form layout for report parameter selection
 * across all financial report pages (Trial Balance, Balance Sheet, Income Statement,
 * Cash Flow Statement, Statement of Changes in Equity).
 *
 * Features:
 * - Card wrapper with "Report Parameters" header
 * - Organized sections with clear visual hierarchy
 * - 2-column grid layout on desktop, single column on mobile
 * - Consistent field sizing and spacing
 * - Prominent "Generate Report" button
 */

import { type ReactNode } from "react"
import { ArrowRight } from "lucide-react"

// =============================================================================
// Types
// =============================================================================

interface ReportParameterFormProps {
  readonly children: ReactNode
  readonly onSubmit: () => void
  readonly isLoading: boolean
  readonly isValid: boolean
  readonly error: string | null
}

interface FormSectionProps {
  readonly title: string
  readonly description?: string
  readonly children: ReactNode
}

interface FormFieldProps {
  readonly label: string
  readonly required?: boolean
  readonly children: ReactNode
  readonly hint?: string
}

interface FormRowProps {
  readonly children: ReactNode
}

// =============================================================================
// Main Component
// =============================================================================

export function ReportParameterForm({
  children,
  onSubmit,
  isLoading,
  isValid,
  error
}: ReportParameterFormProps) {
  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Report Parameters</h2>
        <p className="mt-1 text-sm text-gray-500">Configure the parameters for your report</p>
      </div>

      {/* Form Content */}
      <div className="px-6 py-5">
        <div className="space-y-6">{children}</div>
      </div>

      {/* Footer with Submit Button */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-sm text-gray-500">* Required fields</p>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!isValid || isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              Generating...
            </>
          ) : (
            <>
              Generate Report
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Form section with title and optional description
 */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  )
}

/**
 * Horizontal row for grouping related fields (2-column on desktop)
 */
export function FormRow({ children }: FormRowProps) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

/**
 * Individual form field with label
 */
export function FormField({ label, required = false, children, hint }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

/**
 * Date input with consistent styling
 */
export function DateInput({
  value,
  onChange,
  "data-testid": dataTestId
}: {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly "data-testid"?: string
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      data-testid={dataTestId}
    />
  )
}

/**
 * Checkbox input with label
 */
export function CheckboxField({
  id,
  checked,
  onChange,
  label
}: {
  readonly id: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly label: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <label htmlFor={id} className="text-sm text-gray-700">
        {label}
      </label>
    </div>
  )
}

/**
 * Radio button group with consistent styling
 */
export function RadioGroup({
  name,
  options,
  value,
  onChange
}: {
  readonly name: string
  readonly options: readonly { readonly value: string; readonly label: string }[]
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <div className="flex gap-6 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
