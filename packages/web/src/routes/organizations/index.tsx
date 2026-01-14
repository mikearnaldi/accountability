/**
 * Organizations Route
 *
 * Protected route for managing organizations.
 * Features:
 * - Table view showing full organization info
 * - Sortable columns
 * - Polished loading, error, and empty states
 * - Create organization modal
 */

import * as React from "react"
import { useState, useCallback, useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAtomValue, useAtomRefresh } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import { AppShell } from "../../components/AppShell.tsx"
import { ProtectedRoute } from "../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../components/UserMenu.tsx"
import { CreateOrganizationModal } from "../../components/CreateOrganizationModal.tsx"
import { organizationsAtom, organizationCompanyCountFamily } from "../../atoms/organizations.ts"
import { Button } from "../../components/ui/Button.tsx"
import { EmptyState, ErrorEmptyState } from "../../components/ui/EmptyState.tsx"
import type { Organization } from "@accountability/core/Domains/Organization"

export const Route = createFileRoute("/organizations/")({
  component: OrganizationsPage
})

// =============================================================================
// Icons
// =============================================================================

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5V21m3-18h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75m-3.75 3.75h3.75" />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

// =============================================================================
// Loading Skeleton (Table)
// =============================================================================

function LoadingSkeleton() {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white overflow-hidden"
      data-testid="organizations-loading"
    >
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left"><div className="h-4 w-24 animate-pulse rounded bg-gray-200" /></th>
            <th className="px-6 py-3 text-left"><div className="h-4 w-16 animate-pulse rounded bg-gray-200" /></th>
            <th className="px-6 py-3 text-left"><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></th>
            <th className="px-6 py-3 text-left"><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></th>
            <th className="px-6 py-3 text-left"><div className="h-4 w-16 animate-pulse rounded bg-gray-200" /></th>
            <th className="px-6 py-3 text-right"><div className="h-4 w-8 animate-pulse rounded bg-gray-200 ml-auto" /></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="px-6 py-4"><div className="h-5 w-40 animate-pulse rounded bg-gray-200" /></td>
              <td className="px-6 py-4"><div className="h-5 w-12 animate-pulse rounded bg-gray-200" /></td>
              <td className="px-6 py-4"><div className="h-5 w-16 animate-pulse rounded bg-gray-200" /></td>
              <td className="px-6 py-4"><div className="h-5 w-20 animate-pulse rounded bg-gray-200" /></td>
              <td className="px-6 py-4"><div className="h-5 w-10 animate-pulse rounded bg-gray-200" /></td>
              <td className="px-6 py-4"><div className="h-5 w-16 animate-pulse rounded bg-gray-200 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Empty State
// =============================================================================

function OrganizationsEmptyState({ onCreateClick }: { readonly onCreateClick: () => void }) {
  return (
    <EmptyState
      icon={<BuildingIcon />}
      title="No organizations yet"
      description="Create your first organization to start managing your companies and generating consolidated reports."
      action={{
        label: "Create your first organization",
        onClick: onCreateClick,
        icon: <PlusIcon />
      }}
      className="min-h-[300px]"
      data-testid="organizations-empty"
    />
  )
}

// =============================================================================
// Error State
// =============================================================================

function OrganizationsErrorState({
  error,
  onRetry
}: {
  readonly error: Cause.Cause<unknown>
  readonly onRetry: () => void
}) {
  const errorMessage = React.useMemo(() => {
    const failures = Cause.failures(error)
    const first = Chunk.head(failures)
    if (first._tag === "Some") {
      const err = first.value
      if (typeof err === "object" && err !== null && "message" in err) {
        return String(Reflect.get(err, "message"))
      }
    }
    return "Failed to load organizations"
  }, [error])

  return (
    <div data-testid="organizations-error">
      <ErrorEmptyState
        onAction={onRetry}
        actionLabel="Try again"
        className="min-h-[300px]"
      />
      <p className="mt-2 text-center text-sm text-gray-500">{errorMessage}</p>
    </div>
  )
}

// =============================================================================
// Company Count Cell
// =============================================================================

function CompanyCountCell({ organizationId }: { readonly organizationId: string }) {
  const count = useAtomValue(organizationCompanyCountFamily(organizationId))
  return (
    <span data-testid={`organization-company-count-${organizationId}`}>
      {count}
    </span>
  )
}

// =============================================================================
// Sort Types and Helpers
// =============================================================================

type SortField = "name" | "currency" | "locale" | "timezone" | "companies"
type SortDirection = "asc" | "desc"

interface SortState {
  field: SortField
  direction: SortDirection
}

function SortHeader({
  label,
  field,
  currentSort,
  onSort
}: {
  label: string
  field: SortField
  currentSort: SortState
  onSort: (field: SortField) => void
}) {
  const isActive = currentSort.field === field
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`
        flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wider
        ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"}
        transition-colors
      `}
    >
      {label}
      {isActive ? (
        currentSort.direction === "asc" ? (
          <ChevronUpIcon className="h-3.5 w-3.5" />
        ) : (
          <ChevronDownIcon className="h-3.5 w-3.5" />
        )
      ) : (
        <span className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

// =============================================================================
// Organizations Table
// =============================================================================

interface OrganizationsTableProps {
  organizations: ReadonlyArray<Organization>
}

function OrganizationsTable({ organizations }: OrganizationsTableProps) {
  const [sortState, setSortState] = useState<SortState>({ field: "name", direction: "asc" })

  const handleSort = useCallback((field: SortField) => {
    setSortState((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc"
    }))
  }, [])

  const sortedOrganizations = useMemo(() => {
    const sorted = [...organizations]
    sorted.sort((a, b) => {
      let compare = 0
      switch (sortState.field) {
        case "name":
          compare = a.name.localeCompare(b.name)
          break
        case "currency":
          compare = a.reportingCurrency.localeCompare(b.reportingCurrency)
          break
        case "locale":
          compare = a.settings.defaultLocale.localeCompare(b.settings.defaultLocale)
          break
        case "timezone":
          compare = a.settings.defaultTimezone.localeCompare(b.settings.defaultTimezone)
          break
        case "companies":
          // For companies, we can't sort without fetching counts - default to name
          compare = a.name.localeCompare(b.name)
          break
      }
      return sortState.direction === "asc" ? compare : -compare
    })
    return sorted
  }, [organizations, sortState])

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm" data-testid="organizations-list">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left">
              <SortHeader label="Name" field="name" currentSort={sortState} onSort={handleSort} />
            </th>
            <th scope="col" className="px-6 py-3 text-left">
              <SortHeader label="Currency" field="currency" currentSort={sortState} onSort={handleSort} />
            </th>
            <th scope="col" className="px-6 py-3 text-left">
              <SortHeader label="Locale" field="locale" currentSort={sortState} onSort={handleSort} />
            </th>
            <th scope="col" className="px-6 py-3 text-left">
              <SortHeader label="Timezone" field="timezone" currentSort={sortState} onSort={handleSort} />
            </th>
            <th scope="col" className="px-6 py-3 text-left">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Companies</span>
            </th>
            <th scope="col" className="px-6 py-3 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sortedOrganizations.map((org) => (
            <tr
              key={org.id}
              className="hover:bg-gray-50 transition-colors"
              data-testid={`organization-row-${org.id}`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow">
                    <BuildingIcon />
                  </div>
                  <div>
                    <div
                      className="text-sm font-semibold text-gray-900"
                      data-testid={`organization-name-${org.id}`}
                    >
                      {org.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {org.settings.useFiscalYear ? "Fiscal Year" : "Calendar Year"} | {org.settings.defaultDecimalPlaces} decimals
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700"
                  data-testid={`organization-currency-${org.id}`}
                >
                  {org.reportingCurrency}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {org.settings.defaultLocale}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {org.settings.defaultTimezone}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                <CompanyCountCell organizationId={org.id} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <Link
                  to="/organizations/$id"
                  params={{ id: org.id }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-900 transition-colors"
                  data-testid={`organization-view-${org.id}`}
                >
                  View
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Organizations List
// =============================================================================

function OrganizationsList() {
  const result = useAtomValue(organizationsAtom)
  const refresh = useAtomRefresh(organizationsAtom)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = useCallback(() => setIsModalOpen(true), [])
  const handleCloseModal = useCallback(() => setIsModalOpen(false), [])
  const handleRetry = useCallback(() => refresh(), [refresh])

  // Loading state
  if (Result.isInitial(result) || (Result.isWaiting(result) && !Result.isSuccess(result))) {
    return <LoadingSkeleton />
  }

  // Error state
  if (Result.isFailure(result)) {
    return <OrganizationsErrorState error={result.cause} onRetry={handleRetry} />
  }

  // Success state
  const { organizations, total } = result.value

  // Empty state
  if (total === 0) {
    return (
      <>
        <OrganizationsEmptyState onCreateClick={handleOpenModal} />
        <CreateOrganizationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </>
    )
  }

  // Table state
  return (
    <>
      <OrganizationsTable organizations={organizations} />
      <CreateOrganizationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  )
}

// =============================================================================
// Main Page
// =============================================================================

function OrganizationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const result = useAtomValue(organizationsAtom)

  const handleOpenModal = useCallback(() => setIsModalOpen(true), [])
  const handleCloseModal = useCallback(() => setIsModalOpen(false), [])

  const showCreateButton = Result.isSuccess(result) && result.value.total > 0

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-8" data-testid="organizations-page">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Organizations
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your organizations and their companies.
              </p>
            </div>
            {showCreateButton && (
              <Button
                variant="primary"
                onClick={handleOpenModal}
                leftIcon={<PlusIcon />}
                data-testid="organizations-create-button"
              >
                Create Organization
              </Button>
            )}
          </div>

          {/* Organizations List */}
          <OrganizationsList />

          {/* Create Modal */}
          <CreateOrganizationModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
