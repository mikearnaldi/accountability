/**
 * Login Page Route
 *
 * Public route for user authentication.
 * Redirects to home if already authenticated.
 */

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Option from "effect/Option"
import { hasTokenAtom, loginMutation } from "../atoms/auth.ts"
import * as React from "react"

// Search params type for redirect handling
export interface LoginSearch {
  redirect?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const result: LoginSearch = {}
    if (typeof search.redirect === "string") {
      result.redirect = search.redirect
    }
    return result
  },
  component: LoginPage
})

function LoginPage() {
  const hasToken = useAtomValue(hasTokenAtom)
  const navigate = useNavigate()
  const search = useSearch({ from: "/login" })
  const redirectTo = search.redirect ?? "/"

  // Form state - local state is fine for form input drafts
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  // Validation state
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  // Login mutation with promise mode for navigation after success
  const [loginResult, login] = useAtom(loginMutation, { mode: "promise" })

  // Track previous waiting state to detect success completion
  const prevWaiting = React.useRef(false)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (hasToken) {
      navigate({ to: redirectTo })
    }
  }, [hasToken, navigate, redirectTo])

  // Detect successful login completion and redirect
  React.useEffect(() => {
    const wasWaiting = prevWaiting.current
    const isNowSuccess = Result.isSuccess(loginResult) && !Result.isWaiting(loginResult)
    prevWaiting.current = Result.isWaiting(loginResult)

    if (wasWaiting && isNowSuccess) {
      // Login completed successfully, redirect
      navigate({ to: redirectTo })
    }
  }, [loginResult, navigate, redirectTo])

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

  // Validate password
  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError("Password is required")
      return false
    }
    if (value.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return false
    }
    setPasswordError(null)
    return true
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate fields
    const emailValid = validateEmail(email)
    const passwordValid = validatePassword(password)

    if (!emailValid || !passwordValid) {
      return
    }

    // Perform login
    try {
      await login({ email, password })
      // Navigation happens in the useEffect above after result updates
    } catch {
      // Error is captured in loginResult - no need to handle here
    }
  }

  // Get error message from Result
  const getErrorMessage = (): string | null => {
    if (!Result.isFailure(loginResult)) {
      return null
    }
    // Extract error message from Cause
    const cause = loginResult.cause
    const failures = Cause.failures(cause)
    const firstFailure = Chunk.head(failures)

    if (Option.isSome(firstFailure)) {
      const error = firstFailure.value
      // Check for specific error types using type guard
      if (isErrorWithTag(error, "AuthUnauthorizedError")) {
        return "Invalid email or password"
      }
      if (isErrorWithMessage(error)) {
        return error.message
      }
      return String(error)
    }
    return "Login failed. Please try again."
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

  const isLoading = Result.isWaiting(loginResult)
  const errorMessage = getErrorMessage()

  // If authenticated, don't render the form
  if (hasToken) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Sign In</h1>
          <p className="mt-2 text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg bg-white p-8 shadow-sm space-y-6"
          data-testid="login-form"
        >
          {/* Error Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
              data-testid="login-error"
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
              data-testid="login-email"
            />
            {emailError && (
              <p className="mt-1 text-sm text-red-600" data-testid="login-email-error">
                {emailError}
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
              }}
              onBlur={() => validatePassword(password)}
              className={`
                w-full rounded-md border px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${passwordError ? "border-red-500" : "border-gray-300"}
              `}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              data-testid="login-password"
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-600" data-testid="login-password-error">
                {passwordError}
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
            data-testid="login-submit"
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
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            search={redirectTo !== "/" ? { redirect: redirectTo } : {}}
            className="font-medium text-blue-600 hover:text-blue-500"
            data-testid="login-register-link"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
