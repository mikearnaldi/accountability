/**
 * Accounts List Route
 *
 * Protected route for viewing and managing the Chart of Accounts.
 * Features:
 * - Tree view showing account hierarchy with expand/collapse
 * - Columns: Account Number, Name, Type, Category, Normal Balance, Active
 * - Filter by account type (Asset, Liability, Equity, Revenue, Expense)
 * - Search by account number or name
 * - Create Account button opens form
 * - Click row opens account detail/edit view
 * - Empty state when no accounts
 */

import * as React from "react"
import { useState, useCallback, useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useAtomValue, useAtom, useAtomRefresh } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import { AppShell } from "../../../../../../components/AppShell.tsx"
import { ProtectedRoute } from "../../../../../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../../../../../components/UserMenu.tsx"
import { AccountsTree } from "../../../../../../components/AccountsTree.tsx"
import { CreateAccountModal } from "../../../../../../components/CreateAccountModal.tsx"
import {
  accountsByCompanyFamily,
  accountTypeFilterAtom,
  accountSearchAtom,
  createFilteredAccountsAtom,
  buildAccountTree
} from "../../../../../../atoms/accounts.ts"
import { companyFamily, organizationFamily } from "../../../../../../atoms/organizations.ts"
import type { AccountType } from "@accountability/core/Domains/Account"

export const Route = createFileRoute("/organizations/$organizationId/companies/$companyId/accounts/")({
  component: AccountsListPage
})

// =============================================================================
// Icons
// =============================================================================

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

function SearchIcon({ className }: { className?: string }) {
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
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
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
        strokeWidth={1.5}
        d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

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
// Constants
// =============================================================================

const ACCOUNT_TYPES: ReadonlyArray<{ value: AccountType | ""; label: string }> = [
  { value: "", label: "All Types" },
  { value: "Asset", label: "Asset" },
  { value: "Liability", label: "Liability" },
  { value: "Equity", label: "Equity" },
  { value: "Revenue", label: "Revenue" },
  { value: "Expense", label: "Expense" }
]

const isAccountTypeOrEmpty = (value: string): value is AccountType | "" =>
  value === "" ||
  value === "Asset" ||
  value === "Liability" ||
  value === "Equity" ||
  value === "Revenue" ||
  value === "Expense"

// =============================================================================
// Loading Skeleton
// =============================================================================

function LoadingSkeleton() {
  return (
    <div
      className="space-y-3"
      data-testid="accounts-loading"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center gap-4">
            <div className="h-4 w-4 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-4 w-48 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center"
      data-testid="accounts-empty"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <TableCellsIcon className="h-8 w-8 text-blue-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">
        No accounts yet
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        Create your first account to start building your Chart of Accounts.
      </p>
      <button
        type="button"
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        data-testid="accounts-empty-create"
      >
        <PlusIcon className="h-4 w-4" />
        Create your first account
      </button>
    </div>
  )
}

// =============================================================================
// Error State
// =============================================================================

function ErrorState({
  error,
  onRetry
}: {
  error: Cause.Cause<unknown>
  onRetry: () => void
}) {
  const errorMessage = React.useMemo(() => {
    return getErrorMessage(error)
  }, [error])

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
      data-testid="accounts-error"
    >
      <div className="flex flex-col items-center">
        <svg
          className="h-12 w-12 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-red-800">
          Something went wrong
        </h3>
        <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          data-testid="accounts-error-retry"
        >
          <RefreshIcon className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Filter Bar
// =============================================================================

function FilterBar({
  typeFilter,
  onTypeFilterChange,
  searchQuery,
  onSearchChange
}: {
  typeFilter: AccountType | ""
  onTypeFilterChange: (type: AccountType | "") => void
  searchQuery: string
  onSearchChange: (query: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center" data-testid="accounts-filter-bar">
      {/* Search input */}
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by account number or name..."
          className="block w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-testid="accounts-search-input"
        />
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="account-type-filter" className="text-sm font-medium text-gray-700">
          Type:
        </label>
        <select
          id="account-type-filter"
          value={typeFilter}
          onChange={(e) => {
            const value = e.target.value
            if (isAccountTypeOrEmpty(value)) {
              onTypeFilterChange(value)
            }
          }}
          className="rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-testid="accounts-type-filter"
        >
          {ACCOUNT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// =============================================================================
// Accounts List
// =============================================================================

function AccountsList({
  companyId
}: {
  companyId: string
}) {
  const accountsAtom = useMemo(() => accountsByCompanyFamily(companyId), [companyId])
  const filteredAtom = useMemo(() => createFilteredAccountsAtom(companyId), [companyId])

  const result = useAtomValue(filteredAtom)
  const refresh = useAtomRefresh(accountsAtom)
  const [typeFilter, setTypeFilter] = useAtom(accountTypeFilterAtom)
  const [searchQuery, setSearchQuery] = useAtom(accountSearchAtom)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const handleRetry = useCallback(() => {
    refresh()
  }, [refresh])

  const handleAccountClick = useCallback((_accountId: string) => {
    // Account detail page will be implemented in a future story
    // For now, clicking just does nothing as the details page doesn't exist yet
  }, [])

  // Build tree structure - must be before conditional returns to follow React hooks rules
  const accountTree = useMemo(() => {
    if (!Result.isSuccess(result)) {
      return []
    }
    return buildAccountTree(result.value.accounts)
  }, [result])

  // Loading state
  if (Result.isInitial(result) || (Result.isWaiting(result) && !Result.isSuccess(result))) {
    return <LoadingSkeleton />
  }

  // Error state
  if (Result.isFailure(result)) {
    return <ErrorState error={result.cause} onRetry={handleRetry} />
  }

  // Success state
  const { total } = result.value

  // Empty state
  if (total === 0 && typeFilter === "" && searchQuery === "") {
    return (
      <>
        <EmptyState onCreateClick={handleOpenModal} />
        <CreateAccountModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          companyId={companyId}
        />
      </>
    )
  }

  // No results from filter/search
  if (total === 0) {
    return (
      <div className="space-y-4">
        <FilterBar
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div
          className="rounded-lg border border-gray-200 bg-white p-8 text-center"
          data-testid="accounts-no-results"
        >
          <p className="text-gray-500">
            No accounts match your filters. Try adjusting your search or filter criteria.
          </p>
        </div>
      </div>
    )
  }

  // List state with tree view
  return (
    <div className="space-y-4">
      <FilterBar
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <AccountsTree
        accounts={accountTree}
        onAccountClick={handleAccountClick}
      />
      <CreateAccountModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        companyId={companyId}
      />
    </div>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

function AccountsListPage() {
  const { organizationId, companyId } = Route.useParams()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const accountsAtom = useMemo(() => accountsByCompanyFamily(companyId), [companyId])
  const result = useAtomValue(accountsAtom)
  const companyAtom = useMemo(() => companyFamily(companyId), [companyId])
  const companyResult = useAtomValue(companyAtom)
  const organizationAtom = useMemo(() => organizationFamily(organizationId), [organizationId])
  const organizationResult = useAtomValue(organizationAtom)

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Get organization and company names for breadcrumb
  const organizationName = useMemo(() => {
    if (Result.isSuccess(organizationResult)) {
      return organizationResult.value.name
    }
    return "Organization"
  }, [organizationResult])

  const companyName = useMemo(() => {
    if (Result.isSuccess(companyResult)) {
      return companyResult.value.name
    }
    return "Company"
  }, [companyResult])

  // Show create button only if we have accounts (empty state has its own button)
  const showCreateButton =
    Result.isSuccess(result) && result.value.total > 0

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6" data-testid="accounts-page">
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
            <Link
              to="/organizations/$organizationId/companies/$companyId"
              params={{ organizationId, companyId }}
              className="text-gray-500 hover:text-gray-700"
              data-testid="breadcrumb-company"
            >
              {companyName}
            </Link>
            <span className="text-gray-400">&gt;</span>
            <span
              className="font-medium text-gray-900"
              data-testid="breadcrumb-current"
            >
              Accounts
            </span>
          </nav>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage accounts for {companyName}.
              </p>
            </div>
            {showCreateButton && (
              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                data-testid="accounts-create-button"
              >
                <PlusIcon className="h-4 w-4" />
                Create Account
              </button>
            )}
          </div>

          {/* Accounts List */}
          <AccountsList companyId={companyId} />

          {/* Create Modal - also shown from header button */}
          <CreateAccountModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            companyId={companyId}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
