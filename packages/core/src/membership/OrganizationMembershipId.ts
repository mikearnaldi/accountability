/**
 * OrganizationMembershipId - Branded type for membership identifiers
 *
 * A branded UUID string type for uniquely identifying user-organization memberships.
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 *
 * @module membership/OrganizationMembershipId
 */

import * as Schema from "effect/Schema"

/**
 * OrganizationMembershipId - Branded UUIDv4 string for membership identification
 *
 * Uses Effect's built-in UUID schema which validates UUIDv4 format.
 */
export const OrganizationMembershipId = Schema.UUID.pipe(
  Schema.brand("OrganizationMembershipId"),
  Schema.annotations({
    identifier: "OrganizationMembershipId",
    title: "Organization Membership ID",
    description:
      "A unique identifier for a user's membership in an organization (UUID format)"
  })
)

/**
 * The branded OrganizationMembershipId type
 */
export type OrganizationMembershipId = typeof OrganizationMembershipId.Type

/**
 * Type guard for OrganizationMembershipId using Schema.is
 */
export const isOrganizationMembershipId = Schema.is(OrganizationMembershipId)
