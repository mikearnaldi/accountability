/**
 * Register Page Route
 *
 * Public route for user registration.
 * Redirects to home if already authenticated.
 */

import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import { hasTokenAtom } from "../atoms/auth.ts"
import * as React from "react"

// Search params interface for redirect handling
interface RegisterSearch {
  redirect?: string
}

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined
  }),
  component: RegisterPage
})

function RegisterPage() {
  const hasToken = useAtomValue(hasTokenAtom)
  const navigate = useNavigate()
  const search = useSearch({ from: "/register" })
  const redirectTo = search.redirect ?? "/"

  // Redirect if already authenticated
  React.useEffect(() => {
    if (hasToken) {
      navigate({ to: redirectTo })
    }
  }, [hasToken, navigate, redirectTo])

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

        <div className="rounded-lg bg-white p-8 shadow-sm" data-testid="register-form">
          {/* Placeholder for register form - will be implemented in future story */}
          <p className="text-center text-sm text-gray-500">
            Registration form coming soon.
            <br />
            This is a placeholder for the registration UI.
          </p>
        </div>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            search={{ redirect: redirectTo !== "/" ? redirectTo : undefined }}
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
