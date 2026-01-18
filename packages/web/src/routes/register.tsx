import { createFileRoute, redirect, useRouter, useNavigate } from "@tanstack/react-router"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { api } from "@/api/client"

// =============================================================================
// Registration Route
// =============================================================================

export const Route = createFileRoute("/register")({
  beforeLoad: async ({ context }) => {
    // If user is already authenticated, redirect to home
    if (context.user !== null) {
      throw redirect({ to: "/" })
    }
  },
  component: RegisterPage
})

// =============================================================================
// Validation Helpers
// =============================================================================

interface ValidationState {
  readonly email: string | null
  readonly displayName: string | null
  readonly password: string | null
}

function validateEmail(email: string): string | null {
  if (email === "") {
    return "Email is required"
  }
  // Basic email regex - server validates more thoroughly
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address"
  }
  return null
}

function validateDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim()
  if (trimmed === "") {
    return "Display name is required"
  }
  if (trimmed.length < 2) {
    return "Display name must be at least 2 characters"
  }
  if (trimmed.length > 100) {
    return "Display name must be less than 100 characters"
  }
  return null
}

interface PasswordValidation {
  readonly hasMinLength: boolean
  readonly hasUppercase: boolean
  readonly hasLowercase: boolean
  readonly hasNumber: boolean
  readonly isValid: boolean
  readonly message: string | null
}

function validatePassword(password: string): PasswordValidation {
  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)

  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber

  let message: string | null = null
  if (password === "") {
    message = "Password is required"
  } else if (!isValid) {
    message = "Password does not meet requirements"
  }

  return { hasMinLength, hasUppercase, hasLowercase, hasNumber, isValid, message }
}

// =============================================================================
// Error Message Extraction
// =============================================================================

/**
 * Safely extracts an error message from an API error response.
 * Uses type narrowing to avoid type assertions.
 */
function getErrorMessage(error: unknown): string {
  const defaultMessage = "Registration failed. Please try again."

  if (typeof error !== "object" || error === null) {
    return defaultMessage
  }

  // Check for _tag property to identify error type
  if ("_tag" in error) {
    const tag = error._tag
    if (typeof tag === "string") {
      if (tag === "UserExistsError") {
        return "An account with this email already exists. Sign in instead?"
      }
      if (tag === "PasswordWeakError") {
        return "Password is too weak. Please choose a stronger password."
      }
      if (tag === "AuthValidationError" || tag === "HttpApiDecodeError") {
        if ("message" in error && typeof error.message === "string") {
          return error.message
        }
      }
    }
  }

  // Check for generic message property
  if ("message" in error && typeof error.message === "string") {
    return error.message
  }

  return defaultMessage
}

// =============================================================================
// Register Page Component
// =============================================================================

function RegisterPage() {
  const router = useRouter()
  const navigate = useNavigate()

  // Form state
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Validation state
  const [errors, setErrors] = useState<ValidationState>({
    email: null,
    displayName: null,
    password: null
  })
  const [apiError, setApiError] = useState<string | null>(null)

  // Track if fields have been touched (for blur validation)
  const [touched, setTouched] = useState({
    email: false,
    displayName: false,
    password: false
  })

  // Password focus state for showing requirements
  const [passwordFocused, setPasswordFocused] = useState(false)

  // Password validation details
  const passwordValidation = validatePassword(password)

  // Handle field blur
  const handleBlur = (field: keyof ValidationState) => {
    setTouched((prev) => ({ ...prev, [field]: true }))

    if (field === "email") {
      setErrors((prev) => ({ ...prev, email: validateEmail(email) }))
    } else if (field === "displayName") {
      setErrors((prev) => ({ ...prev, displayName: validateDisplayName(displayName) }))
    } else if (field === "password") {
      setErrors((prev) => ({ ...prev, password: passwordValidation.message }))
    }
  }

  // Validate all fields
  const validateAll = (): boolean => {
    const emailError = validateEmail(email)
    const displayNameError = validateDisplayName(displayName)
    const passwordError = validatePassword(password).message

    setErrors({
      email: emailError,
      displayName: displayNameError,
      password: passwordError
    })

    setTouched({
      email: true,
      displayName: true,
      password: true
    })

    return emailError === null && displayNameError === null && passwordError === null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return // Prevent double submission

    // Validate all fields before submit
    if (!validateAll()) {
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    try {
      const { error: registerError } = await api.POST("/api/auth/register", {
        body: {
          email,
          password,
          displayName: displayName.trim()
        }
      })

      if (registerError !== undefined) {
        // Handle specific error types
        const errorMessage = getErrorMessage(registerError)
        setApiError(errorMessage)
        setIsSubmitting(false)
        return
      }

      // Registration successful - now auto-login to get session cookie
      const { data: loginData, error: loginError } = await api.POST("/api/auth/login", {
        body: {
          provider: "local",
          credentials: {
            email,
            password
          }
        }
      })

      if (loginError !== undefined || loginData === undefined) {
        // Registration succeeded but login failed - redirect to login page
        navigate({ to: "/login" })
        return
      }

      // Cookie is set by the server via Set-Cookie header
      // No token storage needed - httpOnly cookies are sent automatically

      // Invalidate to refresh user context
      await router.invalidate()

      // Navigate to home page (auto-login successful)
      navigate({ to: "/" })
    } catch {
      setApiError("An unexpected error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <Link to="/" className="mb-8 flex justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Accountability</h1>
          </div>
        </Link>

        {/* Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          {/* Heading */}
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">
            Create Account
          </h2>

          {/* API Error Message */}
          {apiError && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoFocus
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  // Clear error when user starts typing
                  if (touched.email) {
                    setErrors((prev) => ({ ...prev, email: null }))
                  }
                }}
                onBlur={() => handleBlur("email")}
                disabled={isSubmitting}
                placeholder="you@example.com"
                aria-describedby={touched.email && errors.email !== null ? "email-error" : undefined}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500 ${
                  touched.email && errors.email !== null
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                }`}
              />
              {touched.email && errors.email !== null && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Display Name Field */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  if (touched.displayName) {
                    setErrors((prev) => ({ ...prev, displayName: null }))
                  }
                }}
                onBlur={() => handleBlur("displayName")}
                disabled={isSubmitting}
                placeholder="Your name"
                aria-describedby={touched.displayName && errors.displayName !== null ? "displayName-error" : undefined}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500 ${
                  touched.displayName && errors.displayName !== null
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                }`}
              />
              {touched.displayName && errors.displayName !== null && (
                <p id="displayName-error" className="mt-1 text-sm text-red-600">
                  {errors.displayName}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (touched.password) {
                      setErrors((prev) => ({ ...prev, password: null }))
                    }
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => {
                    setPasswordFocused(false)
                    handleBlur("password")
                  }}
                  disabled={isSubmitting}
                  placeholder="••••••••"
                  aria-describedby={
                    touched.password && errors.password !== null
                      ? "password-error"
                      : passwordFocused && password.length > 0
                        ? "password-requirements"
                        : undefined
                  }
                  className={`w-full rounded-lg border px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-500 ${
                    touched.password && errors.password !== null
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:text-gray-300"
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Password Requirements - shown while focused and typing */}
              {passwordFocused && password.length > 0 && (
                <ul id="password-requirements" className="mt-2 space-y-1 text-sm">
                  <li className={passwordValidation.hasMinLength ? "text-green-600" : "text-gray-500"}>
                    {passwordValidation.hasMinLength ? "✓" : "○"} At least 8 characters
                  </li>
                  <li className={passwordValidation.hasUppercase ? "text-green-600" : "text-gray-500"}>
                    {passwordValidation.hasUppercase ? "✓" : "○"} One uppercase letter
                  </li>
                  <li className={passwordValidation.hasLowercase ? "text-green-600" : "text-gray-500"}>
                    {passwordValidation.hasLowercase ? "✓" : "○"} One lowercase letter
                  </li>
                  <li className={passwordValidation.hasNumber ? "text-green-600" : "text-gray-500"}>
                    {passwordValidation.hasNumber ? "✓" : "○"} One number
                  </li>
                </ul>
              )}

              {/* Password Error */}
              {touched.password && errors.password !== null && !passwordFocused && (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
