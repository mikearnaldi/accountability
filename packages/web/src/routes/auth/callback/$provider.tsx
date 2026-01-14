/**
 * OAuth Callback Route
 *
 * Handles OAuth provider callbacks after authentication.
 * This route receives the authorization code and state from OAuth providers,
 * exchanges them for a session token, and redirects to the intended destination.
 *
 * Supports two flows:
 * 1. Login/Registration - Creates new session, redirects to home or intended destination
 * 2. Link Provider - Adds provider to existing account, redirects to home (or intended destination)
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Option from "effect/Option"
import * as React from "react"
import {
  handleOAuthCallbackMutation,
  handleOAuthLinkCallbackMutation,
  hasTokenAtom,
  type OAuthCallbackInput
} from "../../../atoms/auth.ts"

// Search params interface for callback handling
export interface OAuthCallbackSearch {
  code?: string
  state?: string
  error?: string
  error_description?: string
  // Used to detect link flow vs login flow
  link?: string
  // Redirect destination after successful auth
  redirect?: string
}

export const Route = createFileRoute("/auth/callback/$provider")({
  validateSearch: (search: Record<string, unknown>): OAuthCallbackSearch => {
    const result: OAuthCallbackSearch = {}
    if (typeof search.code === "string") {
      result.code = search.code
    }
    if (typeof search.state === "string") {
      result.state = search.state
    }
    if (typeof search.error === "string") {
      result.error = search.error
    }
    if (typeof search.error_description === "string") {
      result.error_description = search.error_description
    }
    if (typeof search.link === "string") {
      result.link = search.link
    }
    if (typeof search.redirect === "string") {
      result.redirect = search.redirect
    }
    return result
  },
  component: OAuthCallbackPage
})

function OAuthCallbackPage() {
  const { provider } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()

  // Check if user already has a token (for link flow detection)
  const hasToken = useAtomValue(hasTokenAtom)

  // Determine if this is a link flow (adding provider to existing account)
  const isLinkFlow = search.link === "true" || hasToken

  // Use the appropriate mutation based on flow type
  const [callbackResult, handleCallback] = useAtom(handleOAuthCallbackMutation, { mode: "promise" })
  const [linkCallbackResult, handleLinkCallback] = useAtom(handleOAuthLinkCallbackMutation, { mode: "promise" })

  // Track if we've already attempted the callback
  const callbackAttempted = React.useRef(false)

  // Process the callback on mount
  React.useEffect(() => {
    // Prevent duplicate calls
    if (callbackAttempted.current) return
    callbackAttempted.current = true

    // Check for OAuth error response from provider
    if (search.error) {
      // Error is already in search params, no mutation needed
      return
    }

    // Validate required parameters
    if (!search.code || !search.state) {
      // Missing parameters, will show error
      return
    }

    // Build callback input
    const input: OAuthCallbackInput = {
      provider,
      code: search.code,
      state: search.state
    }

    // Execute the appropriate mutation
    const performCallback = async () => {
      try {
        if (isLinkFlow) {
          await handleLinkCallback(input)
          // Navigate to home or redirect destination after linking
          navigate({ to: search.redirect ?? "/" })
        } else {
          await handleCallback(input)
          // Navigate to intended destination or home
          navigate({ to: search.redirect ?? "/" })
        }
      } catch {
        // Error is captured in result - no need to handle here
        // The UI will show the error state
      }
    }

    performCallback()
  }, [provider, search, navigate, isLinkFlow, handleCallback, handleLinkCallback])

  // Handle retry - reset the ref and reload
  const handleRetry = () => {
    // Redirect back to login to restart OAuth flow
    navigate({ to: "/login", search: search.redirect ? { redirect: search.redirect } : {} })
  }

  // Format provider name for display
  const providerDisplayName = provider.charAt(0).toUpperCase() + provider.slice(1)

  // Helper to check if either result has failure
  const getFailedResult = () => {
    if (isLinkFlow && Result.isFailure(linkCallbackResult)) {
      return linkCallbackResult
    }
    if (!isLinkFlow && Result.isFailure(callbackResult)) {
      return callbackResult
    }
    return null
  }

  // Get error message from OAuth error response or mutation result
  const getErrorMessage = (): string | null => {
    // Check for OAuth error in URL params
    if (search.error) {
      if (search.error_description) {
        return search.error_description
      }
      switch (search.error) {
        case "access_denied":
          return "Access was denied. Please try again or use a different sign-in method."
        case "invalid_request":
          return "Invalid request. Please restart the sign-in process."
        case "server_error":
          return "The authentication server encountered an error. Please try again later."
        default:
          return `Authentication failed: ${search.error}`
      }
    }

    // Check for missing parameters
    if (!search.code && !search.state) {
      return "Missing authentication parameters. Please restart the sign-in process."
    }
    if (!search.code) {
      return "Missing authorization code. Please restart the sign-in process."
    }
    if (!search.state) {
      return "Missing state parameter. Please restart the sign-in process."
    }

    // Check mutation result for errors
    const failedResult = getFailedResult()
    if (!failedResult) {
      return null
    }

    // Extract error message from Cause
    const cause = failedResult.cause
    const failures = Cause.failures(cause)
    const firstFailure = Chunk.head(failures)

    if (Option.isSome(firstFailure)) {
      const error = firstFailure.value

      // Check for specific error types using type guard
      if (isErrorWithTag(error, "OAuthStateInvalidError")) {
        return "Security validation failed. Please restart the sign-in process."
      }
      if (isErrorWithTag(error, "ProviderAuthError")) {
        return `Authentication with ${providerDisplayName} failed. Please try again.`
      }
      if (isErrorWithTag(error, "ProviderNotFoundError")) {
        return `${providerDisplayName} is not configured as an authentication provider.`
      }
      if (isErrorWithTag(error, "IdentityLinkedError")) {
        return "This account is already linked to another user."
      }
      if (isErrorWithMessage(error)) {
        return error.message
      }
      return String(error)
    }
    return "Authentication failed. Please try again."
  }

  // Type guards for error handling
  function isErrorWithTag(error: unknown, tag: string): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      error._tag === tag
    )
  }

  function isErrorWithMessage(error: unknown): error is { message: string } {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    )
  }

  // Check loading state for the appropriate result
  const isLoading = isLinkFlow
    ? Result.isInitial(linkCallbackResult) || Result.isWaiting(linkCallbackResult)
    : Result.isInitial(callbackResult) || Result.isWaiting(callbackResult)
  const errorMessage = getErrorMessage()
  const hasError = errorMessage !== null

  // Loading state
  if (isLoading && !hasError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
        <div className="text-center" data-testid="oauth-callback-loading">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <h1 className="text-xl font-semibold text-gray-900">
            {isLinkFlow
              ? `Linking ${providerDisplayName} account...`
              : `Completing ${providerDisplayName} authentication...`}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we complete your {isLinkFlow ? "account linking" : "sign-in"}.
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (hasError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md space-y-6" data-testid="oauth-callback-error">
          <div className="text-center">
            {/* Error icon */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Authentication Failed
            </h1>
          </div>

          {/* Error message */}
          <div
            role="alert"
            className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
            data-testid="oauth-callback-error-message"
          >
            {errorMessage}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              data-testid="oauth-callback-retry"
            >
              Try Again
            </button>
            <Link
              to="/login"
              search={search.redirect ? { redirect: search.redirect } : {}}
              className="block w-full rounded-md bg-gray-100 px-4 py-2 text-center text-gray-700 font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              data-testid="oauth-callback-back-to-login"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Success state - should redirect, but show success message as fallback
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="text-center" data-testid="oauth-callback-success">
        {/* Success icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {isLinkFlow ? "Account Linked Successfully" : "Sign In Successful"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Redirecting...
        </p>
      </div>
    </div>
  )
}
