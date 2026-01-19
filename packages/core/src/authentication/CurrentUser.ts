/**
 * CurrentUser - Context for the currently authenticated user
 *
 * Provides a Context.Tag for accessing the current authenticated user
 * in Effect programs. This allows request handlers and business logic
 * to access the current user without threading it through every function.
 *
 * Usage:
 * - Set via middleware after session validation
 * - Access via getCurrentUser() helper in business logic
 *
 * @module CurrentUser
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type { AuthUser } from "./AuthUser.ts"

// =============================================================================
// CurrentUser Context
// =============================================================================

/**
 * CurrentUser - Context.Tag for the currently authenticated user
 *
 * This tag holds the AuthUser that is authenticated for the current
 * request/session context. It's typically set by authentication middleware
 * after validating the session.
 *
 * Usage:
 * ```typescript
 * // In middleware, after validating session:
 * const { user, session } = yield* authService.validateSession(sessionId)
 * yield* Effect.provideService(CurrentUser, user)(nextHandler)
 *
 * // In business logic:
 * const program = Effect.gen(function* () {
 *   const user = yield* getCurrentUser()
 *   console.log(`Current user: ${user.displayName}`)
 * })
 * ```
 */
export class CurrentUser extends Context.Tag("CurrentUser")<
  CurrentUser,
  AuthUser
>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * getCurrentUser - Get the current authenticated user from context
 *
 * Convenience helper that retrieves the current user from the CurrentUser
 * context. This is equivalent to `yield* CurrentUser` but provides a
 * more semantic API.
 *
 * @returns Effect requiring CurrentUser context and returning the AuthUser
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const user = yield* getCurrentUser()
 *   console.log(`Hello, ${user.displayName}!`)
 *   return user.id
 * })
 *
 * // The program requires CurrentUser to be provided:
 * // program: Effect<AuthUserId, never, CurrentUser>
 * ```
 */
export const getCurrentUser = (): Effect.Effect<AuthUser, never, CurrentUser> =>
  CurrentUser

/**
 * withCurrentUser - Run an effect with a specific user in context
 *
 * Provides the CurrentUser context with the specified user, allowing
 * business logic that requires CurrentUser to run.
 *
 * @param user - The AuthUser to set as current user
 * @returns A function that provides CurrentUser to an effect
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const user = yield* getCurrentUser()
 *   return `Welcome ${user.displayName}`
 * })
 *
 * // Provide the user context
 * const result = yield* program.pipe(withCurrentUser(authenticatedUser))
 * ```
 */
export const withCurrentUser = (user: AuthUser) =>
  <A, E, R>(effect: Effect.Effect<A, E, R | CurrentUser>): Effect.Effect<A, E, Exclude<R, CurrentUser>> =>
    Effect.provideService(effect, CurrentUser, user)
