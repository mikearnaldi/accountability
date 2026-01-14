/**
 * Organization Details Route
 *
 * Displays details for a single organization including:
 * - Organization name, reporting currency, settings
 * - Companies list within the organization
 * - Edit organization settings
 * - Create company button
 * - Breadcrumb navigation
 */

import * as React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAtomValue, useAtom, useAtomRefresh } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Chunk from "effect/Chunk"
import * as Cause from "effect/Cause"
import { AppShell } from "../../components/AppShell.tsx"
import { ProtectedRoute } from "../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../components/UserMenu.tsx"
import {
  organizationFamily,
  companiesByOrgFamily,
  updateOrganizationMutation
} from "../../atoms/organizations.ts"
import type { Company } from "@accountability/core/Domains/Company"

export const Route = createFileRoute("/organizations/$id")({
  component: OrganizationDetailsPage
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

function PlusIcon({ className }: { className?: string }) {
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
        d="M12 4v16m8-8H4"
      />
    </svg>
  )
}

function BuildingOfficeIcon({ className }: { className?: string }) {
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
        strokeWidth={1.5}
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5V21m3-18h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75"
      />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
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
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}

// =============================================================================
// Common Currencies
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
// Edit Organization Modal
// =============================================================================

interface EditOrganizationModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly organizationId: string
  readonly currentName: string
  readonly currentCurrency: string
}

function EditOrganizationModal({
  isOpen,
  onClose,
  organizationId,
  currentName,
  currentCurrency
}: EditOrganizationModalProps) {
  const [name, setName] = useState(currentName)
  const [currency, setCurrency] = useState(currentCurrency)
  const [validationError, setValidationError] = useState<string | null>(null)

  const [updateResult, updateOrganization] = useAtom(updateOrganizationMutation, { mode: "promise" })
  const isLoading = Result.isWaiting(updateResult)

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Reset form when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setCurrency(currentCurrency)
      setValidationError(null)
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, currentName, currentCurrency])

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
        await updateOrganization({
          id: organizationId,
          name: trimmedName !== currentName ? trimmedName : undefined,
          reportingCurrency: currency !== currentCurrency ? currency : undefined
        })
        onClose()
      } catch (error: unknown) {
        const tag = hasTag(error) ? error._tag : undefined
        if (tag === "ConflictError") {
          setValidationError("An organization with this name already exists")
        } else if (tag === "ValidationError") {
          setValidationError(hasMessage(error) ? error.message : "Validation error")
        } else {
          setValidationError(hasMessage(error) ? error.message : "An unexpected error occurred")
        }
      }
    },
    [name, currency, currentName, currentCurrency, organizationId, updateOrganization, onClose]
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
      data-testid="edit-organization-modal"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="edit-modal-title" className="text-lg font-semibold text-gray-900">
            Edit Organization
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Update your organization's settings.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-4">
            {validationError && (
              <div
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
                data-testid="edit-organization-error"
              >
                {validationError}
              </div>
            )}

            <div>
              <label htmlFor="edit-org-name" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <input
                ref={nameInputRef}
                id="edit-org-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="edit-organization-name-input"
              />
            </div>

            <div>
              <label htmlFor="edit-org-currency" className="block text-sm font-medium text-gray-700">
                Reporting Currency
              </label>
              <select
                id="edit-org-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading}
                data-testid="edit-organization-currency-select"
              >
                {COMMON_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name}
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
              data-testid="edit-organization-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="edit-organization-submit"
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
// Create Company Modal (placeholder for future story)
// =============================================================================

interface CreateCompanyModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly organizationId: string
}

function CreateCompanyModal({ isOpen, onClose }: CreateCompanyModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      data-testid="create-company-modal"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-company-title"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="create-company-title" className="text-lg font-semibold text-gray-900">
            Create Company
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Company creation will be implemented in a future story.
          </p>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">
            This functionality is coming soon. Companies are legal entities within
            organizations that have their own Chart of Accounts.
          </p>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid="create-company-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Company Card
// =============================================================================

interface CompanyCardProps {
  readonly company: Company
}

function CompanyCard({ company }: CompanyCardProps) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      data-testid={`company-card-${company.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100">
          <BuildingOfficeIcon className="h-5 w-5 text-green-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold text-gray-900"
            data-testid={`company-name-${company.id}`}
          >
            {company.name}
          </h3>
          <p className="truncate text-xs text-gray-500">{company.legalName}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex gap-3 text-xs text-gray-500">
          <span data-testid={`company-currency-${company.id}`}>
            {company.functionalCurrency}
          </span>
          <span>•</span>
          <span>{company.jurisdiction}</span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            company.isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {company.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Companies Section
// =============================================================================

interface CompaniesSectionProps {
  readonly organizationId: string
  readonly onCreateClick: () => void
}

function CompaniesSection({ organizationId, onCreateClick }: CompaniesSectionProps) {
  const companiesAtom = companiesByOrgFamily(organizationId)
  const result = useAtomValue(companiesAtom)
  const refresh = useAtomRefresh(companiesAtom)

  // Loading state
  if (Result.isInitial(result) || (Result.isWaiting(result) && !Result.isSuccess(result))) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="companies-loading">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Companies</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (Result.isFailure(result)) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-6"
        data-testid="companies-error"
      >
        <div className="flex flex-col items-center text-center">
          <h3 className="text-lg font-semibold text-red-800">Failed to load companies</h3>
          <p className="mt-2 text-sm text-red-600">{getErrorMessage(result.cause)}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            data-testid="companies-error-retry"
          >
            <RefreshIcon className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  const { companies, total } = result.value

  // Empty state
  if (total === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="companies-section">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Companies</h2>
        </div>
        <div
          className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center"
          data-testid="companies-empty"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <BuildingOfficeIcon className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No companies yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first company to start managing accounts and journal entries.
          </p>
          <button
            type="button"
            onClick={onCreateClick}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid="companies-empty-create"
          >
            <PlusIcon className="h-4 w-4" />
            Create your first company
          </button>
        </div>
      </div>
    )
  }

  // Companies list
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="companies-section">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Companies</h2>
          <p className="mt-1 text-sm text-gray-500">{total} {total === 1 ? "company" : "companies"}</p>
        </div>
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          data-testid="companies-create-button"
        >
          <PlusIcon className="h-4 w-4" />
          Create Company
        </button>
      </div>
      <div
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="companies-list"
      >
        {companies.map((company) => (
          <CompanyCard key={company.id} company={company} />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function OrganizationDetailsPage() {
  const { id } = Route.useParams()
  const organizationAtom = organizationFamily(id)
  const result = useAtomValue(organizationAtom)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateCompanyModalOpen, setIsCreateCompanyModalOpen] = useState(false)

  const handleOpenEditModal = useCallback(() => setIsEditModalOpen(true), [])
  const handleCloseEditModal = useCallback(() => setIsEditModalOpen(false), [])
  const handleOpenCreateCompanyModal = useCallback(() => setIsCreateCompanyModalOpen(true), [])
  const handleCloseCreateCompanyModal = useCallback(() => setIsCreateCompanyModalOpen(false), [])

  // Loading state
  if (Result.isInitial(result) || (Result.isWaiting(result) && !Result.isSuccess(result))) {
    return (
      <ProtectedRoute>
        <AppShell userMenu={<UserMenu />}>
          <div className="animate-pulse space-y-4" data-testid="organization-details-loading">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
          </div>
        </AppShell>
      </ProtectedRoute>
    )
  }

  // Error state
  if (Result.isFailure(result)) {
    return (
      <ProtectedRoute>
        <AppShell userMenu={<UserMenu />}>
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
            data-testid="organization-details-error"
          >
            <h2 className="text-lg font-semibold text-red-800">
              Organization not found
            </h2>
            <p className="mt-2 text-sm text-red-600">
              The organization you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link
              to="/organizations"
              className="mt-4 inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Back to Organizations
            </Link>
          </div>
        </AppShell>
      </ProtectedRoute>
    )
  }

  const organization = result.value

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6" data-testid="organization-details-page">
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
            <span
              className="font-medium text-gray-900"
              data-testid="breadcrumb-current"
            >
              {organization.name}
            </span>
          </nav>

          {/* Header with organization info and edit button */}
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-2xl font-bold text-gray-900"
                data-testid="organization-detail-name"
              >
                {organization.name}
              </h1>
              <div className="mt-2 flex items-center gap-4">
                <p
                  className="text-sm text-gray-600"
                  data-testid="organization-detail-currency"
                >
                  <span className="font-medium">Reporting Currency:</span> {organization.reportingCurrency}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              data-testid="organization-edit-button"
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
          </div>

          {/* Organization Settings Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6" data-testid="organization-settings">
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Default Locale</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="setting-locale">
                  {organization.settings.defaultLocale}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Default Timezone</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="setting-timezone">
                  {organization.settings.defaultTimezone}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Fiscal Year</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="setting-fiscal-year">
                  {organization.settings.useFiscalYear ? "Enabled" : "Calendar Year"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Decimal Places</dt>
                <dd className="mt-1 text-sm text-gray-900" data-testid="setting-decimal-places">
                  {organization.settings.defaultDecimalPlaces}
                </dd>
              </div>
            </div>
          </div>

          {/* Companies Section */}
          <CompaniesSection
            organizationId={id}
            onCreateClick={handleOpenCreateCompanyModal}
          />

          {/* Edit Organization Modal */}
          <EditOrganizationModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
            organizationId={id}
            currentName={organization.name}
            currentCurrency={organization.reportingCurrency}
          />

          {/* Create Company Modal */}
          <CreateCompanyModal
            isOpen={isCreateCompanyModalOpen}
            onClose={handleCloseCreateCompanyModal}
            organizationId={id}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
