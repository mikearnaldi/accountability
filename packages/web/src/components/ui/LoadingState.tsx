/**
 * LoadingState component
 *
 * Loading indicators and skeleton loaders.
 * Features:
 * - Spinner variant for general loading
 * - Skeleton variant for content placeholder
 * - Full-page and inline variants
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"

// =============================================================================
// LoadingState Component (Full container)
// =============================================================================

interface LoadingStateProps {
  /** Loading message */
  readonly message?: string
  /** Variant: spinner or skeleton */
  readonly variant?: "spinner" | "skeleton"
  /** Size of the loading indicator */
  readonly size?: "sm" | "md" | "lg"
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function LoadingState({
  message = "Loading...",
  variant = "spinner",
  size = "md",
  className,
  "data-testid": testId = "loading-state"
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "min-h-[100px]",
    md: "min-h-[200px]",
    lg: "min-h-[400px]"
  }

  const spinnerSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  }

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center",
        sizeClasses[size],
        className
      )}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {variant === "spinner" ? (
        <>
          <Spinner className={clsx("text-blue-600 animate-spin", spinnerSizes[size])} />
          {message && (
            <p className="mt-3 text-sm text-gray-500">{message}</p>
          )}
        </>
      ) : (
        <SkeletonCard />
      )}
    </div>
  )
}

// =============================================================================
// Spinner Component
// =============================================================================

interface SpinnerProps {
  readonly className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" data-testid="spinner">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-25"
      />
      <path
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// =============================================================================
// Skeleton Components
// =============================================================================

interface SkeletonProps {
  /** Width class */
  readonly width?: string
  /** Height class */
  readonly height?: string
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function Skeleton({
  width = "w-full",
  height = "h-4",
  className,
  "data-testid": testId = "skeleton"
}: SkeletonProps) {
  return (
    <div
      className={clsx("animate-pulse bg-gray-200 rounded", width, height, className)}
      data-testid={testId}
    />
  )
}

export function SkeletonText({ lines = 3, className }: { readonly lines?: number; readonly className?: string }) {
  return (
    <div className={clsx("space-y-2", className)} data-testid="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "w-2/3" : "w-full"}
          height="h-4"
        />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md" data-testid="skeleton-card">
      <Skeleton width="w-1/3" height="h-6" className="mb-4" />
      <SkeletonText lines={3} />
    </div>
  )
}

// =============================================================================
// InlineLoading Component
// =============================================================================

interface InlineLoadingProps {
  /** Loading text */
  readonly text?: string
  /** Size */
  readonly size?: "sm" | "md"
  readonly className?: string
}

export function InlineLoading({ text, size = "sm", className }: InlineLoadingProps) {
  const spinnerSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5"
  }

  const textSizes = {
    sm: "text-sm",
    md: "text-base"
  }

  return (
    <span className={clsx("inline-flex items-center gap-2", className)} data-testid="inline-loading">
      <Spinner className={clsx("animate-spin text-blue-600", spinnerSizes[size])} />
      {text && <span className={clsx("text-gray-500", textSizes[size])}>{text}</span>}
    </span>
  )
}

// =============================================================================
// PageLoader Component
// =============================================================================

interface PageLoaderProps {
  /** Loading message */
  readonly message?: string
}

export function PageLoader({ message = "Loading..." }: PageLoaderProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-gray-50"
      data-testid="page-loader"
    >
      <Spinner className="h-12 w-12 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-500">{message}</p>
    </div>
  )
}

// =============================================================================
// TableSkeleton Component
// =============================================================================

interface TableSkeletonProps {
  /** Number of rows */
  readonly rows?: number
  /** Number of columns */
  readonly columns?: number
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="w-full" data-testid="table-skeleton">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200 bg-gray-50">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} width="w-24" height="h-4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 p-4 border-b border-gray-100">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} width="w-24" height="h-4" />
          ))}
        </div>
      ))}
    </div>
  )
}
