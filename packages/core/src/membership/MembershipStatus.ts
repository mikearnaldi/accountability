/**
 * MembershipStatus - Re-export from canonical location
 *
 * This file provides the new import path for MembershipStatus value object
 * while maintaining backward compatibility during the core package reorganization.
 *
 * @module membership/MembershipStatus
 */

export {
  MembershipStatus,
  type MembershipStatus as MembershipStatusType,
  isMembershipStatus,
  MembershipStatusValues
} from "../Auth/MembershipStatus.ts"
