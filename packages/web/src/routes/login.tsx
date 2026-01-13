/**
 * Login Page Route
 *
 * Route: /login
 *
 * Multi-provider login page supporting:
 * - Local email/password authentication
 * - OAuth/SSO providers (Google, GitHub, WorkOS, SAML)
 * - Provider discovery from /api/auth/providers
 * - Redirect to intended route on success
 * - Redirect away if already authenticated
 *
 * @module routes/login
 */

import {
  createFileRoute,
  redirect,
  useNavigate
} from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtomSet, useAtom } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Schema from "effect/Schema"
import {
  enabledProvidersAtom,
  loginMutation,
  oauthLoginMutation,
  isAuthenticatedAtom,
  type LoginCredentials,
  type ProviderMetadata
} from "../atoms/auth.ts"
import type { AuthProviderType } from "@accountability/core/Auth/AuthProviderType"
import * as Option from "effect/Option"

// =============================================================================
// Route Configuration
// =============================================================================

/**
 * Search params schema for the login page
 */
const LoginSearchSchema = Schema.Struct({
  redirect: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String)
})

type LoginSearch = typeof LoginSearchSchema.Type

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    // Validate search params safely
    const result = Schema.decodeUnknownOption(LoginSearchSchema)(search)
    return Option.getOrElse(result, () => ({}))
  },
  beforeLoad: async ({ search }) => {
    // Check if already authenticated - redirect away
    // Note: This is a simple client-side check; real auth should be verified server-side
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (token) {
        const validatedSearch = Schema.decodeUnknownOption(LoginSearchSchema)(search)
        const redirectPath = Option.match(validatedSearch, {
          onNone: () => "/",
          onSome: (s) => s.redirect ?? "/"
        })
        throw redirect({
          to: redirectPath,
          replace: true
        })
      }
    }
  }
})

// =============================================================================
// Styles
// =============================================================================

const pageStyles: React.CSSProperties = {
  maxWidth: "400px",
  margin: "2rem auto",
  padding: "0 1rem"
}

const cardStyles: React.CSSProperties = {
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "2rem",
  backgroundColor: "#fff",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)"
}

const titleStyles: React.CSSProperties = {
  margin: "0 0 0.5rem 0",
  fontSize: "24px",
  fontWeight: 600,
  textAlign: "center"
}

const subtitleStyles: React.CSSProperties = {
  color: "#666",
  textAlign: "center",
  marginBottom: "2rem"
}

const formStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem"
}

const labelStyles: React.CSSProperties = {
  display: "block",
  marginBottom: "0.5rem",
  fontWeight: 500,
  fontSize: "14px"
}

const inputStyles: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  border: "1px solid #d9d9d9",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box"
}

const inputErrorStyles: React.CSSProperties = {
  ...inputStyles,
  borderColor: "#ff4d4f"
}

const buttonStyles: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.2s"
}

const primaryButtonStyles: React.CSSProperties = {
  ...buttonStyles,
  backgroundColor: "#1890ff",
  color: "#fff"
}

const primaryButtonDisabledStyles: React.CSSProperties = {
  ...primaryButtonStyles,
  backgroundColor: "#bae7ff",
  cursor: "not-allowed"
}

const errorAlertStyles: React.CSSProperties = {
  padding: "0.75rem 1rem",
  backgroundColor: "#fff2f0",
  border: "1px solid #ffccc7",
  borderRadius: "6px",
  color: "#ff4d4f",
  fontSize: "14px",
  marginBottom: "1rem"
}

const fieldErrorStyles: React.CSSProperties = {
  color: "#ff4d4f",
  fontSize: "12px",
  marginTop: "0.25rem"
}

const dividerStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  margin: "1.5rem 0",
  color: "#999",
  fontSize: "14px"
}

const dividerLineStyles: React.CSSProperties = {
  flex: 1,
  height: "1px",
  backgroundColor: "#e8e8e8"
}

const oauthSectionStyles: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem"
}

const oauthButtonStyles = (provider: AuthProviderType): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    ...buttonStyles,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    backgroundColor: "#fff",
    border: "1px solid #d9d9d9",
    color: "#333"
  }

  // Provider-specific styling
  switch (provider) {
    case "google":
      return {
        ...baseStyles,
        backgroundColor: "#fff",
        borderColor: "#ddd"
      }
    case "github":
      return {
        ...baseStyles,
        backgroundColor: "#24292e",
        color: "#fff",
        borderColor: "#24292e"
      }
    case "workos":
      return {
        ...baseStyles,
        backgroundColor: "#6366f1",
        color: "#fff",
        borderColor: "#6366f1"
      }
    case "saml":
      return {
        ...baseStyles,
        backgroundColor: "#0d6efd",
        color: "#fff",
        borderColor: "#0d6efd"
      }
    default:
      return baseStyles
  }
}

const oauthButtonDisabledStyles: React.CSSProperties = {
  opacity: 0.7,
  cursor: "not-allowed"
}

const footerStyles: React.CSSProperties = {
  marginTop: "1.5rem",
  textAlign: "center",
  fontSize: "14px",
  color: "#666"
}

const loadingStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#666"
}

// =============================================================================
// Provider Icons
// =============================================================================

/**
 * Get provider icon/label based on provider type
 */
function getProviderIcon(provider: AuthProviderType): string {
  switch (provider) {
    case "google":
      return "G"
    case "github":
      return "GH"
    case "workos":
      return "W"
    case "saml":
      return "SSO"
    default:
      return provider.charAt(0).toUpperCase()
  }
}

/**
 * Get provider display name
 */
function getProviderDisplayName(provider: ProviderMetadata): string {
  return provider.name
}

// =============================================================================
// Form State Atom
// =============================================================================

interface LoginFormState {
  email: string
  password: string
  emailError: string | null
  passwordError: string | null
  generalError: string | null
  isSubmitting: boolean
}

const initialFormState: LoginFormState = {
  email: "",
  password: "",
  emailError: null,
  passwordError: null,
  generalError: null,
  isSubmitting: false
}

const loginFormAtom = Atom.make<LoginFormState>(initialFormState)

// Track which OAuth provider is currently loading
const oauthLoadingProviderAtom = Atom.make<AuthProviderType | null>(null)

// =============================================================================
// Local Auth Form Component
// =============================================================================

interface LocalAuthFormProps {
  readonly redirectTo: string
}

function LocalAuthForm({
  redirectTo
}: LocalAuthFormProps): React.ReactElement {
  const [formState, setFormState] = useAtom(loginFormAtom)
  const executeLogin = useAtomSet(loginMutation)
  const loginResult = useAtomValue(loginMutation)
  const navigate = useNavigate()
  const emailInputRef = React.useRef<HTMLInputElement>(null)

  // Focus email input on mount
  React.useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  // Handle successful login
  React.useEffect(() => {
    if (Result.isSuccess(loginResult) && formState.isSubmitting) {
      setFormState(state => ({ ...state, isSubmitting: false }))
      navigate({ to: redirectTo, replace: true })
    }
  }, [loginResult, formState.isSubmitting, navigate, redirectTo, setFormState])

  // Handle login error
  React.useEffect(() => {
    if (Result.isFailure(loginResult) && formState.isSubmitting) {
      let errorMessage = "Login failed. Please try again."

      // Extract error from Cause using failureOption
      const errorOption = Cause.failureOption(loginResult.cause)

      Option.match(errorOption, {
        onNone: () => {
          // Keep default error message
        },
        onSome: (error) => {
          // Extract error message from tagged error
          const isTaggedError = (e: unknown): e is { _tag: string; message?: string } =>
            e !== null && typeof e === "object" && "_tag" in e

          if (isTaggedError(error)) {
            switch (error._tag) {
              case "AuthUnauthorizedError":
                errorMessage = "Invalid email or password"
                break
              case "AuthValidationError":
                errorMessage = error.message ?? "Invalid credentials"
                break
              default:
                errorMessage = error.message ?? errorMessage
            }
          }
        }
      })

      setFormState(state => ({
        ...state,
        isSubmitting: false,
        generalError: errorMessage
      }))
    }
  }, [loginResult, formState.isSubmitting, setFormState])

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) {
      return "Email is required"
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address"
    }
    return null
  }

  const validatePassword = (password: string): string | null => {
    if (!password) {
      return "Password is required"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    // Clear previous errors
    setFormState(state => ({
      ...state,
      emailError: null,
      passwordError: null,
      generalError: null
    }))

    // Validate
    const emailError = validateEmail(formState.email)
    const passwordError = validatePassword(formState.password)

    if (emailError || passwordError) {
      setFormState(state => ({
        ...state,
        emailError,
        passwordError
      }))
      return
    }

    // Submit
    setFormState(state => ({ ...state, isSubmitting: true }))

    const credentials: LoginCredentials = {
      provider: "local",
      credentials: {
        email: formState.email.trim(),
        password: formState.password
      }
    }

    executeLogin(credentials)
  }

  const isLoading = formState.isSubmitting || Result.isWaiting(loginResult)

  return (
    <form style={formStyles} onSubmit={handleSubmit} noValidate>
      {formState.generalError && (
        <div style={errorAlertStyles} role="alert" aria-live="polite">
          {formState.generalError}
        </div>
      )}

      <div>
        <label htmlFor="email" style={labelStyles}>
          Email Address
        </label>
        <input
          ref={emailInputRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={formState.email}
          onChange={e =>
            setFormState(state => ({ ...state, email: e.target.value }))
          }
          onBlur={e => {
            const error = validateEmail(e.target.value)
            setFormState(state => ({ ...state, emailError: error }))
          }}
          style={formState.emailError ? inputErrorStyles : inputStyles}
          placeholder="you@example.com"
          aria-invalid={formState.emailError !== null}
          aria-describedby={formState.emailError ? "email-error" : undefined}
          disabled={isLoading}
        />
        {formState.emailError && (
          <div id="email-error" style={fieldErrorStyles} role="alert">
            {formState.emailError}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="password" style={labelStyles}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={formState.password}
          onChange={e =>
            setFormState(state => ({ ...state, password: e.target.value }))
          }
          onBlur={e => {
            const error = validatePassword(e.target.value)
            setFormState(state => ({ ...state, passwordError: error }))
          }}
          style={formState.passwordError ? inputErrorStyles : inputStyles}
          placeholder="Enter your password"
          aria-invalid={formState.passwordError !== null}
          aria-describedby={
            formState.passwordError ? "password-error" : undefined
          }
          disabled={isLoading}
        />
        {formState.passwordError && (
          <div id="password-error" style={fieldErrorStyles} role="alert">
            {formState.passwordError}
          </div>
        )}
      </div>

      <button
        type="submit"
        style={isLoading ? primaryButtonDisabledStyles : primaryButtonStyles}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  )
}

// =============================================================================
// OAuth Provider Button Component
// =============================================================================

interface OAuthButtonProps {
  readonly provider: ProviderMetadata
  readonly redirectTo: string
}

function OAuthButton({
  provider,
  redirectTo
}: OAuthButtonProps): React.ReactElement {
  const [loadingProvider, setLoadingProvider] = useAtom(oauthLoadingProviderAtom)
  const executeOAuth = useAtomSet(oauthLoginMutation)
  const oauthResult = useAtomValue(oauthLoginMutation)

  const isLoading = loadingProvider === provider.type
  const isAnyLoading = loadingProvider !== null

  // Handle OAuth redirect response
  React.useEffect(() => {
    if (Result.isSuccess(oauthResult) && isLoading) {
      // Store the redirect URL for when we come back from OAuth
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("auth_redirect", redirectTo)
      }
      // Redirect to OAuth provider
      window.location.href = oauthResult.value.redirectUrl
    }
  }, [oauthResult, isLoading, redirectTo])

  // Handle OAuth error
  React.useEffect(() => {
    if (Result.isFailure(oauthResult) && isLoading) {
      setLoadingProvider(null)
      // Error will be shown via URL param on redirect
    }
  }, [oauthResult, isLoading, setLoadingProvider])

  const handleClick = (): void => {
    if (isAnyLoading) return

    setLoadingProvider(provider.type)
    executeOAuth(provider.type)
  }

  const buttonStyle = {
    ...oauthButtonStyles(provider.type),
    ...(isAnyLoading ? oauthButtonDisabledStyles : {})
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={buttonStyle}
      disabled={isAnyLoading}
      aria-busy={isLoading}
      aria-label={`Sign in with ${provider.name}`}
    >
      <span style={{ fontWeight: "bold" }}>{getProviderIcon(provider.type)}</span>
      <span>
        {isLoading ? "Redirecting..." : `Continue with ${getProviderDisplayName(provider)}`}
      </span>
    </button>
  )
}

// =============================================================================
// Main Login Page Component
// =============================================================================

function LoginPage(): React.ReactElement {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const providersResult = useAtomValue(enabledProvidersAtom)
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const setFormState = useAtomSet(loginFormAtom)

  const redirectTo = search.redirect ?? "/"
  const urlError = search.error

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: redirectTo, replace: true })
    }
  }, [isAuthenticated, navigate, redirectTo])

  // Set URL error in form state
  React.useEffect(() => {
    if (urlError) {
      setFormState(state => ({ ...state, generalError: decodeURIComponent(urlError) }))
    }
  }, [urlError, setFormState])

  // Reset form on unmount
  React.useEffect(() => {
    return () => {
      setFormState(initialFormState)
    }
  }, [setFormState])

  // Loading state for providers
  if (Result.isInitial(providersResult) || Result.isWaiting(providersResult)) {
    return (
      <div style={pageStyles}>
        <div style={cardStyles}>
          <div style={loadingStyles}>Loading authentication options...</div>
        </div>
      </div>
    )
  }

  // Error state for providers
  if (Result.isFailure(providersResult)) {
    return (
      <div style={pageStyles}>
        <div style={cardStyles}>
          <div style={errorAlertStyles} role="alert">
            Unable to load authentication options. Please refresh the page.
          </div>
        </div>
      </div>
    )
  }

  const providers = providersResult.value

  // Separate local and OAuth providers
  const localProvider = providers.find(
    p => p.type === "local" && p.supportsPasswordLogin
  )
  const oauthProviders = providers.filter(p => p.oauthEnabled)

  // No providers enabled
  if (!localProvider && oauthProviders.length === 0) {
    return (
      <div style={pageStyles}>
        <div style={cardStyles}>
          <h1 style={titleStyles}>Sign In</h1>
          <div style={errorAlertStyles} role="alert">
            No authentication providers are currently enabled. Please contact
            your administrator.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyles}>
      <div style={cardStyles}>
        <h1 style={titleStyles}>Sign In</h1>
        <p style={subtitleStyles}>Welcome back! Please sign in to continue.</p>

        {/* Local auth form */}
        {localProvider && (
          <LocalAuthForm redirectTo={redirectTo} />
        )}

        {/* Divider between local and OAuth */}
        {localProvider && oauthProviders.length > 0 && (
          <div style={dividerStyles}>
            <div style={dividerLineStyles} />
            <span style={{ margin: "0 1rem" }}>or</span>
            <div style={dividerLineStyles} />
          </div>
        )}

        {/* OAuth/SSO providers */}
        {oauthProviders.length > 0 && (
          <div style={oauthSectionStyles} role="group" aria-label="External sign-in options">
            {oauthProviders.map(provider => (
              <OAuthButton
                key={provider.type}
                provider={provider}
                redirectTo={redirectTo}
              />
            ))}
          </div>
        )}

        {/* Registration info - register page would be implemented in a separate story */}
        {localProvider?.supportsRegistration && (
          <div style={footerStyles}>
            Don't have an account? Contact your administrator for access.
          </div>
        )}
      </div>
    </div>
  )
}
