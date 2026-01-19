/**
 * InvitationRepository - Repository interface for OrganizationInvitation persistence
 *
 * Uses Effect Context.Tag pattern for dependency injection.
 * All operations return Effect with typed errors.
 *
 * Token hashing uses SHA-256 for secure storage. Raw tokens are never stored.
 *
 * @module InvitationRepository
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { OrganizationInvitation, InvitationRole } from "@accountability/core/membership/OrganizationInvitation"
import type { InvitationId } from "@accountability/core/membership/InvitationId"
import type { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import type { OrganizationId } from "@accountability/core/organization/Organization"
import type { FunctionalRole } from "@accountability/core/authorization/FunctionalRole"
import type { EntityNotFoundError, PersistenceError } from "../Errors/RepositoryError.ts"

/**
 * Input for creating a new invitation
 */
export interface CreateInvitationInput {
  readonly id: InvitationId
  readonly organizationId: OrganizationId
  readonly email: string
  readonly role: InvitationRole
  readonly functionalRoles: readonly FunctionalRole[]
  readonly invitedBy: AuthUserId
}

/**
 * InvitationRepository - Service interface for OrganizationInvitation persistence
 *
 * Provides CRUD operations for invitation entities with typed error handling.
 */
export interface InvitationRepositoryService {
  /**
   * Create a new invitation with raw token
   * The token will be hashed before storage using SHA-256
   *
   * @param input - The invitation details
   * @param rawToken - The raw token to hash and store
   * @returns Effect containing the created invitation
   */
  readonly create: (
    input: CreateInvitationInput,
    rawToken: string
  ) => Effect.Effect<OrganizationInvitation, PersistenceError>

  /**
   * Find invitation by its unique identifier
   *
   * @param id - The invitation ID to search for
   * @returns Effect containing Option of OrganizationInvitation (None if not found)
   */
  readonly findById: (
    id: InvitationId
  ) => Effect.Effect<Option.Option<OrganizationInvitation>, PersistenceError>

  /**
   * Find invitation by token hash
   *
   * @param tokenHash - The SHA-256 hash of the token
   * @returns Effect containing Option of OrganizationInvitation (None if not found)
   */
  readonly findByTokenHash: (
    tokenHash: string
  ) => Effect.Effect<Option.Option<OrganizationInvitation>, PersistenceError>

  /**
   * Find all invitations for an organization
   *
   * @param organizationId - The organization ID
   * @returns Effect containing array of invitations
   */
  readonly findByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<OrganizationInvitation>, PersistenceError>

  /**
   * Find pending invitations for an organization
   *
   * @param organizationId - The organization ID
   * @returns Effect containing array of pending invitations
   */
  readonly findPendingByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<OrganizationInvitation>, PersistenceError>

  /**
   * Find pending invitations by email
   *
   * @param email - The email address
   * @returns Effect containing array of pending invitations
   */
  readonly findPendingByEmail: (
    email: string
  ) => Effect.Effect<ReadonlyArray<OrganizationInvitation>, PersistenceError>

  /**
   * Mark an invitation as accepted
   *
   * @param id - The invitation ID
   * @param acceptedBy - The user who accepted the invitation
   * @returns Effect containing the updated invitation
   * @throws EntityNotFoundError if invitation doesn't exist
   */
  readonly accept: (
    id: InvitationId,
    acceptedBy: AuthUserId
  ) => Effect.Effect<OrganizationInvitation, EntityNotFoundError | PersistenceError>

  /**
   * Mark an invitation as revoked
   *
   * @param id - The invitation ID
   * @param revokedBy - The user who revoked the invitation
   * @returns Effect containing the updated invitation
   * @throws EntityNotFoundError if invitation doesn't exist
   */
  readonly revoke: (
    id: InvitationId,
    revokedBy: AuthUserId
  ) => Effect.Effect<OrganizationInvitation, EntityNotFoundError | PersistenceError>

  /**
   * Find invitation by ID, throwing if not found
   *
   * @param id - The invitation ID to search for
   * @returns Effect containing the invitation
   * @throws EntityNotFoundError if invitation doesn't exist
   */
  readonly getById: (
    id: InvitationId
  ) => Effect.Effect<OrganizationInvitation, EntityNotFoundError | PersistenceError>

  /**
   * Check if a pending invitation exists for email in an organization
   *
   * @param email - The email address
   * @param organizationId - The organization ID
   * @returns Effect containing boolean indicating if pending invitation exists
   */
  readonly hasPendingInvitation: (
    email: string,
    organizationId: OrganizationId
  ) => Effect.Effect<boolean, PersistenceError>
}

/**
 * InvitationRepository - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * import { InvitationRepository } from "@accountability/persistence/Services/InvitationRepository"
 *
 * const program = Effect.gen(function* () {
 *   const repo = yield* InvitationRepository
 *   const invitation = yield* repo.findByTokenHash(hash)
 *   // ...
 * })
 * ```
 */
export class InvitationRepository extends Context.Tag("InvitationRepository")<
  InvitationRepository,
  InvitationRepositoryService
>() {}
