/**
 * ProtectedRoute Component
 *
 * A wrapper component that ensures the user is authenticated before
 * rendering its children. If not authenticated, redirects to the login page.
 *
 * Features:
 * - Checks for auth token in localStorage (via authTokenAtom)
 * - Redirects to /login with return URL if not authenticated
 * - Shows loading state while checking authentication
 */

import { useNavigate, useLocation } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import { hasTokenAtom } from "../atoms/auth.ts"
import * as React from "react"

interface ProtectedRouteProps {
  readonly children: React.ReactNode
  /**
   * Optional fallback to show while checking authentication.
   * Defaults to a loading spinner.
   */
  readonly fallback?: React.ReactNode
}

/**
 * Default loading fallback shown while checking auth state
 */
function DefaultLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" data-testid="protected-route-loading">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

/**
 * ProtectedRoute - Ensures user is authenticated before rendering children
 *
 * Usage:
 * ```tsx
 * // In a protected route component
 * function DashboardPage() {
 *   return (
 *     <ProtectedRoute>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   )
 * }
 * ```
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const hasToken = useAtomValue(hasTokenAtom)
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = React.useState(true)

  React.useEffect(() => {
    // On client-side, check auth state
    if (typeof window !== "undefined") {
      if (!hasToken) {
        // Build redirect URL to return after login
        const currentPath = location.pathname + location.search
        const redirectUrl = currentPath !== "/" ? `?redirect=${encodeURIComponent(currentPath)}` : ""
        navigate({ to: `/login${redirectUrl}` })
      } else {
        setIsChecking(false)
      }
    }
  }, [hasToken, navigate, location.pathname, location.search])

  // During SSR or initial check, show fallback
  if (isChecking) {
    return <>{fallback ?? <DefaultLoadingFallback />}</>
  }

  // User has token, render children
  return <>{children}</>
}
