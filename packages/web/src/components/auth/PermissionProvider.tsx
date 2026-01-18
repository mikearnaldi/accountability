/**
 * Permission Provider Component
 *
 * Provides permission context to the component tree.
 * Should wrap any components that need to check permissions.
 *
 * Phase G2 of AUTHORIZATION.md specification.
 */

import React, { useMemo, type ReactNode } from "react"
import {
  PermissionContext,
  createPermissionContextValue,
  type UserOrganization
} from "@/hooks/usePermissions"

// =============================================================================
// Props
// =============================================================================

export interface PermissionProviderProps {
  /**
   * User's organizations with their permissions (from API response)
   */
  readonly organizations: readonly UserOrganization[]

  /**
   * The current organization ID (from URL params)
   */
  readonly currentOrganizationId: string | null

  /**
   * Whether permissions are still loading
   */
  readonly isLoading?: boolean

  /**
   * Children components
   */
  readonly children: ReactNode
}

// =============================================================================
// Component
// =============================================================================

/**
 * Provider component that supplies permission context to child components.
 *
 * @example
 * ```tsx
 * // In a route loader, fetch user organizations
 * const fetchUserOrganizations = createServerFn({ method: "GET" })
 *   .handler(async () => {
 *     const { data } = await api.GET("/api/v1/users/me/organizations")
 *     return parseUserOrganizations(data)
 *   })
 *
 * // In the route component
 * function MyPage() {
 *   const { userOrganizations } = Route.useLoaderData()
 *   const { organizationId } = Route.useParams()
 *
 *   return (
 *     <PermissionProvider
 *       organizations={userOrganizations}
 *       currentOrganizationId={organizationId}
 *     >
 *       <MyContent />
 *     </PermissionProvider>
 *   )
 * }
 * ```
 */
export function PermissionProvider({
  organizations,
  currentOrganizationId,
  isLoading = false,
  children
}: PermissionProviderProps): React.ReactNode {
  const contextValue = useMemo(
    () => createPermissionContextValue(organizations, currentOrganizationId, isLoading),
    [organizations, currentOrganizationId, isLoading]
  )

  return <PermissionContext.Provider value={contextValue}>{children}</PermissionContext.Provider>
}
