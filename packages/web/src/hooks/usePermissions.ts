/**
 * Permission Hook
 *
 * Provides permission checking capabilities for React components.
 * Fetches effective permissions from `/v1/users/me/organizations` and caches them
 * in React context for efficient access throughout the component tree.
 *
 * Phase G2 of AUTHORIZATION.md specification.
 */

import { createContext, useContext, type ReactNode } from "react"
import type { components } from "@/api/schema"

// =============================================================================
// Types
// =============================================================================

/**
 * Authorization action type from the API schema
 */
export type Action = components["schemas"]["Action"]

/**
 * Base role type from the API schema
 */
export type BaseRole = components["schemas"]["BaseRole"]

/**
 * Functional roles type from the API schema
 */
export type FunctionalRoles = components["schemas"]["FunctionalRoles"]

/**
 * User organization info from the API
 */
export interface UserOrganization {
  readonly id: string
  readonly name: string
  readonly role: BaseRole
  readonly functionalRoles: FunctionalRoles
  readonly effectivePermissions: readonly Action[]
}

/**
 * Permission context value
 */
export interface PermissionContextValue {
  /**
   * All organizations the user is a member of with their permissions
   */
  readonly organizations: readonly UserOrganization[]

  /**
   * The current organization's permissions (null if not in org context)
   */
  readonly currentOrganization: UserOrganization | null

  /**
   * Check if the user can perform a specific action in the current organization
   */
  readonly canPerform: (action: Action) => boolean

  /**
   * Check if the user can perform any of the given actions in the current organization
   */
  readonly canPerformAny: (actions: readonly Action[]) => boolean

  /**
   * Check if the user can perform all of the given actions in the current organization
   */
  readonly canPerformAll: (actions: readonly Action[]) => boolean

  /**
   * Check if the user has a specific role in the current organization
   */
  readonly hasRole: (role: BaseRole) => boolean

  /**
   * Check if the user has any of the given roles in the current organization
   */
  readonly hasAnyRole: (roles: readonly BaseRole[]) => boolean

  /**
   * Check if the user is an owner or admin in the current organization
   */
  readonly isAdminOrOwner: boolean

  /**
   * Check if the user is an owner in the current organization
   */
  readonly isOwner: boolean

  /**
   * Whether permissions are still loading
   */
  readonly isLoading: boolean
}

// =============================================================================
// Context
// =============================================================================

const defaultContextValue: PermissionContextValue = {
  organizations: [],
  currentOrganization: null,
  canPerform: () => false,
  canPerformAny: () => false,
  canPerformAll: () => false,
  hasRole: () => false,
  hasAnyRole: () => false,
  isAdminOrOwner: false,
  isOwner: false,
  isLoading: true
}

export const PermissionContext = createContext<PermissionContextValue>(defaultContextValue)

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access permission checking capabilities
 *
 * Must be used within a PermissionProvider component.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { canPerform, isOwner } = usePermissions()
 *
 *   return (
 *     <>
 *       {canPerform("company:create") && <CreateCompanyButton />}
 *       {isOwner && <DeleteOrganizationButton />}
 *     </>
 *   )
 * }
 * ```
 */
export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext)
  return context
}

// =============================================================================
// Provider Props
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
// Helper Functions
// =============================================================================

/**
 * Create a permission context value from organizations data
 */
export function createPermissionContextValue(
  organizations: readonly UserOrganization[],
  currentOrganizationId: string | null,
  isLoading = false
): PermissionContextValue {
  const currentOrganization = currentOrganizationId
    ? organizations.find((org) => org.id === currentOrganizationId) ?? null
    : null

  const effectivePermissions = currentOrganization?.effectivePermissions ?? []
  const currentRole = currentOrganization?.role ?? null

  const canPerform = (action: Action): boolean => {
    if (!currentOrganization) return false
    // Check for wildcard permission
    if (effectivePermissions.includes("*")) return true
    // Check for exact match
    return effectivePermissions.includes(action)
  }

  const canPerformAny = (actions: readonly Action[]): boolean => {
    return actions.some((action) => canPerform(action))
  }

  const canPerformAll = (actions: readonly Action[]): boolean => {
    return actions.every((action) => canPerform(action))
  }

  const hasRole = (role: BaseRole): boolean => {
    return currentRole === role
  }

  const hasAnyRole = (roles: readonly BaseRole[]): boolean => {
    return currentRole !== null && roles.includes(currentRole)
  }

  const isOwner = currentRole === "owner"
  const isAdminOrOwner = currentRole === "owner" || currentRole === "admin"

  return {
    organizations,
    currentOrganization,
    canPerform,
    canPerformAny,
    canPerformAll,
    hasRole,
    hasAnyRole,
    isAdminOrOwner,
    isOwner,
    isLoading
  }
}

// =============================================================================
// Utility Functions for Server-Side Use
// =============================================================================

/**
 * Parse API response into UserOrganization array
 */
export function parseUserOrganizations(
  data: { organizations: readonly components["schemas"]["UserOrganizationInfo"][] } | null | undefined
): readonly UserOrganization[] {
  if (!data?.organizations) return []

  return data.organizations.map((org) => ({
    id: org.id,
    name: org.name,
    role: org.role,
    functionalRoles: org.functionalRoles,
    effectivePermissions: org.effectivePermissions
  }))
}
