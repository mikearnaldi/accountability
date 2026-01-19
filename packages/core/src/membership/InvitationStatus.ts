/**
 * InvitationStatus - Re-export from canonical location
 *
 * This file provides the new import path for InvitationStatus value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/InvitationStatus
 */

export {
  InvitationStatus,
  type InvitationStatus as InvitationStatusType,
  isInvitationStatus,
  InvitationStatusValues
} from "../Auth/InvitationStatus.ts"
