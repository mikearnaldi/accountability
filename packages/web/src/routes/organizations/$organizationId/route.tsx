/**
 * Organization Layout Route
 *
 * This is a layout route that wraps all routes under /organizations/$organizationId/*.
 * It fetches all organizations once and provides them to child routes via context.
 *
 * This solves Issue 19: Organization Selector Shows Empty List When In Organization Context
 * by ensuring the organizations list is fetched once at the layout level and shared
 * across all child routes.
 *
 * Also provides user permissions via context for Phase G2 (Permission Hook) of AUTHORIZATION.md.
 *
 * Route: /organizations/:organizationId/*
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"
import { PermissionProvider } from "@/components/auth/PermissionProvider"
import { parseUserOrganizations, type UserOrganization } from "@/hooks/usePermissions"

// =============================================================================
// Types
// =============================================================================

// Exported so TypeScript's declaration file generation can reference it
export interface OrganizationListItem {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
}

// =============================================================================
// Server Functions
// =============================================================================

const fetchOrganizations = createServerFn({ method: "GET" }).handler(async (): Promise<readonly OrganizationListItem[]> => {
  const sessionToken = getCookie("accountability_session")

  if (!sessionToken) {
    return []
  }

  try {
    const serverApi = createServerApi()
    const { data, error } = await serverApi.GET("/api/v1/organizations", {
      headers: { Authorization: `Bearer ${sessionToken}` }
    })

    if (error || !data) {
      return []
    }

    return data.organizations.map((org) => ({
      id: org.id,
      name: org.name,
      reportingCurrency: org.reportingCurrency
    }))
  } catch {
    return []
  }
})

/**
 * Fetch user's organizations with their permissions from the new authorization API
 */
const fetchUserOrganizations = createServerFn({ method: "GET" }).handler(
  async (): Promise<readonly UserOrganization[]> => {
    const sessionToken = getCookie("accountability_session")

    if (!sessionToken) {
      return []
    }

    try {
      const serverApi = createServerApi()
      const { data, error } = await serverApi.GET("/api/v1/users/me/organizations", {
        headers: { Authorization: `Bearer ${sessionToken}` }
      })

      if (error || !data) {
        return []
      }

      return parseUserOrganizations(data)
    } catch {
      return []
    }
  }
)

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId")({
  beforeLoad: async () => {
    // Fetch organizations and user permissions in parallel for all child routes
    const [organizations, userOrganizations] = await Promise.all([fetchOrganizations(), fetchUserOrganizations()])
    return { organizations, userOrganizations }
  },
  component: OrganizationLayoutComponent
})

// =============================================================================
// Layout Component
// =============================================================================

function OrganizationLayoutComponent() {
  const { organizationId } = Route.useParams()
  const context = Route.useRouteContext()
  const userOrganizations = context.userOrganizations ?? []

  // Wrap children in PermissionProvider to make permissions available
  return (
    <PermissionProvider organizations={userOrganizations} currentOrganizationId={organizationId} isLoading={false}>
      <Outlet />
    </PermissionProvider>
  )
}
