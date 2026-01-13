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
 * @module routes/auth/callback/$provider
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import * as React from "react"
import { useAtomSet } from "@effect-atom/atom-react"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { LoginResponse } from "@accountability/api/Definitions/AuthApi"
import { isAuthProviderType, type AuthProviderType } from "@accountability/core/Auth/AuthProviderType"
import { authTokenAtom } from "../../../atoms/auth.ts"

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
  const stored = window.sessionStorage.getItem("auth_redirect")
  window.sessionStorage.removeItem("auth_redirect")
  return stored ?? "/"
}

/**
 * Store auth token to localStorage
 */
const storeToken = (token: string): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("accountability_auth_token", token)
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
// Main Callback Page Component
// =============================================================================

function OAuthCallbackPage(): React.ReactElement {
  const { provider } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const setAuthToken = useAtomSet(authTokenAtom)
  const [callbackState, setCallbackState] = React.useState<CallbackState>({ type: "processing" })
  const [redirectTo, setRedirectTo] = React.useState<string>("/")
  const hasProcessed = React.useRef(false)

  // Process callback on mount
  React.useEffect(() => {
    // Prevent double execution in strict mode
    if (hasProcessed.current) return
    hasProcessed.current = true

    const processCallback = async (): Promise<void> => {
      // Get redirect URL first (before it's cleared)
      const storedRedirect = getStoredRedirect()
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

      // Exchange the code for a token
      try {
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
          let errorMessage = "Authentication failed. Please try again."

          if (errorData && typeof errorData === "object" && "_tag" in errorData) {
            switch (errorData._tag) {
              case "OAuthStateInvalidError":
                errorMessage = "Security validation failed. Please restart the login process."
                break
              case "ProviderAuthError":
                errorMessage = errorData.reason ?? "Provider authentication failed"
                break
              case "ProviderNotFoundError":
                errorMessage = `Provider "${provider}" is not enabled`
                break
              default:
                errorMessage = errorData.message ?? errorMessage
            }
          }

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
      } catch (err) {
        const errorMessage = err instanceof Error
          ? err.message
          : "An unexpected error occurred during authentication"
        setCallbackState({ type: "error", message: errorMessage })
      }
    }

    processCallback()
  }, [search, provider, setAuthToken])

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
    return (
      <div style={pageStyles}>
        <div style={cardStyles}>
          <h1 style={titleStyles}>Authentication Failed</h1>
          <div style={errorAlertStyles} role="alert">
            {callbackState.message}
          </div>
          <p style={subtitleStyles}>
            <Link to="/login" style={linkStyles}>
              Return to login
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // Processing or success (redirecting)
  return (
    <div style={pageStyles}>
      <div style={cardStyles}>
        <Spinner />
        <h1 style={titleStyles}>
          {callbackState.type === "success" ? "Success!" : "Completing sign in..."}
        </h1>
        <p style={subtitleStyles}>
          {callbackState.type === "success"
            ? "Redirecting you now..."
            : "Please wait while we complete your authentication."}
        </p>
      </div>
    </div>
  )
}
