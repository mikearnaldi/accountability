import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { api } from "@/api/client"

// =============================================================================
// Home Page Route
// =============================================================================

export const Route = createFileRoute("/")({
  component: HomePage
})

function HomePage() {
  const context = Route.useRouteContext()
  const user = context.user

  if (user) {
    return <AuthenticatedHomePage user={user} />
  }

  return <UnauthenticatedHomePage />
}

// =============================================================================
// User Type (from route context)
// =============================================================================

interface User {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: string
  readonly primaryProvider: string
}

// =============================================================================
// Unauthenticated Home Page
// =============================================================================

function UnauthenticatedHomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Accountability</h1>
          <p className="mt-2 text-lg text-gray-600">
            Multi-company, multi-currency accounting
          </p>
        </div>

        {/* Welcome Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>

          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Welcome to Accountability
          </h2>
          <p className="mb-6 text-gray-500">
            Professional accounting software for managing multiple companies across currencies.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-2xl font-bold text-blue-600">Multi</div>
            <p className="text-xs text-gray-500">Company Support</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-2xl font-bold text-blue-600">Any</div>
            <p className="text-xs text-gray-500">Currency</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-2xl font-bold text-blue-600">Full</div>
            <p className="text-xs text-gray-500">Audit Trail</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Authenticated Home Page
// =============================================================================

function AuthenticatedHomePage({ user }: { readonly user: User }) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)

    try {
      await api.POST("/api/auth/logout")
      // Cookie will be cleared by the server
      // Invalidate router to clear user context and redirect
      await router.invalidate()
      router.navigate({ to: "/" })
    } catch {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Logout */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Accountability
            </Link>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user.displayName || user.email}
              </span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.displayName || "there"}!
          </h1>
          <p className="mt-1 text-gray-500">
            Manage your organizations and companies from your dashboard.
          </p>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Organizations Card */}
          <Link
            to="/organizations"
            className="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Organizations</h2>
            <p className="text-sm text-gray-500">
              View and manage your organizations and their companies.
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-blue-600">
              Go to Organizations
              <svg
                className="ml-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>

          {/* Quick Stats Placeholder */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Dashboard</h2>
            <p className="text-sm text-gray-500">
              Quick overview of your financial data across all companies.
            </p>
            <p className="mt-4 text-xs text-gray-400">
              Coming soon
            </p>
          </div>

          {/* Reports Placeholder */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <svg
                className="h-6 w-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Reports</h2>
            <p className="text-sm text-gray-500">
              Generate balance sheets, income statements, and more.
            </p>
            <p className="mt-4 text-xs text-gray-400">
              Coming soon
            </p>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-2 text-lg font-semibold text-blue-900">
            Getting Started
          </h3>
          <p className="mb-4 text-sm text-blue-700">
            New to Accountability? Here's how to set up your accounting:
          </p>
          <ol className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
                1
              </span>
              <span>Create an organization to group related companies</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
                2
              </span>
              <span>Add companies with their respective currencies</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
                3
              </span>
              <span>Set up your chart of accounts for each company</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">
                4
              </span>
              <span>Start recording journal entries</span>
            </li>
          </ol>
          <Link
            to="/organizations"
            className="mt-4 inline-flex items-center text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Get Started
            <svg
              className="ml-1 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  )
}
