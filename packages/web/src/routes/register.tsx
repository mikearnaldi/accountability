/**
 * Register Page Route
 *
 * Public route for user registration with local provider.
 * Redirects to home if already authenticated.
 */

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Option from "effect/Option"
import { hasTokenAtom, registerMutation } from "../atoms/auth.ts"
import * as React from "react"

// Search params interface for redirect handling
export interface RegisterSearch {
  redirect?: string
}

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

// Password strength requirements
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_REQUIREMENTS = [
  { test: (p: string) => p.length >= PASSWORD_MIN_LENGTH, message: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { test: (p: string) => /[A-Z]/.test(p), message: "At least one uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), message: "At least one lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), message: "At least one number" },
  { test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p), message: "At least one special character" }
]

function RegisterPage() {
  const hasToken = useAtomValue(hasTokenAtom)
  const navigate = useNavigate()
  const search = useSearch({ from: "/register" })
  const redirectTo = search.redirect ?? "/"

  // Form state - local state is fine for form input drafts
  const [email, setEmail] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  // Validation state
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [displayNameError, setDisplayNameError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = React.useState<string | null>(null)

  // Register mutation with promise mode for navigation after success
  const [registerResult, register] = useAtom(registerMutation, { mode: "promise" })

  // Track previous waiting state to detect success completion
  const prevWaiting = React.useRef(false)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (hasToken) {
      navigate({ to: redirectTo })
    }
  }, [hasToken, navigate, redirectTo])

  // Detect successful registration completion and redirect
  React.useEffect(() => {
    const wasWaiting = prevWaiting.current
    const isNowSuccess = Result.isSuccess(registerResult) && !Result.isWaiting(registerResult)
    prevWaiting.current = Result.isWaiting(registerResult)

    if (wasWaiting && isNowSuccess) {
      // Registration and auto-login completed successfully, redirect
      navigate({ to: redirectTo })
    }
  }, [registerResult, navigate, redirectTo])

  // Validate email
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

  // Validate display name
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

  // Validate password strength
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

  // Validate password confirmation
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

    // Validate all fields
    const emailValid = validateEmail(email)
    const displayNameValid = validateDisplayName(displayName)
    const passwordValid = validatePassword(password)
    const confirmPasswordValid = validateConfirmPassword(confirmPassword)

    if (!emailValid || !displayNameValid || !passwordValid || !confirmPasswordValid) {
      return
    }

    // Perform registration
    try {
      await register({ email, password, displayName })
      // Navigation happens in the useEffect above after result updates
    } catch {
      // Error is captured in registerResult - no need to handle here
    }
  }

  // Get error message from Result
  const getErrorMessage = (): string | null => {
    if (!Result.isFailure(registerResult)) {
      return null
    }
    // Extract error message from Cause
    const cause = registerResult.cause
    const failures = Cause.failures(cause)
    const firstFailure = Chunk.head(failures)

    if (Option.isSome(firstFailure)) {
      const error = firstFailure.value
      // Check for specific error types using type guard
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

  const isLoading = Result.isWaiting(registerResult)
  const errorMessage = getErrorMessage()

  // If authenticated, don't render the form
  if (hasToken) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="mt-2 text-gray-600">
            Register for a new account to get started
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg bg-white p-8 shadow-sm space-y-6"
          data-testid="register-form"
        >
          {/* Error Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
              data-testid="register-error"
            >
              {errorMessage}
            </div>
          )}

          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) validateEmail(e.target.value)
              }}
              onBlur={() => validateEmail(email)}
              className={`
                w-full rounded-md border px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${emailError ? "border-red-500" : "border-gray-300"}
              `}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              data-testid="register-email"
            />
            {emailError && (
              <p className="mt-1 text-sm text-red-600" data-testid="register-email-error">
                {emailError}
              </p>
            )}
          </div>

          {/* Display Name Field */}
          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                if (displayNameError) validateDisplayName(e.target.value)
              }}
              onBlur={() => validateDisplayName(displayName)}
              className={`
                w-full rounded-md border px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${displayNameError ? "border-red-500" : "border-gray-300"}
              `}
              placeholder="John Doe"
              autoComplete="name"
              disabled={isLoading}
              data-testid="register-display-name"
            />
            {displayNameError && (
              <p className="mt-1 text-sm text-red-600" data-testid="register-display-name-error">
                {displayNameError}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordError) validatePassword(e.target.value)
                // Also revalidate confirm password if it's filled
                if (confirmPassword && confirmPasswordError) {
                  validateConfirmPassword(confirmPassword)
                }
              }}
              onBlur={() => validatePassword(password)}
              className={`
                w-full rounded-md border px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${passwordError ? "border-red-500" : "border-gray-300"}
              `}
              placeholder="Create a strong password"
              autoComplete="new-password"
              disabled={isLoading}
              data-testid="register-password"
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-600" data-testid="register-password-error">
                {passwordError}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (confirmPasswordError) validateConfirmPassword(e.target.value)
              }}
              onBlur={() => validateConfirmPassword(confirmPassword)}
              className={`
                w-full rounded-md border px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${confirmPasswordError ? "border-red-500" : "border-gray-300"}
              `}
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={isLoading}
              data-testid="register-confirm-password"
            />
            {confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600" data-testid="register-confirm-password-error">
                {confirmPasswordError}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`
              w-full rounded-md px-4 py-2 text-white font-medium
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isLoading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
              }
            `}
            data-testid="register-submit"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            search={redirectTo !== "/" ? { redirect: redirectTo } : {}}
            className="font-medium text-blue-600 hover:text-blue-500"
            data-testid="register-login-link"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
