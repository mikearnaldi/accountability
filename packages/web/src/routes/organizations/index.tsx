/**
 * Organizations Route
 *
 * Protected route for managing organizations.
 * Features:
 * - Beautiful card grid layout
 * - Polished loading, error, and empty states
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
import { Button } from "../../components/ui/Button.tsx"
import { SkeletonCard } from "../../components/ui/Skeleton.tsx"
import { EmptyState, ErrorEmptyState } from "../../components/ui/EmptyState.tsx"

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

// =============================================================================
// Loading Skeleton
// =============================================================================

function LoadingSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="organizations-loading"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
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
