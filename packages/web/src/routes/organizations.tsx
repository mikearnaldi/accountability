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
  beforeLoad: async () => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
        throw redirect({
          to: "/login",
          search: { redirect: "/organizations" },
          replace: true
        })
      }
    }
  }
})

/**
 * Organizations layout component that renders child routes
 */
function OrganizationsLayout(): React.ReactElement {
  return (
    <AuthGuard redirectTo="/organizations">
      <Outlet />
    </AuthGuard>
  )
}
