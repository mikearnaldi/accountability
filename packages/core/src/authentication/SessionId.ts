/**
 * SessionId - Branded type for session identifiers
 *
 * A branded string type for securely identifying user sessions.
 * Uses a base64url-encoded random token format (at least 32 characters).
 *
 * @module SessionId
 */

import * as Schema from "effect/Schema"

/**
 * SessionId - Branded string for secure session token identification
 *
 * Validates as a non-empty string with minimum length of 32 characters
 * to ensure sufficient entropy for secure session tokens.
 * Typically base64url-encoded random bytes.
 */
export const SessionId = Schema.String.pipe(
  Schema.minLength(32),
  Schema.pattern(/^[A-Za-z0-9_-]+$/),
  Schema.brand("SessionId"),
  Schema.annotations({
    identifier: "SessionId",
    title: "Session ID",
    description: "A secure random token for session identification (min 32 chars, base64url format)"
  })
)

/**
 * The branded SessionId type
 */
export type SessionId = typeof SessionId.Type

/**
 * Type guard for SessionId using Schema.is
 */
export const isSessionId = Schema.is(SessionId)
