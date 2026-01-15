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
 * Route: /organizations/:organizationId/*
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"
import { createServerApi } from "@/api/server"

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

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId")({
  beforeLoad: async () => {
    // Fetch organizations once for all child routes
    const organizations = await fetchOrganizations()
    return { organizations }
  },
  component: OrganizationLayoutComponent
})

// =============================================================================
// Layout Component
// =============================================================================

function OrganizationLayoutComponent() {
  // Simply render the child route - organizations are available via context
  return <Outlet />
}
