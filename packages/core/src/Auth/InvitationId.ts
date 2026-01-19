/**
 * InvitationId - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/InvitationId" instead
 * @module Auth/InvitationId
 */

export {
  InvitationId,
  type InvitationId as InvitationIdType,
  isInvitationId
} from "../membership/InvitationId.ts"
