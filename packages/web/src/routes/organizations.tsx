/**
 * Organizations Layout Route
 *
 * Route: /organizations
 *
 * Layout route that renders child routes via Outlet.
 * Child routes include:
 * - /organizations (index) - List of organizations
 * - /organizations/:organizationId - Organization details
 *
 * @module routes/organizations
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import * as React from "react"
import { AuthGuard } from "../components/AuthGuard.tsx"

export const Route = createFileRoute("/organizations")({
  component: OrganizationsLayout,
  beforeLoad: async ({ location }) => {
    // Quick client-side check for auth token
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
 * Organizations layout component that renders child routes
 *
 * We use AuthGuard here for client-side auth verification after hydration.
 * The beforeLoad handles client-side navigation redirects, but for initial
 * page loads (SSR), AuthGuard provides the client-side redirect.
 *
 * We use window.location.pathname to get the actual browser URL path.
 */
function OrganizationsLayout(): React.ReactElement {
  // Get the actual browser pathname for redirect purposes
  const currentPath = typeof window !== "undefined"
    ? window.location.pathname
    : "/organizations"

  return (
    <AuthGuard redirectTo={currentPath}>
      <Outlet />
    </AuthGuard>
  )
}
