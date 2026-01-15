/**
 * Card component
 *
 * Reusable card container with optional header, body, and footer.
 * Features:
 * - Composable structure (Card, CardHeader, CardBody, CardFooter)
 * - Optional padding control
 * - Optional border and shadow variations
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import type { ReactNode } from "react"

// =============================================================================
// Card Component
// =============================================================================

interface CardProps {
  /** Card content */
  readonly children: ReactNode
  /** Remove default padding */
  readonly noPadding?: boolean
  /** Card variant */
  readonly variant?: "default" | "bordered" | "elevated"
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function Card({
  children,
  noPadding = false,
  variant = "default",
  className,
  "data-testid": testId
}: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white rounded-lg",
        variant === "bordered" && "border border-gray-200",
        variant === "elevated" && "shadow-md border border-gray-100",
        variant === "default" && "border border-gray-200",
        !noPadding && "p-6",
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

// =============================================================================
// CardHeader Component
// =============================================================================

interface CardHeaderProps {
  /** Header content */
  readonly children?: ReactNode
  /** Optional title */
  readonly title?: string
  /** Optional description */
  readonly description?: string
  /** Optional action buttons */
  readonly action?: ReactNode
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function CardHeader({
  children,
  title,
  description,
  action,
  className,
  "data-testid": testId
}: CardHeaderProps) {
  // If title/description provided, use structured layout
  if (title || description) {
    return (
      <div
        className={clsx("flex items-start justify-between mb-4", className)}
        data-testid={testId}
      >
        <div>
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    )
  }

  return (
    <div
      className={clsx("mb-4 border-b border-gray-200 pb-4", className)}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

// =============================================================================
// CardBody Component
// =============================================================================

interface CardBodyProps {
  /** Body content */
  readonly children: ReactNode
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function CardBody({ children, className, "data-testid": testId }: CardBodyProps) {
  return (
    <div className={className} data-testid={testId}>
      {children}
    </div>
  )
}

// =============================================================================
// CardFooter Component
// =============================================================================

interface CardFooterProps {
  /** Footer content */
  readonly children: ReactNode
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function CardFooter({ children, className, "data-testid": testId }: CardFooterProps) {
  return (
    <div
      className={clsx("mt-4 pt-4 border-t border-gray-200", className)}
      data-testid={testId}
    >
      {children}
    </div>
  )
}
