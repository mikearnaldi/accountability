/**
 * InvitationStatus - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/InvitationStatus" instead
 * @module Auth/InvitationStatus
 */

export {
  InvitationStatus,
  type InvitationStatus as InvitationStatusType,
  isInvitationStatus,
  InvitationStatusValues
} from "../membership/InvitationStatus.ts"
