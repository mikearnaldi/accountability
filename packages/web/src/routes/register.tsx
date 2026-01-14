/**
 * Register Page Route
 *
 * Public route for user registration.
 * Features:
 * - Centered card layout with branded design
 * - Professional input styling with error states
 * - Password strength requirements shown while typing
 * - Loading spinner during registration
 * - Auto-focus on first field
 * - Show/hide password toggle
 * - Caps Lock indicator
 * - Clickable logo linking to home
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

function EyeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function EyeSlashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="6" />
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
  { test: (p: string) => p.length >= PASSWORD_MIN_LENGTH, label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "One number" },
  { test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p), label: "One special character" }
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
// Password Requirements Component
// =============================================================================

function PasswordRequirements({
  password,
  show
}: {
  password: string
  show: boolean
}) {
  if (!show) return null

  return (
    <ul className="mt-2 space-y-1 text-sm" data-testid="password-requirements">
      {PASSWORD_REQUIREMENTS.map((req, index) => {
        const passed = req.test(password)
        return (
          <li
            key={index}
            className={`flex items-center gap-2 ${passed ? "text-green-600" : "text-gray-500"}`}
          >
            {passed ? (
              <CheckIcon className="h-4 w-4 flex-shrink-0" />
            ) : (
              <CircleIcon className="h-4 w-4 flex-shrink-0" />
            )}
            {req.label}
          </li>
        )
      })}
    </ul>
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

  // Validation state
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [displayNameError, setDisplayNameError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  // UI state
  const [showPassword, setShowPassword] = React.useState(false)
  const [capsLockOn, setCapsLockOn] = React.useState(false)
  const [passwordFocused, setPasswordFocused] = React.useState(false)

  // Refs
  const emailInputRef = React.useRef<HTMLInputElement>(null)

  // Register mutation with promise mode
  const [registerResult, register] = useAtom(registerMutation, { mode: "promise" })

  // Track state transitions
  const prevWaiting = React.useRef(false)

  // Auto-focus email input on mount (only if not already authenticated)
  React.useEffect(() => {
    if (!hasToken) {
      const timer = setTimeout(() => {
        emailInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hasToken])

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

    const allPassed = PASSWORD_REQUIREMENTS.every(req => req.test(value))
    if (!allPassed) {
      setPasswordError("Password does not meet all requirements")
      return false
    }

    setPasswordError(null)
    return true
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const emailValid = validateEmail(email)
    const displayNameValid = validateDisplayName(displayName)
    const passwordValid = validatePassword(password)

    if (!emailValid || !displayNameValid || !passwordValid) {
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
        return "An account with this email already exists. Sign in instead?"
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
        {/* Logo and Title - Logo links to home */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex flex-col items-center gap-2 mb-6 transition-transform hover:scale-105"
            data-testid="register-logo-link"
          >
            <LogoIcon />
            <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
              Accountability
            </span>
          </Link>
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

            {/* Email Field - auto-focused */}
            <Input
              ref={emailInputRef}
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

            {/* Password Field with show/hide toggle, caps lock indicator, and requirements */}
            <div className="space-y-1">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError(null)
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => {
                  setPasswordFocused(false)
                  validatePassword(password)
                }}
                onKeyDown={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
                error={passwordError ?? undefined}
                errorTestId="register-password-error"
                placeholder="Create a strong password"
                autoComplete="new-password"
                disabled={isLoading}
                leftIcon={<LockIcon />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    data-testid="register-password-toggle"
                  >
                    {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                }
                data-testid="register-password"
              />
              {capsLockOn && (
                <p className="text-amber-600 text-sm flex items-center gap-1" data-testid="caps-lock-warning">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Caps Lock is on
                </p>
              )}
              {/* Password requirements shown while typing */}
              <PasswordRequirements
                password={password}
                show={passwordFocused && password.length > 0}
              />
            </div>

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
