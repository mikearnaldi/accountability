/**
 * AuthorizationErrors - Tagged error types for authorization failure scenarios
 *
 * Defines all authorization-related errors for membership and permission checking.
 * Each error extends Schema.TaggedError.
 *
 * HTTP Status Codes (for API layer reference):
 * - 403 Forbidden: PermissionDeniedError, MembershipNotActiveError
 * - 404 Not Found: MembershipNotFoundError
 * - 400 Bad Request: InvalidInvitationError, InvitationExpiredError
 * - 409 Conflict: OwnerCannotBeRemovedError, CannotTransferToNonAdminError
 *
 * @module AuthorizationErrors
 */

import * as Schema from "effect/Schema"
import { AuthUserId } from "./AuthUserId.ts"
import { OrganizationId } from "../Domains/Organization.ts"
import { Action } from "./Action.ts"
import { MembershipStatus } from "./MembershipStatus.ts"

// =============================================================================
// 403 Forbidden Errors - Authorization failures
// =============================================================================

/**
 * PermissionDeniedError - User lacks required permission
 *
 * Returned when a user attempts an action they are not authorized to perform.
 *
 * HTTP Status: 403 Forbidden
 */
export class PermissionDeniedError extends Schema.TaggedError<PermissionDeniedError>()(
  "PermissionDeniedError",
  {
    action: Action.annotations({
      description: "The action that was denied"
    }),
    resourceType: Schema.String.annotations({
      description: "The type of resource being accessed"
    }),
    resourceId: Schema.optional(Schema.UUID).annotations({
      description: "The specific resource ID, if applicable"
    }),
    reason: Schema.String.annotations({
      description: "A description of why the permission was denied"
    })
  }
) {
  get message(): string {
    const resource = this.resourceId
      ? `${this.resourceType} (${this.resourceId})`
      : this.resourceType
    return `Permission denied: cannot perform '${this.action}' on ${resource}. ${this.reason}`
  }
}

/**
 * Type guard for PermissionDeniedError
 */
export const isPermissionDeniedError = Schema.is(PermissionDeniedError)

/**
 * MembershipNotActiveError - User's membership is suspended or removed
 *
 * Returned when a user attempts to access an organization where their
 * membership is not in an active state.
 *
 * HTTP Status: 403 Forbidden
 */
export class MembershipNotActiveError extends Schema.TaggedError<MembershipNotActiveError>()(
  "MembershipNotActiveError",
  {
    userId: AuthUserId.annotations({
      description: "The user whose membership is not active"
    }),
    organizationId: OrganizationId.annotations({
      description: "The organization the user is attempting to access"
    }),
    status: MembershipStatus.annotations({
      description: "The current status of the membership"
    })
  }
) {
  get message(): string {
    return `Membership is ${this.status}. Access to this organization is denied.`
  }
}

/**
 * Type guard for MembershipNotActiveError
 */
export const isMembershipNotActiveError = Schema.is(MembershipNotActiveError)

// =============================================================================
// 404 Not Found Errors - Resource does not exist
// =============================================================================

/**
 * MembershipNotFoundError - User is not a member of the organization
 *
 * Returned when a user attempts to access an organization they are not a member of.
 *
 * HTTP Status: 404 Not Found
 */
export class MembershipNotFoundError extends Schema.TaggedError<MembershipNotFoundError>()(
  "MembershipNotFoundError",
  {
    userId: AuthUserId.annotations({
      description: "The user who is not a member"
    }),
    organizationId: OrganizationId.annotations({
      description: "The organization the user is not a member of"
    })
  }
) {
  get message(): string {
    return `User is not a member of this organization`
  }
}

/**
 * Type guard for MembershipNotFoundError
 */
export const isMembershipNotFoundError = Schema.is(MembershipNotFoundError)

// =============================================================================
// 400 Bad Request Errors - Invalid request data
// =============================================================================

/**
 * InvalidInvitationError - Invitation is invalid or not found
 *
 * Returned when attempting to accept or decline an invitation that is invalid.
 *
 * HTTP Status: 400 Bad Request
 */
export class InvalidInvitationError extends Schema.TaggedError<InvalidInvitationError>()(
  "InvalidInvitationError",
  {
    reason: Schema.String.annotations({
      description: "A description of why the invitation is invalid"
    })
  }
) {
  get message(): string {
    return `Invalid invitation: ${this.reason}`
  }
}

/**
 * Type guard for InvalidInvitationError
 */
export const isInvalidInvitationError = Schema.is(InvalidInvitationError)

/**
 * InvitationExpiredError - Invitation has been revoked
 *
 * Returned when attempting to accept an invitation that has been revoked.
 * Note: Invitations do not expire by time, but can be revoked by admins.
 *
 * HTTP Status: 400 Bad Request
 */
export class InvitationExpiredError extends Schema.TaggedError<InvitationExpiredError>()(
  "InvitationExpiredError",
  {}
) {
  get message(): string {
    return `This invitation has been revoked and can no longer be used`
  }
}

/**
 * Type guard for InvitationExpiredError
 */
export const isInvitationExpiredError = Schema.is(InvitationExpiredError)

// =============================================================================
// 409 Conflict Errors - Business rule violations
// =============================================================================

/**
 * OwnerCannotBeRemovedError - Cannot remove the organization owner
 *
 * Returned when attempting to remove the owner from an organization.
 * Ownership must be transferred before the owner can leave.
 *
 * HTTP Status: 409 Conflict
 */
export class OwnerCannotBeRemovedError extends Schema.TaggedError<OwnerCannotBeRemovedError>()(
  "OwnerCannotBeRemovedError",
  {
    organizationId: OrganizationId.annotations({
      description: "The organization where the owner cannot be removed"
    })
  }
) {
  get message(): string {
    return `The organization owner cannot be removed. Transfer ownership first.`
  }
}

/**
 * Type guard for OwnerCannotBeRemovedError
 */
export const isOwnerCannotBeRemovedError = Schema.is(OwnerCannotBeRemovedError)

/**
 * CannotTransferToNonAdminError - Cannot transfer ownership to a non-admin
 *
 * Returned when attempting to transfer ownership to a user who is not an admin.
 * Only existing admins can receive ownership transfer.
 *
 * HTTP Status: 409 Conflict
 */
export class CannotTransferToNonAdminError extends Schema.TaggedError<CannotTransferToNonAdminError>()(
  "CannotTransferToNonAdminError",
  {
    userId: AuthUserId.annotations({
      description: "The user who is not an admin"
    })
  }
) {
  get message(): string {
    return `Cannot transfer ownership to a non-admin user. The target must be an admin.`
  }
}

/**
 * Type guard for CannotTransferToNonAdminError
 */
export const isCannotTransferToNonAdminError = Schema.is(CannotTransferToNonAdminError)

/**
 * InvitationAlreadyExistsError - Pending invitation already exists for this email
 *
 * Returned when attempting to send an invitation to an email that already has
 * a pending invitation for the same organization.
 *
 * HTTP Status: 409 Conflict
 */
export class InvitationAlreadyExistsError extends Schema.TaggedError<InvitationAlreadyExistsError>()(
  "InvitationAlreadyExistsError",
  {
    email: Schema.String.annotations({
      description: "The email that already has a pending invitation"
    }),
    organizationId: OrganizationId.annotations({
      description: "The organization with the existing invitation"
    })
  }
) {
  get message(): string {
    return `A pending invitation for ${this.email} already exists for this organization`
  }
}

/**
 * Type guard for InvitationAlreadyExistsError
 */
export const isInvitationAlreadyExistsError = Schema.is(InvitationAlreadyExistsError)

/**
 * UserAlreadyMemberError - User is already a member of the organization
 *
 * Returned when attempting to add a user who is already a member.
 *
 * HTTP Status: 409 Conflict
 */
export class UserAlreadyMemberError extends Schema.TaggedError<UserAlreadyMemberError>()(
  "UserAlreadyMemberError",
  {
    userId: AuthUserId.annotations({
      description: "The user who is already a member"
    }),
    organizationId: OrganizationId.annotations({
      description: "The organization the user is already a member of"
    })
  }
) {
  get message(): string {
    return `User is already a member of this organization`
  }
}

/**
 * Type guard for UserAlreadyMemberError
 */
export const isUserAlreadyMemberError = Schema.is(UserAlreadyMemberError)

// =============================================================================
// Union Types
// =============================================================================

/**
 * Union type for all authorization errors
 */
export type AuthorizationError =
  | PermissionDeniedError
  | MembershipNotActiveError
  | MembershipNotFoundError
  | InvalidInvitationError
  | InvitationExpiredError
  | OwnerCannotBeRemovedError
  | CannotTransferToNonAdminError
  | InvitationAlreadyExistsError
  | UserAlreadyMemberError

/**
 * HTTP status code mapping for API layer
 */
export const AUTHORIZATION_ERROR_STATUS_CODES = {
  // 403 Forbidden
  PermissionDeniedError: 403,
  MembershipNotActiveError: 403,
  // 404 Not Found
  MembershipNotFoundError: 404,
  // 400 Bad Request
  InvalidInvitationError: 400,
  InvitationExpiredError: 400,
  // 409 Conflict
  OwnerCannotBeRemovedError: 409,
  CannotTransferToNonAdminError: 409,
  InvitationAlreadyExistsError: 409,
  UserAlreadyMemberError: 409
} as const
