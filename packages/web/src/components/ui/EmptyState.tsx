/**
 * EmptyState component
 *
 * Display when no data is available.
 * Features:
 * - Icon display
 * - Title and description
 * - Call-to-action button
 * - Context-specific variants
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import type { ReactNode } from "react"

// =============================================================================
// EmptyState Component
// =============================================================================

interface EmptyStateProps {
  /** Icon to display */
  readonly icon?: ReactNode
  /** Title text */
  readonly title: string
  /** Description text */
  readonly description?: string
  /** Primary action button */
  readonly action?: ReactNode
  /** Secondary action (link, etc.) */
  readonly secondaryAction?: ReactNode
  /** Size variant */
  readonly size?: "sm" | "md" | "lg"
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
  "data-testid": testId = "empty-state"
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "py-6 px-4",
    md: "py-12 px-4",
    lg: "py-16 px-6"
  }

  const iconContainerSizes = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  }

  const titleSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl"
  }

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        sizeClasses[size],
        className
      )}
      data-testid={testId}
    >
      {icon && (
        <div
          className={clsx(
            "flex items-center justify-center rounded-full bg-gray-100 mb-4",
            iconContainerSizes[size]
          )}
          data-testid="empty-state-icon"
        >
          {icon}
        </div>
      )}
      <h3
        className={clsx("font-medium text-gray-900", titleSizes[size])}
        data-testid="empty-state-title"
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 text-sm text-gray-500 max-w-sm"
          data-testid="empty-state-description"
        >
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6" data-testid="empty-state-action">
          {action}
        </div>
      )}
      {secondaryAction && (
        <div className="mt-3" data-testid="empty-state-secondary-action">
          {secondaryAction}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Common Empty State Icons
// =============================================================================

export function EmptyIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={clsx("h-6 w-6 text-gray-400", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  )
}

export function NoDataIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={clsx("h-6 w-6 text-gray-400", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

export function NoSearchResultsIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={clsx("h-6 w-6 text-gray-400", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

// =============================================================================
// Preset Empty States
// =============================================================================

interface PresetEmptyStateProps {
  readonly action?: ReactNode
  readonly className?: string
}

export function NoOrganizationsEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      }
      title="No organizations yet"
      description="Create an organization to group your companies together and start managing your accounting."
      action={action}
      data-testid="empty-organizations"
      {...(className !== undefined && { className })}
    />
  )
}

export function NoCompaniesEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      }
      title="No companies yet"
      description="Add your first company to start tracking finances and recording transactions."
      action={action}
      data-testid="empty-companies"
      {...(className !== undefined && { className })}
    />
  )
}

export function NoAccountsEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<NoDataIcon />}
      title="No accounts configured"
      description="Set up your chart of accounts to begin recording transactions."
      action={action}
      data-testid="empty-accounts"
      {...(className !== undefined && { className })}
    />
  )
}

export function NoJournalEntriesEmptyState({ action, className }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={<NoDataIcon />}
      title="No journal entries"
      description="Create your first journal entry to record a transaction."
      action={action}
      data-testid="empty-journal-entries"
      {...(className !== undefined && { className })}
    />
  )
}

export function NoSearchResultsEmptyState({ query, className }: { readonly query?: string; readonly className?: string }) {
  return (
    <EmptyState
      icon={<NoSearchResultsIcon />}
      title="No results found"
      description={query ? `No results found for "${query}". Try adjusting your search terms.` : "Try adjusting your search terms or filters."}
      data-testid="empty-search-results"
      {...(className !== undefined && { className })}
    />
  )
}
