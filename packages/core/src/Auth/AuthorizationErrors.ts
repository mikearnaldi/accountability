/**
 * AuthorizationErrors - Re-export from canonical location
 *
 * This file re-exports all authorization errors from the authorization domain
 * for backward compatibility. Import from @accountability/core/authorization/AuthorizationErrors
 * for new code.
 *
 * @deprecated Import from @accountability/core/authorization/AuthorizationErrors instead
 * @module Auth/AuthorizationErrors
 */

export {
  // 403 Forbidden Errors
  PermissionDeniedError,
  isPermissionDeniedError,
  MembershipNotActiveError,
  isMembershipNotActiveError,

  // 404 Not Found Errors
  MembershipNotFoundError,
  isMembershipNotFoundError,
  PolicyNotFoundError,
  isPolicyNotFoundError,

  // 400 Bad Request Errors
  InvalidInvitationError,
  isInvalidInvitationError,
  InvitationExpiredError,
  isInvitationExpiredError,
  InvalidPolicyIdError,
  isInvalidPolicyIdError,
  InvalidPolicyConditionError,
  isInvalidPolicyConditionError,
  PolicyPriorityValidationError,
  isPolicyPriorityValidationError,
  InvalidResourceTypeError,
  isInvalidResourceTypeError,

  // 409 Conflict Errors
  OwnerCannotBeRemovedError,
  isOwnerCannotBeRemovedError,
  OwnerCannotBeSuspendedError,
  isOwnerCannotBeSuspendedError,
  MemberNotSuspendedError,
  isMemberNotSuspendedError,
  CannotTransferToNonAdminError,
  isCannotTransferToNonAdminError,
  InvitationAlreadyExistsError,
  isInvitationAlreadyExistsError,
  UserAlreadyMemberError,
  isUserAlreadyMemberError,
  PolicyAlreadyExistsError,
  isPolicyAlreadyExistsError,
  SystemPolicyCannotBeModifiedError,
  isSystemPolicyCannotBeModifiedError,

  // 500 Internal Server Errors
  PolicyLoadError,
  isPolicyLoadError,
  AuthorizationAuditError,
  isAuthorizationAuditError,

  // Union types and constants
  type AuthorizationError,
  AUTHORIZATION_ERROR_STATUS_CODES
} from "../authorization/AuthorizationErrors.ts"
