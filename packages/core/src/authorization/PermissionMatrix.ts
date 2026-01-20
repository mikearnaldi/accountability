/**
 * PermissionMatrix - RBAC permission matrix
 *
 * Defines which actions are allowed for each base role and functional role.
 * This is the hardcoded RBAC matrix that will be used until ABAC policies
 * are fully implemented.
 *
 * Permission precedence:
 * 1. Owner has all permissions
 * 2. Admin has all permissions except org:delete and org:transfer_ownership
 * 3. Viewer has read-only permissions (plus report:export)
 * 4. Member permissions are determined by functional roles
 *
 * @module authorization/PermissionMatrix
 */

import type { Action } from "./Action.ts"
import type { BaseRole } from "./BaseRole.ts"
import type { FunctionalRole } from "./FunctionalRole.ts"

/**
 * All actions that exist in the system (excluding wildcard)
 */
const ALL_ACTIONS: readonly Action[] = [
  // Organization actions
  "organization:manage_settings",
  "organization:manage_members",
  "organization:delete",
  "organization:transfer_ownership",

  // Company actions
  "company:create",
  "company:read",
  "company:update",
  "company:delete",

  // Account actions
  "account:create",
  "account:read",
  "account:update",
  "account:deactivate",

  // Journal entry actions
  "journal_entry:create",
  "journal_entry:read",
  "journal_entry:update",
  "journal_entry:post",
  "journal_entry:reverse",

  // Fiscal period actions
  "fiscal_period:read",
  "fiscal_period:manage",

  // Consolidation actions
  "consolidation_group:create",
  "consolidation_group:read",
  "consolidation_group:update",
  "consolidation_group:delete",
  "consolidation_group:run",
  "elimination:create",

  // Report actions
  "report:read",
  "report:export",

  // Exchange rate actions
  "exchange_rate:read",
  "exchange_rate:manage",

  // Audit log actions
  "audit_log:read"
] as const

/**
 * Read-only actions (viewer permissions)
 */
const READ_ONLY_ACTIONS: readonly Action[] = [
  "company:read",
  "account:read",
  "journal_entry:read",
  "fiscal_period:read",
  "consolidation_group:read",
  "report:read",
  "report:export",
  "exchange_rate:read"
] as const

/**
 * Admin actions (everything except org delete and transfer)
 */
const ADMIN_ACTIONS: readonly Action[] = ALL_ACTIONS.filter(
  (action) =>
    action !== "organization:delete" && action !== "organization:transfer_ownership"
)

/**
 * Controller functional role permissions
 * Period management, consolidation run/approval, full financial oversight
 */
const CONTROLLER_ACTIONS: readonly Action[] = [
  // Company
  "company:create",
  "company:read",
  "company:update",

  // Account
  "account:create",
  "account:read",
  "account:update",
  "account:deactivate",

  // Journal entry
  "journal_entry:create",
  "journal_entry:read",
  "journal_entry:update",
  "journal_entry:post",
  "journal_entry:reverse",

  // Fiscal period - full control
  "fiscal_period:read",
  "fiscal_period:manage",

  // Consolidation - full control
  "consolidation_group:create",
  "consolidation_group:read",
  "consolidation_group:update",
  "consolidation_group:delete",
  "consolidation_group:run",
  "elimination:create",

  // Reports
  "report:read",
  "report:export",

  // Exchange rates
  "exchange_rate:read",
  "exchange_rate:manage",

  // Audit log
  "audit_log:read"
] as const

/**
 * Finance manager functional role permissions
 * Account management, exchange rates, elimination rules
 */
const FINANCE_MANAGER_ACTIONS: readonly Action[] = [
  // Company
  "company:read",
  "company:update",

  // Account - full control
  "account:create",
  "account:read",
  "account:update",
  "account:deactivate",

  // Journal entry
  "journal_entry:create",
  "journal_entry:read",
  "journal_entry:update",
  "journal_entry:post",

  // Fiscal period - read only (no manage permission)
  "fiscal_period:read",

  // Consolidation - read and elimination
  "consolidation_group:read",
  "consolidation_group:run",
  "elimination:create",

  // Reports
  "report:read",
  "report:export",

  // Exchange rates - full control
  "exchange_rate:read",
  "exchange_rate:manage"
] as const

/**
 * Accountant functional role permissions
 * Create/edit/post journal entries, reconciliation
 */
const ACCOUNTANT_ACTIONS: readonly Action[] = [
  // Company
  "company:read",

  // Account
  "account:read",

  // Journal entry - create/edit/post
  "journal_entry:create",
  "journal_entry:read",
  "journal_entry:update",
  "journal_entry:post",

  // Fiscal period - read only
  "fiscal_period:read",

  // Consolidation - read only
  "consolidation_group:read",

  // Reports
  "report:read",
  "report:export",

  // Exchange rates - read only
  "exchange_rate:read"
] as const

/**
 * Period admin functional role permissions
 * Open/close periods
 */
const PERIOD_ADMIN_ACTIONS: readonly Action[] = [
  // Company
  "company:read",

  // Account
  "account:read",

  // Journal entry - read only
  "journal_entry:read",

  // Fiscal period - full control
  "fiscal_period:read",
  "fiscal_period:manage",

  // Consolidation - read only
  "consolidation_group:read",

  // Reports
  "report:read",

  // Exchange rates - read only
  "exchange_rate:read"
] as const

/**
 * Consolidation manager functional role permissions
 * Manage consolidation groups, elimination rules
 */
const CONSOLIDATION_MANAGER_ACTIONS: readonly Action[] = [
  // Company
  "company:read",

  // Account
  "account:read",

  // Journal entry - read only
  "journal_entry:read",

  // Fiscal period - read only
  "fiscal_period:read",

  // Consolidation - create/read/update
  "consolidation_group:create",
  "consolidation_group:read",
  "consolidation_group:update",
  "elimination:create",

  // Reports
  "report:read",
  "report:export",

  // Exchange rates - read only
  "exchange_rate:read"
] as const

/**
 * Get permissions for a base role
 */
export const getBaseRolePermissions = (role: BaseRole): ReadonlySet<Action> => {
  switch (role) {
    case "owner":
      return new Set(ALL_ACTIONS)
    case "admin":
      return new Set(ADMIN_ACTIONS)
    case "viewer":
      return new Set(READ_ONLY_ACTIONS)
    case "member":
      // Member has no default permissions - must have functional roles
      return new Set(READ_ONLY_ACTIONS)
  }
}

/**
 * Get permissions for a functional role
 */
export const getFunctionalRolePermissions = (role: FunctionalRole): ReadonlySet<Action> => {
  switch (role) {
    case "controller":
      return new Set(CONTROLLER_ACTIONS)
    case "finance_manager":
      return new Set(FINANCE_MANAGER_ACTIONS)
    case "accountant":
      return new Set(ACCOUNTANT_ACTIONS)
    case "period_admin":
      return new Set(PERIOD_ADMIN_ACTIONS)
    case "consolidation_manager":
      return new Set(CONSOLIDATION_MANAGER_ACTIONS)
  }
}

/**
 * Compute effective permissions for a user given their role and functional roles
 *
 * Permissions are additive - base role permissions plus all functional role permissions.
 */
export const computeEffectivePermissions = (
  baseRole: BaseRole,
  functionalRoles: readonly FunctionalRole[]
): ReadonlySet<Action> => {
  const permissions = new Set(getBaseRolePermissions(baseRole))

  // Add functional role permissions
  for (const funcRole of functionalRoles) {
    for (const action of getFunctionalRolePermissions(funcRole)) {
      permissions.add(action)
    }
  }

  return permissions
}

/**
 * Check if a set of permissions includes a specific action
 *
 * Handles wildcard matching:
 * - "*" in permissions matches any action
 * - "resource:*" in the action being checked would match "resource:create" etc.
 */
export const hasPermission = (
  permissions: ReadonlySet<Action>,
  action: Action
): boolean => {
  // Direct match
  if (permissions.has(action)) {
    return true
  }

  // Wildcard permission grants all actions
  if (permissions.has("*")) {
    return true
  }

  return false
}

/**
 * Get the resource type from an action
 *
 * @example
 * getResourceType("company:create") // "company"
 * getResourceType("journal_entry:post") // "journal_entry"
 */
export const getResourceType = (action: Action): string => {
  if (action === "*") return "*"
  const colonIndex = action.indexOf(":")
  if (colonIndex === -1) return action
  return action.substring(0, colonIndex)
}

/**
 * Convert a permission set to an array with proper typing
 *
 * Helper function that iterates through the set to create a properly typed array.
 */
export const permissionSetToArray = (
  permissions: ReadonlySet<Action>
): ReadonlyArray<Action> => {
  const result: Action[] = []
  permissions.forEach((action) => result.push(action))
  return result
}
