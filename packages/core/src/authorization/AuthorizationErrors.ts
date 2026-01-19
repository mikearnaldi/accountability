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
 * @module authorization/AuthorizationErrors
 */

import { HttpApiSchema } from "@effect/platform"
import * as Schema from "effect/Schema"
import { AuthUserId } from "../authentication/AuthUserId.ts"
import { OrganizationId } from "../organization/Organization.ts"
import { Action } from "./Action.ts"
import { MembershipStatus } from "../membership/MembershipStatus.ts"

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
  },
  HttpApiSchema.annotations({ status: 403 })
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
  },
  HttpApiSchema.annotations({ status: 403 })
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
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `User is not a member of this organization`
  }
}

/**
 * Type guard for MembershipNotFoundError
 */
export const isMembershipNotFoundError = Schema.is(MembershipNotFoundError)

/**
 * PolicyNotFoundError - Policy does not exist
 */
export class PolicyNotFoundError extends Schema.TaggedError<PolicyNotFoundError>()(
  "PolicyNotFoundError",
  {
    policyId: Schema.String
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Policy not found: ${this.policyId}`
  }
}

export const isPolicyNotFoundError = Schema.is(PolicyNotFoundError)

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
  },
  HttpApiSchema.annotations({ status: 400 })
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
  {},
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `This invitation has been revoked and can no longer be used`
  }
}

/**
 * Type guard for InvitationExpiredError
 */
export const isInvitationExpiredError = Schema.is(InvitationExpiredError)

/**
 * InvalidPolicyIdError - Invalid policy ID format
 */
export class InvalidPolicyIdError extends Schema.TaggedError<InvalidPolicyIdError>()(
  "InvalidPolicyIdError",
  {
    value: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid policy ID format: ${this.value}`
  }
}

export const isInvalidPolicyIdError = Schema.is(InvalidPolicyIdError)

/**
 * InvalidPolicyConditionError - Invalid policy condition
 */
export class InvalidPolicyConditionError extends Schema.TaggedError<InvalidPolicyConditionError>()(
  "InvalidPolicyConditionError",
  {
    condition: Schema.String,
    reason: Schema.String
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid policy condition '${this.condition}': ${this.reason}`
  }
}

export const isInvalidPolicyConditionError = Schema.is(InvalidPolicyConditionError)

/**
 * PolicyPriorityValidationError - Policy priority is out of valid range
 */
export class PolicyPriorityValidationError extends Schema.TaggedError<PolicyPriorityValidationError>()(
  "PolicyPriorityValidationError",
  {
    priority: Schema.Number,
    maxAllowed: Schema.Number
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Custom policy priority must be between 0 and ${this.maxAllowed}, got ${this.priority}`
  }
}

export const isPolicyPriorityValidationError = Schema.is(PolicyPriorityValidationError)

/**
 * InvalidResourceTypeError - Invalid resource type for policy testing
 */
export class InvalidResourceTypeError extends Schema.TaggedError<InvalidResourceTypeError>()(
  "InvalidResourceTypeError",
  {
    resourceType: Schema.String,
    validTypes: Schema.Array(Schema.String)
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Invalid resource type: ${this.resourceType}. Valid types: ${this.validTypes.join(", ")}`
  }
}

export const isInvalidResourceTypeError = Schema.is(InvalidResourceTypeError)

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
  },
  HttpApiSchema.annotations({ status: 409 })
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
 * OwnerCannotBeSuspendedError - Cannot suspend the organization owner
 *
 * Returned when attempting to suspend the owner of an organization.
 * Ownership must be transferred before the owner can be suspended.
 *
 * HTTP Status: 409 Conflict
 */
export class OwnerCannotBeSuspendedError extends Schema.TaggedError<OwnerCannotBeSuspendedError>()(
  "OwnerCannotBeSuspendedError",
  {
    organizationId: OrganizationId.annotations({
      description: "The organization where the owner cannot be suspended"
    })
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `The organization owner cannot be suspended. Transfer ownership first.`
  }
}

/**
 * Type guard for OwnerCannotBeSuspendedError
 */
export const isOwnerCannotBeSuspendedError = Schema.is(OwnerCannotBeSuspendedError)

/**
 * MemberNotSuspendedError - Cannot unsuspend a member who is not suspended
 *
 * Returned when attempting to unsuspend a member whose status is not 'suspended'.
 *
 * HTTP Status: 409 Conflict
 */
export class MemberNotSuspendedError extends Schema.TaggedError<MemberNotSuspendedError>()(
  "MemberNotSuspendedError",
  {
    userId: AuthUserId.annotations({
      description: "The user who is not suspended"
    }),
    organizationId: OrganizationId.annotations({
      description: "The organization"
    }),
    currentStatus: MembershipStatus.annotations({
      description: "The current status of the membership"
    })
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Cannot unsuspend member: current status is '${this.currentStatus}', not 'suspended'`
  }
}

/**
 * Type guard for MemberNotSuspendedError
 */
export const isMemberNotSuspendedError = Schema.is(MemberNotSuspendedError)

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
  },
  HttpApiSchema.annotations({ status: 409 })
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
  },
  HttpApiSchema.annotations({ status: 409 })
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
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `User is already a member of this organization`
  }
}

/**
 * Type guard for UserAlreadyMemberError
 */
export const isUserAlreadyMemberError = Schema.is(UserAlreadyMemberError)

/**
 * PolicyAlreadyExistsError - Policy with same name already exists
 */
export class PolicyAlreadyExistsError extends Schema.TaggedError<PolicyAlreadyExistsError>()(
  "PolicyAlreadyExistsError",
  {
    name: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Policy with name '${this.name}' already exists`
  }
}

export const isPolicyAlreadyExistsError = Schema.is(PolicyAlreadyExistsError)

/**
 * SystemPolicyCannotBeModifiedError - System policies cannot be modified or deleted
 */
export class SystemPolicyCannotBeModifiedError extends Schema.TaggedError<SystemPolicyCannotBeModifiedError>()(
  "SystemPolicyCannotBeModifiedError",
  {
    policyId: Schema.String,
    operation: Schema.String
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `System policy ${this.policyId} cannot be ${this.operation}`
  }
}

export const isSystemPolicyCannotBeModifiedError = Schema.is(SystemPolicyCannotBeModifiedError)

// =============================================================================
// 500 Internal Server Errors - System failures
// =============================================================================

/**
 * PolicyLoadError - Failed to load policies from the policy repository
 *
 * Returned when the authorization system cannot load policies from the database.
 * This is a critical error that should not be silently ignored - authorization
 * decisions must be based on actual policy data, not empty defaults.
 *
 * HTTP Status: 500 Internal Server Error
 */
export class PolicyLoadError extends Schema.TaggedError<PolicyLoadError>()(
  "PolicyLoadError",
  {
    organizationId: OrganizationId.annotations({
      description: "The organization for which policy loading failed"
    }),
    cause: Schema.Unknown.annotations({
      description: "The underlying error that caused the policy load to fail"
    })
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Failed to load authorization policies for organization: ${String(this.cause)}`
  }
}

/**
 * Type guard for PolicyLoadError
 */
export const isPolicyLoadError = Schema.is(PolicyLoadError)

/**
 * AuthorizationAuditError - Failed to log authorization audit entry
 *
 * Returned when the authorization system cannot log a denial to the audit log.
 * Per ERROR_TRACKER.md, audit logging is essential for compliance and security
 * monitoring - failures must not be silently ignored.
 *
 * HTTP Status: 500 Internal Server Error
 */
export class AuthorizationAuditError extends Schema.TaggedError<AuthorizationAuditError>()(
  "AuthorizationAuditError",
  {
    operation: Schema.String.annotations({
      description: "The audit operation that failed"
    }),
    cause: Schema.Unknown.annotations({
      description: "The underlying error that caused the audit to fail"
    })
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Failed to log authorization audit: ${this.operation} - ${String(this.cause)}`
  }
}

/**
 * Type guard for AuthorizationAuditError
 */
export const isAuthorizationAuditError = Schema.is(AuthorizationAuditError)

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
  | OwnerCannotBeSuspendedError
  | MemberNotSuspendedError
  | CannotTransferToNonAdminError
  | InvitationAlreadyExistsError
  | UserAlreadyMemberError
  | PolicyLoadError
  | AuthorizationAuditError
  | PolicyNotFoundError
  | InvalidPolicyIdError
  | InvalidPolicyConditionError
  | PolicyPriorityValidationError
  | InvalidResourceTypeError
  | PolicyAlreadyExistsError
  | SystemPolicyCannotBeModifiedError

/**
 * HTTP status code mapping for API layer
 */
export const AUTHORIZATION_ERROR_STATUS_CODES = {
  // 403 Forbidden
  PermissionDeniedError: 403,
  MembershipNotActiveError: 403,
  // 404 Not Found
  MembershipNotFoundError: 404,
  PolicyNotFoundError: 404,
  // 400 Bad Request
  InvalidInvitationError: 400,
  InvitationExpiredError: 400,
  InvalidPolicyIdError: 400,
  InvalidPolicyConditionError: 400,
  PolicyPriorityValidationError: 400,
  InvalidResourceTypeError: 400,
  // 409 Conflict
  OwnerCannotBeRemovedError: 409,
  OwnerCannotBeSuspendedError: 409,
  MemberNotSuspendedError: 409,
  CannotTransferToNonAdminError: 409,
  InvitationAlreadyExistsError: 409,
  UserAlreadyMemberError: 409,
  PolicyAlreadyExistsError: 409,
  SystemPolicyCannotBeModifiedError: 409,
  // 500 Internal Server Error
  PolicyLoadError: 500,
  AuthorizationAuditError: 500
} as const
