/**
 * AuthGuard Component
 *
 * Route protection component that ensures users are authenticated before
 * accessing protected content. Provides:
 * - Loading state while checking authentication
 * - Redirect to /login if not authenticated
 * - Preservation of intended destination for post-login redirect
 *
 * Usage:
 * ```tsx
 * <AuthGuard redirectTo={currentPath}>
 *   <ProtectedContent />
 * </AuthGuard>
 * ```
 *
 * @module components/AuthGuard
 */

import * as React from "react"
import { useNavigate, useLocation } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Option from "effect/Option"
import {
  authTokenAtom,
  currentUserAtom
} from "../atoms/auth.ts"

// =============================================================================
// Types
// =============================================================================

interface AuthGuardProps {
  /** The content to render when authenticated */
  readonly children: React.ReactNode
  /** Custom redirect path (defaults to current path) */
  readonly redirectTo?: string
  /** Custom loading component */
  readonly loadingComponent?: React.ReactNode
}

// =============================================================================
// Styles
// =============================================================================

const loadingContainerStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "200px",
  padding: "2rem"
}

const loadingSpinnerStyles: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "3px solid #e8e8e8",
  borderTop: "3px solid #1890ff",
  borderRadius: "50%",
  animation: "spin 1s linear infinite"
}

const loadingTextStyles: React.CSSProperties = {
  marginTop: "1rem",
  color: "#666",
  fontSize: "14px"
}

// =============================================================================
// Default Loading Component
// =============================================================================

function DefaultLoadingComponent(): React.ReactElement {
  return (
    <div style={loadingContainerStyles}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={loadingSpinnerStyles} aria-label="Loading" role="status" />
      <p style={loadingTextStyles}>Verifying authentication...</p>
    </div>
  )
}

// =============================================================================
// AuthGuard Component
// =============================================================================

/**
 * AuthGuard - Protects routes from unauthenticated access
 *
 * This component checks if the user is authenticated and redirects to the
 * login page if not. It preserves the intended destination in the URL
 * so the user can be redirected back after login.
 *
 * Authentication check flow:
 * 1. Check if auth token exists in localStorage
 * 2. If token exists, verify it's valid by fetching current user
 * 3. While checking, show loading state
 * 4. If not authenticated, redirect to /login with redirect param
 * 5. If authenticated, render children
 */
export function AuthGuard({
  children,
  redirectTo,
  loadingComponent
}: AuthGuardProps): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()

  // Get auth state from atoms
  const tokenOption = useAtomValue(authTokenAtom)
  const userResult = useAtomValue(currentUserAtom)

  // Determine the redirect destination (current path if not specified)
  const intendedPath = redirectTo ?? location.pathname

  // Determine auth state
  const hasToken = Option.isSome(tokenOption)
  const isUserLoading = Result.isInitial(userResult) || Result.isWaiting(userResult)
  const isUserSuccess = Result.isSuccess(userResult)
  const isUserFailure = Result.isFailure(userResult)

  // Handle redirect effect
  React.useEffect(() => {
    // No token - redirect immediately
    if (!hasToken) {
      navigate({
        to: "/login",
        search: { redirect: intendedPath },
        replace: true
      })
      return
    }

    // Token exists but user fetch failed - token is invalid, redirect
    if (hasToken && isUserFailure) {
      navigate({
        to: "/login",
        search: { redirect: intendedPath },
        replace: true
      })
    }
  }, [hasToken, isUserFailure, navigate, intendedPath])

  // No token - show loading while redirect happens
  if (!hasToken) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <DefaultLoadingComponent />
    )
  }

  // Token exists but still verifying with server
  if (isUserLoading) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <DefaultLoadingComponent />
    )
  }

  // User fetch failed - show loading while redirect happens
  if (isUserFailure) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <DefaultLoadingComponent />
    )
  }

  // User is authenticated - render children
  if (isUserSuccess) {
    return <>{children}</>
  }

  // Fallback loading state
  return loadingComponent ? (
    <>{loadingComponent}</>
  ) : (
    <DefaultLoadingComponent />
  )
}

// =============================================================================
// Utility: Check Auth for beforeLoad
// =============================================================================

/**
 * checkAuthForRoute - Utility for route beforeLoad hooks
 *
 * This function checks if the user has an auth token stored in localStorage.
 * It's designed to be called in TanStack Router's beforeLoad hook for quick
 * client-side auth verification.
 *
 * Note: This only checks for token presence, not validity. The AuthGuard
 * component handles full token validation by fetching the current user.
 *
 * @param currentPath - The path the user is trying to access
 * @returns Object with redirect info if not authenticated, undefined otherwise
 */
export function checkAuthForRoute(currentPath: string): { to: string; search: { redirect: string }; replace: true } | undefined {
  if (typeof window === "undefined") {
    // Server-side - can't check localStorage, let client handle it
    return undefined
  }

  const token = window.localStorage.getItem("accountability_auth_token")

  if (!token) {
    return {
      to: "/login",
      search: { redirect: currentPath },
      replace: true
    }
  }

  return undefined
}

export default AuthGuard
