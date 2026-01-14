/**
 * CreateOrganizationModal Component
 *
 * A polished modal form for creating a new organization with:
 * - Professional styling using UI components
 * - Name input (required)
 * - Reporting currency selector
 * - All OrganizationSettings fields:
 *   - Default locale
 *   - Default timezone
 *   - Fiscal year toggle
 *   - Decimal places
 * - Form validation
 * - Loading/error states
 */

import * as React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { createOrganizationMutation } from "../atoms/organizations.ts"
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "./ui/Modal.tsx"
import { Button } from "./ui/Button.tsx"
import { Input } from "./ui/Input.tsx"
import { Select } from "./ui/Select.tsx"
import { Alert } from "./ui/Alert.tsx"

// =============================================================================
// Constants
// =============================================================================

const COMMON_CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "CNY", label: "CNY - Chinese Yuan" }
] as const

const COMMON_LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "it-IT", label: "Italian (Italy)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
  { value: "zh-CN", label: "Chinese (China)" },
  { value: "ko-KR", label: "Korean (Korea)" }
] as const

const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" }
] as const

const DECIMAL_PLACES_OPTIONS = [
  { value: "0", label: "0 decimal places" },
  { value: "1", label: "1 decimal place" },
  { value: "2", label: "2 decimal places" },
  { value: "3", label: "3 decimal places" },
  { value: "4", label: "4 decimal places" }
] as const

// =============================================================================
// Helper Functions
// =============================================================================

function hasTag(error: unknown): error is { _tag: string } {
  if (typeof error !== "object" || error === null) return false
  if (!("_tag" in error)) return false
  const tagValue = Reflect.get(error, "_tag")
  return typeof tagValue === "string"
}

function hasMessage(error: unknown): error is { message: string } {
  if (typeof error !== "object" || error === null) return false
  if (!("message" in error)) return false
  const messageValue = Reflect.get(error, "message")
  return typeof messageValue === "string"
}

function getErrorMessage(error: unknown): string {
  if (hasMessage(error)) return error.message
  if (hasTag(error)) return error._tag
  return "An unexpected error occurred"
}

// =============================================================================
// Component
// =============================================================================

interface CreateOrganizationModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSuccess?: (organizationId: string) => void
}

export function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess
}: CreateOrganizationModalProps) {
  // Form state - basic info
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")

  // Form state - settings
  const [defaultLocale, setDefaultLocale] = useState("en-US")
  const [defaultTimezone, setDefaultTimezone] = useState("UTC")
  const [useFiscalYear, setUseFiscalYear] = useState(true)
  const [defaultDecimalPlaces, setDefaultDecimalPlaces] = useState("2")

  // UI state
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Mutation
  const [createResult, createOrganization] = useAtom(createOrganizationMutation, { mode: "promise" })
  const isLoading = Result.isWaiting(createResult)

  // Focus management
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName("")
      setCurrency("USD")
      setDefaultLocale("en-US")
      setDefaultTimezone("UTC")
      setUseFiscalYear(true)
      setDefaultDecimalPlaces("2")
      setValidationError(null)
      setShowAdvanced(false)
    }
  }, [isOpen])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setValidationError(null)

      const trimmedName = name.trim()
      if (!trimmedName) {
        setValidationError("Organization name is required")
        return
      }
      if (trimmedName.length < 2) {
        setValidationError("Organization name must be at least 2 characters")
        return
      }
      if (trimmedName.length > 100) {
        setValidationError("Organization name must be less than 100 characters")
        return
      }

      try {
        const organization = await createOrganization({
          name: trimmedName,
          reportingCurrency: currency,
          settings: {
            defaultLocale,
            defaultTimezone,
            useFiscalYear,
            defaultDecimalPlaces: parseInt(defaultDecimalPlaces, 10)
          }
        })
        onSuccess?.(organization.id)
        onClose()
      } catch (error: unknown) {
        const tag = hasTag(error) ? error._tag : undefined
        if (tag === "ConflictError") {
          setValidationError("An organization with this name already exists")
        } else {
          setValidationError(getErrorMessage(error))
        }
      }
    },
    [name, currency, defaultLocale, defaultTimezone, useFiscalYear, defaultDecimalPlaces, createOrganization, onSuccess, onClose]
  )

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose()
    }
  }, [isLoading, onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      closeOnEscape={!isLoading}
      closeOnBackdrop={!isLoading}
    >
      <form onSubmit={handleSubmit} data-testid="create-organization-modal">
        <ModalHeader onClose={handleClose}>
          <ModalTitle description="Organizations group companies together for consolidated reporting.">
            Create Organization
          </ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {validationError && (
            <Alert variant="error" data-testid="create-organization-error">
              {validationError}
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Basic Information</h3>
            <Input
              ref={nameInputRef}
              label="Organization Name"
              id="organization-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
              disabled={isLoading}
              data-testid="organization-name-input"
            />

            <Select
              label="Reporting Currency"
              id="reporting-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={COMMON_CURRENCIES}
              disabled={isLoading}
              helperText="This currency will be used for consolidated reports."
              data-testid="organization-currency-select"
            />
          </div>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            data-testid="toggle-advanced-settings"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            {showAdvanced ? "Hide" : "Show"} Advanced Settings
          </button>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-medium text-gray-900">Organization Settings</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Default Locale"
                  id="default-locale"
                  value={defaultLocale}
                  onChange={(e) => setDefaultLocale(e.target.value)}
                  options={COMMON_LOCALES}
                  disabled={isLoading}
                  helperText="For number and date formatting."
                  data-testid="organization-locale-select"
                />

                <Select
                  label="Default Timezone"
                  id="default-timezone"
                  value={defaultTimezone}
                  onChange={(e) => setDefaultTimezone(e.target.value)}
                  options={COMMON_TIMEZONES}
                  disabled={isLoading}
                  helperText="For report timestamps."
                  data-testid="organization-timezone-select"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Decimal Places"
                  id="decimal-places"
                  value={defaultDecimalPlaces}
                  onChange={(e) => setDefaultDecimalPlaces(e.target.value)}
                  options={DECIMAL_PLACES_OPTIONS}
                  disabled={isLoading}
                  helperText="For monetary display."
                  data-testid="organization-decimal-select"
                />

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Year Type
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="yearType"
                        checked={useFiscalYear}
                        onChange={() => setUseFiscalYear(true)}
                        disabled={isLoading}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        data-testid="organization-fiscal-year-radio"
                      />
                      <span className="text-sm text-gray-700">Fiscal Year</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="yearType"
                        checked={!useFiscalYear}
                        onChange={() => setUseFiscalYear(false)}
                        disabled={isLoading}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        data-testid="organization-calendar-year-radio"
                      />
                      <span className="text-sm text-gray-700">Calendar Year</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Choose fiscal year for custom period boundaries.
                  </p>
                </div>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
            data-testid="create-organization-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            data-testid="create-organization-submit"
          >
            Create Organization
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
