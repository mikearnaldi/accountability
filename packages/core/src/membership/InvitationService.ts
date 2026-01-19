/**
 * InvitationService - Service interface for organization invitation management
 *
 * Provides business logic for managing organization invitations including:
 * - Creating invitations with token generation
 * - Accepting invitations and creating memberships
 * - Declining and revoking invitations
 *
 * @module membership/InvitationService
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { OrganizationInvitation, InvitationRole } from "./OrganizationInvitation.ts"
import type { InvitationId } from "./InvitationId.ts"
import type { OrganizationMembership } from "./OrganizationMembership.ts"
import type { AuthUserId } from "../authentication/AuthUserId.ts"
import type { OrganizationId } from "../organization/Organization.ts"
import type { FunctionalRole } from "../authorization/FunctionalRole.ts"
import type {
  InvalidInvitationError,
  InvitationExpiredError,
  InvitationAlreadyExistsError,
  UserAlreadyMemberError
} from "../authorization/AuthorizationErrors.ts"
import type { PersistenceError, EntityNotFoundError } from "../shared/errors/RepositoryError.ts"

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * Input for creating an invitation
 */
export interface CreateInvitationInput {
  readonly organizationId: OrganizationId
  readonly email: string
  readonly role: InvitationRole
  readonly functionalRoles: readonly FunctionalRole[]
  readonly invitedBy: AuthUserId
}

/**
 * Result of creating an invitation
 */
export interface CreateInvitationResult {
  readonly invitation: OrganizationInvitation
  /** The raw token to send to the invitee (only returned on creation) */
  readonly rawToken: string
}

/**
 * Result of accepting an invitation
 */
export interface AcceptInvitationResult {
  readonly invitation: OrganizationInvitation
  readonly membership: OrganizationMembership
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * InvitationServiceShape - The shape of the invitation service
 *
 * Provides all invitation management operations including:
 * - Creating invitations with secure token generation
 * - Accepting invitations (creating membership)
 * - Declining invitations
 * - Revoking invitations (admin action)
 */
export interface InvitationServiceShape {
  /**
   * Create a new invitation
   *
   * Generates a secure token and creates an invitation record.
   * The raw token is returned and should be sent to the invitee via email.
   *
   * @param input - The invitation details
   * @returns Effect containing the invitation and raw token
   * @errors InvitationAlreadyExistsError - A pending invitation already exists for this email/org
   * @errors PersistenceError - Database operation failed
   */
  readonly createInvitation: (
    input: CreateInvitationInput
  ) => Effect.Effect<
    CreateInvitationResult,
    InvitationAlreadyExistsError | PersistenceError
  >

  /**
   * Accept an invitation
   *
   * Validates the token, creates a membership for the user, and marks
   * the invitation as accepted.
   *
   * @param token - The raw invitation token
   * @param userId - The user accepting the invitation
   * @returns Effect containing the updated invitation and new membership
   * @errors InvalidInvitationError - Token not found or invitation not in pending state
   * @errors InvitationExpiredError - Invitation has been revoked
   * @errors UserAlreadyMemberError - User is already a member of the organization
   * @errors PersistenceError - Database operation failed
   */
  readonly acceptInvitation: (
    token: string,
    userId: AuthUserId
  ) => Effect.Effect<
    AcceptInvitationResult,
    InvalidInvitationError | InvitationExpiredError | UserAlreadyMemberError | PersistenceError | EntityNotFoundError
  >

  /**
   * Decline an invitation
   *
   * Marks the invitation as revoked. The invitee declines the invitation.
   *
   * @param token - The raw invitation token
   * @returns Effect containing the updated invitation
   * @errors InvalidInvitationError - Token not found or invitation not in pending state
   * @errors InvitationExpiredError - Invitation has been revoked
   * @errors PersistenceError - Database operation failed
   */
  readonly declineInvitation: (
    token: string
  ) => Effect.Effect<
    OrganizationInvitation,
    InvalidInvitationError | InvitationExpiredError | PersistenceError | EntityNotFoundError
  >

  /**
   * Revoke an invitation (admin action)
   *
   * Marks the invitation as revoked. An admin revokes a pending invitation.
   *
   * @param invitationId - The invitation ID to revoke
   * @param revokedBy - The admin performing the revocation
   * @returns Effect containing the updated invitation
   * @errors InvalidInvitationError - Invitation not found or not in pending state
   * @errors PersistenceError - Database operation failed
   */
  readonly revokeInvitation: (
    invitationId: InvitationId,
    revokedBy: AuthUserId
  ) => Effect.Effect<
    OrganizationInvitation,
    InvalidInvitationError | PersistenceError | EntityNotFoundError
  >

  /**
   * List pending invitations for a user by email
   *
   * @param email - The email address to find invitations for
   * @returns Effect containing array of pending invitations
   * @errors PersistenceError - Database operation failed
   */
  readonly listPendingByEmail: (
    email: string
  ) => Effect.Effect<ReadonlyArray<OrganizationInvitation>, PersistenceError>

  /**
   * List pending invitations for an organization
   *
   * @param organizationId - The organization ID
   * @returns Effect containing array of pending invitations
   * @errors PersistenceError - Database operation failed
   */
  readonly listPendingByOrganization: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<OrganizationInvitation>, PersistenceError>
}

/**
 * InvitationService - Context.Tag for the invitation service
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const invitationService = yield* InvitationService
 *   const { invitation, rawToken } = yield* invitationService.createInvitation({
 *     organizationId,
 *     email: "user@example.com",
 *     role: "member",
 *     functionalRoles: ["accountant"],
 *     invitedBy: adminUserId
 *   })
 *   // Send rawToken to user via email
 *   return invitation
 * })
 *
 * // Provide the implementation
 * program.pipe(Effect.provide(InvitationServiceLive))
 * ```
 */
export class InvitationService extends Context.Tag("InvitationService")<
  InvitationService,
  InvitationServiceShape
>() {}

// =============================================================================
// Error Union Types
// =============================================================================

/**
 * CreateInvitationError - Union of errors for creating an invitation
 */
export type CreateInvitationError = InvitationAlreadyExistsError | PersistenceError

/**
 * AcceptInvitationError - Union of errors for accepting an invitation
 */
export type AcceptInvitationError =
  | InvalidInvitationError
  | InvitationExpiredError
  | UserAlreadyMemberError
  | PersistenceError
  | EntityNotFoundError

/**
 * DeclineInvitationError - Union of errors for declining an invitation
 */
export type DeclineInvitationError =
  | InvalidInvitationError
  | InvitationExpiredError
  | PersistenceError
  | EntityNotFoundError

/**
 * RevokeInvitationError - Union of errors for revoking an invitation
 */
export type RevokeInvitationError =
  | InvalidInvitationError
  | PersistenceError
  | EntityNotFoundError
