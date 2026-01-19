/**
 * Session - User session entity
 *
 * Represents an authenticated user session with expiration tracking.
 * Sessions are created upon successful authentication and invalidated
 * on logout or expiration.
 *
 * @module Session
 */

import * as Schema from "effect/Schema"
import { SessionId } from "./SessionId.ts"
import { AuthUserId } from "./AuthUserId.ts"
import { AuthProviderType } from "./AuthProviderType.ts"
import { Timestamp } from "../shared/values/Timestamp.ts"

/**
 * UserAgent - Optional user agent string for session tracking
 *
 * Stores the browser/client user agent for security audit purposes.
 */
export const UserAgent = Schema.String.pipe(
  Schema.maxLength(1024),
  Schema.annotations({
    identifier: "UserAgent",
    title: "User Agent",
    description: "The browser or client user agent string"
  })
)

/**
 * The UserAgent type
 */
export type UserAgent = typeof UserAgent.Type

/**
 * Session - Authenticated user session
 *
 * Tracks active user sessions with the provider used for authentication,
 * expiration time, and optional metadata for security auditing.
 */
export class Session extends Schema.Class<Session>("Session")({
  /**
   * Unique session identifier (secure random token)
   */
  id: SessionId,

  /**
   * Reference to the authenticated user
   */
  userId: AuthUserId,

  /**
   * The auth provider used for this session's authentication
   */
  provider: AuthProviderType,

  /**
   * When this session expires (stored as UTC timestamp)
   */
  expiresAt: Timestamp,

  /**
   * When this session was created
   */
  createdAt: Timestamp,

  /**
   * Optional user agent string for security tracking
   */
  userAgent: Schema.Option(UserAgent)
}) {
  /**
   * Check if the session has expired
   */
  isExpired(now: Timestamp): boolean {
    return now.epochMillis >= this.expiresAt.epochMillis
  }

  /**
   * Check if the session is still valid
   */
  isValid(now: Timestamp): boolean {
    return !this.isExpired(now)
  }

  /**
   * Get time remaining until expiration in milliseconds
   * Returns 0 if already expired
   */
  timeRemainingMs(now: Timestamp): number {
    const remaining = this.expiresAt.epochMillis - now.epochMillis
    return remaining > 0 ? remaining : 0
  }
}

/**
 * Type guard for Session using Schema.is
 */
export const isSession = Schema.is(Session)
