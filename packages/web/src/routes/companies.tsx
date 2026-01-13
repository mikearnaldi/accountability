/**
 * Companies Layout Route
 *
 * Route: /companies
 *
 * Layout route that renders child routes via Outlet.
 * Child routes include:
 * - /companies (index) - List of companies
 * - /companies/$companyId/accounts - Chart of Accounts
 * - /companies/$companyId/reports - Reports
 * - /companies/$companyId/journal-entries/* - Journal Entries
 *
 * @module routes/companies
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import * as React from "react"
import { AuthGuard } from "../components/AuthGuard.tsx"

export const Route = createFileRoute("/companies")({
  component: CompaniesLayout,
  beforeLoad: async ({ location }) => {
    // Quick client-side check for auth token
    // This runs on both SSR (where window is undefined) and client-side
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        // Use location.pathname for the redirect path
        throw redirect({
          to: "/login",
          search: { redirect: location.pathname },
          replace: true
        })
      }
    }
  }
})

/**
 * Companies layout component that renders child routes
 *
 * We use AuthGuard here for client-side auth verification after hydration.
 * The beforeLoad handles client-side navigation redirects, but for initial
 * page loads (SSR), AuthGuard provides the client-side redirect.
 *
 * We use window.location.pathname to get the actual browser URL path,
 * which gives us the path the user is actually trying to access (e.g.,
 * /companies or /companies/123/accounts). This is more reliable than
 * using the router state which might already reflect a redirect target.
 */
function CompaniesLayout(): React.ReactElement {
  // Get the actual browser pathname for redirect purposes
  // This should be the path being accessed, not /login from any redirect
  const currentPath = typeof window !== "undefined"
    ? window.location.pathname
    : "/companies"

  return (
    <AuthGuard redirectTo={currentPath}>
      <Outlet />
    </AuthGuard>
  )
}
