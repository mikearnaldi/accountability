/**
 * Company Layout Route
 *
 * Layout route that wraps company-specific pages (details, accounts, etc.)
 * Simply renders the Outlet to display child routes.
 */

import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/organizations/$organizationId/companies/$companyId")({
  component: CompanyLayout
})

function CompanyLayout() {
  return <Outlet />
}
