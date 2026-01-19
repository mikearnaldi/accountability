/**
 * CurrentUserId - Context for the current authenticated user ID
 *
 * Provides a Context.Tag for passing the current user's ID through Effect
 * programs. This is used by services that need to record the user ID
 * for audit logging, without requiring access to the full user object.
 *
 * Usage:
 * - Set via middleware or API handlers after authentication
 * - Access via `yield* CurrentUserId` in services
 *
 * @module shared/context/CurrentUserId
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type { AuthUserId } from "../../authentication/AuthUserId.ts"

// =============================================================================
// CurrentUserId Context
// =============================================================================

/**
 * CurrentUserId - Context.Tag for the current authenticated user's ID
 *
 * This tag holds just the user ID (not the full user object) for services
 * that need to record user actions but don't need other user properties.
 *
 * Usage:
 * ```typescript
 * // In API handlers, currentUser.userId is already typed as AuthUserId:
 * yield* Effect.provideService(effect, CurrentUserId, currentUser.userId)
 *
 * // In services:
 * const userId = yield* CurrentUserId
 * yield* auditLogService.logCreate("Account", account.id, account, userId)
 * ```
 */
export class CurrentUserId extends Context.Tag("CurrentUserId")<
  CurrentUserId,
  AuthUserId
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * getCurrentUserId - Get the current user ID from context
 *
 * Convenience helper for retrieving the current user ID.
 *
 * @returns Effect requiring CurrentUserId context and returning AuthUserId
 */
export const getCurrentUserId = (): Effect.Effect<AuthUserId, never, CurrentUserId> =>
  CurrentUserId

/**
 * withCurrentUserId - Run an effect with a specific user ID in context
 *
 * Provides the CurrentUserId context with the specified user ID.
 *
 * @param userId - The AuthUserId to set as current user ID
 * @returns A function that provides CurrentUserId to an effect
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const userId = yield* getCurrentUserId()
 *   return userId
 * })
 *
 * const result = yield* program.pipe(withCurrentUserId(authenticatedUserId))
 * ```
 */
export const withCurrentUserId = (userId: AuthUserId) =>
  <A, E, R>(effect: Effect.Effect<A, E, R | CurrentUserId>): Effect.Effect<A, E, Exclude<R, CurrentUserId>> =>
    Effect.provideService(effect, CurrentUserId, userId)
