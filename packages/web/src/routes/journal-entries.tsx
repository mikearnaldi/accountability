/**
 * Journal Entries Page Route
 *
 * Route: /journal-entries
 *
 * Protected route that displays journal entries overview.
 *
 * @module routes/journal-entries
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import * as React from "react"
import { AuthGuard } from "../components/AuthGuard.tsx"

export const Route = createFileRoute("/journal-entries")({
  component: JournalEntriesWithAuth,
  beforeLoad: async () => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: "/journal-entries" },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function JournalEntriesWithAuth(): React.ReactElement {
  return (
    <AuthGuard redirectTo="/journal-entries">
      <JournalEntries />
    </AuthGuard>
  )
}

function JournalEntries(): React.ReactElement {
  return (
    <div>
      <h1>Journal Entries</h1>
      <p>Record and manage your accounting transactions.</p>
      <section>
        <h2>Recent Entries</h2>
        <p>No journal entries yet. Create your first entry to get started.</p>
      </section>
    </div>
  )
}
