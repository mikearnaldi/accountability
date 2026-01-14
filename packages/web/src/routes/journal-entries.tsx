/**
 * Journal Entries Route
 *
 * Protected route for managing journal entries.
 * Uses AppShell for consistent navigation.
 */

import { createFileRoute } from "@tanstack/react-router"
import { AppShell } from "../components/AppShell.tsx"
import { ProtectedRoute } from "../components/ProtectedRoute.tsx"
import { UserMenu } from "../components/UserMenu.tsx"

export const Route = createFileRoute("/journal-entries")({
  component: JournalEntriesPage
})

function JournalEntriesPage() {
  return (
    <ProtectedRoute>
      <AppShell userMenu={<UserMenu />}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
          <p className="text-gray-600">
            Manage your journal entries here.
          </p>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">
              Journal entries list coming soon.
            </p>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  )
}
