/**
 * Organizations Route
 *
 * Protected route for managing organizations.
 * Features:
 * - List of user's organizations in card grid
 * - Loading skeleton during fetch
 * - Error state with retry option
 * - Empty state with call-to-action
 * - Create organization modal
 */

import * as React from "react"
import { useState, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useAtomValue, useAtomRefresh } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import { AppShell } from "../../components/AppShell.tsx"
import { ProtectedRoute } from "../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../components/UserMenu.tsx"
import { OrganizationCard } from "../../components/OrganizationCard.tsx"
import { CreateOrganizationModal } from "../../components/CreateOrganizationModal.tsx"
import { organizationsAtom } from "../../atoms/organizations.ts"

export const Route = createFileRoute("/organizations/")({
  component: OrganizationsPage
})

/**
 * PlusIcon - Simple plus SVG icon
 */
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

/**
 * RefreshIcon - Simple refresh SVG icon
 */
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

/**
 * LoadingSkeleton - Skeleton cards shown while loading organizations
 */
function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="organizations-loading"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded bg-gray-200" />
              <div className="h-4 w-1/3 rounded bg-gray-200" />
            </div>
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="h-4 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * EmptyState - Shown when user has no organizations
 */
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center"
      data-testid="organizations-empty"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <svg
          className="h-8 w-8 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">
        No organizations yet
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        Create your first organization to start managing your companies and
        generating consolidated reports.
      </p>
      <button
        type="button"
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        data-testid="organizations-empty-create"
      >
        <PlusIcon className="h-4 w-4" />
        Create your first organization
      </button>
    </div>
  )
}

/**
 * ErrorState - Shown when organizations fetch fails
 */
function ErrorState({
  error,
  onRetry
}: {
  error: Cause.Cause<unknown>
  onRetry: () => void
}) {
  // Extract a user-friendly error message
  const errorMessage = React.useMemo(() => {
    const failures = Cause.failures(error)
    const first = Chunk.head(failures)
    if (first._tag === "Some") {
      const err = first.value
      if (typeof err === "object" && err !== null && "message" in err) {
        return String(Reflect.get(err, "message"))
      }
      if (typeof err === "object" && err !== null && "_tag" in err) {
        return String(Reflect.get(err, "_tag"))
      }
    }
    return "Failed to load organizations"
  }, [error])

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
      data-testid="organizations-error"
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
          data-testid="organizations-error-retry"
        >
          <RefreshIcon className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  )
}

/**
 * OrganizationsList - Displays the grid of organization cards
 */
function OrganizationsList() {
  const result = useAtomValue(organizationsAtom)
  const refresh = useAtomRefresh(organizationsAtom)
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

  // Loading state
  if (Result.isInitial(result) || (Result.isWaiting(result) && !Result.isSuccess(result))) {
    return <LoadingSkeleton />
  }

  // Error state
  if (Result.isFailure(result)) {
    return <ErrorState error={result.cause} onRetry={handleRetry} />
  }

  // Success state
  const { organizations, total } = result.value

  // Empty state
  if (total === 0) {
    return (
      <>
        <EmptyState onCreateClick={handleOpenModal} />
        <CreateOrganizationModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </>
    )
  }

  // List state
  return (
    <>
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="organizations-list"
      >
        {organizations.map((org) => (
          <OrganizationCard key={org.id} organization={org} />
        ))}
      </div>
      <CreateOrganizationModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  )
}

function OrganizationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const result = useAtomValue(organizationsAtom)

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Show create button only if we have organizations (empty state has its own button)
  const showCreateButton =
    Result.isSuccess(result) && result.value.total > 0

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6" data-testid="organizations-page">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage your organizations and their companies.
              </p>
            </div>
            {showCreateButton && (
              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                data-testid="organizations-create-button"
              >
                <PlusIcon className="h-4 w-4" />
                Create Organization
              </button>
            )}
          </div>

          {/* Organizations List */}
          <OrganizationsList />

          {/* Create Modal - also shown from header button */}
          <CreateOrganizationModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
