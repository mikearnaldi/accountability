/**
 * Reports Page Route
 *
 * Route: /reports
 *
 * Protected route that displays available financial reports.
 *
 * @module routes/reports
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import * as React from "react"
import { AuthGuard } from "../components/AuthGuard.tsx"

export const Route = createFileRoute("/reports")({
  component: ReportsWithAuth,
  beforeLoad: async () => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: "/reports" },
          replace: true
        })
      }
    }
  }
})

/**
 * Wrapper component that adds AuthGuard protection
 */
function ReportsWithAuth(): React.ReactElement {
  return (
    <AuthGuard redirectTo="/reports">
      <Reports />
    </AuthGuard>
  )
}

function Reports(): React.ReactElement {
  return (
    <div>
      <h1>Reports</h1>
      <p>Generate and view financial reports.</p>
      <section>
        <h2>Available Reports</h2>
        <ul>
          <li>Trial Balance</li>
          <li>Balance Sheet</li>
          <li>Income Statement</li>
          <li>Cash Flow Statement</li>
          <li>Statement of Changes in Equity</li>
        </ul>
      </section>
    </div>
  )
}
