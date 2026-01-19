/**
 * MembershipErrors - Domain errors for Membership domain
 *
 * These errors are used for Organization membership and invitation operations
 * and include HttpApiSchema annotations for automatic HTTP status code mapping.
 *
 * Note: Core membership errors are defined in Auth/AuthorizationErrors.ts and
 * re-exported here for the new import path. Additional membership-specific errors
 * that aren't authorization-related are defined directly in this file.
 *
 * @module membership/MembershipErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"

// =============================================================================
// Not Found Errors (404) - Defined here
// =============================================================================

/**
 * MemberNotFoundError - Organization member does not exist
 */
export class MemberNotFoundError extends Schema.TaggedError<MemberNotFoundError>()(
  "MemberNotFoundError",
  {
    memberId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Member not found: ${this.memberId}`
  }
}

export const isMemberNotFoundError = Schema.is(MemberNotFoundError)

/**
 * InvitationNotFoundError - Invitation does not exist
 */
export class InvitationNotFoundError extends Schema.TaggedError<InvitationNotFoundError>()(
  "InvitationNotFoundError",
  {
    invitationId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Invitation not found: ${this.invitationId}`
  }
}

export const isInvitationNotFoundError = Schema.is(InvitationNotFoundError)

/**
 * UserNotFoundByEmailError - User with email does not exist
 */
export class UserNotFoundByEmailError extends Schema.TaggedError<UserNotFoundByEmailError>()(
  "UserNotFoundByEmailError",
  {
    email: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `User not found with email: ${this.email}`
  }
}

export const isUserNotFoundByEmailError = Schema.is(UserNotFoundByEmailError)

// =============================================================================
// Validation Errors (400) - Defined here
// =============================================================================

/**
 * InvalidInvitationIdError - Invalid invitation ID format
 */
export class InvalidInvitationIdError extends Schema.TaggedError<InvalidInvitationIdError>()(
  "InvalidInvitationIdError",
  {
    value: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid invitation ID format: ${this.value}`
  }
}

export const isInvalidInvitationIdError = Schema.is(InvalidInvitationIdError)

// =============================================================================
// Business Rule Errors (422) - Defined here
// =============================================================================

/**
 * InvitationNotPendingError - Invitation is not in pending state
 */
export class InvitationNotPendingError extends Schema.TaggedError<InvitationNotPendingError>()(
  "InvitationNotPendingError",
  {
    invitationId: Schema.String,
    currentStatus: Schema.String
  },
  HttpApiSchema.annotations({ status: 422 })
) {
  get message(): string {
    return `Invitation ${this.invitationId} is not pending (current status: ${this.currentStatus})`
  }
}

export const isInvitationNotPendingError = Schema.is(InvitationNotPendingError)

// =============================================================================
// Re-exports from Auth/AuthorizationErrors.ts
// =============================================================================

export {
  // Membership errors
  MembershipNotActiveError,
  isMembershipNotActiveError,
  MembershipNotFoundError,
  isMembershipNotFoundError,
  MemberNotSuspendedError,
  isMemberNotSuspendedError,

  // Owner protection errors
  OwnerCannotBeRemovedError,
  isOwnerCannotBeRemovedError,
  OwnerCannotBeSuspendedError,
  isOwnerCannotBeSuspendedError,
  CannotTransferToNonAdminError,
  isCannotTransferToNonAdminError,

  // Invitation errors
  InvalidInvitationError,
  isInvalidInvitationError,
  InvitationExpiredError,
  isInvitationExpiredError,
  InvitationAlreadyExistsError,
  isInvitationAlreadyExistsError,
  UserAlreadyMemberError,
  isUserAlreadyMemberError
} from "../authorization/AuthorizationErrors.ts"
