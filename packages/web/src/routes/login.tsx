/**
 * Login Page Route
 *
 * Public route for user authentication.
 * Features:
 * - Centered card layout with branded design
 * - Professional input styling with error states
 * - Loading spinner during authentication
 * - Status messages for password changes and session expiry
 */

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useAtomValue, useAtom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Option from "effect/Option"
import { hasTokenAtom, loginMutation } from "../atoms/auth.ts"
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

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

// =============================================================================
// Types
// =============================================================================

export interface LoginSearch {
  redirect?: string
  message?: "password_changed" | "session_expired"
}

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const result: LoginSearch = {}
    if (typeof search.redirect === "string") {
      result.redirect = search.redirect
    }
    if (search.message === "password_changed") {
      result.message = "password_changed"
    } else if (search.message === "session_expired") {
      result.message = "session_expired"
    }
    return result
  },
  component: LoginPage
})

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusMessage(message?: LoginSearch["message"]): { type: "success" | "info"; text: string } | null {
  switch (message) {
    case "password_changed":
      return {
        type: "success",
        text: "Password changed successfully. Please sign in with your new password."
      }
    case "session_expired":
      return {
        type: "info",
        text: "Your session has expired. Please sign in again."
      }
    default:
      return null
  }
}

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
// LoginPage Component
// =============================================================================

function LoginPage() {
  const hasToken = useAtomValue(hasTokenAtom)
  const navigate = useNavigate()
  const search = useSearch({ from: "/login" })
  const redirectTo = search.redirect ?? "/"

  // Form state
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  // Validation state
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  // Login mutation with promise mode
  const [loginResult, login] = useAtom(loginMutation, { mode: "promise" })

  // Track state transitions
  const prevWaiting = React.useRef(false)
  const formInteractionRef = React.useRef(false)

  // Redirect if already authenticated
  React.useEffect(() => {
    if (hasToken && !search.message) {
      const timer = setTimeout(() => {
        if (!formInteractionRef.current) {
          navigate({ to: redirectTo })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [hasToken, navigate, redirectTo, search.message])

  // Detect successful login and redirect
  React.useEffect(() => {
    const wasWaiting = prevWaiting.current
    const isNowSuccess = Result.isSuccess(loginResult) && !Result.isWaiting(loginResult)
    prevWaiting.current = Result.isWaiting(loginResult)

    if (wasWaiting && isNowSuccess) {
      navigate({ to: redirectTo })
    }
  }, [loginResult, navigate, redirectTo])

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

    const emailValid = validateEmail(email)
    const passwordValid = validatePassword(password)

    if (!emailValid || !passwordValid) {
      return
    }

    try {
      await login({ email, password })
    } catch {
      // Error captured in loginResult
    }
  }

  // Extract error message from Result
  const getErrorMessage = (): string | null => {
    if (!Result.isFailure(loginResult)) {
      return null
    }
    const cause = loginResult.cause
    const failures = Cause.failures(cause)
    const firstFailure = Chunk.head(failures)

    if (Option.isSome(firstFailure)) {
      const error = firstFailure.value
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

  const isLoading = Result.isWaiting(loginResult)
  const errorMessage = getErrorMessage()
  const statusMessage = getStatusMessage(search.message)

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
            Sign In
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <Alert
            variant={statusMessage.type === "success" ? "success" : "info"}
            data-testid="login-status-message"
          >
            {statusMessage.text}
          </Alert>
        )}

        {/* Login Card */}
        <div className="rounded-2xl bg-white p-8 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            {/* Error Alert */}
            {errorMessage && (
              <Alert variant="error" data-testid="login-error">
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
                formInteractionRef.current = true
                setEmail(e.target.value)
                if (emailError) validateEmail(e.target.value)
              }}
              onBlur={() => validateEmail(email)}
              onFocus={() => { formInteractionRef.current = true }}
              error={emailError ?? undefined}
              errorTestId="login-email-error"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              leftIcon={<EnvelopeIcon />}
              data-testid="login-email"
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
              }}
              onBlur={() => validatePassword(password)}
              error={passwordError ?? undefined}
              errorTestId="login-password-error"
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
              leftIcon={<LockIcon />}
              data-testid="login-password"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              className="w-full"
              data-testid="login-submit"
            >
              Sign in
            </Button>
          </form>
        </div>

        {/* Register Link */}
        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            search={redirectTo !== "/" ? { redirect: redirectTo } : {}}
            className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            data-testid="login-register-link"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
