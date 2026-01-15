/**
 * Home Page Route
 *
 * For authenticated users:
 * - Redirects to the appropriate page based on organization count:
 *   - No organizations -> /organizations/new
 *   - Single organization -> /organizations/:id/dashboard
 *   - Multiple organizations -> /organizations
 *
 * For unauthenticated users:
 * - Landing page with sign in/register options
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"

// =============================================================================
// Server Function: Fetch organizations for redirect logic
// =============================================================================

const fetchOrganizationsForRedirect = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ organizations: readonly { id: string }[] } | null> => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return null
    }

    try {
      const serverApi = createServerApi()
      const headers = { Authorization: `Bearer ${sessionToken}` }
      const orgsResult = await serverApi.GET("/api/v1/organizations", { headers })
      return { organizations: orgsResult.data?.organizations ?? [] }
    } catch {
      return null
    }
  }
)

// =============================================================================
// Home Page Route
// =============================================================================

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // If user is authenticated, redirect based on organization count
    if (context.user) {
      const result = await fetchOrganizationsForRedirect()
      const orgs = result?.organizations ?? []

      if (orgs.length === 0) {
        // No organizations - go to create first org
        throw redirect({ to: "/organizations/new" })
      } else if (orgs.length === 1) {
        // Single organization - go directly to its dashboard
        throw redirect({
          to: "/organizations/$organizationId/dashboard",
          params: { organizationId: orgs[0].id }
        })
      } else {
        // Multiple organizations - go to org selector
        throw redirect({ to: "/organizations" })
      }
    }
  },
  component: HomePage
})

// =============================================================================
// Home Page Component (Landing page for unauthenticated users)
// =============================================================================

function HomePage() {
  // Authenticated users are redirected in beforeLoad, so this only renders
  // for unauthenticated users
  return <UnauthenticatedHomePage />
}

// =============================================================================
// Unauthenticated Home Page (Landing Page)
// =============================================================================

function UnauthenticatedHomePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4"
      data-testid="unauthenticated-home"
    >
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
            Professional accounting software for managing multiple companies
            across currencies.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              data-testid="landing-sign-in"
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              data-testid="landing-register"
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
