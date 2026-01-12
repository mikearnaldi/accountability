/**
 * AuthUserId - Branded type for user authentication identifiers
 *
 * A branded UUID string type for uniquely identifying authenticated users.
 * Uses Effect's built-in UUID schema with additional branding for type safety.
 *
 * @module AuthUserId
 */

import * as Schema from "effect/Schema"

/**
 * AuthUserId - Branded UUIDv4 string for user identification
 *
 * Uses Effect's built-in UUID schema which validates UUIDv4 format.
 */
export const AuthUserId = Schema.UUID.pipe(
  Schema.brand("AuthUserId"),
  Schema.annotations({
    identifier: "AuthUserId",
    title: "Auth User ID",
    description: "A unique identifier for an authenticated user (UUID format)"
  })
)

/**
 * The branded AuthUserId type
 */
export type AuthUserId = typeof AuthUserId.Type

/**
 * Type guard for AuthUserId using Schema.is
 */
export const isAuthUserId = Schema.is(AuthUserId)
