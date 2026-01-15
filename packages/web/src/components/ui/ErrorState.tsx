/**
 * ErrorState component
 *
 * Display error messages with recovery options.
 * Features:
 * - WHAT/WHY/WHAT TO DO structure
 * - Retry action button
 * - Navigation action
 * - Inline and full-page variants
 * - Data-testid attributes for E2E testing
 */

import { clsx } from "clsx"
import type { ReactNode } from "react"
import { Button } from "./Button.tsx"

// =============================================================================
// ErrorState Component
// =============================================================================

interface ErrorStateProps {
  /** Error title (WHAT happened) */
  readonly title: string
  /** Error description (WHY it happened) */
  readonly description?: string
  /** Retry action */
  readonly onRetry?: () => void
  /** Retry button text */
  readonly retryText?: string
  /** Custom action button */
  readonly action?: ReactNode
  /** Whether retry is in progress */
  readonly retrying?: boolean
  /** Size variant */
  readonly variant?: "inline" | "card" | "fullPage"
  /** Additional class names */
  readonly className?: string
  /** Test ID for E2E testing */
  readonly "data-testid"?: string
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryText = "Try Again",
  action,
  retrying = false,
  variant = "card",
  className,
  "data-testid": testId = "error-state"
}: ErrorStateProps) {
  const variantClasses = {
    inline: "p-4",
    card: "rounded-lg border border-red-200 bg-red-50 p-6",
    fullPage: "flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
  }

  return (
    <div
      className={clsx(variantClasses[variant], className)}
      role="alert"
      data-testid={testId}
    >
      {variant === "fullPage" && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <ErrorIcon className="h-6 w-6 text-red-600" />
        </div>
      )}
      <h3
        className={clsx(
          "font-medium",
          variant === "fullPage" ? "text-lg text-gray-900" : "text-red-800"
        )}
        data-testid="error-state-title"
      >
        {title}
      </h3>
      {description && (
        <p
          className={clsx(
            "mt-2 text-sm",
            variant === "fullPage" ? "text-gray-500 max-w-md" : "text-red-700"
          )}
          data-testid="error-state-description"
        >
          {description}
        </p>
      )}
      {(onRetry || action) && (
        <div
          className={clsx("mt-4", variant === "fullPage" && "flex gap-3")}
          data-testid="error-state-actions"
        >
          {onRetry && (
            <Button
              variant={variant === "fullPage" ? "primary" : "secondary"}
              size="sm"
              onClick={onRetry}
              loading={retrying}
              data-testid="error-state-retry"
            >
              {retryText}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Error Icon
// =============================================================================

function ErrorIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

// =============================================================================
// Error Alert (Inline)
// =============================================================================

interface ErrorAlertProps {
  /** Error message */
  readonly message: string
  /** Dismiss handler */
  readonly onDismiss?: () => void
  readonly className?: string
}

export function ErrorAlert({ message, onDismiss, className }: ErrorAlertProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-3",
        className
      )}
      role="alert"
      data-testid="error-alert"
    >
      <ErrorIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 flex-1" data-testid="error-alert-message">
        {message}
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-600 hover:text-red-800"
          aria-label="Dismiss error"
          data-testid="error-alert-dismiss"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Full Page Error
// =============================================================================

interface FullPageErrorProps {
  /** Error title */
  readonly title?: string
  /** Error message */
  readonly message: string
  /** Retry handler */
  readonly onRetry?: () => void
  /** Navigation handler */
  readonly onNavigate?: () => void
  /** Navigation button text */
  readonly navigateText?: string
}

export function FullPageError({
  title = "Something went wrong",
  message,
  onRetry,
  onNavigate,
  navigateText = "Go Back"
}: FullPageErrorProps) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4"
      data-testid="full-page-error"
    >
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ErrorIcon className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="full-page-error-title">
          {title}
        </h1>
        <p className="text-gray-500 mb-8" data-testid="full-page-error-message">
          {message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="primary" data-testid="full-page-error-retry">
              Try Again
            </Button>
          )}
          {onNavigate && (
            <Button onClick={onNavigate} variant="secondary" data-testid="full-page-error-navigate">
              {navigateText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Preset Error States
// =============================================================================

interface PresetErrorProps {
  readonly onRetry?: () => void
  readonly retrying?: boolean
  readonly className?: string
}

export function NetworkErrorState({ onRetry, retrying = false, className }: PresetErrorProps) {
  return (
    <ErrorState
      title="Unable to connect"
      description="Please check your internet connection and try again."
      retrying={retrying}
      data-testid="network-error"
      {...(onRetry !== undefined && { onRetry })}
      {...(className !== undefined && { className })}
    />
  )
}

export function NotFoundErrorState({
  title = "Not found",
  description = "The resource you're looking for doesn't exist or has been removed.",
  action,
  className
}: {
  readonly title?: string
  readonly description?: string
  readonly action?: ReactNode
  readonly className?: string
}) {
  return (
    <ErrorState
      title={title}
      description={description}
      action={action}
      variant="fullPage"
      data-testid="not-found-error"
      {...(className !== undefined && { className })}
    />
  )
}

export function PermissionErrorState({ action, className }: { readonly action?: ReactNode; readonly className?: string }) {
  return (
    <ErrorState
      title="Access denied"
      description="You don't have permission to view this resource."
      action={action}
      variant="fullPage"
      data-testid="permission-error"
      {...(className !== undefined && { className })}
    />
  )
}
