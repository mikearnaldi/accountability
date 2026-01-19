/**
 * AuthorizationService - Service interface for permission checking
 *
 * Provides RBAC (Role-Based Access Control) permission checking based on the
 * current user's organization membership. Uses a hardcoded permission matrix
 * that maps roles and functional roles to allowed actions.
 *
 * For Phase C4, this implements RBAC only. ABAC policy engine integration
 * will be added in Track F.
 *
 * @module authorization/AuthorizationService
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { Action } from "./Action.ts"
import type { BaseRole } from "./BaseRole.ts"
import type { FunctionalRole } from "./FunctionalRole.ts"
import type { PermissionDeniedError, PolicyLoadError, AuthorizationAuditError } from "./AuthorizationErrors.ts"
import type { CurrentOrganizationMembership } from "../membership/CurrentOrganizationMembership.ts"
import type { CurrentEnvironmentContext } from "./CurrentEnvironmentContext.ts"
import type { ResourceContext } from "./matchers/ResourceMatcher.ts"

// =============================================================================
// Service Interface
// =============================================================================

/**
 * AuthorizationServiceShape - The shape of the authorization service
 *
 * Provides permission checking operations based on the current user's
 * organization membership. Uses RBAC with a permission matrix.
 */
export interface AuthorizationServiceShape {
  /**
   * Check if the current user has permission to perform an action
   *
   * Checks the permission matrix against the user's role and functional roles.
   * Throws PermissionDeniedError if not authorized.
   *
   * When a resourceContext is provided, ABAC policies can evaluate resource
   * attributes like period status for time-sensitive authorization checks.
   *
   * @param action - The action to check permission for
   * @param resourceContext - Optional resource context for ABAC evaluation
   * @returns Effect that completes successfully if permitted, fails with PermissionDeniedError otherwise
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const authService = yield* AuthorizationService
   *   yield* authService.checkPermission("company:create")
   *   // If we get here, user has permission
   *   yield* companyService.create(...)
   * })
   *
   * // With resource context (for period-sensitive checks):
   * const journalEntryProgram = Effect.gen(function* () {
   *   const authService = yield* AuthorizationService
   *   yield* authService.checkPermission("journal_entry:create", {
   *     type: "journal_entry",
   *     periodStatus: "Open"
   *   })
   * })
   * ```
   */
  readonly checkPermission: (
    action: Action,
    resourceContext?: ResourceContext
  ) => Effect.Effect<void, PermissionDeniedError | PolicyLoadError | AuthorizationAuditError, CurrentOrganizationMembership | CurrentEnvironmentContext>

  /**
   * Check multiple permissions at once
   *
   * Returns a record mapping each action to whether it's permitted.
   * Does not throw - useful for UI element visibility.
   *
   * @param actions - The actions to check
   * @returns Effect containing a record of action to boolean
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const authService = yield* AuthorizationService
   *   const perms = yield* authService.checkPermissions([
   *     "company:create",
   *     "company:delete",
   *     "account:create"
   *   ])
   *   if (perms["company:create"]) {
   *     // Show create button
   *   }
   * })
   * ```
   */
  readonly checkPermissions: (
    actions: readonly Action[]
  ) => Effect.Effect<Partial<Record<Action, boolean>>, PolicyLoadError, CurrentOrganizationMembership | CurrentEnvironmentContext>

  /**
   * Check if current user has a specific base role
   *
   * @param role - The role to check for
   * @returns Effect containing boolean indicating if user has the role
   */
  readonly hasRole: (
    role: BaseRole
  ) => Effect.Effect<boolean, never, CurrentOrganizationMembership>

  /**
   * Check if current user has a specific functional role
   *
   * @param role - The functional role to check for
   * @returns Effect containing boolean indicating if user has the role
   */
  readonly hasFunctionalRole: (
    role: FunctionalRole
  ) => Effect.Effect<boolean, never, CurrentOrganizationMembership>

  /**
   * Get all actions the current user is permitted to perform
   *
   * Computes the full list of allowed actions based on role and functional roles.
   * Useful for UI to determine visibility of all elements at once.
   *
   * @returns Effect containing array of permitted actions
   */
  readonly getEffectivePermissions: () => Effect.Effect<
    ReadonlyArray<Action>,
    PolicyLoadError,
    CurrentOrganizationMembership | CurrentEnvironmentContext
  >
}

/**
 * AuthorizationService - Context.Tag for the authorization service
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const authService = yield* AuthorizationService
 *   yield* authService.checkPermission("company:create")
 *   // Permission granted, proceed with operation
 * })
 *
 * // Provide the implementation and membership context
 * program.pipe(
 *   Effect.provide(AuthorizationServiceLive),
 *   withOrganizationMembership(membership)
 * )
 * ```
 */
export class AuthorizationService extends Context.Tag("AuthorizationService")<
  AuthorizationService,
  AuthorizationServiceShape
>() {}
