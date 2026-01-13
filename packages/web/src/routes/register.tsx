/**
 * Registration Page Route
 *
 * Route: /register
 *
 * Local provider registration page supporting:
 * - Email input with validation
 * - Display name input
 * - Password with strength indicator
 * - Confirm password with match validation
 * - Error display for validation and duplicate email
 * - Auto-login after successful registration
 * - Redirect away if already authenticated
 * - Hide if local provider is not enabled
 *
 * Note: SSO/OAuth users don't register - they auto-provision on first login
 *
 * @module routes/register
 */

import {
  createFileRoute,
  Link,
  redirect,
  useNavigate
} from "@tanstack/react-router"
import * as React from "react"
import { useAtomValue, useAtomSet, useAtom } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import {
  enabledProvidersAtom,
  registerMutation,
  loginMutation,
  isAuthenticatedAtom,
  type RegisterInput,
  type LoginCredentials
} from "../atoms/auth.ts"

// =============================================================================
// Route Configuration
// =============================================================================

/**
 * Search params schema for the register page
 */
const RegisterSearchSchema = Schema.Struct({
  redirect: Schema.optional(Schema.String)
})

type RegisterSearch = typeof RegisterSearchSchema.Type

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  validateSearch: (search: Record<string, unknown>): RegisterSearch => {
    const result = Schema.decodeUnknownOption(RegisterSearchSchema)(search)
    return Option.getOrElse(result, () => ({}))
  },
  beforeLoad: async ({ search }) => {
    // Check if already authenticated - redirect away
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (token) {
        const validatedSearch = Schema.decodeUnknownOption(RegisterSearchSchema)(search)
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

const footerStyles: React.CSSProperties = {
  marginTop: "1.5rem",
  textAlign: "center",
  fontSize: "14px",
  color: "#666"
}

const linkStyles: React.CSSProperties = {
  color: "#1890ff",
  textDecoration: "none"
}

const loadingStyles: React.CSSProperties = {
  textAlign: "center",
  padding: "2rem",
  color: "#666"
}

// =============================================================================
// Password Strength Indicator Styles
// =============================================================================

const strengthContainerStyles: React.CSSProperties = {
  marginTop: "0.5rem"
}

const strengthBarContainerStyles: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  marginBottom: "0.25rem"
}

const strengthBarBaseStyles: React.CSSProperties = {
  flex: 1,
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "#e8e8e8",
  transition: "background-color 0.2s"
}

const strengthTextStyles: React.CSSProperties = {
  fontSize: "12px",
  marginTop: "0.25rem"
}

// =============================================================================
// Password Strength Logic
// =============================================================================

type PasswordStrength = "weak" | "fair" | "good" | "strong"

interface PasswordStrengthResult {
  readonly strength: PasswordStrength
  readonly score: number
  readonly label: string
  readonly color: string
  readonly requirements: ReadonlyArray<{
    readonly met: boolean
    readonly text: string
  }>
}

function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const requirements: Array<{ met: boolean; text: string }> = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(password), text: "Contains uppercase letter" },
    { met: /[a-z]/.test(password), text: "Contains lowercase letter" },
    { met: /[0-9]/.test(password), text: "Contains number" },
    { met: /[^A-Za-z0-9]/.test(password), text: "Contains special character" }
  ]

  const score = requirements.filter(r => r.met).length

  if (score <= 1) {
    return { strength: "weak", score, label: "Weak", color: "#ff4d4f", requirements }
  }
  if (score <= 2) {
    return { strength: "fair", score, label: "Fair", color: "#faad14", requirements }
  }
  if (score <= 3) {
    return { strength: "good", score, label: "Good", color: "#52c41a", requirements }
  }
  return { strength: "strong", score, label: "Strong", color: "#389e0d", requirements }
}

// =============================================================================
// Password Strength Indicator Component
// =============================================================================

interface PasswordStrengthIndicatorProps {
  readonly password: string
}

function PasswordStrengthIndicator({
  password
}: PasswordStrengthIndicatorProps): React.ReactElement | null {
  if (!password) {
    return null
  }

  const result = evaluatePasswordStrength(password)
  const bars = [1, 2, 3, 4, 5]

  return (
    <div style={strengthContainerStyles}>
      <div style={strengthBarContainerStyles} role="progressbar" aria-valuenow={result.score} aria-valuemin={0} aria-valuemax={5}>
        {bars.map(barIndex => (
          <div
            key={barIndex}
            style={{
              ...strengthBarBaseStyles,
              backgroundColor: barIndex <= result.score ? result.color : "#e8e8e8"
            }}
          />
        ))}
      </div>
      <div style={{ ...strengthTextStyles, color: result.color }}>
        Password strength: {result.label}
      </div>
      <ul style={{ margin: "0.5rem 0 0 0", padding: "0 0 0 1.25rem", fontSize: "12px", color: "#666" }}>
        {result.requirements.map((req, index) => (
          <li key={index} style={{ color: req.met ? "#52c41a" : "#999" }}>
            {req.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

// =============================================================================
// Form State Atom
// =============================================================================

interface RegisterFormState {
  readonly email: string
  readonly displayName: string
  readonly password: string
  readonly confirmPassword: string
  readonly emailError: string | null
  readonly displayNameError: string | null
  readonly passwordError: string | null
  readonly confirmPasswordError: string | null
  readonly generalError: string | null
  readonly isSubmitting: boolean
  readonly registrationComplete: boolean
}

const initialFormState: RegisterFormState = {
  email: "",
  displayName: "",
  password: "",
  confirmPassword: "",
  emailError: null,
  displayNameError: null,
  passwordError: null,
  confirmPasswordError: null,
  generalError: null,
  isSubmitting: false,
  registrationComplete: false
}

const registerFormAtom = Atom.make<RegisterFormState>(initialFormState)

// =============================================================================
// Register Form Component
// =============================================================================

interface RegisterFormProps {
  readonly redirectTo: string
}

function RegisterForm({
  redirectTo
}: RegisterFormProps): React.ReactElement {
  const [formState, setFormState] = useAtom(registerFormAtom)
  const executeRegister = useAtomSet(registerMutation)
  const registerResult = useAtomValue(registerMutation)
  const executeLogin = useAtomSet(loginMutation)
  const loginResult = useAtomValue(loginMutation)
  const navigate = useNavigate()
  const emailInputRef = React.useRef<HTMLInputElement>(null)

  // Focus email input on mount
  React.useEffect(() => {
    emailInputRef.current?.focus()
  }, [])

  // Handle successful registration - auto-login
  React.useEffect(() => {
    if (Result.isSuccess(registerResult) && formState.isSubmitting && !formState.registrationComplete) {
      // Registration successful - now auto-login
      setFormState(state => ({ ...state, registrationComplete: true }))
      const credentials: LoginCredentials = {
        provider: "local",
        credentials: {
          email: formState.email.trim(),
          password: formState.password
        }
      }
      executeLogin(credentials)
    }
  }, [registerResult, formState.isSubmitting, formState.registrationComplete, formState.email, formState.password, executeLogin, setFormState])

  // Handle successful login after registration
  React.useEffect(() => {
    if (Result.isSuccess(loginResult) && formState.registrationComplete) {
      setFormState(state => ({ ...state, isSubmitting: false }))
      navigate({ to: redirectTo, replace: true })
    }
  }, [loginResult, formState.registrationComplete, navigate, redirectTo, setFormState])

  // Handle login error after registration (rare but possible)
  React.useEffect(() => {
    if (Result.isFailure(loginResult) && formState.registrationComplete) {
      // Registration succeeded but auto-login failed - redirect to login page
      setFormState(state => ({ ...state, isSubmitting: false }))
      navigate({ to: "/login", search: { redirect: redirectTo }, replace: true })
    }
  }, [loginResult, formState.registrationComplete, navigate, redirectTo, setFormState])

  // Handle registration error
  React.useEffect(() => {
    if (Result.isFailure(registerResult) && formState.isSubmitting && !formState.registrationComplete) {
      let errorMessage = "Registration failed. Please try again."
      let fieldError: { field: string; message: string } | null = null

      const errorOption = Cause.failureOption(registerResult.cause)

      Option.match(errorOption, {
        onNone: () => {
          // Keep default error message
        },
        onSome: (error) => {
          const isTaggedError = (e: unknown): e is { _tag: string; message?: string; email?: string; field?: unknown } =>
            e !== null && typeof e === "object" && "_tag" in e

          if (isTaggedError(error)) {
            switch (error._tag) {
              case "UserExistsError":
                fieldError = { field: "email", message: "This email is already registered" }
                break
              case "AuthValidationError":
                // Check if it's a field-specific error
                if (error.field && typeof error.field === "object" && "_tag" in error.field && error.field._tag === "Some" && "value" in error.field) {
                  const fieldValueRaw = error.field.value
                  const fieldValue = typeof fieldValueRaw === "string" ? fieldValueRaw : String(fieldValueRaw)
                  fieldError = { field: fieldValue, message: error.message ?? "Validation error" }
                } else {
                  errorMessage = error.message ?? errorMessage
                }
                break
              case "PasswordWeakError":
                fieldError = { field: "password", message: error.message ?? "Password is too weak" }
                break
              default:
                errorMessage = error.message ?? errorMessage
            }
          }
        }
      })

      if (fieldError) {
        setFormState(state => ({
          ...state,
          isSubmitting: false,
          [`${fieldError!.field}Error`]: fieldError!.message
        }))
      } else {
        setFormState(state => ({
          ...state,
          isSubmitting: false,
          generalError: errorMessage
        }))
      }
    }
  }, [registerResult, formState.isSubmitting, formState.registrationComplete, setFormState])

  // Validation functions
  const validateEmail = (email: string): string | null => {
    if (!email.trim()) {
      return "Email is required"
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address"
    }
    return null
  }

  const validateDisplayName = (name: string): string | null => {
    if (!name.trim()) {
      return "Display name is required"
    }
    if (name.trim().length < 2) {
      return "Display name must be at least 2 characters"
    }
    return null
  }

  const validatePassword = (password: string): string | null => {
    if (!password) {
      return "Password is required"
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters"
    }
    return null
  }

  const validateConfirmPassword = (confirmPassword: string, password: string): string | null => {
    if (!confirmPassword) {
      return "Please confirm your password"
    }
    if (confirmPassword !== password) {
      return "Passwords do not match"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    // Clear previous errors
    setFormState(state => ({
      ...state,
      emailError: null,
      displayNameError: null,
      passwordError: null,
      confirmPasswordError: null,
      generalError: null
    }))

    // Validate all fields
    const emailError = validateEmail(formState.email)
    const displayNameError = validateDisplayName(formState.displayName)
    const passwordError = validatePassword(formState.password)
    const confirmPasswordError = validateConfirmPassword(formState.confirmPassword, formState.password)

    if (emailError || displayNameError || passwordError || confirmPasswordError) {
      setFormState(state => ({
        ...state,
        emailError,
        displayNameError,
        passwordError,
        confirmPasswordError
      }))
      return
    }

    // Submit
    setFormState(state => ({ ...state, isSubmitting: true, registrationComplete: false }))

    const input: RegisterInput = {
      email: formState.email.trim(),
      password: formState.password,
      displayName: formState.displayName.trim()
    }

    executeRegister(input)
  }

  const isLoading = formState.isSubmitting || Result.isWaiting(registerResult) || Result.isWaiting(loginResult)

  return (
    <form style={formStyles} onSubmit={handleSubmit} noValidate>
      {formState.generalError && (
        <div style={errorAlertStyles} role="alert" aria-live="polite">
          {formState.generalError}
        </div>
      )}

      {/* Email Field */}
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

      {/* Display Name Field */}
      <div>
        <label htmlFor="displayName" style={labelStyles}>
          Display Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          value={formState.displayName}
          onChange={e =>
            setFormState(state => ({ ...state, displayName: e.target.value }))
          }
          onBlur={e => {
            const error = validateDisplayName(e.target.value)
            setFormState(state => ({ ...state, displayNameError: error }))
          }}
          style={formState.displayNameError ? inputErrorStyles : inputStyles}
          placeholder="John Doe"
          aria-invalid={formState.displayNameError !== null}
          aria-describedby={formState.displayNameError ? "displayName-error" : undefined}
          disabled={isLoading}
        />
        {formState.displayNameError && (
          <div id="displayName-error" style={fieldErrorStyles} role="alert">
            {formState.displayNameError}
          </div>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label htmlFor="password" style={labelStyles}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={formState.password}
          onChange={e =>
            setFormState(state => ({ ...state, password: e.target.value }))
          }
          onBlur={e => {
            const error = validatePassword(e.target.value)
            setFormState(state => ({ ...state, passwordError: error }))
          }}
          style={formState.passwordError ? inputErrorStyles : inputStyles}
          placeholder="Enter a strong password"
          aria-invalid={formState.passwordError !== null}
          aria-describedby={formState.passwordError ? "password-error" : "password-strength"}
          disabled={isLoading}
        />
        {formState.passwordError && (
          <div id="password-error" style={fieldErrorStyles} role="alert">
            {formState.passwordError}
          </div>
        )}
        <div id="password-strength">
          <PasswordStrengthIndicator password={formState.password} />
        </div>
      </div>

      {/* Confirm Password Field */}
      <div>
        <label htmlFor="confirmPassword" style={labelStyles}>
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={formState.confirmPassword}
          onChange={e =>
            setFormState(state => ({ ...state, confirmPassword: e.target.value }))
          }
          onBlur={e => {
            const error = validateConfirmPassword(e.target.value, formState.password)
            setFormState(state => ({ ...state, confirmPasswordError: error }))
          }}
          style={formState.confirmPasswordError ? inputErrorStyles : inputStyles}
          placeholder="Confirm your password"
          aria-invalid={formState.confirmPasswordError !== null}
          aria-describedby={formState.confirmPasswordError ? "confirmPassword-error" : undefined}
          disabled={isLoading}
        />
        {formState.confirmPasswordError && (
          <div id="confirmPassword-error" style={fieldErrorStyles} role="alert">
            {formState.confirmPasswordError}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        style={isLoading ? primaryButtonDisabledStyles : primaryButtonStyles}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  )
}

// =============================================================================
// Main Register Page Component
// =============================================================================

function RegisterPage(): React.ReactElement {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const providersResult = useAtomValue(enabledProvidersAtom)
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const setFormState = useAtomSet(registerFormAtom)

  const redirectTo = search.redirect ?? "/"

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: redirectTo, replace: true })
    }
  }, [isAuthenticated, navigate, redirectTo])

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
          <div style={loadingStyles}>Loading...</div>
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
            Unable to load registration options. Please refresh the page.
          </div>
        </div>
      </div>
    )
  }

  const providers = providersResult.value

  // Check if local provider is enabled and supports registration
  const localProvider = providers.find(
    p => p.type === "local" && p.supportsRegistration
  )

  // If local provider is not enabled, redirect to login
  if (!localProvider) {
    return (
      <div style={pageStyles}>
        <div style={cardStyles}>
          <h1 style={titleStyles}>Registration Unavailable</h1>
          <p style={subtitleStyles}>
            User registration is not currently available. Please contact your
            administrator or sign in with an existing account.
          </p>
          <div style={footerStyles}>
            <Link to="/login" style={linkStyles}>
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyles}>
      <div style={cardStyles}>
        <h1 style={titleStyles}>Create Account</h1>
        <p style={subtitleStyles}>Fill in your details to get started.</p>

        <RegisterForm redirectTo={redirectTo} />

        <div style={footerStyles}>
          Already have an account?{" "}
          <Link to="/login" search={{ redirect: redirectTo }} style={linkStyles}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
