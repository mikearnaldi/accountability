import { createFileRoute, redirect, useRouter, useNavigate } from "@tanstack/react-router"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { api } from "@/api/client"

// =============================================================================
// Login Route
// =============================================================================

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    // If user is already authenticated, redirect following Post-Login Flow
    // The home route (/) handles this redirect logic, so just redirect there
    if (context.user) {
      throw redirect({ to: "/" })
    }
  },
  component: LoginPage
})

function LoginPage() {
  const router = useRouter()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return // Prevent double submission

    setIsSubmitting(true)
    setError(null)

    try {
      const { data, error: apiError } = await api.POST("/api/auth/login", {
        body: {
          provider: "local",
          credentials: {
            email,
            password
          }
        }
      })

      if (apiError) {
        // Extract user-friendly error message
        let errorMessage = "Invalid email or password"

        // Check if error is an HttpApiDecodeError
        if (typeof apiError === "object" && apiError !== null) {
          if ("message" in apiError && typeof apiError.message === "string") {
            errorMessage = apiError.message
          }
        }

        setError(errorMessage)
        setPassword("") // Clear password but keep email
        setIsSubmitting(false)
        return
      }

      if (!data) {
        setError("Login failed. Please try again.")
        setIsSubmitting(false)
        return
      }

      // Cookie is set by the server via Set-Cookie header
      // No token storage needed - httpOnly cookies are sent automatically

      // Check for explicit redirect query parameter
      const searchParams = new URLSearchParams(window.location.search)
      let redirectTo = searchParams.get("redirect")

      // If no explicit redirect, determine destination based on org count
      if (!redirectTo) {
        // Fetch organizations to determine redirect
        const orgsResult = await api.GET("/api/v1/organizations")
        const orgs = orgsResult.data?.organizations ?? []

        if (orgs.length === 0) {
          redirectTo = "/organizations/new"
        } else if (orgs.length === 1) {
          redirectTo = `/organizations/${orgs[0].id}/dashboard`
        } else {
          redirectTo = "/organizations"
        }
      }

      // Invalidate to refresh user context
      await router.invalidate()

      // Navigate to redirect destination
      navigate({ to: redirectTo })
    } catch {
      setError("An unexpected error occurred. Please try again.")
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
            Sign In
          </h2>

          {/* Error Message */}
          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
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
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
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
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
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
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing In...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
