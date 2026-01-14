/**
 * Organization Details Route
 *
 * Displays details for a single organization.
 * This is a placeholder that will be expanded in future stories.
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { AppShell } from "../../components/AppShell.tsx"
import { ProtectedRoute } from "../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../components/UserMenu.tsx"
import { organizationFamily } from "../../atoms/organizations.ts"

export const Route = createFileRoute("/organizations/$id")({
  component: OrganizationDetailsPage
})

function OrganizationDetailsPage() {
  const { id } = Route.useParams()
  const organizationAtom = organizationFamily(id)
  const result = useAtomValue(organizationAtom)

  // Loading state
  if (Result.isInitial(result) || (Result.isWaiting(result) && !Result.isSuccess(result))) {
    return (
      <ProtectedRoute>
        <AppShell userMenu={<UserMenu />}>
          <div className="animate-pulse space-y-4" data-testid="organization-details-loading">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
          </div>
        </AppShell>
      </ProtectedRoute>
    )
  }

  // Error state
  if (Result.isFailure(result)) {
    return (
      <ProtectedRoute>
        <AppShell userMenu={<UserMenu />}>
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
            data-testid="organization-details-error"
          >
            <h2 className="text-lg font-semibold text-red-800">
              Organization not found
            </h2>
            <p className="mt-2 text-sm text-red-600">
              The organization you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link
              to="/organizations"
              className="mt-4 inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Back to Organizations
            </Link>
          </div>
        </AppShell>
      </ProtectedRoute>
    )
  }

  const organization = result.value

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6" data-testid="organization-details-page">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  to="/organizations"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Organizations
                </Link>
                <span className="text-gray-400">/</span>
              </div>
              <h1
                className="text-2xl font-bold text-gray-900"
                data-testid="organization-detail-name"
              >
                {organization.name}
              </h1>
              <p
                className="mt-1 text-sm text-gray-600"
                data-testid="organization-detail-currency"
              >
                Reporting Currency: {organization.reportingCurrency}
              </p>
            </div>
          </div>

          {/* Placeholder content */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Companies</h2>
            <p className="mt-2 text-sm text-gray-500">
              Company management will be implemented in a future story.
            </p>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
