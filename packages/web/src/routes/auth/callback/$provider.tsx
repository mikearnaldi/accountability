/**
 * OAuth Callback Route
 *
 * Route: /auth/callback/:provider
 *
 * Handles OAuth callback from external providers:
 * - Exchanges authorization code for tokens via API
 * - Stores session token on success
 * - Redirects to intended destination or home
 * - Shows error message on failure
 *
 * Link callback flow (for adding providers to existing account):
 * - Detects link flow via session storage flag
 * - Calls link/callback endpoint instead of login
 * - Does NOT replace the current token
 * - Redirects to account settings page
 *
 * @module routes/auth/callback/$provider
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import * as React from "react"
import { useAtomSet, useAtomRefresh } from "@effect-atom/atom-react"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { LoginResponse, AuthUserResponse } from "@accountability/api/Definitions/AuthApi"
import { isAuthProviderType, type AuthProviderType } from "@accountability/core/Auth/AuthProviderType"
import { authTokenAtom, currentUserAtom } from "../../../atoms/auth.ts"

// =============================================================================
// Route Configuration
// =============================================================================

/**
 * Search params schema for OAuth callback
 */
const CallbackSearchSchema = Schema.Struct({
  code: Schema.optional(Schema.String),
  state: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String)
})

type CallbackSearch = typeof CallbackSearchSchema.Type

export const Route = createFileRoute("/auth/callback/$provider")({
  component: OAuthCallbackPage,
  validateSearch: (search: Record<string, unknown>): CallbackSearch => {
    const result = Schema.decodeUnknownOption(CallbackSearchSchema)(search)
    return Option.getOrElse(result, () => ({}))
  }
})

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "400px",
  margin: "4rem auto",
  padding: "0 1rem",
  textAlign: "center"
}

const cardStyles: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "2rem",
  backgroundColor: "#fff",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)"
}

const titleStyles: React.CSSProperties = {
  margin: "0 0 1rem 0",
  fontSize: "20px",
  fontWeight: 600
}

const subtitleStyles: React.CSSProperties = {
  color: "#666",
  marginBottom: "1.5rem"
}

const errorAlertStyles: React.CSSProperties = {
  padding: "1rem",
  backgroundColor: "#fff2f0",
  border: "1px solid #ffccc7",
  borderRadius: "6px",
  color: "#ff4d4f",
  fontSize: "14px",
  marginBottom: "1rem"
}

const linkStyles: React.CSSProperties = {
  color: "#1890ff",
  textDecoration: "none",
  fontWeight: 500
}

const spinnerContainerStyles: React.CSSProperties = {
  marginBottom: "1rem"
}

// =============================================================================
// Callback State Types
// =============================================================================

type CallbackState =
  | { readonly type: "processing" }
  | { readonly type: "success" }
  | { readonly type: "error"; readonly message: string }

// =============================================================================
// Constants
// =============================================================================

const AUTH_TOKEN_KEY = "accountability_auth_token"
const AUTH_REDIRECT_KEY = "auth_redirect"
const AUTH_LINK_FLOW_KEY = "auth_link_flow"

// =============================================================================
// Types
// =============================================================================

/**
 * The type of callback flow being processed
 */
type CallbackFlowType = "login" | "link"

// =============================================================================
// Helpers
// =============================================================================

/**
 * Gets the base URL for API calls
 */
const getBaseUrl = (): string =>
  typeof window !== "undefined" ? window.location.origin : ""

/**
 * Get the stored redirect URL from session storage
 */
const getStoredRedirect = (): string => {
  if (typeof window === "undefined") return "/"
  const stored = window.sessionStorage.getItem(AUTH_REDIRECT_KEY)
  window.sessionStorage.removeItem(AUTH_REDIRECT_KEY)
  return stored ?? "/"
}

/**
 * Check if this is a link flow (adding provider to existing account)
 * Clears the flag after reading
 */
const getAndClearLinkFlow = (): boolean => {
  if (typeof window === "undefined") return false
  const isLinkFlow = window.sessionStorage.getItem(AUTH_LINK_FLOW_KEY) === "true"
  window.sessionStorage.removeItem(AUTH_LINK_FLOW_KEY)
  return isLinkFlow
}

/**
 * Get the stored auth token from localStorage
 */
const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

/**
 * Store auth token to localStorage
 */
const storeToken = (token: string): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  }
}

// =============================================================================
// Spinner Component
// =============================================================================

function Spinner(): React.ReactElement {
  return (
    <div style={spinnerContainerStyles}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        style={{ animation: "spin 1s linear infinite" }}
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="#f3f3f3"
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="#1890ff"
          strokeWidth="3"
          strokeDasharray="28 85"
          strokeLinecap="round"
        />
      </svg>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// =============================================================================
// Error Message Helpers
// =============================================================================

/**
 * Schema for validating API error responses
 */
const ApiErrorResponse = Schema.Struct({
  _tag: Schema.String,
  message: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String)
})

/**
 * Type guard for API error objects
 */
const isApiError = (value: unknown): value is typeof ApiErrorResponse.Type =>
  Option.isSome(Schema.decodeUnknownOption(ApiErrorResponse)(value))

/**
 * Parse API error response into user-friendly message
 */
const parseErrorMessage = (
  errorData: unknown,
  provider: string,
  flowType: CallbackFlowType
): string => {
  const defaultMessage = flowType === "link"
    ? "Failed to link provider. Please try again."
    : "Authentication failed. Please try again."

  if (isApiError(errorData)) {
    switch (errorData._tag) {
      case "OAuthStateInvalidError":
        return flowType === "link"
          ? "Security validation failed. Please restart the linking process."
          : "Security validation failed. Please restart the login process."
      case "ProviderAuthError":
        return errorData.reason ?? "Provider authentication failed"
      case "ProviderNotFoundError":
        return `Provider "${provider}" is not enabled`
      case "IdentityLinkedError":
        return errorData.message ?? "This identity is already linked to another account"
      default:
        return errorData.message ?? defaultMessage
    }
  }

  return defaultMessage
}

// =============================================================================
// Main Callback Page Component
// =============================================================================

function OAuthCallbackPage(): React.ReactElement {
  const { provider } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const setAuthToken = useAtomSet(authTokenAtom)
  const refreshCurrentUser = useAtomRefresh(currentUserAtom)
  const [callbackState, setCallbackState] = React.useState<CallbackState>({ type: "processing" })
  const [redirectTo, setRedirectTo] = React.useState<string>("/")
  const [flowType, setFlowType] = React.useState<CallbackFlowType>("login")
  const hasProcessed = React.useRef(false)

  // Process callback on mount
  React.useEffect(() => {
    // Prevent double execution in strict mode
    if (hasProcessed.current) return
    hasProcessed.current = true

    const processCallback = async (): Promise<void> => {
      // Determine if this is a link flow (before clearing)
      const isLinkFlow = getAndClearLinkFlow()
      const currentFlowType: CallbackFlowType = isLinkFlow ? "link" : "login"
      setFlowType(currentFlowType)

      // Get redirect URL (cleared after reading)
      const storedRedirect = getStoredRedirect()
      // Both flows default to "/" if no redirect stored
      setRedirectTo(storedRedirect)

      // Check for OAuth error in URL
      if (search.error) {
        const errorMessage = search.error_description
          ? decodeURIComponent(search.error_description)
          : `Authentication failed: ${search.error}`
        setCallbackState({ type: "error", message: errorMessage })
        return
      }

      // Validate provider - use type guard to get narrowed type
      if (!isAuthProviderType(provider)) {
        setCallbackState({
          type: "error",
          message: `Invalid authentication provider: ${provider}`
        })
        return
      }

      // Capture validated provider for use in fetch
      const validatedProvider: AuthProviderType = provider

      // Validate required params
      if (!search.code || !search.state) {
        setCallbackState({
          type: "error",
          message: "Missing authorization code or state parameter"
        })
        return
      }

      // For link flow, we need an existing auth token
      const existingToken = isLinkFlow ? getStoredToken() : null
      if (isLinkFlow && !existingToken) {
        setCallbackState({
          type: "error",
          message: "Session expired. Please log in again before linking a provider."
        })
        return
      }

      try {
        if (isLinkFlow) {
          // Link callback flow - call GET /api/auth/link/callback/:provider
          const linkUrl = new URL(`${getBaseUrl()}/api/auth/link/callback/${validatedProvider}`)
          linkUrl.searchParams.set("code", search.code)
          linkUrl.searchParams.set("state", search.state)

          const response = await fetch(linkUrl.toString(), {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${existingToken}`
            }
          })

          if (!response.ok) {
            const errorData = await response.json()
            const errorMessage = parseErrorMessage(errorData, provider, currentFlowType)
            setCallbackState({ type: "error", message: errorMessage })
            return
          }

          // For link flow, we don't get a new token - just refresh user data
          const data = await response.json()
          // Validate response but don't need to use it (just refresh)
          Schema.decodeUnknownSync(AuthUserResponse)(data)

          // Refresh the current user atom to show the newly linked provider
          refreshCurrentUser()

          // Success!
          setCallbackState({ type: "success" })
        } else {
          // Login callback flow - call POST /api/auth/login
          const response = await fetch(`${getBaseUrl()}/api/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              provider: validatedProvider,
              credentials: {
                code: search.code,
                state: search.state
              }
            })
          })

          if (!response.ok) {
            const errorData = await response.json()
            const errorMessage = parseErrorMessage(errorData, provider, currentFlowType)
            setCallbackState({ type: "error", message: errorMessage })
            return
          }

          const data = await response.json()
          const loginResponse = Schema.decodeUnknownSync(LoginResponse)(data)

          // Store the token
          storeToken(loginResponse.token)
          setAuthToken(Option.some(loginResponse.token))

          // Success!
          setCallbackState({ type: "success" })
        }
      } catch (err) {
        const errorMessage = err instanceof Error
          ? err.message
          : "An unexpected error occurred during authentication"
        setCallbackState({ type: "error", message: errorMessage })
      }
    }

    processCallback()
  }, [search, provider, setAuthToken, refreshCurrentUser])

  // Redirect on success
  React.useEffect(() => {
    if (callbackState.type === "success") {
      // Small delay to show success message
      const timer = setTimeout(() => {
        navigate({ to: redirectTo, replace: true })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [callbackState, navigate, redirectTo])

  // Render based on state
  if (callbackState.type === "error") {
    // For link flow, return to home (settings page doesn't exist yet)
    // For login flow, return to /login
    const returnLink = flowType === "link" ? "/" : "/login"
    const returnText = flowType === "link" ? "Return to home" : "Return to login"
    const errorTitle = flowType === "link" ? "Provider Linking Failed" : "Authentication Failed"

    return (
      <div style={pageStyles}>
        <div style={cardStyles}>
          <h1 style={titleStyles}>{errorTitle}</h1>
          <div style={errorAlertStyles} role="alert">
            {callbackState.message}
          </div>
          <p style={subtitleStyles}>
            <Link to={returnLink} style={linkStyles}>
              {returnText}
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // Processing or success (redirecting)
  const processingTitle = flowType === "link"
    ? "Linking provider..."
    : "Completing sign in..."
  const processingSubtitle = flowType === "link"
    ? "Please wait while we link your account."
    : "Please wait while we complete your authentication."
  const successTitle = flowType === "link"
    ? "Provider Linked!"
    : "Success!"

  return (
    <div style={pageStyles}>
      <div style={cardStyles}>
        <Spinner />
        <h1 style={titleStyles}>
          {callbackState.type === "success" ? successTitle : processingTitle}
        </h1>
        <p style={subtitleStyles}>
          {callbackState.type === "success"
            ? "Redirecting you now..."
            : processingSubtitle}
        </p>
      </div>
    </div>
  )
}
