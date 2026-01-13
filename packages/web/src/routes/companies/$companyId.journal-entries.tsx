/**
 * Journal Entries Layout Route
 *
 * Route: /companies/:companyId/journal-entries (layout)
 *
 * Layout component that handles authentication for all journal entry routes
 * and renders child routes via Outlet.
 *
 * Child routes:
 * - index: Journal entries list
 * - new: Create new journal entry
 * - $entryId/edit: Edit existing journal entry
 *
 * @module routes/companies/$companyId.journal-entries
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import * as React from "react"
import { AuthGuard } from "../../components/AuthGuard.tsx"

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/companies/$companyId/journal-entries")({
  component: JournalEntriesLayoutWithAuth,
  beforeLoad: async ({ params }) => {
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: `/companies/${params.companyId}/journal-entries` },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection to all journal entry routes
 */
function JournalEntriesLayoutWithAuth(): React.ReactElement {
  const { companyId } = Route.useParams()
  return (
    <AuthGuard redirectTo={`/companies/${companyId}/journal-entries`}>
      <Outlet />
    </AuthGuard>
  )
}
