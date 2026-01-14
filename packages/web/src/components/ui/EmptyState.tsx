/**
 * EmptyState Component
 *
 * A polished empty state component for when there's no data.
 * Features:
 * - Icon slot
 * - Title and description
 * - Optional action button
 * - Multiple visual variants
 */

import * as React from "react"
import { Button } from "./Button.tsx"

interface EmptyStateProps {
  readonly icon?: React.ReactNode
  readonly title: string
  readonly description?: string
  readonly action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  } | undefined
  readonly className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = ""
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        rounded-xl border-2 border-dashed border-gray-200
        bg-gray-50/50 px-6 py-12 text-center
        ${className}
      `}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className={`text-base font-semibold text-gray-900 ${icon ? "mt-4" : ""}`}>
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          <Button
            variant="primary"
            onClick={action.onClick}
            leftIcon={action.icon}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}

// Preset empty states for common patterns

interface PresetEmptyStateProps {
  readonly onAction?: () => void
  readonly actionLabel?: string
  readonly className?: string
}

export function NoDataEmptyState({
  onAction,
  actionLabel = "Add new item",
  className = ""
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      }
      title="No data yet"
      description="Get started by creating your first item."
      action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
      className={className}
    />
  )
}

export function NoResultsEmptyState({
  onAction,
  actionLabel = "Clear filters",
  className = ""
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      title="No results found"
      description="Try adjusting your search or filter criteria."
      action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
      className={className}
    />
  )
}

export function ErrorEmptyState({
  onAction,
  actionLabel = "Try again",
  className = ""
}: PresetEmptyStateProps & { readonly message?: string }) {
  return (
    <EmptyState
      icon={
        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      title="Something went wrong"
      description="We couldn't load the data. Please try again."
      action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
      className={className}
    />
  )
}
