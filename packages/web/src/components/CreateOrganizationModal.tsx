/**
 * CreateOrganizationModal Component
 *
 * A modal form for creating a new organization with:
 * - Name input (required)
 * - Reporting currency selector
 * - Form validation
 * - Loading/error states
 */

import * as React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { createOrganizationMutation } from "../atoms/organizations.ts"

/**
 * Common currencies for the dropdown
 */
const COMMON_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" }
] as const

interface CreateOrganizationModalProps {
  /**
   * Whether the modal is open
   */
  readonly isOpen: boolean
  /**
   * Called when the modal should close (cancel or after success)
   */
  readonly onClose: () => void
  /**
   * Called after a successful organization creation
   */
  readonly onSuccess?: (organizationId: string) => void
}

/**
 * Type guard for objects with _tag property
 */
function hasTag(error: unknown): error is { _tag: string } {
  if (typeof error !== "object" || error === null) {
    return false
  }
  if (!("_tag" in error)) {
    return false
  }
  const tagValue = Reflect.get(error, "_tag")
  return typeof tagValue === "string"
}

/**
 * Type guard for objects with message property
 */
function hasMessage(error: unknown): error is { message: string } {
  if (typeof error !== "object" || error === null) {
    return false
  }
  if (!("message" in error)) {
    return false
  }
  const messageValue = Reflect.get(error, "message")
  return typeof messageValue === "string"
}

/**
 * Get error message from an error object
 */
function getErrorMessage(error: unknown): string {
  if (hasMessage(error)) {
    return error.message
  }
  if (hasTag(error)) {
    return error._tag
  }
  return "An unexpected error occurred"
}

/**
 * CreateOrganizationModal - Modal form for creating organizations
 *
 * Features:
 * - Name input with validation
 * - Currency dropdown with common currencies
 * - Loading state during submission
 * - Error display
 * - Focus management (focuses name input on open)
 * - Keyboard support (Escape to close)
 *
 * Usage:
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 *
 * <CreateOrganizationModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={(id) => navigate(`/organizations/${id}`)}
 * />
 * ```
 */
export function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess
}: CreateOrganizationModalProps) {
  // Form state
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [validationError, setValidationError] = useState<string | null>(null)

  // Mutation
  const [createResult, createOrganization] = useAtom(createOrganizationMutation, { mode: "promise" })
  const isLoading = Result.isWaiting(createResult)

  // Refs for focus management
  const nameInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
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
      setValidationError(null)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen && !isLoading) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isLoading, onClose])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setValidationError(null)

      // Client-side validation
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
          reportingCurrency: currency
        })
        // Success! Call onSuccess if provided
        onSuccess?.(organization.id)
        onClose()
      } catch (error: unknown) {
        const tag = hasTag(error) ? error._tag : undefined
        if (tag === "ConflictError") {
          setValidationError("An organization with this name already exists")
        } else if (tag === "ValidationError") {
          setValidationError(getErrorMessage(error))
        } else {
          setValidationError(getErrorMessage(error))
        }
      }
    },
    [name, currency, createOrganization, onSuccess, onClose]
  )

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the backdrop (not the modal content)
      if (e.target === e.currentTarget && !isLoading) {
        onClose()
      }
    },
    [isLoading, onClose]
  )

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="create-organization-modal"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-gray-900"
          >
            Create Organization
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Organizations group companies together for consolidated reporting.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-4">
            {/* Error display */}
            {validationError && (
              <div
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
                data-testid="create-organization-error"
              >
                {validationError}
              </div>
            )}

            {/* Name input */}
            <div>
              <label
                htmlFor="organization-name"
                className="block text-sm font-medium text-gray-700"
              >
                Organization Name
              </label>
              <input
                ref={nameInputRef}
                id="organization-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="My Organization"
                disabled={isLoading}
                data-testid="organization-name-input"
              />
            </div>

            {/* Currency select */}
            <div>
              <label
                htmlFor="reporting-currency"
                className="block text-sm font-medium text-gray-700"
              >
                Reporting Currency
              </label>
              <select
                id="reporting-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="organization-currency-select"
              >
                {COMMON_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                This currency will be used for consolidated reports.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="create-organization-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="create-organization-submit"
            >
              {isLoading ? "Creating..." : "Create Organization"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
