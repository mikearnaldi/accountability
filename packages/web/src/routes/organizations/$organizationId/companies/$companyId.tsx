/**
 * Company Details Route (Placeholder)
 *
 * This route will be implemented in a future story.
 * Provides a placeholder for company details navigation.
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { AppShell } from "../../../../components/AppShell.tsx"
import { ProtectedRoute } from "../../../../components/ProtectedRoute.tsx"
import { UserMenu } from "../../../../components/UserMenu.tsx"

export const Route = createFileRoute("/organizations/$organizationId/companies/$companyId")({
  component: CompanyDetailsPage
})

function CompanyDetailsPage() {
  const { organizationId, companyId } = Route.useParams()

  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6" data-testid="company-details-page">
          {/* Breadcrumb navigation */}
          <nav className="flex items-center gap-2 text-sm" data-testid="breadcrumb">
            <Link
              to="/organizations"
              className="text-gray-500 hover:text-gray-700"
            >
              Organizations
            </Link>
            <span className="text-gray-400">&gt;</span>
            <Link
              to="/organizations/$id"
              params={{ id: organizationId }}
              className="text-gray-500 hover:text-gray-700"
            >
              Organization
            </Link>
            <span className="text-gray-400">&gt;</span>
            <Link
              to="/organizations/$organizationId/companies"
              params={{ organizationId }}
              className="text-gray-500 hover:text-gray-700"
            >
              Companies
            </Link>
            <span className="text-gray-400">&gt;</span>
            <span className="font-medium text-gray-900">
              Company Details
            </span>
          </nav>

          {/* Placeholder content */}
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Company Details
            </h1>
            <p className="mt-2 text-gray-600">
              Company ID: {companyId}
            </p>
            <p className="mt-4 text-sm text-gray-500">
              This page will be implemented in a future story.
            </p>
            <Link
              to="/organizations/$organizationId/companies"
              params={{ organizationId }}
              className="mt-6 inline-flex items-center text-blue-600 hover:text-blue-700"
            >
              &larr; Back to Companies
            </Link>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
