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

/** Base role from authorization system */
export type BaseRole = "owner" | "admin" | "member" | "viewer"

/**
 * Organization with optional role info from permissions API
 * Exported so TypeScript's declaration file generation can reference it
 */
export interface OrganizationListItem {
  readonly id: string
  readonly name: string
  readonly reportingCurrency: string
  /** User's role in this organization (from permissions API) */
  readonly role?: BaseRole
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
    const [rawOrganizations, userOrganizations] = await Promise.all([fetchOrganizations(), fetchUserOrganizations()])

    // Create a role lookup map from userOrganizations
    const roleMap = new Map<string, BaseRole>()
    for (const userOrg of userOrganizations) {
      roleMap.set(userOrg.id, userOrg.role)
    }

    // Merge role info into organizations for the OrganizationSelector
    // Only include role property if we have a role (satisfies exactOptionalPropertyTypes)
    const organizations: readonly OrganizationListItem[] = rawOrganizations.map((org) => {
      const role = roleMap.get(org.id)
      if (role) {
        return { ...org, role }
      }
      return org
    })

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
