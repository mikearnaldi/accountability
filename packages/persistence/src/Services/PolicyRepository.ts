/**
 * PolicyRepository - Repository interface for AuthorizationPolicy persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * System policies (isSystemPolicy=true) cannot be created, updated, or deleted
 * by users - they are seeded by the system.
 *
 * @module PolicyRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { AuthorizationPolicy } from "@accountability/core/authorization/AuthorizationPolicy"
import type { PolicyId } from "@accountability/core/authorization/PolicyId"
import type { PolicyEffect } from "@accountability/core/authorization/PolicyEffect"
import type { SubjectCondition, ResourceCondition, ActionCondition, EnvironmentCondition } from "@accountability/core/authorization/PolicyConditions"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * Error when attempting to modify a system policy
 */
export class SystemPolicyProtectionError extends Error {
  readonly _tag = "SystemPolicyProtectionError"

  constructor(
    readonly policyId: PolicyId,
    readonly operation: "update" | "delete"
  ) {
    super(`Cannot ${operation} system policy: ${policyId}`)
    this.name = "SystemPolicyProtectionError"
  }
}

/**
 * Input for creating a new policy
 */
export interface CreatePolicyInput {
  readonly id: PolicyId
  readonly organizationId: OrganizationId
  readonly name: string
  readonly description?: string
  readonly subject: SubjectCondition
  readonly resource: ResourceCondition
  readonly action: ActionCondition
  readonly environment?: EnvironmentCondition
  readonly effect: PolicyEffect
  readonly priority: number
  readonly isSystemPolicy?: boolean
  readonly isActive?: boolean
  readonly createdBy?: AuthUserId
}

/**
 * Input for updating a policy
 */
export interface UpdatePolicyInput {
  readonly name?: string
  readonly description?: string | null
  readonly subject?: SubjectCondition
  readonly resource?: ResourceCondition
  readonly action?: ActionCondition
  readonly environment?: EnvironmentCondition | null
  readonly effect?: PolicyEffect
  readonly priority?: number
  readonly isActive?: boolean
}

/**
 * PolicyRepository - Service interface for AuthorizationPolicy persistence
 *
 * Provides CRUD operations for policy entities with typed error handling.
 */
export interface PolicyRepositoryService {
  /**
   * Find a policy by its unique identifier
   *
   * @param id - The policy ID to search for
   * @returns Effect containing Option of AuthorizationPolicy (None if not found)
   */
  readonly findById: (
    id: PolicyId
  ) => Effect.Effect<Option.Option<AuthorizationPolicy>, PersistenceError>

  /**
   * Find all policies for an organization
   *
   * @param organizationId - The organization ID
   * @returns Effect containing array of policies
   */
  readonly findByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<AuthorizationPolicy>, PersistenceError>

  /**
   * Find all active policies for an organization
   *
   * @param organizationId - The organization ID
   * @returns Effect containing array of active policies ordered by priority (desc)
   */
  readonly findActiveByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<AuthorizationPolicy>, PersistenceError>

  /**
   * Create a new policy
   *
   * @param input - The policy details
   * @returns Effect containing the created policy
   */
  readonly create: (
    input: CreatePolicyInput
  ) => Effect.Effect<AuthorizationPolicy, PersistenceError>

  /**
   * Update a policy
   * Rejects updates to system policies.
   *
   * @param id - The policy ID
   * @param changes - The changes to apply
   * @returns Effect containing the updated policy
   * @throws EntityNotFoundError if policy doesn't exist
   * @throws SystemPolicyProtectionError if policy is a system policy
   */
  readonly update: (
    id: PolicyId,
    changes: UpdatePolicyInput
  ) => Effect.Effect<AuthorizationPolicy, EntityNotFoundError | SystemPolicyProtectionError | PersistenceError>

  /**
   * Delete a policy
   * Rejects deletion of system policies.
   *
   * @param id - The policy ID
   * @returns Effect containing void
   * @throws EntityNotFoundError if policy doesn't exist
   * @throws SystemPolicyProtectionError if policy is a system policy
   */
  readonly delete: (
    id: PolicyId
  ) => Effect.Effect<void, EntityNotFoundError | SystemPolicyProtectionError | PersistenceError>

  /**
   * Find policy by ID, throwing if not found
   *
   * @param id - The policy ID to search for
   * @returns Effect containing the policy
   * @throws EntityNotFoundError if policy doesn't exist
   */
  readonly getById: (
    id: PolicyId
  ) => Effect.Effect<AuthorizationPolicy, EntityNotFoundError | PersistenceError>
}

/**
 * PolicyRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { PolicyRepository } from "@accountability/persistence/Services/PolicyRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* PolicyRepository
 *   const policies = yield* repo.findActiveByOrganization(orgId)
 *   // ...
 * })
 * ```
 */
export class PolicyRepository extends Context.Tag("PolicyRepository")<
  PolicyRepository,
  PolicyRepositoryService
>() {}
