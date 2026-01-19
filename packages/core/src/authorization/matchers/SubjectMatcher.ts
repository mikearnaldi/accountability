/**
 * SubjectMatcher - Matches users against subject conditions
 *
 * This module provides functions to match a user against a SubjectCondition
 * in ABAC policy evaluation.
 *
 * Matching supports:
 * - roles: User's base role must be in the list (any match)
 * - functionalRoles: User must have at least one of the specified functional roles (any match)
 * - userIds: User's ID must be in the list
 * - isPlatformAdmin: User's platform admin status must match
 *
 * All specified conditions are combined with AND logic (all must match).
 * If a condition field is undefined, it is not checked (passes).
 *
 * @module SubjectMatcher
 */

import type { SubjectCondition } from "../PolicyConditions.ts"
import type { BaseRole } from "../BaseRole.ts"
import type { FunctionalRole } from "../FunctionalRole.ts"
import type { AuthUserId } from "../../authentication/AuthUserId.ts"

/**
 * Subject context for matching - represents the user making the request
 *
 * This is a minimal interface that can be satisfied by OrganizationMembership
 * or other sources of user context.
 */
export interface SubjectContext {
  /**
   * The user's ID
   */
  readonly userId: AuthUserId

  /**
   * The user's base role in the organization
   */
  readonly role: BaseRole

  /**
   * The user's functional roles (as an array)
   */
  readonly functionalRoles: readonly FunctionalRole[]

  /**
   * Whether the user is a platform admin
   */
  readonly isPlatformAdmin: boolean
}

/**
 * Creates a SubjectContext from an OrganizationMembership and platform admin flag
 *
 * @param membership - The user's organization membership
 * @param isPlatformAdmin - Whether the user is a platform admin
 * @returns SubjectContext for policy matching
 *
 * @example
 * ```ts
 * const context = createSubjectContext(membership, false)
 * matchesSubjectCondition(condition, context)
 * ```
 */
export const createSubjectContextFromMembership = (
  membership: {
    readonly userId: AuthUserId
    readonly role: BaseRole
    readonly isController: boolean
    readonly isFinanceManager: boolean
    readonly isAccountant: boolean
    readonly isPeriodAdmin: boolean
    readonly isConsolidationManager: boolean
  },
  isPlatformAdmin: boolean
): SubjectContext => {
  const functionalRoles: FunctionalRole[] = []
  if (membership.isController) functionalRoles.push("controller")
  if (membership.isFinanceManager) functionalRoles.push("finance_manager")
  if (membership.isAccountant) functionalRoles.push("accountant")
  if (membership.isPeriodAdmin) functionalRoles.push("period_admin")
  if (membership.isConsolidationManager) functionalRoles.push("consolidation_manager")

  return {
    userId: membership.userId,
    role: membership.role,
    functionalRoles,
    isPlatformAdmin
  }
}

/**
 * Checks if a user's role matches any of the specified roles
 *
 * @param roles - The roles to match against
 * @param userRole - The user's current role
 * @returns true if the user's role is in the list
 *
 * @example
 * ```ts
 * matchesRoles(["owner", "admin"], "admin") // true
 * matchesRoles(["owner", "admin"], "member") // false
 * ```
 */
export const matchesRoles = (
  roles: readonly BaseRole[],
  userRole: BaseRole
): boolean => {
  return roles.includes(userRole)
}

/**
 * Checks if a user has any of the specified functional roles
 *
 * @param requiredRoles - The functional roles to match against (any match)
 * @param userFunctionalRoles - The user's current functional roles
 * @returns true if the user has at least one of the required functional roles
 *
 * @example
 * ```ts
 * matchesFunctionalRoles(["controller", "finance_manager"], ["accountant"]) // false
 * matchesFunctionalRoles(["controller", "finance_manager"], ["controller"]) // true
 * matchesFunctionalRoles(["controller"], ["controller", "accountant"]) // true
 * ```
 */
export const matchesFunctionalRoles = (
  requiredRoles: readonly FunctionalRole[],
  userFunctionalRoles: readonly FunctionalRole[]
): boolean => {
  return requiredRoles.some((role) => userFunctionalRoles.includes(role))
}

/**
 * Checks if a user's ID is in the specified list
 *
 * @param userIds - The user IDs to match against
 * @param userId - The user's current ID
 * @returns true if the user's ID is in the list
 *
 * @example
 * ```ts
 * matchesUserIds(["user-1", "user-2"], "user-1" as AuthUserId) // true
 * matchesUserIds(["user-1", "user-2"], "user-3" as AuthUserId) // false
 * ```
 */
export const matchesUserIds = (
  userIds: readonly AuthUserId[],
  userId: AuthUserId
): boolean => {
  return userIds.includes(userId)
}

/**
 * Checks if a user's platform admin status matches the required status
 *
 * @param required - The required platform admin status
 * @param actual - The user's actual platform admin status
 * @returns true if the statuses match
 *
 * @example
 * ```ts
 * matchesPlatformAdmin(true, true) // true
 * matchesPlatformAdmin(true, false) // false
 * matchesPlatformAdmin(false, false) // true
 * ```
 */
export const matchesPlatformAdmin = (
  required: boolean,
  actual: boolean
): boolean => {
  return required === actual
}

/**
 * Checks if a user matches a SubjectCondition
 *
 * All specified conditions are combined with AND logic:
 * - If roles is specified, the user must have one of those roles
 * - If functionalRoles is specified, the user must have one of those functional roles
 * - If userIds is specified, the user's ID must be in the list
 * - If isPlatformAdmin is specified, the user's platform admin status must match
 *
 * Undefined/empty conditions are treated as "match any" (they pass).
 *
 * @param condition - The SubjectCondition to match against
 * @param subject - The user context to test
 * @returns true if the subject matches all specified conditions
 *
 * @example
 * ```ts
 * const condition: SubjectCondition = {
 *   roles: ["owner", "admin"]
 * }
 * const adminUser: SubjectContext = {
 *   userId: "user-1" as AuthUserId,
 *   role: "admin",
 *   functionalRoles: [],
 *   isPlatformAdmin: false
 * }
 * matchesSubjectCondition(condition, adminUser) // true
 *
 * const memberUser: SubjectContext = {
 *   userId: "user-2" as AuthUserId,
 *   role: "member",
 *   functionalRoles: ["accountant"],
 *   isPlatformAdmin: false
 * }
 * matchesSubjectCondition(condition, memberUser) // false
 * ```
 */
export const matchesSubjectCondition = (
  condition: SubjectCondition,
  subject: SubjectContext
): boolean => {
  // Check roles condition (if specified)
  if (condition.roles !== undefined && condition.roles.length > 0) {
    if (!matchesRoles(condition.roles, subject.role)) {
      return false
    }
  }

  // Check functional roles condition (if specified)
  if (condition.functionalRoles !== undefined && condition.functionalRoles.length > 0) {
    if (!matchesFunctionalRoles(condition.functionalRoles, subject.functionalRoles)) {
      return false
    }
  }

  // Check user IDs condition (if specified)
  if (condition.userIds !== undefined && condition.userIds.length > 0) {
    if (!matchesUserIds(condition.userIds, subject.userId)) {
      return false
    }
  }

  // Check platform admin condition (if specified)
  if (condition.isPlatformAdmin !== undefined) {
    if (!matchesPlatformAdmin(condition.isPlatformAdmin, subject.isPlatformAdmin)) {
      return false
    }
  }

  // All conditions passed (or were not specified)
  return true
}

/**
 * Checks if a user matches any of multiple SubjectConditions
 *
 * @param conditions - The SubjectConditions to match against
 * @param subject - The user context to test
 * @returns true if the subject matches at least one condition
 *
 * @example
 * ```ts
 * const conditions: SubjectCondition[] = [
 *   { roles: ["owner"] },
 *   { functionalRoles: ["controller"] }
 * ]
 * matchesAnySubjectCondition(conditions, controllerUser) // true if owner OR controller
 * ```
 */
export const matchesAnySubjectCondition = (
  conditions: readonly SubjectCondition[],
  subject: SubjectContext
): boolean => {
  return conditions.some((condition) => matchesSubjectCondition(condition, subject))
}

/**
 * Checks if a user matches all of multiple SubjectConditions
 *
 * @param conditions - The SubjectConditions to match against
 * @param subject - The user context to test
 * @returns true if the subject matches all conditions
 */
export const matchesAllSubjectConditions = (
  conditions: readonly SubjectCondition[],
  subject: SubjectContext
): boolean => {
  return conditions.every((condition) => matchesSubjectCondition(condition, subject))
}

/**
 * Gets a human-readable description of why a subject does not match a condition
 *
 * @param condition - The SubjectCondition that failed to match
 * @param subject - The user context that was tested
 * @returns A string describing why the match failed, or null if it matched
 */
export const getSubjectMismatchReason = (
  condition: SubjectCondition,
  subject: SubjectContext
): string | null => {
  // Check roles condition
  if (condition.roles !== undefined && condition.roles.length > 0) {
    if (!matchesRoles(condition.roles, subject.role)) {
      return `User role '${subject.role}' is not in required roles: [${condition.roles.join(", ")}]`
    }
  }

  // Check functional roles condition
  if (condition.functionalRoles !== undefined && condition.functionalRoles.length > 0) {
    if (!matchesFunctionalRoles(condition.functionalRoles, subject.functionalRoles)) {
      const userRoles =
        subject.functionalRoles.length > 0
          ? subject.functionalRoles.join(", ")
          : "none"
      return `User functional roles [${userRoles}] do not include any of: [${condition.functionalRoles.join(", ")}]`
    }
  }

  // Check user IDs condition
  if (condition.userIds !== undefined && condition.userIds.length > 0) {
    if (!matchesUserIds(condition.userIds, subject.userId)) {
      return `User ID '${subject.userId}' is not in allowed user IDs`
    }
  }

  // Check platform admin condition
  if (condition.isPlatformAdmin !== undefined) {
    if (!matchesPlatformAdmin(condition.isPlatformAdmin, subject.isPlatformAdmin)) {
      const expected = condition.isPlatformAdmin ? "platform admin" : "non-platform admin"
      const actual = subject.isPlatformAdmin ? "platform admin" : "non-platform admin"
      return `User is ${actual} but condition requires ${expected}`
    }
  }

  // All conditions passed
  return null
}
