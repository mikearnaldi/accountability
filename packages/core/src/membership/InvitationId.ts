/**
 * InvitationId - Branded type for invitation identifiers
 *
 * A branded UUID string type for uniquely identifying organization invitations.
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 *
 * @module membership/InvitationId
 */

import * as Schema from "effect/Schema"

/**
 * InvitationId - Branded UUIDv4 string for invitation identification
 *
 * Uses Effect's built-in UUID schema which validates UUIDv4 format.
 */
export const InvitationId = Schema.UUID.pipe(
  Schema.brand("InvitationId"),
  Schema.annotations({
    identifier: "InvitationId",
    title: "Invitation ID",
    description:
      "A unique identifier for an organization invitation (UUID format)"
  })
)

/**
 * The branded InvitationId type
 */
export type InvitationId = typeof InvitationId.Type

/**
 * Type guard for InvitationId using Schema.is
 */
export const isInvitationId = Schema.is(InvitationId)
