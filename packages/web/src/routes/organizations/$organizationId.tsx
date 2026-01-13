/**
 * Organization Layout Route
 *
 * Route: /organizations/:organizationId (layout)
 *
 * Layout route for organization-specific pages. Renders child routes via Outlet.
 * Child routes include:
 * - /organizations/:organizationId (index) - Organization details
 * - /organizations/:organizationId/companies - Companies list
 * - /organizations/:organizationId/companies/:companyId - Company details
 *
 * @module routes/organizations/$organizationId
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import * as React from "react"
import { AuthGuard } from "../../components/AuthGuard.tsx"

export const Route = createFileRoute("/organizations/$organizationId")({
  component: OrganizationLayoutWithAuth,
  beforeLoad: async ({ location }) => {
    // Quick client-side check for auth token
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("accountability_auth_token")
      if (!token) {
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
 * Wrapper component that adds AuthGuard protection
 */
function OrganizationLayoutWithAuth(): React.ReactElement {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  )
}
