/**
 * Companies Route
 *
 * Protected route for managing companies.
 * Uses AppShell for consistent navigation.
 */

import { createFileRoute } from "@tanstack/react-router"
import { AppShell } from "../components/AppShell.tsx"
import { ProtectedRoute } from "../components/ProtectedRoute.tsx"

export const Route = createFileRoute("/companies")({
  component: CompaniesPage
})

function CompaniesPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-600">
            Manage your companies here.
          </p>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">
              Companies list coming soon.
            </p>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
