/**
 * OrganizationMemberRepository - Repository interface for OrganizationMembership persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * @module OrganizationMemberRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { OrganizationMembership } from "@accountability/core/membership/OrganizationMembership"
import type { OrganizationMembershipId } from "@accountability/core/membership/OrganizationMembershipId"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { BaseRole } from "@accountability/core/authorization/BaseRole"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * Input for updating membership role and functional roles
 */
export interface UpdateMembershipInput {
  readonly role?: BaseRole
  readonly isController?: boolean
  readonly isFinanceManager?: boolean
  readonly isAccountant?: boolean
  readonly isPeriodAdmin?: boolean
  readonly isConsolidationManager?: boolean
}

/**
 * OrganizationMemberRepository - Service interface for OrganizationMembership persistence
 *
 * Provides CRUD operations for membership entities with typed error handling.
 */
export interface OrganizationMemberRepositoryService {
  /**
   * Find a membership by its unique identifier
   *
   * @param id - The membership ID to search for
   * @returns Effect containing Option of OrganizationMembership (None if not found)
   */
  readonly findById: (
    id: OrganizationMembershipId
  ) => Effect.Effect<Option.Option<OrganizationMembership>, PersistenceError>

  /**
   * Find all members belonging to an organization (any status)
   *
   * @param organizationId - The organization ID to filter by
   * @returns Effect containing array of memberships
   */
  readonly findByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<OrganizationMembership>, PersistenceError>

  /**
   * Find all active members belonging to an organization
   *
   * @param organizationId - The organization ID to filter by
   * @returns Effect containing array of active memberships only
   */
  readonly findActiveByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<OrganizationMembership>, PersistenceError>

  /**
   * Find all memberships for a user
   *
   * @param userId - The user ID to filter by
   * @returns Effect containing array of memberships
   */
  readonly findByUser: (
    userId: AuthUserId
  ) => Effect.Effect<ReadonlyArray<OrganizationMembership>, PersistenceError>

  /**
   * Find all active memberships for a user
   *
   * @param userId - The user ID to filter by
   * @returns Effect containing array of active memberships
   */
  readonly findActiveByUser: (
    userId: AuthUserId
  ) => Effect.Effect<ReadonlyArray<OrganizationMembership>, PersistenceError>

  /**
   * Find membership by user and organization
   *
   * @param userId - The user ID
   * @param organizationId - The organization ID
   * @returns Effect containing Option of OrganizationMembership
   */
  readonly findByUserAndOrganization: (
    userId: AuthUserId,
    organizationId: OrganizationId
  ) => Effect.Effect<Option.Option<OrganizationMembership>, PersistenceError>

  /**
   * Create a new membership
   *
   * @param membership - The membership entity to create
   * @returns Effect containing the created membership
   */
  readonly create: (
    membership: OrganizationMembership
  ) => Effect.Effect<OrganizationMembership, PersistenceError>

  /**
   * Update membership role and functional roles
   *
   * @param id - The membership ID to update
   * @param changes - The changes to apply
   * @returns Effect containing the updated membership
   * @throws EntityNotFoundError if membership doesn't exist
   */
  readonly update: (
    id: OrganizationMembershipId,
    changes: UpdateMembershipInput
  ) => Effect.Effect<OrganizationMembership, EntityNotFoundError | PersistenceError>

  /**
   * Remove a member (soft delete)
   *
   * @param id - The membership ID to remove
   * @param removedBy - The user who is removing the member
   * @param reason - Optional reason for removal
   * @returns Effect containing the updated membership
   * @throws EntityNotFoundError if membership doesn't exist
   */
  readonly remove: (
    id: OrganizationMembershipId,
    removedBy: AuthUserId,
    reason?: string
  ) => Effect.Effect<OrganizationMembership, EntityNotFoundError | PersistenceError>

  /**
   * Reinstate a removed member
   *
   * @param id - The membership ID to reinstate
   * @param reinstatedBy - The user who is reinstating the member
   * @returns Effect containing the updated membership
   * @throws EntityNotFoundError if membership doesn't exist
   */
  readonly reinstate: (
    id: OrganizationMembershipId,
    reinstatedBy: AuthUserId
  ) => Effect.Effect<OrganizationMembership, EntityNotFoundError | PersistenceError>

  /**
   * Suspend a member (temporary access denial)
   *
   * @param id - The membership ID to suspend
   * @param suspendedBy - The user who is suspending the member
   * @param reason - Optional reason for suspension
   * @returns Effect containing the updated membership
   * @throws EntityNotFoundError if membership doesn't exist
   */
  readonly suspend: (
    id: OrganizationMembershipId,
    suspendedBy: AuthUserId,
    reason?: string
  ) => Effect.Effect<OrganizationMembership, EntityNotFoundError | PersistenceError>

  /**
   * Unsuspend a member (restore access)
   *
   * @param id - The membership ID to unsuspend
   * @param unsuspendedBy - The user who is unsuspending the member
   * @returns Effect containing the updated membership
   * @throws EntityNotFoundError if membership doesn't exist
   */
  readonly unsuspend: (
    id: OrganizationMembershipId,
    unsuspendedBy: AuthUserId
  ) => Effect.Effect<OrganizationMembership, EntityNotFoundError | PersistenceError>

  /**
   * Find membership by ID, throwing if not found
   *
   * @param id - The membership ID to search for
   * @returns Effect containing the membership
   * @throws EntityNotFoundError if membership doesn't exist
   */
  readonly getById: (
    id: OrganizationMembershipId
  ) => Effect.Effect<OrganizationMembership, EntityNotFoundError | PersistenceError>

  /**
   * Check if a user is a member of an organization
   *
   * @param userId - The user ID
   * @param organizationId - The organization ID
   * @returns Effect containing boolean indicating membership
   */
  readonly isMember: (
    userId: AuthUserId,
    organizationId: OrganizationId
  ) => Effect.Effect<boolean, PersistenceError>

  /**
   * Find the owner of an organization
   *
   * @param organizationId - The organization ID
   * @returns Effect containing Option of the owner membership
   */
  readonly findOwner: (
    organizationId: OrganizationId
  ) => Effect.Effect<Option.Option<OrganizationMembership>, PersistenceError>
}

/**
 * OrganizationMemberRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { OrganizationMemberRepository } from "@accountability/persistence/Services/OrganizationMemberRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* OrganizationMemberRepository
 *   const members = yield* repo.findByOrganization(orgId)
 *   // ...
 * })
 * ```
 */
export class OrganizationMemberRepository extends Context.Tag("OrganizationMemberRepository")<
  OrganizationMemberRepository,
  OrganizationMemberRepositoryService
>() {}
