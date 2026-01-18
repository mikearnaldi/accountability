/**
 * Organization Settings Layout Route
 *
 * This is a layout route that wraps all routes under /organizations/$organizationId/settings/*.
 * It simply renders an Outlet to allow child routes (index, members, policies) to render.
 *
 * Child routes:
 * - /settings (index.tsx) - General organization settings
 * - /settings/members - Member management
 * - /settings/policies - Authorization policies
 *
 * Route: /organizations/:organizationId/settings/*
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"

// =============================================================================
// Route Definition
// =============================================================================

export const Route = createFileRoute("/organizations/$organizationId/settings")({
  component: SettingsLayoutComponent
})

// =============================================================================
// Layout Component
// =============================================================================

function SettingsLayoutComponent() {
  // Simply render the child route via Outlet
  return <Outlet />
}
