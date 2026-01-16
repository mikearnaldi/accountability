/**
 * RouteError component
 *
 * Reusable error component for route error boundaries.
 * Uses user-friendly error formatting and provides retry/navigation actions.
 */

import { Link, useRouter } from "@tanstack/react-router"
import { FullPageError } from "./ErrorState.tsx"
import { getErrorInfo, formatApiError } from "../../utils/errors.ts"

interface RouteErrorProps {
  /** The error object from the route error boundary */
  readonly error: Error | unknown
  /** Link to navigate back to */
  readonly backTo?: string
  /** Text for the back navigation link */
  readonly backText?: string
}

/**
 * Standard error component for route error boundaries.
 * Formats errors into user-friendly messages and provides retry/navigation.
 */
export function RouteError({
  error,
  backTo = "/organizations",
  backText = "Back to Organizations"
}: RouteErrorProps) {
  const router = useRouter()

  const handleRetry = () => {
    router.invalidate()
  }

  const handleNavigate = () => {
    router.navigate({ to: backTo })
  }

  const errorInfo = getErrorInfo(error)

  return (
    <FullPageError
      title={errorInfo.title}
      message={errorInfo.description}
      onRetry={handleRetry}
      onNavigate={handleNavigate}
      navigateText={backText}
    />
  )
}

/**
 * Minimal error component for use in route definitions.
 * Wraps the error message in a styled card with a back link.
 */
export function MinimalRouteError({
  error,
  backTo = "/organizations",
  backText = "Back to Organizations"
}: RouteErrorProps) {
  const errorMessage = formatApiError(error)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Accountability
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to={backTo}
              className="text-xl text-gray-600 hover:text-gray-900"
            >
              {backText.replace("Back to ", "")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
          role="alert"
          data-testid="route-error"
        >
          <h2 className="text-lg font-medium text-red-800">
            Something went wrong
          </h2>
          <p className="mt-2 text-red-700" data-testid="route-error-message">
            {errorMessage}
          </p>
          <Link
            to={backTo}
            className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            {backText}
          </Link>
        </div>
      </main>
    </div>
  )
}
