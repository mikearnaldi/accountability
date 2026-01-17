/**
 * AuthorizationServiceLive - RBAC implementation of AuthorizationService
 *
 * Implements permission checking using the RBAC permission matrix.
 * Uses the CurrentOrganizationMembership context to determine the user's
 * role and functional roles.
 *
 * For Phase C4, this implements RBAC only. ABAC policy engine integration
 * will be added in Track F.
 *
 * @module AuthorizationServiceLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  AuthorizationService,
  type AuthorizationServiceShape
} from "@accountability/core/Auth/AuthorizationService"
import { getCurrentOrganizationMembership } from "@accountability/core/Auth/CurrentOrganizationMembership"
import { PermissionDeniedError } from "@accountability/core/Auth/AuthorizationErrors"
import type { Action } from "@accountability/core/Auth/Action"
import type { BaseRole } from "@accountability/core/Auth/BaseRole"
import type { FunctionalRole } from "@accountability/core/Auth/FunctionalRole"
import {
  computeEffectivePermissions,
  hasPermission,
  getResourceType,
  permissionSetToArray
} from "@accountability/core/Auth/PermissionMatrix"

/**
 * Creates the AuthorizationService implementation
 */
const make: AuthorizationServiceShape = {
  /**
   * Check if the current user has permission to perform an action
   */
  checkPermission: (action: Action) =>
    Effect.gen(function* () {
      const membership = yield* getCurrentOrganizationMembership()

      // Get effective permissions
      const functionalRoles: FunctionalRole[] = []
      if (membership.isController) functionalRoles.push("controller")
      if (membership.isFinanceManager) functionalRoles.push("finance_manager")
      if (membership.isAccountant) functionalRoles.push("accountant")
      if (membership.isPeriodAdmin) functionalRoles.push("period_admin")
      if (membership.isConsolidationManager) functionalRoles.push("consolidation_manager")

      const permissions = computeEffectivePermissions(membership.role, functionalRoles)

      // Check permission
      if (!hasPermission(permissions, action)) {
        return yield* Effect.fail(
          new PermissionDeniedError({
            action,
            resourceType: getResourceType(action),
            reason: `Role '${membership.role}' does not have permission for '${action}'`
          })
        )
      }
    }),

  /**
   * Check multiple permissions at once
   */
  checkPermissions: (actions: readonly Action[]) =>
    Effect.gen(function* () {
      const membership = yield* getCurrentOrganizationMembership()

      // Get effective permissions
      const functionalRoles: FunctionalRole[] = []
      if (membership.isController) functionalRoles.push("controller")
      if (membership.isFinanceManager) functionalRoles.push("finance_manager")
      if (membership.isAccountant) functionalRoles.push("accountant")
      if (membership.isPeriodAdmin) functionalRoles.push("period_admin")
      if (membership.isConsolidationManager) functionalRoles.push("consolidation_manager")

      const permissions = computeEffectivePermissions(membership.role, functionalRoles)

      // Build result record using reduce - each action maps to its permission status
      const result: Partial<Record<Action, boolean>> = {}
      for (const action of actions) {
        result[action] = hasPermission(permissions, action)
      }
      return result
    }),

  /**
   * Check if current user has a specific base role
   */
  hasRole: (role: BaseRole) =>
    Effect.gen(function* () {
      const membership = yield* getCurrentOrganizationMembership()
      return membership.role === role
    }),

  /**
   * Check if current user has a specific functional role
   */
  hasFunctionalRole: (role: FunctionalRole) =>
    Effect.gen(function* () {
      const membership = yield* getCurrentOrganizationMembership()
      return membership.hasFunctionalRole(role)
    }),

  /**
   * Get all actions the current user is permitted to perform
   */
  getEffectivePermissions: () =>
    Effect.gen(function* () {
      const membership = yield* getCurrentOrganizationMembership()

      // Get effective permissions
      const functionalRoles: FunctionalRole[] = []
      if (membership.isController) functionalRoles.push("controller")
      if (membership.isFinanceManager) functionalRoles.push("finance_manager")
      if (membership.isAccountant) functionalRoles.push("accountant")
      if (membership.isPeriodAdmin) functionalRoles.push("period_admin")
      if (membership.isConsolidationManager) functionalRoles.push("consolidation_manager")

      const permissions = computeEffectivePermissions(membership.role, functionalRoles)

      return permissionSetToArray(permissions)
    })
}

/**
 * AuthorizationServiceLive - Layer providing AuthorizationService implementation
 *
 * This layer has no dependencies - it only requires CurrentOrganizationMembership
 * to be in context when methods are called.
 *
 * Usage:
 * ```typescript
 * import { AuthorizationServiceLive } from "@accountability/persistence/Layers/AuthorizationServiceLive"
 *
 * const program = Effect.gen(function* () {
 *   const authService = yield* AuthorizationService
 *   yield* authService.checkPermission("company:create")
 *   // If we get here, permission was granted
 * })
 *
 * program.pipe(
 *   Effect.provide(AuthorizationServiceLive),
 *   withOrganizationMembership(membership)
 * )
 * ```
 */
export const AuthorizationServiceLive: Layer.Layer<AuthorizationService> = Layer.succeed(
  AuthorizationService,
  make
)
