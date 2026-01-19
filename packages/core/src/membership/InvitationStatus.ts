/**
 * InvitationStatus - Status of an organization invitation
 *
 * Defines the possible states for an invitation:
 * - 'pending': Invitation has been sent but not yet acted upon
 * - 'accepted': Invitation has been accepted, user is now a member
 * - 'revoked': Invitation has been revoked by an admin
 *
 * Note: Invitations do not expire automatically - they remain pending until
 * accepted or revoked.
 *
 * @module membership/InvitationStatus
 */

import * as Schema from "effect/Schema"

/**
 * InvitationStatus - The status of an organization invitation
 */
export const InvitationStatus = Schema.Literal(
  "pending",
  "accepted",
  "revoked"
).annotations({
  identifier: "InvitationStatus",
  title: "Invitation Status",
  description: "The status of an organization invitation"
})

/**
 * The InvitationStatus type
 */
export type InvitationStatus = typeof InvitationStatus.Type

/**
 * Type guard for InvitationStatus using Schema.is
 */
export const isInvitationStatus = Schema.is(InvitationStatus)

/**
 * All valid InvitationStatus values
 */
export const InvitationStatusValues: readonly InvitationStatus[] = [
  "pending",
  "accepted",
  "revoked"
] as const
