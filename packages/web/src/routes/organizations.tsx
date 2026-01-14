/**
 * Organizations Route
 *
 * Protected route for managing organizations.
 * Uses AppShell for consistent navigation.
 */

import { createFileRoute } from "@tanstack/react-router"
import { AppShell } from "../components/AppShell.tsx"
import { ProtectedRoute } from "../components/ProtectedRoute.tsx"
import { UserMenu } from "../components/UserMenu.tsx"

export const Route = createFileRoute("/organizations")({
  component: OrganizationsPage
})

function OrganizationsPage() {
  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-600">
            Manage your organizations here.
          </p>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">
              Organizations list coming soon.
            </p>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
