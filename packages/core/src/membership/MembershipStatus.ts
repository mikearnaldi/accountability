/**
 * MembershipStatus - Status of a user's organization membership
 *
 * Defines the possible states for a membership:
 * - 'active': User has full access to the organization
 * - 'suspended': User is temporarily denied access (can be reactivated)
 * - 'removed': User has been removed from the organization (soft delete)
 *
 * @module membership/MembershipStatus
 */

import * as Schema from "effect/Schema"

/**
 * MembershipStatus - The status of a user's membership in an organization
 *
 * Supports soft delete via the 'removed' status, allowing for reinstatement
 * with full history preservation.
 */
export const MembershipStatus = Schema.Literal(
  "active",
  "suspended",
  "removed"
).annotations({
  identifier: "MembershipStatus",
  title: "Membership Status",
  description: "The status of a user's membership in an organization"
})

/**
 * The MembershipStatus type
 */
export type MembershipStatus = typeof MembershipStatus.Type

/**
 * Type guard for MembershipStatus using Schema.is
 */
export const isMembershipStatus = Schema.is(MembershipStatus)

/**
 * All valid MembershipStatus values
 */
export const MembershipStatusValues: readonly MembershipStatus[] = [
  "active",
  "suspended",
  "removed"
] as const
