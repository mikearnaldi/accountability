/**
 * MembershipStatus - Re-export from canonical location
 *
 * This file maintains backward compatibility by re-exporting from the
 * canonical membership/ location after the core package reorganization.
 *
 * @deprecated Import from "@accountability/core/membership/MembershipStatus" instead
 * @module Auth/MembershipStatus
 */

export {
  MembershipStatus,
  type MembershipStatus as MembershipStatusType,
  isMembershipStatus,
  MembershipStatusValues
} from "../membership/MembershipStatus.ts"
