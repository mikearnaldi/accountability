/**
 * Company Details Route
 *
 * Protected route displaying company details including:
 * - Company name, legal name, jurisdiction, tax ID
 * - Currencies (functional and reporting)
 * - Fiscal year end
 * - Consolidation info (if subsidiary)
 * - Navigation tabs to Accounts, Journal Entries, Fiscal Periods, Reports
 * - Edit company settings button
 * - Breadcrumb navigation
 */

import * as React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Option from "effect/Option"
import { AppShell } from "../../../../../components/AppShell.tsx"
import { ProtectedRoute } from "../../../../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../../../../components/UserMenu.tsx"
import {
  companyFamily,
  organizationFamily,
  updateCompanyMutation,
  type UpdateCompanyInput
} from "../../../../../atoms/organizations.ts"

export const Route = createFileRoute("/organizations/$organizationId/companies/$companyId/")({
  component: CompanyDetailsPage
})

// =============================================================================
// Icons
// =============================================================================

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  )
}

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  )
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  )
}

function TableCellsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

// =============================================================================
// Common Currencies and Jurisdictions
// =============================================================================

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

const FISCAL_YEAR_END_OPTIONS = [
  { month: 12, day: 31, label: "December 31 (Calendar Year)" },
  { month: 3, day: 31, label: "March 31" },
  { month: 6, day: 30, label: "June 30" },
  { month: 9, day: 30, label: "September 30" }
] as const

const CONSOLIDATION_METHODS = [
  { value: "FullConsolidation", label: "Full Consolidation" },
  { value: "EquityMethod", label: "Equity Method" },
  { value: "CostMethod", label: "Cost Method" },
  { value: "VariableInterestEntity", label: "Variable Interest Entity" }
] as const

// =============================================================================
// Error Helpers
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

function getErrorMessage(cause: Cause.Cause<unknown>): string {
  const failures = Cause.failures(cause)
  const first = Chunk.head(failures)
  if (first._tag === "Some") {
    const err = first.value
    if (hasMessage(err)) return err.message
    if (hasTag(err)) return err._tag
  }
  return "An unexpected error occurred"
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatFiscalYearEnd(month: number, day: number): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]
  return `${monthNames[month - 1]} ${day}`
}

function getConsolidationMethodLabel(method: string): string {
  const found = CONSOLIDATION_METHODS.find(m => m.value === method)
  return found ? found.label : method
}

// =============================================================================
// Edit Company Modal
// =============================================================================

interface EditCompanyModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly companyId: string
  readonly organizationId: string
  readonly currentName: string
  readonly currentLegalName: string
  readonly currentTaxId: string
  readonly currentReportingCurrency: string
  readonly currentFiscalYearEndMonth: number
  readonly currentFiscalYearEndDay: number
}

function EditCompanyModal({
  isOpen,
  onClose,
  companyId,
  organizationId,
  currentName,
  currentLegalName,
  currentTaxId,
  currentReportingCurrency,
  currentFiscalYearEndMonth,
  currentFiscalYearEndDay
}: EditCompanyModalProps) {
  const [name, setName] = useState(currentName)
  const [legalName, setLegalName] = useState(currentLegalName)
  const [taxId, setTaxId] = useState(currentTaxId)
  const [reportingCurrency, setReportingCurrency] = useState(currentReportingCurrency)
  const [fiscalYearEndIndex, setFiscalYearEndIndex] = useState(() => {
    const idx = FISCAL_YEAR_END_OPTIONS.findIndex(
      opt => opt.month === currentFiscalYearEndMonth && opt.day === currentFiscalYearEndDay
    )
    return idx >= 0 ? idx : 0
  })
  const [validationError, setValidationError] = useState<string | null>(null)

  const [updateResult, updateCompany] = useAtom(updateCompanyMutation, { mode: "promise" })
  const isLoading = Result.isWaiting(updateResult)

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setLegalName(currentLegalName)
      setTaxId(currentTaxId)
      setReportingCurrency(currentReportingCurrency)
      const idx = FISCAL_YEAR_END_OPTIONS.findIndex(
        opt => opt.month === currentFiscalYearEndMonth && opt.day === currentFiscalYearEndDay
      )
      setFiscalYearEndIndex(idx >= 0 ? idx : 0)
      setValidationError(null)
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, currentName, currentLegalName, currentTaxId, currentReportingCurrency, currentFiscalYearEndMonth, currentFiscalYearEndDay])

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setValidationError(null)

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

      const input: UpdateCompanyInput = {
        id: companyId,
        organizationId,
        ...(trimmedName !== currentName ? { name: trimmedName } : {}),
        ...(trimmedLegalName !== currentLegalName ? { legalName: trimmedLegalName } : {}),
        ...(trimmedTaxId !== currentTaxId ? { taxId: trimmedTaxId || null } : {}),
        ...(reportingCurrency !== currentReportingCurrency ? { reportingCurrency } : {}),
        ...(fiscalYearEnd.month !== currentFiscalYearEndMonth || fiscalYearEnd.day !== currentFiscalYearEndDay
          ? { fiscalYearEndMonth: fiscalYearEnd.month, fiscalYearEndDay: fiscalYearEnd.day }
          : {})
      }

      try {
        await updateCompany(input)
        onClose()
      } catch (error: unknown) {
        const tag = hasTag(error) ? error._tag : undefined
        if (tag === "ConflictError") {
          setValidationError("A company with this name already exists")
        } else if (tag === "ValidationError") {
          setValidationError(hasMessage(error) ? error.message : "Validation error")
        } else {
          setValidationError(hasMessage(error) ? error.message : "An unexpected error occurred")
        }
      }
    },
    [name, legalName, taxId, reportingCurrency, fiscalYearEndIndex, companyId, organizationId, currentName, currentLegalName, currentTaxId, currentReportingCurrency, currentFiscalYearEndMonth, currentFiscalYearEndDay, updateCompany, onClose]
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose()
      }
    },
    [isLoading, onClose]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="edit-company-modal"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-company-modal-title"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="edit-company-modal-title" className="text-lg font-semibold text-gray-900">
            Edit Company Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Update your company's information.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-4">
            {validationError && (
              <div
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
                data-testid="edit-company-error"
              >
                {validationError}
              </div>
            )}

            <div>
              <label htmlFor="edit-company-name" className="block text-sm font-medium text-gray-700">
                Company Name *
              </label>
              <input
                ref={nameInputRef}
                id="edit-company-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="edit-company-name-input"
              />
            </div>

            <div>
              <label htmlFor="edit-company-legal-name" className="block text-sm font-medium text-gray-700">
                Legal Name *
              </label>
              <input
                id="edit-company-legal-name"
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="edit-company-legal-name-input"
              />
            </div>

            <div>
              <label htmlFor="edit-company-tax-id" className="block text-sm font-medium text-gray-700">
                Tax ID (Optional)
              </label>
              <input
                id="edit-company-tax-id"
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="EIN, VAT number, etc."
                disabled={isLoading}
                data-testid="edit-company-tax-id-input"
              />
            </div>

            <div>
              <label htmlFor="edit-company-reporting-currency" className="block text-sm font-medium text-gray-700">
                Reporting Currency
              </label>
              <select
                id="edit-company-reporting-currency"
                value={reportingCurrency}
                onChange={(e) => setReportingCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="edit-company-reporting-currency-select"
              >
                {COMMON_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-company-fiscal-year-end" className="block text-sm font-medium text-gray-700">
                Fiscal Year End
              </label>
              <select
                id="edit-company-fiscal-year-end"
                value={fiscalYearEndIndex}
                onChange={(e) => setFiscalYearEndIndex(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="edit-company-fiscal-year-end-select"
              >
                {FISCAL_YEAR_END_OPTIONS.map((opt, idx) => (
                  <option key={idx} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="edit-company-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="edit-company-submit"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =============================================================================
// Navigation Tab
// =============================================================================

interface NavTabProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly to: string
  readonly params: Record<string, string>
  readonly testId: string
}

function NavTab({ icon, label, to, params, testId }: NavTabProps) {
  return (
    <Link
      to={to}
      params={params}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
      data-testid={testId}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function CompanyDetailsPage() {
  const { organizationId, companyId } = Route.useParams()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const companyAtom = companyFamily(companyId)
  const companyResult = useAtomValue(companyAtom)
  const organizationAtom = organizationFamily(organizationId)
  const organizationResult = useAtomValue(organizationAtom)

  const handleOpenEditModal = useCallback(() => setIsEditModalOpen(true), [])
  const handleCloseEditModal = useCallback(() => setIsEditModalOpen(false), [])

  // Get organization name for breadcrumb
  const organizationName = React.useMemo(() => {
    if (Result.isSuccess(organizationResult)) {
      return organizationResult.value.name
    }
    return "Organization"
  }, [organizationResult])

  // Loading state
  if (Result.isInitial(companyResult) || (Result.isWaiting(companyResult) && !Result.isSuccess(companyResult))) {
    return (
      <ProtectedRoute>
        <AppShell userMenu={<UserMenu />}>
          <div className="animate-pulse space-y-6" data-testid="company-details-loading">
            <div className="h-4 w-1/2 rounded bg-gray-200" />
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-24 rounded bg-gray-200" />
              <div className="h-24 rounded bg-gray-200" />
            </div>
          </div>
        </AppShell>
      </ProtectedRoute>
    )
  }

  // Error state
  if (Result.isFailure(companyResult)) {
    return (
      <ProtectedRoute>
        <AppShell userMenu={<UserMenu />}>
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
            data-testid="company-details-error"
          >
            <h2 className="text-lg font-semibold text-red-800">
              Company not found
            </h2>
            <p className="mt-2 text-sm text-red-600">
              {getErrorMessage(companyResult.cause)}
            </p>
            <Link
              to="/organizations/$organizationId/companies"
              params={{ organizationId }}
              className="mt-4 inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Back to Companies
            </Link>
          </div>
        </AppShell>
      </ProtectedRoute>
    )
  }

  const company = companyResult.value
  const taxId = Option.isSome(company.taxId) ? company.taxId.value : ""
  const hasParent = Option.isSome(company.parentCompanyId)
  const ownershipPercentage = Option.isSome(company.ownershipPercentage) ? company.ownershipPercentage.value : null
  const consolidationMethod = Option.isSome(company.consolidationMethod) ? company.consolidationMethod.value : null

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6" data-testid="company-details-page">
          {/* Breadcrumb navigation */}
          <nav className="flex items-center gap-2 text-sm" data-testid="breadcrumb">
            <Link
              to="/organizations"
              className="text-gray-500 hover:text-gray-700"
              data-testid="breadcrumb-organizations"
            >
              Organizations
            </Link>
            <span className="text-gray-400">&gt;</span>
            <Link
              to="/organizations/$id"
              params={{ id: organizationId }}
              className="text-gray-500 hover:text-gray-700"
              data-testid="breadcrumb-organization"
            >
              {organizationName}
            </Link>
            <span className="text-gray-400">&gt;</span>
            <Link
              to="/organizations/$organizationId/companies"
              params={{ organizationId }}
              className="text-gray-500 hover:text-gray-700"
              data-testid="breadcrumb-companies"
            >
              Companies
            </Link>
            <span className="text-gray-400">&gt;</span>
            <span
              className="font-medium text-gray-900"
              data-testid="breadcrumb-current"
            >
              {company.name}
            </span>
          </nav>

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1
                  className="text-2xl font-bold text-gray-900"
                  data-testid="company-name"
                >
                  {company.name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    company.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                  data-testid="company-status"
                >
                  {company.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p
                className="mt-1 text-sm text-gray-600"
                data-testid="company-legal-name"
              >
                {company.legalName}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              data-testid="company-edit-button"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
          </div>

          {/* Company Details Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="company-details-card">
            <h2 className="text-lg font-semibold text-gray-900">Company Details</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Jurisdiction</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="company-jurisdiction">
                  {company.jurisdiction}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Tax ID</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="company-tax-id">
                  {taxId || "Not specified"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Functional Currency</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="company-functional-currency">
                  {company.functionalCurrency}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Reporting Currency</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="company-reporting-currency">
                  {company.reportingCurrency}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Fiscal Year End</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="company-fiscal-year-end">
                  {formatFiscalYearEnd(company.fiscalYearEnd.month, company.fiscalYearEnd.day)}
                </dd>
              </div>
            </div>
          </div>

          {/* Consolidation Info Card (only shown if subsidiary) */}
          {hasParent && (
            <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="company-consolidation-card">
              <h2 className="text-lg font-semibold text-gray-900">Consolidation Information</h2>
              <p className="mt-1 text-sm text-gray-500">
                This company is a subsidiary in the consolidation hierarchy.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Parent Company ID</dt>
                  <dd className="mt-1 text-sm text-gray-900" data-testid="company-parent-id">
                    {Option.isSome(company.parentCompanyId) ? company.parentCompanyId.value : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Ownership Percentage</dt>
                  <dd className="mt-1 text-sm text-gray-900" data-testid="company-ownership-percentage">
                    {ownershipPercentage !== null ? `${ownershipPercentage}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Consolidation Method</dt>
                  <dd className="mt-1 text-sm text-gray-900" data-testid="company-consolidation-method">
                    {consolidationMethod !== null ? getConsolidationMethodLabel(consolidationMethod) : "—"}
                  </dd>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="company-navigation">
            <h2 className="text-lg font-semibold text-gray-900">Manage</h2>
            <p className="mt-1 text-sm text-gray-500">
              Navigate to different areas of this company.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NavTab
                icon={<TableCellsIcon className="h-5 w-5 text-blue-600" />}
                label="Accounts"
                to="/organizations/$organizationId/companies/$companyId/accounts"
                params={{ organizationId, companyId }}
                testId="nav-accounts"
              />
              <NavTab
                icon={<DocumentTextIcon className="h-5 w-5 text-green-600" />}
                label="Journal Entries"
                to="/organizations/$organizationId/companies/$companyId/journal-entries"
                params={{ organizationId, companyId }}
                testId="nav-journal-entries"
              />
              <NavTab
                icon={<CalendarIcon className="h-5 w-5 text-purple-600" />}
                label="Fiscal Periods"
                to="/organizations/$organizationId/companies/$companyId/fiscal-periods"
                params={{ organizationId, companyId }}
                testId="nav-fiscal-periods"
              />
              <NavTab
                icon={<ChartBarIcon className="h-5 w-5 text-orange-600" />}
                label="Reports"
                to="/organizations/$organizationId/companies/$companyId/reports"
                params={{ organizationId, companyId }}
                testId="nav-reports"
              />
            </div>
          </div>

          {/* Edit Company Modal */}
          <EditCompanyModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
            companyId={companyId}
            organizationId={organizationId}
            currentName={company.name}
            currentLegalName={company.legalName}
            currentTaxId={taxId}
            currentReportingCurrency={company.reportingCurrency}
            currentFiscalYearEndMonth={company.fiscalYearEnd.month}
            currentFiscalYearEndDay={company.fiscalYearEnd.day}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
