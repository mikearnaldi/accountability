/**
 * OrganizationMemberService - Service interface for organization membership management
 *
 * Provides business logic for managing organization members including:
 * - Adding and removing members
 * - Updating roles and functional roles
 * - Reinstating removed members
 * - Transferring ownership
 *
 * @module membership/OrganizationMemberService
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { OrganizationMembership } from "./OrganizationMembership.ts"
import type { AuthUserId } from "../authentication/AuthUserId.ts"
import type { OrganizationId } from "../organization/Organization.ts"
import type { BaseRole } from "../authorization/BaseRole.ts"
import type { FunctionalRole } from "../authorization/FunctionalRole.ts"
import type {
  MembershipNotFoundError,
  OwnerCannotBeRemovedError,
  OwnerCannotBeSuspendedError,
  MemberNotSuspendedError,
  CannotTransferToNonAdminError,
  UserAlreadyMemberError
} from "../authorization/AuthorizationErrors.ts"
import type { PersistenceError, EntityNotFoundError } from "../shared/errors/RepositoryError.ts"
import type { AuditLogService } from "../audit/AuditLogService.ts"
import type { AuditLogError, UserLookupError } from "../audit/AuditLogErrors.ts"
import type { CurrentUserId } from "../shared/context/CurrentUserId.ts"

// =============================================================================
// Service Input Types
// =============================================================================

/**
 * Input for adding a new member
 */
export interface AddMemberInput {
  readonly organizationId: OrganizationId
  readonly userId: AuthUserId
  readonly role: BaseRole
  readonly functionalRoles: readonly FunctionalRole[]
  readonly invitedBy?: AuthUserId
}

/**
 * Input for updating member roles
 */
export interface UpdateMemberRolesInput {
  readonly role?: BaseRole
  readonly functionalRoles?: readonly FunctionalRole[]
}

/**
 * Input for transferring ownership
 */
export interface TransferOwnershipInput {
  readonly organizationId: OrganizationId
  readonly fromUserId: AuthUserId
  readonly toUserId: AuthUserId
  readonly newRoleForPreviousOwner: Exclude<BaseRole, "owner">
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * OrganizationMemberServiceShape - The shape of the organization member service
 *
 * Provides all membership management operations including:
 * - Adding members to organizations
 * - Removing members (soft delete)
 * - Updating member roles
 * - Reinstating removed members
 * - Transferring organization ownership
 */
export interface OrganizationMemberServiceShape {
  /**
   * Add a new member to an organization
   *
   * Creates a membership with the specified role and functional roles.
   *
   * @param input - The member details including org, user, roles
   * @returns Effect containing the created membership
   * @errors UserAlreadyMemberError - User is already a member of the organization
   * @errors PersistenceError - Database operation failed
   */
  readonly addMember: (
    input: AddMemberInput
  ) => Effect.Effect<OrganizationMembership, UserAlreadyMemberError | PersistenceError | AuditLogError | UserLookupError, AuditLogService | CurrentUserId>

  /**
   * Remove a member from an organization (soft delete)
   *
   * Marks the membership as 'removed'. The owner cannot be removed;
   * ownership must be transferred first.
   *
   * @param organizationId - The organization ID
   * @param userId - The user to remove
   * @param removedBy - The user performing the removal
   * @param reason - Optional reason for removal
   * @returns Effect containing the updated membership
   * @errors MembershipNotFoundError - User is not a member
   * @errors OwnerCannotBeRemovedError - Cannot remove the organization owner
   * @errors PersistenceError - Database operation failed
   */
  readonly removeMember: (
    organizationId: OrganizationId,
    userId: AuthUserId,
    removedBy: AuthUserId,
    reason?: string
  ) => Effect.Effect<
    OrganizationMembership,
    MembershipNotFoundError | OwnerCannotBeRemovedError | PersistenceError | EntityNotFoundError | AuditLogError | UserLookupError,
    AuditLogService | CurrentUserId
  >

  /**
   * Update a member's role and/or functional roles
   *
   * @param organizationId - The organization ID
   * @param userId - The user to update
   * @param input - The changes to apply
   * @returns Effect containing the updated membership
   * @errors MembershipNotFoundError - User is not a member
   * @errors PersistenceError - Database operation failed
   */
  readonly updateRole: (
    organizationId: OrganizationId,
    userId: AuthUserId,
    input: UpdateMemberRolesInput
  ) => Effect.Effect<
    OrganizationMembership,
    MembershipNotFoundError | PersistenceError | EntityNotFoundError | AuditLogError | UserLookupError,
    AuditLogService | CurrentUserId
  >

  /**
   * Reinstate a previously removed member
   *
   * Changes the membership status back to 'active'.
   *
   * @param organizationId - The organization ID
   * @param userId - The user to reinstate
   * @param reinstatedBy - The user performing the reinstatement
   * @returns Effect containing the updated membership
   * @errors MembershipNotFoundError - User is not a member (even removed)
   * @errors PersistenceError - Database operation failed
   */
  readonly reinstateMember: (
    organizationId: OrganizationId,
    userId: AuthUserId,
    reinstatedBy: AuthUserId
  ) => Effect.Effect<
    OrganizationMembership,
    MembershipNotFoundError | PersistenceError | EntityNotFoundError | AuditLogError | UserLookupError,
    AuditLogService | CurrentUserId
  >

  /**
   * Suspend a member temporarily
   *
   * Changes the membership status to 'suspended'. The owner cannot be suspended;
   * ownership must be transferred first. Suspended members cannot access the organization.
   *
   * @param organizationId - The organization ID
   * @param userId - The user to suspend
   * @param suspendedBy - The user performing the suspension
   * @param reason - Optional reason for suspension
   * @returns Effect containing the updated membership
   * @errors MembershipNotFoundError - User is not a member
   * @errors OwnerCannotBeSuspendedError - Cannot suspend the organization owner
   * @errors PersistenceError - Database operation failed
   */
  readonly suspendMember: (
    organizationId: OrganizationId,
    userId: AuthUserId,
    suspendedBy: AuthUserId,
    reason?: string
  ) => Effect.Effect<
    OrganizationMembership,
    MembershipNotFoundError | OwnerCannotBeSuspendedError | PersistenceError | EntityNotFoundError | AuditLogError | UserLookupError,
    AuditLogService | CurrentUserId
  >

  /**
   * Unsuspend a previously suspended member
   *
   * Changes the membership status back to 'active'.
   *
   * @param organizationId - The organization ID
   * @param userId - The user to unsuspend
   * @param unsuspendedBy - The user performing the unsuspension
   * @returns Effect containing the updated membership
   * @errors MembershipNotFoundError - User is not a member
   * @errors MemberNotSuspendedError - Member is not in suspended status
   * @errors PersistenceError - Database operation failed
   */
  readonly unsuspendMember: (
    organizationId: OrganizationId,
    userId: AuthUserId,
    unsuspendedBy: AuthUserId
  ) => Effect.Effect<
    OrganizationMembership,
    MembershipNotFoundError | MemberNotSuspendedError | PersistenceError | EntityNotFoundError | AuditLogError | UserLookupError,
    AuditLogService | CurrentUserId
  >

  /**
   * Transfer organization ownership
   *
   * Atomically transfers ownership from the current owner to another admin.
   * The target must be an existing admin. The previous owner's role is
   * changed to the specified newRole.
   *
   * @param input - Transfer details including org, from/to users, new role for previous owner
   * @returns Effect containing both updated memberships (previous owner, new owner)
   * @errors MembershipNotFoundError - Either user is not a member
   * @errors CannotTransferToNonAdminError - Target is not an admin
   * @errors PersistenceError - Database operation failed
   */
  readonly transferOwnership: (
    input: TransferOwnershipInput
  ) => Effect.Effect<
    { previousOwner: OrganizationMembership; newOwner: OrganizationMembership },
    MembershipNotFoundError | CannotTransferToNonAdminError | PersistenceError | EntityNotFoundError | AuditLogError | UserLookupError,
    AuditLogService | CurrentUserId
  >

  /**
   * Get membership for a user in an organization
   *
   * @param organizationId - The organization ID
   * @param userId - The user ID
   * @returns Effect containing the membership
   * @errors MembershipNotFoundError - User is not a member
   * @errors PersistenceError - Database operation failed
   */
  readonly getMembership: (
    organizationId: OrganizationId,
    userId: AuthUserId
  ) => Effect.Effect<
    OrganizationMembership,
    MembershipNotFoundError | PersistenceError
  >

  /**
   * List all active members in an organization
   *
   * @param organizationId - The organization ID
   * @returns Effect containing array of active memberships
   * @errors PersistenceError - Database operation failed
   */
  readonly listActiveMembers: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<OrganizationMembership>, PersistenceError>

  /**
   * List all members in an organization (including removed/suspended)
   *
   * @param organizationId - The organization ID
   * @returns Effect containing array of all memberships regardless of status
   * @errors PersistenceError - Database operation failed
   */
  readonly listAllMembers: (
    organizationId: OrganizationId
  ) => Effect.Effect<ReadonlyArray<OrganizationMembership>, PersistenceError>

  /**
   * List all memberships for a user (across all organizations)
   *
   * @param userId - The user ID
   * @returns Effect containing array of memberships
   * @errors PersistenceError - Database operation failed
   */
  readonly listUserMemberships: (
    userId: AuthUserId
  ) => Effect.Effect<ReadonlyArray<OrganizationMembership>, PersistenceError>
}

/**
 * OrganizationMemberService - Context.Tag for the organization member service
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const memberService = yield* OrganizationMemberService
 *   const membership = yield* memberService.addMember({
 *     organizationId,
 *     userId,
 *     role: "member",
 *     functionalRoles: ["accountant"]
 *   })
 *   return membership
 * })
 *
 * // Provide the implementation
 * program.pipe(Effect.provide(OrganizationMemberServiceLive))
 * ```
 */
export class OrganizationMemberService extends Context.Tag("OrganizationMemberService")<
  OrganizationMemberService,
  OrganizationMemberServiceShape
>() {}

// =============================================================================
// Error Union Types
// =============================================================================

/**
 * AddMemberError - Union of errors for adding a member
 */
export type AddMemberError = UserAlreadyMemberError | PersistenceError | AuditLogError | UserLookupError

/**
 * RemoveMemberError - Union of errors for removing a member
 */
export type RemoveMemberError =
  | MembershipNotFoundError
  | OwnerCannotBeRemovedError
  | PersistenceError
  | EntityNotFoundError
  | AuditLogError
  | UserLookupError

/**
 * UpdateRoleError - Union of errors for updating roles
 */
export type UpdateRoleError =
  | MembershipNotFoundError
  | PersistenceError
  | EntityNotFoundError
  | AuditLogError
  | UserLookupError

/**
 * ReinstateMemberError - Union of errors for reinstating a member
 */
export type ReinstateMemberError =
  | MembershipNotFoundError
  | PersistenceError
  | EntityNotFoundError
  | AuditLogError
  | UserLookupError

/**
 * SuspendMemberError - Union of errors for suspending a member
 */
export type SuspendMemberError =
  | MembershipNotFoundError
  | OwnerCannotBeSuspendedError
  | PersistenceError
  | EntityNotFoundError
  | AuditLogError
  | UserLookupError

/**
 * UnsuspendMemberError - Union of errors for unsuspending a member
 */
export type UnsuspendMemberError =
  | MembershipNotFoundError
  | MemberNotSuspendedError
  | PersistenceError
  | EntityNotFoundError
  | AuditLogError
  | UserLookupError

/**
 * TransferOwnershipError - Union of errors for transferring ownership
 */
export type TransferOwnershipError =
  | MembershipNotFoundError
  | CannotTransferToNonAdminError
  | PersistenceError
  | EntityNotFoundError
  | AuditLogError
  | UserLookupError
