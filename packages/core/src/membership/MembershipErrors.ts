/**
 * MembershipErrors - Re-export from canonical location
 *
 * This file provides the new import path for membership domain errors
 * while maintaining backward compatibility during the core package reorganization.
 *
 * Note: Membership errors are currently in AuthorizationErrors.ts but belong
 * conceptually to the membership domain. This re-export groups them appropriately.
 *
 * @module membership/MembershipErrors
 */

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
} from "../Auth/AuthorizationErrors.ts"
