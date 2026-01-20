/**
 * OrganizationForm component
 *
 * Form to create/edit an organization with all API-supported fields.
 *
 * Features:
 * - Name (required)
 * - Reporting Currency (dropdown from /api/v1/currencies)
 * - Settings (collapsible):
 *   - Default Locale
 *   - Default Timezone
 *   - Use Fiscal Year (checkbox)
 *   - Default Decimal Places (0-4)
 * - Client-side validation
 * - Submit via api.POST('/api/v1/organizations')
 * - Error handling with inline validation errors
 *
 * Route: /organizations/new
 */

import { useState } from "react"
import { clsx } from "clsx"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { CurrencySelect } from "@/components/ui/CurrencySelect"
import { Button } from "@/components/ui/Button"

// =============================================================================
// Types
// =============================================================================

interface CurrencyOption {
  readonly code: string
  readonly name: string
  readonly symbol: string
  readonly decimalPlaces: number
  readonly isActive: boolean
}

interface OrganizationFormData {
  readonly name: string
  readonly reportingCurrency: string
  readonly settings: {
    readonly defaultLocale: string
    readonly defaultTimezone: string
    readonly defaultDecimalPlaces: number
  }
}

interface FieldErrors {
  name?: string
  reportingCurrency?: string
  defaultLocale?: string
  defaultTimezone?: string
  defaultDecimalPlaces?: string
}

interface OrganizationFormProps {
  /** Currencies loaded from API */
  readonly currencies: readonly CurrencyOption[]
  /** Whether currencies are loading */
  readonly isCurrenciesLoading?: boolean
  /** Callback when form is submitted successfully */
  readonly onSubmit: (data: OrganizationFormData) => Promise<void>
  /** Callback when form is cancelled (deprecated - use cancelHref for reliable navigation) */
  readonly onCancel?: () => void
  /** URL to navigate to when cancel is clicked - uses Link for reliable navigation */
  readonly cancelHref?: string
  /** API error message to display */
  readonly apiError?: string | null
  /** Whether form is submitting */
  readonly isSubmitting?: boolean
}

// =============================================================================
// Constants
// =============================================================================

const COMMON_LOCALES = [
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-CA", label: "English (Canada)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "it-IT", label: "Italian (Italy)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ko-KR", label: "Korean (Korea)" }
]

const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York (EST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "America/Denver", label: "America/Denver (MST)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" }
]

const DECIMAL_PLACES_OPTIONS = [
  { value: "0", label: "0 decimal places" },
  { value: "1", label: "1 decimal place" },
  { value: "2", label: "2 decimal places" },
  { value: "3", label: "3 decimal places" },
  { value: "4", label: "4 decimal places" }
]

// =============================================================================
// Form Component
// =============================================================================

export function OrganizationForm({
  currencies,
  isCurrenciesLoading = false,
  onSubmit,
  onCancel,
  cancelHref,
  apiError,
  isSubmitting = false
}: OrganizationFormProps) {
  // Form state
  const [name, setName] = useState("")
  const [reportingCurrency, setReportingCurrency] = useState("")
  const [defaultLocale, setDefaultLocale] = useState("en-US")
  const [defaultTimezone, setDefaultTimezone] = useState("UTC")
  const [defaultDecimalPlaces, setDefaultDecimalPlaces] = useState("2")

  // UI state
  const [showSettings, setShowSettings] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validation
  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "name":
        if (!value.trim()) {
          return "Organization name is required"
        }
        if (value.trim().length < 2) {
          return "Name must be at least 2 characters"
        }
        if (value.trim().length > 100) {
          return "Name must be less than 100 characters"
        }
        return undefined

      case "reportingCurrency":
        if (!value) {
          return "Reporting currency is required"
        }
        return undefined

      case "defaultDecimalPlaces": {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0 || num > 4) {
          return "Decimal places must be between 0 and 4"
        }
        return undefined
      }

      default:
        return undefined
    }
  }

  const validateForm = (): boolean => {
    const errors: FieldErrors = {}

    const nameError = validateField("name", name)
    if (nameError) errors.name = nameError

    const currencyError = validateField("reportingCurrency", reportingCurrency)
    if (currencyError) errors.reportingCurrency = currencyError

    const decimalError = validateField("defaultDecimalPlaces", defaultDecimalPlaces)
    if (decimalError) errors.defaultDecimalPlaces = decimalError

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFieldBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const error = validateField(field, value)
    setFieldErrors((prev) => ({ ...prev, [field]: error }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    setTouched({
      name: true,
      reportingCurrency: true,
      defaultDecimalPlaces: true
    })

    if (!validateForm()) {
      return
    }

    const formData: OrganizationFormData = {
      name: name.trim(),
      reportingCurrency,
      settings: {
        defaultLocale,
        defaultTimezone,
        defaultDecimalPlaces: parseInt(defaultDecimalPlaces, 10)
      }
    }

    await onSubmit(formData)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      data-testid="organization-form"
    >
      {/* API Error Message */}
      {apiError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4"
          data-testid="organization-form-error"
        >
          <p className="text-sm text-red-700">{apiError}</p>
        </div>
      )}

      {/* Name Field (Required) */}
      <Input
        id="org-name"
        label="Organization Name"
        type="text"
        required
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={(e) => handleFieldBlur("name", e.target.value)}
        disabled={isSubmitting}
        placeholder="Enter organization name"
        data-testid="org-name-input"
        {...(touched.name && fieldErrors.name ? { error: fieldErrors.name } : {})}
      />

      {/* Reporting Currency (Required) */}
      <CurrencySelect
        id="org-currency"
        label="Reporting Currency"
        currencies={currencies}
        isLoading={isCurrenciesLoading}
        value={reportingCurrency}
        onChange={setReportingCurrency}
        disabled={isSubmitting}
        placeholder="Search currencies..."
        data-testid="org-currency-select"
        {...(touched.reportingCurrency && fieldErrors.reportingCurrency ? { error: fieldErrors.reportingCurrency } : {})}
      />

      {/* Settings Section (Collapsible) */}
      <div className="rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={clsx(
            "flex w-full items-center justify-between px-4 py-3 text-left",
            "text-sm font-medium text-gray-700 hover:bg-gray-50",
            "transition-colors rounded-t-lg",
            !showSettings && "rounded-b-lg"
          )}
          data-testid="org-settings-toggle"
        >
          <span>Settings</span>
          {showSettings ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {showSettings && (
          <div
            className="space-y-4 border-t border-gray-200 px-4 py-4"
            data-testid="org-settings-panel"
          >
            {/* Default Locale */}
            <Select
              id="org-locale"
              label="Default Locale"
              value={defaultLocale}
              onChange={(e) => setDefaultLocale(e.target.value)}
              disabled={isSubmitting}
              options={COMMON_LOCALES}
              helperText="Used for number and date formatting"
              data-testid="org-locale-select"
            />

            {/* Default Timezone */}
            <Select
              id="org-timezone"
              label="Default Timezone"
              value={defaultTimezone}
              onChange={(e) => setDefaultTimezone(e.target.value)}
              disabled={isSubmitting}
              options={COMMON_TIMEZONES}
              helperText="Used for date/time display"
              data-testid="org-timezone-select"
            />

            {/* Default Decimal Places */}
            <Select
              id="org-decimal-places"
              label="Default Decimal Places"
              value={defaultDecimalPlaces}
              onChange={(e) => setDefaultDecimalPlaces(e.target.value)}
              onBlur={() => handleFieldBlur("defaultDecimalPlaces", defaultDecimalPlaces)}
              disabled={isSubmitting}
              options={DECIMAL_PLACES_OPTIONS}
              helperText="Number of decimal places for monetary values (0-4)"
              data-testid="org-decimal-places-select"
              {...(touched.defaultDecimalPlaces && fieldErrors.defaultDecimalPlaces ? { error: fieldErrors.defaultDecimalPlaces } : {})}
            />
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-2">
        {cancelHref ? (
          <a
            href={cancelHref}
            className={clsx(
              "inline-flex flex-1 items-center justify-center font-medium rounded-lg transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "px-4 py-2 text-sm",
              "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus:ring-blue-500",
              isSubmitting && "opacity-50 pointer-events-none"
            )}
            data-testid="org-form-cancel-button"
          >
            Cancel
          </a>
        ) : onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
            data-testid="org-form-cancel-button"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting || isCurrenciesLoading}
          className={(cancelHref || onCancel) ? "flex-1" : "w-full"}
          data-testid="org-form-submit-button"
        >
          Create Organization
        </Button>
      </div>
    </form>
  )
}
