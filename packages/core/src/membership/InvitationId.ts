/**
 * InvitationId - Re-export from canonical location
 *
 * This file provides the new import path for InvitationId value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/InvitationId
 */

export {
  InvitationId,
  type InvitationId as InvitationIdType,
  isInvitationId
} from "../Auth/InvitationId.ts"
