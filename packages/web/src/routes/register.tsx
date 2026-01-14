/**
 * Register Page Route
 *
 * Public route for user registration.
 * Features:
 * - Centered card layout with branded design
 * - Professional input styling with error states
 * - Password strength requirements
 * - Loading spinner during registration
 */

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Option from "effect/Option"
import { hasTokenAtom, registerMutation } from "../atoms/auth.ts"
import { Button } from "../components/ui/Button.tsx"
import { Input } from "../components/ui/Input.tsx"
import { Alert } from "../components/ui/Alert.tsx"
import * as React from "react"

// =============================================================================
// Icons
// =============================================================================

function LogoIcon() {
  return (
    <svg className="h-12 w-12" viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="6" className="fill-indigo-600" />
      <path d="M9 22V10h4l3 8 3-8h4v12h-3v-8l-3 8h-2l-3-8v8H9z" className="fill-white" />
    </svg>
  )
}

function EnvelopeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}

// =============================================================================
// Types
// =============================================================================

export interface RegisterSearch {
  redirect?: string
}

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): RegisterSearch => {
    const result: RegisterSearch = {}
    if (typeof search.redirect === "string") {
      result.redirect = search.redirect
    }
    return result
  },
  component: RegisterPage
})

// =============================================================================
// Constants
// =============================================================================

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_REQUIREMENTS = [
  { test: (p: string) => p.length >= PASSWORD_MIN_LENGTH, message: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { test: (p: string) => /[A-Z]/.test(p), message: "At least one uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), message: "At least one lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), message: "At least one number" },
  { test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p), message: "At least one special character" }
]

// =============================================================================
// Helper Functions
// =============================================================================

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

// =============================================================================
// RegisterPage Component
// =============================================================================

function RegisterPage() {
  const hasToken = useAtomValue(hasTokenAtom)
  const navigate = useNavigate()
  const search = useSearch({ from: "/register" })
  const redirectTo = search.redirect ?? "/"

  // Form state
  const [email, setEmail] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  // Validation state
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [displayNameError, setDisplayNameError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = React.useState<string | null>(null)

  // Register mutation with promise mode
  const [registerResult, register] = useAtom(registerMutation, { mode: "promise" })

  // Track state transitions
  const prevWaiting = React.useRef(false)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (hasToken) {
      navigate({ to: redirectTo })
    }
  }, [hasToken, navigate, redirectTo])

  // Detect successful registration and redirect
  React.useEffect(() => {
    const wasWaiting = prevWaiting.current
    const isNowSuccess = Result.isSuccess(registerResult) && !Result.isWaiting(registerResult)
    prevWaiting.current = Result.isWaiting(registerResult)

    if (wasWaiting && isNowSuccess) {
      navigate({ to: redirectTo })
    }
  }, [registerResult, navigate, redirectTo])

  // Validation functions
  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("Email is required")
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError("Please enter a valid email address")
      return false
    }
    setEmailError(null)
    return true
  }

  const validateDisplayName = (value: string): boolean => {
    if (!value.trim()) {
      setDisplayNameError("Display name is required")
      return false
    }
    if (value.trim().length < 2) {
      setDisplayNameError("Display name must be at least 2 characters")
      return false
    }
    setDisplayNameError(null)
    return true
  }

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError("Password is required")
      return false
    }

    const failedRequirements = PASSWORD_REQUIREMENTS
      .filter(req => !req.test(value))
      .map(req => req.message)

    if (failedRequirements.length > 0) {
      setPasswordError(`Password must have: ${failedRequirements.join(", ")}`)
      return false
    }

    setPasswordError(null)
    return true
  }

  const validateConfirmPassword = (value: string): boolean => {
    if (!value) {
      setConfirmPasswordError("Please confirm your password")
      return false
    }
    if (value !== password) {
      setConfirmPasswordError("Passwords do not match")
      return false
    }
    setConfirmPasswordError(null)
    return true
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const emailValid = validateEmail(email)
    const displayNameValid = validateDisplayName(displayName)
    const passwordValid = validatePassword(password)
    const confirmPasswordValid = validateConfirmPassword(confirmPassword)

    if (!emailValid || !displayNameValid || !passwordValid || !confirmPasswordValid) {
      return
    }

    try {
      await register({ email, password, displayName })
    } catch {
      // Error captured in registerResult
    }
  }

  // Extract error message from Result
  const getErrorMessage = (): string | null => {
    if (!Result.isFailure(registerResult)) {
      return null
    }
    const cause = registerResult.cause
    const failures = Cause.failures(cause)
    const firstFailure = Chunk.head(failures)

    if (Option.isSome(firstFailure)) {
      const error = firstFailure.value
      if (isErrorWithTag(error, "UserExistsError")) {
        return "An account with this email already exists"
      }
      if (isErrorWithTag(error, "PasswordWeakError")) {
        return "Password does not meet security requirements"
      }
      if (isErrorWithTag(error, "AuthValidationError")) {
        return "Please check your input and try again"
      }
      if (isErrorWithMessage(error)) {
        return error.message
      }
      return String(error)
    }
    return "Registration failed. Please try again."
  }

  const isLoading = Result.isWaiting(registerResult)
  const errorMessage = getErrorMessage()

  // If authenticated, don't render the form
  if (hasToken) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-indigo-50 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-100 opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-100 opacity-50 blur-3xl" />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <LogoIcon />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Create Account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Get started with your accounting journey
          </p>
        </div>

        {/* Register Card */}
        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
            {/* Error Alert */}
            {errorMessage && (
              <Alert variant="error" data-testid="register-error">
                {errorMessage}
              </Alert>
            )}

            {/* Email Field */}
            <Input
              label="Email address"
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) validateEmail(e.target.value)
              }}
              onBlur={() => validateEmail(email)}
              error={emailError ?? undefined}
              errorTestId="register-email-error"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              leftIcon={<EnvelopeIcon />}
              data-testid="register-email"
            />

            {/* Display Name Field */}
            <Input
              label="Display name"
              type="text"
              id="displayName"
              name="displayName"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                if (displayNameError) validateDisplayName(e.target.value)
              }}
              onBlur={() => validateDisplayName(displayName)}
              error={displayNameError ?? undefined}
              errorTestId="register-display-name-error"
              placeholder="John Doe"
              autoComplete="name"
              disabled={isLoading}
              leftIcon={<UserIcon />}
              data-testid="register-display-name"
            />

            {/* Password Field */}
            <Input
              label="Password"
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordError) validatePassword(e.target.value)
                if (confirmPassword && confirmPasswordError) {
                  validateConfirmPassword(confirmPassword)
                }
              }}
              onBlur={() => validatePassword(password)}
              error={passwordError ?? undefined}
              errorTestId="register-password-error"
              placeholder="Create a strong password"
              autoComplete="new-password"
              disabled={isLoading}
              leftIcon={<LockIcon />}
              data-testid="register-password"
            />

            {/* Confirm Password Field */}
            <Input
              label="Confirm password"
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (confirmPasswordError) validateConfirmPassword(e.target.value)
              }}
              onBlur={() => validateConfirmPassword(confirmPassword)}
              error={confirmPasswordError ?? undefined}
              errorTestId="register-confirm-password-error"
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={isLoading}
              leftIcon={<ShieldCheckIcon />}
              data-testid="register-confirm-password"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              className="w-full"
              data-testid="register-submit"
            >
              Create account
            </Button>
          </form>
        </div>

        {/* Login Link */}
        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            search={redirectTo !== "/" ? { redirect: redirectTo } : {}}
            className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            data-testid="register-login-link"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
