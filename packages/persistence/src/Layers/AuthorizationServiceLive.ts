/**
 * AuthorizationServiceLive - ABAC + RBAC implementation of AuthorizationService
 *
 * Implements permission checking using:
 * 1. ABAC Policy Engine for organizations with custom policies
 * 2. RBAC permission matrix as fallback when no policies exist
 *
 * Uses the CurrentOrganizationMembership context to determine the user's
 * role and functional roles.
 *
 * Includes denial audit logging per Phase E14 - all permission denials
 * are logged to the authorization_audit_log table.
 *
 * Phase F7: Integrated ABAC policy engine with PolicyEngine.evaluatePolicies()
 * and PolicyRepository. Falls back to RBAC matrix for backward compatibility
 * when no policies exist.
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
import { AuthorizationAuditRepository } from "../Services/AuthorizationAuditRepository.ts"
import { PolicyRepository } from "../Services/PolicyRepository.ts"
import { PolicyEngine, type PolicyEvaluationContext } from "@accountability/core/Auth/PolicyEngine"
import {
  createSubjectContextFromMembership
} from "@accountability/core/Auth/matchers/SubjectMatcher"
import type { ResourceType, ResourceContext } from "@accountability/core/Auth/matchers/ResourceMatcher"

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Lookup table to convert resource type strings to ResourceType
 * Used to avoid type assertions when creating ResourceContext
 */
const RESOURCE_TYPE_MAP: Record<string, ResourceType | undefined> = {
  organization: "organization",
  company: "company",
  account: "account",
  journal_entry: "journal_entry",
  fiscal_period: "fiscal_period",
  consolidation_group: "consolidation_group",
  report: "report",
  exchange_rate: "report", // Map exchange_rate to report (read-only)
  elimination: "consolidation_group", // Map elimination to consolidation_group
  audit_log: "organization" // Map audit_log to organization
}

/**
 * Convert a resource type string to ResourceContext
 * Returns undefined if the resource type is not known
 */
const createResourceContext = (resourceTypeString: string): ResourceContext | undefined => {
  const type = RESOURCE_TYPE_MAP[resourceTypeString]
  if (type === undefined) {
    return undefined
  }
  return { type }
}

/**
 * Extract functional roles array from membership
 */
const extractFunctionalRoles = (membership: {
  readonly isController: boolean
  readonly isFinanceManager: boolean
  readonly isAccountant: boolean
  readonly isPeriodAdmin: boolean
  readonly isConsolidationManager: boolean
}): FunctionalRole[] => {
  const functionalRoles: FunctionalRole[] = []
  if (membership.isController) functionalRoles.push("controller")
  if (membership.isFinanceManager) functionalRoles.push("finance_manager")
  if (membership.isAccountant) functionalRoles.push("accountant")
  if (membership.isPeriodAdmin) functionalRoles.push("period_admin")
  if (membership.isConsolidationManager) functionalRoles.push("consolidation_manager")
  return functionalRoles
}

/**
 * Check permission using RBAC permission matrix
 * Returns the denial reason if denied, or undefined if allowed
 */
const checkWithRBAC = (
  role: BaseRole,
  functionalRoles: readonly FunctionalRole[],
  action: Action
): string | undefined => {
  const permissions = computeEffectivePermissions(role, functionalRoles)
  if (!hasPermission(permissions, action)) {
    return `Role '${role}' does not have permission for '${action}'`
  }
  return undefined
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Creates the AuthorizationService implementation
 */
const make = Effect.gen(function* () {
  const auditRepo = yield* AuthorizationAuditRepository
  const policyRepo = yield* PolicyRepository
  const policyEngine = yield* PolicyEngine

  const service: AuthorizationServiceShape = {
    /**
     * Check if the current user has permission to perform an action
     *
     * Uses ABAC policy engine if the organization has policies.
     * Falls back to RBAC permission matrix if no policies exist.
     * Logs denied attempts to authorization_audit_log.
     */
    checkPermission: (action: Action) =>
      Effect.gen(function* () {
        const membership = yield* getCurrentOrganizationMembership()
        const functionalRoles = extractFunctionalRoles(membership)
        const resourceType = getResourceType(action)

        // Load active policies for the organization
        const policies = yield* policyRepo
          .findActiveByOrganization(membership.organizationId)
          .pipe(Effect.catchAll(() => Effect.succeed([] as const)))

        let denialReason: string | undefined

        if (policies.length === 0) {
          // No policies - fall back to RBAC permission matrix
          denialReason = checkWithRBAC(membership.role, functionalRoles, action)
        } else {
          // Use ABAC policy engine
          // Note: isPlatformAdmin is not currently tracked in membership
          // For now, we assume non-platform admin. This can be enhanced
          // when user-level platform admin flag is accessible.
          const subjectContext = createSubjectContextFromMembership(membership, false)
          const resourceContext = createResourceContext(resourceType)

          // If resource type is not recognized, fall back to RBAC
          if (resourceContext === undefined) {
            denialReason = checkWithRBAC(membership.role, functionalRoles, action)
          } else {
            const evalContext: PolicyEvaluationContext = {
              subject: subjectContext,
              resource: resourceContext,
              action
              // environment could be added here for IP/time-based policies
            }

            const result = yield* policyEngine.evaluatePolicies(policies, evalContext)

            if (result.decision === "deny") {
              denialReason = result.reason
            }
          }
        }

        if (denialReason !== undefined) {
          // Log the denial to audit log (fire-and-forget, don't block on logging)
          yield* auditRepo
            .logDenial({
              userId: membership.userId,
              organizationId: membership.organizationId,
              action,
              resourceType,
              denialReason
              // ipAddress and userAgent are optional - not available in current context
            })
            .pipe(
              // Don't fail the main operation if logging fails
              Effect.catchAll(() => Effect.void)
            )

          return yield* Effect.fail(
            new PermissionDeniedError({
              action,
              resourceType,
              reason: denialReason
            })
          )
        }
      }),

    /**
     * Check multiple permissions at once
     *
     * Uses ABAC policy engine if the organization has policies.
     * Falls back to RBAC permission matrix if no policies exist.
     */
    checkPermissions: (actions: readonly Action[]) =>
      Effect.gen(function* () {
        const membership = yield* getCurrentOrganizationMembership()
        const functionalRoles = extractFunctionalRoles(membership)

        // Load active policies for the organization
        const policies = yield* policyRepo
          .findActiveByOrganization(membership.organizationId)
          .pipe(Effect.catchAll(() => Effect.succeed([] as const)))

        const result: Partial<Record<Action, boolean>> = {}

        if (policies.length === 0) {
          // No policies - fall back to RBAC permission matrix
          const permissions = computeEffectivePermissions(membership.role, functionalRoles)
          for (const action of actions) {
            result[action] = hasPermission(permissions, action)
          }
        } else {
          // Use ABAC policy engine for each action
          const subjectContext = createSubjectContextFromMembership(membership, false)

          for (const action of actions) {
            const resourceType = getResourceType(action)
            const resourceContext = createResourceContext(resourceType)

            // If resource type is not recognized, fall back to RBAC for this action
            if (resourceContext === undefined) {
              const permissions = computeEffectivePermissions(membership.role, functionalRoles)
              result[action] = hasPermission(permissions, action)
            } else {
              const evalContext: PolicyEvaluationContext = {
                subject: subjectContext,
                resource: resourceContext,
                action
              }

              const evalResult = yield* policyEngine.evaluatePolicies(policies, evalContext)
              result[action] = evalResult.decision === "allow"
            }
          }
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
     *
     * Uses ABAC policy engine if the organization has policies.
     * Falls back to RBAC permission matrix if no policies exist.
     */
    getEffectivePermissions: () =>
      Effect.gen(function* () {
        const membership = yield* getCurrentOrganizationMembership()
        const functionalRoles = extractFunctionalRoles(membership)

        // Load active policies for the organization
        const policies = yield* policyRepo
          .findActiveByOrganization(membership.organizationId)
          .pipe(Effect.catchAll(() => Effect.succeed([] as const)))

        if (policies.length === 0) {
          // No policies - fall back to RBAC permission matrix
          const permissions = computeEffectivePermissions(membership.role, functionalRoles)
          return permissionSetToArray(permissions)
        }

        // Use ABAC policy engine - check each possible action
        const subjectContext = createSubjectContextFromMembership(membership, false)
        const allowedActions: Action[] = []

        // Get all actions from the permission matrix to check
        const allActions = permissionSetToArray(computeEffectivePermissions("owner", []))

        for (const action of allActions) {
          const resourceType = getResourceType(action)
          const resourceContext = createResourceContext(resourceType)

          // If resource type is not recognized, fall back to RBAC for this action
          if (resourceContext === undefined) {
            const permissions = computeEffectivePermissions(membership.role, functionalRoles)
            if (hasPermission(permissions, action)) {
              allowedActions.push(action)
            }
          } else {
            const evalContext: PolicyEvaluationContext = {
              subject: subjectContext,
              resource: resourceContext,
              action
            }

            const evalResult = yield* policyEngine.evaluatePolicies(policies, evalContext)
            if (evalResult.decision === "allow") {
              allowedActions.push(action)
            }
          }
        }

        return allowedActions
      })
  }

  return service
})

/**
 * AuthorizationServiceLive - Layer providing AuthorizationService implementation
 *
 * This layer depends on:
 * - AuthorizationAuditRepository for denial logging
 * - PolicyRepository for loading organization policies
 * - PolicyEngine for evaluating ABAC policies
 *
 * CurrentOrganizationMembership must be in context when methods are called.
 *
 * The service uses ABAC policy evaluation when policies exist for the organization,
 * and falls back to RBAC permission matrix when no policies are present.
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
export const AuthorizationServiceLive: Layer.Layer<
  AuthorizationService,
  never,
  AuthorizationAuditRepository | PolicyRepository | PolicyEngine
> = Layer.effect(AuthorizationService, make)
