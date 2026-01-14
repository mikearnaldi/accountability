/**
 * Reports Route
 *
 * Protected route for viewing reports.
 * Uses AppShell for consistent navigation.
 */

import { createFileRoute } from "@tanstack/react-router"
import { AppShell } from "../components/AppShell.tsx"
import { ProtectedRoute } from "../components/ProtectedRoute.tsx"

export const Route = createFileRoute("/reports")({
  component: ReportsPage
})

function ReportsPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">
            View financial reports here.
          </p>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">
              Reports list coming soon.
            </p>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
