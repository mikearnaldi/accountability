/**
 * PolicyApiLive - Live implementation of policy API handlers
 *
 * Implements the PolicyApi endpoints using PolicyRepository and PolicyEngine.
 * System policies cannot be modified or deleted.
 *
 * @module PolicyApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { PolicyRepository } from "@accountability/persistence/Services/PolicyRepository"
import { OrganizationMemberRepository } from "@accountability/persistence/Services/OrganizationMemberRepository"
import { PolicyEngine, type PolicyEvaluationContext } from "@accountability/core/authorization/PolicyEngine"
import { PolicyId } from "@accountability/core/authorization/PolicyId"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { AuthorizationPolicy } from "@accountability/core/authorization/AuthorizationPolicy"
import type { SubjectCondition, ResourceCondition, ActionCondition, EnvironmentCondition } from "@accountability/core/authorization/PolicyConditions"
import type { ResourceContext, ResourceType } from "@accountability/core/authorization/matchers/ResourceMatcher"
import type { SubjectContext } from "@accountability/core/authorization/matchers/SubjectMatcher"
import { AppApi } from "../Definitions/AppApi.ts"
import {
  PolicyInfo,
  PolicyListResponse,
  TestPolicyResponse
} from "../Definitions/PolicyApi.ts"
import { UserNotMemberOfOrganizationError } from "@accountability/core/organization/OrganizationErrors"
import {
  PolicyNotFoundError,
  InvalidPolicyIdError,
  PolicyPriorityValidationError,
  InvalidResourceTypeError,
  SystemPolicyCannotBeModifiedError
} from "@accountability/core/authorization/AuthorizationErrors"
import {
  requireOrganizationContext,
  requireAdminOrOwner
} from "./OrganizationContextMiddlewareLive.ts"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import { getCurrentOrganizationMembership } from "@accountability/core/membership/CurrentOrganizationMembership"

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert AuthorizationPolicy to PolicyInfo for API responses
 */
const policyToInfo = (policy: AuthorizationPolicy): PolicyInfo =>
  PolicyInfo.make({
    id: policy.id,
    name: policy.name,
    description: policy.description,
    subject: policy.subject,
    resource: policy.resource,
    action: policy.action,
    environment: policy.environment,
    effect: policy.effect,
    priority: policy.priority,
    isSystemPolicy: policy.isSystemPolicy,
    isActive: policy.isActive,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
    createdBy: policy.createdBy
  })

/**
 * Validate policy ID from string
 */
const validatePolicyId = (policyIdString: string) =>
  Schema.decodeUnknown(PolicyId)(policyIdString).pipe(
    Effect.mapError(() => new InvalidPolicyIdError({ value: policyIdString }))
  )

/**
 * Valid resource types for the test endpoint
 */
const RESOURCE_TYPE_MAP: Record<string, ResourceType | undefined> = {
  organization: "organization",
  company: "company",
  account: "account",
  journal_entry: "journal_entry",
  fiscal_period: "fiscal_period",
  consolidation_group: "consolidation_group",
  report: "report"
}

/**
 * Create SubjectContext from membership
 */
const createSubjectContextFromMembership = (membership: {
  userId: AuthUserId
  role: "owner" | "admin" | "member" | "viewer"
  isController: boolean
  isFinanceManager: boolean
  isAccountant: boolean
  isPeriodAdmin: boolean
  isConsolidationManager: boolean
}): SubjectContext => {
  const functionalRoles: ("controller" | "finance_manager" | "accountant" | "period_admin" | "consolidation_manager")[] = []
  if (membership.isController) functionalRoles.push("controller")
  if (membership.isFinanceManager) functionalRoles.push("finance_manager")
  if (membership.isAccountant) functionalRoles.push("accountant")
  if (membership.isPeriodAdmin) functionalRoles.push("period_admin")
  if (membership.isConsolidationManager) functionalRoles.push("consolidation_manager")

  return {
    userId: membership.userId,
    role: membership.role,
    functionalRoles,
    isPlatformAdmin: false // TODO: Fetch from user record when needed
  }
}

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * PolicyApiLive - Layer providing PolicyApi handlers
 *
 * Requires:
 * - PolicyRepository
 * - PolicyEngine
 * - OrganizationMemberRepository
 */
export const PolicyApiLive = HttpApiBuilder.group(AppApi, "policy", (handlers) =>
  Effect.gen(function* () {
    const policyRepo = yield* PolicyRepository
    const policyEngine = yield* PolicyEngine
    const memberRepo = yield* OrganizationMemberRepository

    return handlers
      // =======================================================================
      // List Policies
      // =======================================================================
      .handle("listPolicies", ({ path }) =>
        requireOrganizationContext(
          path.orgId,
          Effect.gen(function* () {
            // Only admins can view policies
            yield* requireAdminOrOwner

            const membership = yield* getCurrentOrganizationMembership()

            // Get all policies for the organization
            const policies = yield* policyRepo.findByOrganization(membership.organizationId).pipe(
              Effect.orDie
            )

            return PolicyListResponse.make({
              policies: policies.map(policyToInfo)
            })
          })
        )
      )

      // =======================================================================
      // Get Policy
      // =======================================================================
      .handle("getPolicy", ({ path }) =>
        requireOrganizationContext(
          path.orgId,
          Effect.gen(function* () {
            // Only admins can view policies
            yield* requireAdminOrOwner

            const membership = yield* getCurrentOrganizationMembership()
            const policyId = yield* validatePolicyId(path.policyId)

            // Get the policy
            const maybePolicy = yield* policyRepo.findById(policyId).pipe(
              Effect.orDie
            )

            if (Option.isNone(maybePolicy)) {
              return yield* Effect.fail(new PolicyNotFoundError({ policyId: path.policyId }))
            }

            const policy = maybePolicy.value

            // Verify the policy belongs to this organization
            if (policy.organizationId !== membership.organizationId) {
              return yield* Effect.fail(new PolicyNotFoundError({ policyId: path.policyId }))
            }

            return policyToInfo(policy)
          })
        )
      )

      // =======================================================================
      // Create Policy
      // =======================================================================
      .handle("createPolicy", ({ path, payload }) =>
        requireOrganizationContext(
          path.orgId,
          Effect.gen(function* () {
            // Only admins can create policies
            yield* requireAdminOrOwner

            const membership = yield* getCurrentOrganizationMembership()
            const currentUserInfo = yield* CurrentUser
            const currentUserId = AuthUserId.make(currentUserInfo.userId)

            // Validate priority is not in system policy range (900-1000)
            if (payload.priority > 899) {
              return yield* Effect.fail(
                new PolicyPriorityValidationError({ priority: payload.priority, maxAllowed: 899 })
              )
            }

            // Generate new policy ID
            const policyId = PolicyId.make(crypto.randomUUID())

            // Build create input - include optional fields conditionally
            const createInput = {
              id: policyId,
              organizationId: membership.organizationId,
              name: payload.name,
              subject: payload.subject,
              resource: payload.resource,
              action: payload.action,
              effect: payload.effect,
              priority: payload.priority,
              isSystemPolicy: false,
              isActive: payload.isActive,
              createdBy: currentUserId,
              ...(Option.isSome(payload.description) ? { description: payload.description.value } : {}),
              ...(Option.isSome(payload.environment) ? { environment: payload.environment.value } : {})
            }

            // Create the policy - persistence errors are infrastructure failures
            const policy = yield* policyRepo.create(createInput).pipe(Effect.orDie)

            return policyToInfo(policy)
          })
        )
      )

      // =======================================================================
      // Update Policy
      // =======================================================================
      .handle("updatePolicy", ({ path, payload }) =>
        requireOrganizationContext(
          path.orgId,
          Effect.gen(function* () {
            // Only admins can update policies
            yield* requireAdminOrOwner

            const membership = yield* getCurrentOrganizationMembership()
            const policyId = yield* validatePolicyId(path.policyId)

            // Check if the policy exists and belongs to this organization
            const maybePolicy = yield* policyRepo.findById(policyId).pipe(
              Effect.orDie
            )

            if (Option.isNone(maybePolicy)) {
              return yield* Effect.fail(new PolicyNotFoundError({ policyId: path.policyId }))
            }

            const existingPolicy = maybePolicy.value

            // Verify the policy belongs to this organization
            if (existingPolicy.organizationId !== membership.organizationId) {
              return yield* Effect.fail(new PolicyNotFoundError({ policyId: path.policyId }))
            }

            // Validate priority if provided
            if (Option.isSome(payload.priority) && payload.priority.value > 899) {
              return yield* Effect.fail(
                new PolicyPriorityValidationError({ priority: payload.priority.value, maxAllowed: 899 })
              )
            }

            // Build update input - only include fields that have values
            const updateInput: {
              name?: string
              description?: string | null
              subject?: SubjectCondition
              resource?: ResourceCondition
              action?: ActionCondition
              environment?: EnvironmentCondition | null
              effect?: "allow" | "deny"
              priority?: number
              isActive?: boolean
            } = {}
            if (Option.isSome(payload.name)) updateInput.name = payload.name.value
            if (Option.isSome(payload.description)) updateInput.description = payload.description.value
            if (Option.isSome(payload.subject)) updateInput.subject = payload.subject.value
            if (Option.isSome(payload.resource)) updateInput.resource = payload.resource.value
            if (Option.isSome(payload.action)) updateInput.action = payload.action.value
            if (Option.isSome(payload.environment)) updateInput.environment = payload.environment.value
            if (Option.isSome(payload.effect)) updateInput.effect = payload.effect.value
            if (Option.isSome(payload.priority)) updateInput.priority = payload.priority.value
            if (Option.isSome(payload.isActive)) updateInput.isActive = payload.isActive.value

            // Update the policy
            const policy = yield* policyRepo.update(policyId, updateInput).pipe(
              Effect.catchTags({
                SystemPolicyProtectionError: () => Effect.fail(new SystemPolicyCannotBeModifiedError({ policyId: path.policyId, operation: "modified" })),
                EntityNotFoundError: () => Effect.fail(new PolicyNotFoundError({ policyId: path.policyId })),
                PersistenceError: Effect.die
              })
            )

            return policyToInfo(policy)
          })
        )
      )

      // =======================================================================
      // Delete Policy
      // =======================================================================
      .handle("deletePolicy", ({ path }) =>
        requireOrganizationContext(
          path.orgId,
          Effect.gen(function* () {
            // Only admins can delete policies
            yield* requireAdminOrOwner

            const membership = yield* getCurrentOrganizationMembership()
            const policyId = yield* validatePolicyId(path.policyId)

            // Check if the policy exists and belongs to this organization
            const maybePolicy = yield* policyRepo.findById(policyId).pipe(
              Effect.orDie
            )

            if (Option.isNone(maybePolicy)) {
              return yield* Effect.fail(new PolicyNotFoundError({ policyId: path.policyId }))
            }

            const existingPolicy = maybePolicy.value

            // Verify the policy belongs to this organization
            if (existingPolicy.organizationId !== membership.organizationId) {
              return yield* Effect.fail(new PolicyNotFoundError({ policyId: path.policyId }))
            }

            // Delete the policy
            yield* policyRepo.delete(policyId).pipe(
              Effect.catchTags({
                SystemPolicyProtectionError: () => Effect.fail(new SystemPolicyCannotBeModifiedError({ policyId: path.policyId, operation: "deleted" })),
                EntityNotFoundError: () => Effect.fail(new PolicyNotFoundError({ policyId: path.policyId })),
                PersistenceError: Effect.die
              })
            )
          })
        )
      )

      // =======================================================================
      // Test Policy (Simulate Authorization)
      // =======================================================================
      .handle("testPolicy", ({ path, payload }) =>
        requireOrganizationContext(
          path.orgId,
          Effect.gen(function* () {
            // Only admins can test policies
            yield* requireAdminOrOwner

            const membership = yield* getCurrentOrganizationMembership()
            const orgId = membership.organizationId

            // Validate resource type
            const resourceType = RESOURCE_TYPE_MAP[payload.resourceType]
            if (!resourceType) {
              return yield* Effect.fail(
                new InvalidResourceTypeError({
                  resourceType: payload.resourceType,
                  validTypes: ["organization", "company", "account", "journal_entry", "fiscal_period", "consolidation_group", "report"]
                })
              )
            }

            // Load the target user's membership to get their subject context
            const targetUserMembership = yield* memberRepo.findByUserAndOrganization(
              payload.userId,
              orgId
            ).pipe(Effect.orDie)

            if (Option.isNone(targetUserMembership)) {
              return yield* Effect.fail(
                new UserNotMemberOfOrganizationError({
                  userId: payload.userId,
                  organizationId: orgId
                })
              )
            }

            // Create subject context from membership
            const subjectContext = createSubjectContextFromMembership(targetUserMembership.value)

            // Create resource context - only add id if present
            const resourceContext: ResourceContext = Option.isSome(payload.resourceId)
              ? { type: resourceType, id: payload.resourceId.value }
              : { type: resourceType }

            // Create evaluation context
            const evalContext: PolicyEvaluationContext = {
              subject: subjectContext,
              resource: resourceContext,
              action: payload.action
            }

            // Get all active policies for the organization
            const policies = yield* policyRepo.findActiveByOrganization(orgId).pipe(
              Effect.orDie
            )

            // Evaluate policies
            const result = yield* policyEngine.evaluatePolicies(policies, evalContext)

            return TestPolicyResponse.make({
              decision: result.decision,
              matchedPolicies: result.matchedPolicies.map(policyToInfo),
              reason: result.reason
            })
          })
        )
      )
  })
)
