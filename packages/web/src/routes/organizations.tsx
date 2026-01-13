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
        // Use location.href for the full path, falling back to pathname
        const redirectPath = location.href || location.pathname
        throw redirect({
          to: "/login",
          search: { redirect: redirectPath },
          replace: true
        })
      }
    }
  }
})

/**
 * Organizations layout component that renders child routes
 * AuthGuard uses the current location.pathname from useLocation() by default
 */
function OrganizationsLayout(): React.ReactElement {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  )
}
