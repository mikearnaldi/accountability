/**
 * CreateCompanyModal Component
 *
 * A modal form for creating a new company with:
 * - Basic info: name, legal name
 * - Regional settings: jurisdiction, tax ID
 * - Currency settings: functional and reporting currency
 * - Fiscal year end date
 * - Consolidation info (optional): parent company, ownership, method
 * - Form validation
 * - Loading/error states
 */

import * as React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { createCompanyMutation, type CreateCompanyInput } from "../atoms/organizations.ts"

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

/**
 * Common jurisdictions for the dropdown
 */
const COMMON_JURISDICTIONS = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "CH", name: "Switzerland" },
  { code: "CN", name: "China" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "NL", name: "Netherlands" },
  { code: "IE", name: "Ireland" }
] as const

/**
 * Fiscal year end options
 */
const FISCAL_YEAR_END_OPTIONS = [
  { month: 12, day: 31, label: "December 31 (Calendar Year)" },
  { month: 3, day: 31, label: "March 31" },
  { month: 6, day: 30, label: "June 30" },
  { month: 9, day: 30, label: "September 30" }
] as const

interface CreateCompanyModalProps {
  /**
   * Whether the modal is open
   */
  readonly isOpen: boolean
  /**
   * Called when the modal should close (cancel or after success)
   */
  readonly onClose: () => void
  /**
   * The organization ID to create the company in
   */
  readonly organizationId: string
  /**
   * Called after a successful company creation
   */
  readonly onSuccess?: (companyId: string) => void
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
 * CreateCompanyModal - Modal form for creating companies
 *
 * Features:
 * - Company name and legal name inputs
 * - Jurisdiction dropdown
 * - Currency dropdowns (functional and reporting)
 * - Fiscal year end selector
 * - Loading state during submission
 * - Error display
 * - Focus management (focuses name input on open)
 * - Keyboard support (Escape to close)
 *
 * Usage:
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 *
 * <CreateCompanyModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   organizationId={orgId}
 *   onSuccess={(id) => navigate(`/organizations/${orgId}/companies/${id}`)}
 * />
 * ```
 */
export function CreateCompanyModal({
  isOpen,
  onClose,
  organizationId,
  onSuccess
}: CreateCompanyModalProps) {
  // Form state
  const [name, setName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [jurisdiction, setJurisdiction] = useState("US")
  const [taxId, setTaxId] = useState("")
  const [functionalCurrency, setFunctionalCurrency] = useState("USD")
  const [reportingCurrency, setReportingCurrency] = useState("USD")
  const [fiscalYearEndIndex, setFiscalYearEndIndex] = useState(0) // December 31
  const [validationError, setValidationError] = useState<string | null>(null)

  // Mutation
  const [createResult, createCompany] = useAtom(createCompanyMutation, { mode: "promise" })
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
      setLegalName("")
      setJurisdiction("US")
      setTaxId("")
      setFunctionalCurrency("USD")
      setReportingCurrency("USD")
      setFiscalYearEndIndex(0)
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
        setValidationError("Company name is required")
        return
      }
      if (trimmedName.length < 2) {
        setValidationError("Company name must be at least 2 characters")
        return
      }
      if (trimmedName.length > 100) {
        setValidationError("Company name must be less than 100 characters")
        return
      }

      const trimmedLegalName = legalName.trim()
      if (!trimmedLegalName) {
        setValidationError("Legal name is required")
        return
      }
      if (trimmedLegalName.length < 2) {
        setValidationError("Legal name must be at least 2 characters")
        return
      }
      if (trimmedLegalName.length > 200) {
        setValidationError("Legal name must be less than 200 characters")
        return
      }

      const fiscalYearEnd = FISCAL_YEAR_END_OPTIONS[fiscalYearEndIndex]

      const trimmedTaxId = taxId.trim()
      const input: CreateCompanyInput = {
        organizationId,
        name: trimmedName,
        legalName: trimmedLegalName,
        jurisdiction,
        ...(trimmedTaxId ? { taxId: trimmedTaxId } : {}),
        functionalCurrency,
        reportingCurrency,
        fiscalYearEndMonth: fiscalYearEnd.month,
        fiscalYearEndDay: fiscalYearEnd.day
      }

      try {
        const company = await createCompany(input)
        // Success! Call onSuccess if provided
        onSuccess?.(company.id)
        onClose()
      } catch (error: unknown) {
        const tag = hasTag(error) ? error._tag : undefined
        if (tag === "ConflictError") {
          setValidationError("A company with this name already exists in this organization")
        } else if (tag === "ValidationError") {
          setValidationError(getErrorMessage(error))
        } else if (tag === "BusinessRuleError") {
          setValidationError(getErrorMessage(error))
        } else {
          setValidationError(getErrorMessage(error))
        }
      }
    },
    [name, legalName, jurisdiction, taxId, functionalCurrency, reportingCurrency, fiscalYearEndIndex, organizationId, createCompany, onSuccess, onClose]
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
      data-testid="create-company-modal"
    >
      <div
        ref={modalRef}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
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
            Create Company
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Companies are legal entities within your organization with their own Chart of Accounts.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-4">
            {/* Error display */}
            {validationError && (
              <div
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
                data-testid="create-company-error"
              >
                {validationError}
              </div>
            )}

            {/* Company Name */}
            <div>
              <label
                htmlFor="company-name"
                className="block text-sm font-medium text-gray-700"
              >
                Company Name *
              </label>
              <input
                ref={nameInputRef}
                id="company-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="ACME Corp"
                disabled={isLoading}
                data-testid="company-name-input"
              />
            </div>

            {/* Legal Name */}
            <div>
              <label
                htmlFor="company-legal-name"
                className="block text-sm font-medium text-gray-700"
              >
                Legal Name *
              </label>
              <input
                id="company-legal-name"
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="ACME Corporation Inc."
                disabled={isLoading}
                data-testid="company-legal-name-input"
              />
              <p className="mt-1 text-xs text-gray-500">
                The official registered name of the company.
              </p>
            </div>

            {/* Jurisdiction */}
            <div>
              <label
                htmlFor="company-jurisdiction"
                className="block text-sm font-medium text-gray-700"
              >
                Jurisdiction *
              </label>
              <select
                id="company-jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="company-jurisdiction-select"
              >
                {COMMON_JURISDICTIONS.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.code} - {j.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tax ID */}
            <div>
              <label
                htmlFor="company-tax-id"
                className="block text-sm font-medium text-gray-700"
              >
                Tax ID (Optional)
              </label>
              <input
                id="company-tax-id"
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="EIN, VAT number, etc."
                disabled={isLoading}
                data-testid="company-tax-id-input"
              />
            </div>

            {/* Currency Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Functional Currency */}
              <div>
                <label
                  htmlFor="company-functional-currency"
                  className="block text-sm font-medium text-gray-700"
                >
                  Functional Currency *
                </label>
                <select
                  id="company-functional-currency"
                  value={functionalCurrency}
                  onChange={(e) => setFunctionalCurrency(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                  data-testid="company-functional-currency-select"
                >
                  {COMMON_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Primary economic environment
                </p>
              </div>

              {/* Reporting Currency */}
              <div>
                <label
                  htmlFor="company-reporting-currency"
                  className="block text-sm font-medium text-gray-700"
                >
                  Reporting Currency *
                </label>
                <select
                  id="company-reporting-currency"
                  value={reportingCurrency}
                  onChange={(e) => setReportingCurrency(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                  data-testid="company-reporting-currency-select"
                >
                  {COMMON_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Financial statement currency
                </p>
              </div>
            </div>

            {/* Fiscal Year End */}
            <div>
              <label
                htmlFor="company-fiscal-year-end"
                className="block text-sm font-medium text-gray-700"
              >
                Fiscal Year End *
              </label>
              <select
                id="company-fiscal-year-end"
                value={fiscalYearEndIndex}
                onChange={(e) => setFiscalYearEndIndex(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="company-fiscal-year-end-select"
              >
                {FISCAL_YEAR_END_OPTIONS.map((opt, idx) => (
                  <option key={idx} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="create-company-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="create-company-submit"
            >
              {isLoading ? "Creating..." : "Create Company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
