/**
 * CurrentEnvironmentContext - Service tag for providing environment context
 *
 * Provides request-scoped environment information (time, IP, user agent)
 * that can be used by the ABAC policy engine for environment-based policies.
 *
 * This context is captured by API middleware from the HTTP request and
 * made available to the AuthorizationService for policy evaluation.
 *
 * @module authorization/CurrentEnvironmentContext
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { EnvironmentContext } from "./matchers/EnvironmentMatcher.ts"

// =============================================================================
// Service Tag
// =============================================================================

/**
 * CurrentEnvironmentContext - Service tag for accessing environment context
 *
 * Contains optional environment information captured from the HTTP request:
 * - currentTime: Current time of day in HH:MM format
 * - currentDayOfWeek: Current day of week (0=Sunday, 6=Saturday)
 * - ipAddress: Client IP address
 * - userAgent: Client user agent string (for audit logging)
 *
 * Usage in handlers/services:
 * ```ts
 * Effect.gen(function* () {
 *   const envContext = yield* getCurrentEnvironmentContext
 *   if (Option.isSome(envContext)) {
 *     // Use environment context for policy evaluation
 *   }
 * })
 * ```
 */
export class CurrentEnvironmentContext extends Context.Tag("CurrentEnvironmentContext")<
  CurrentEnvironmentContext,
  EnvironmentContextWithMeta
>() {}

/**
 * Extended environment context that includes metadata for audit logging
 */
export interface EnvironmentContextWithMeta extends EnvironmentContext {
  /**
   * Client user agent string (for audit logging, not policy evaluation)
   */
  readonly userAgent: string | undefined
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * getCurrentEnvironmentContext - Get the environment context from the current effect context
 *
 * Requires CurrentEnvironmentContext in context. Use CurrentEnvironmentContextDefault
 * layer in tests or non-HTTP contexts.
 *
 * @returns Effect that yields the environment context
 */
export const getCurrentEnvironmentContext: Effect.Effect<
  EnvironmentContextWithMeta,
  never,
  CurrentEnvironmentContext
> = CurrentEnvironmentContext

/**
 * withEnvironmentContext - Provide environment context for an effect
 *
 * @param context - The environment context to provide
 * @param effect - The effect to run with the environment context
 * @returns Effect with CurrentEnvironmentContext provided
 */
export const withEnvironmentContext =
  (context: EnvironmentContextWithMeta) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, Exclude<R, CurrentEnvironmentContext>> =>
    Effect.provideService(effect, CurrentEnvironmentContext, context)

/**
 * createEnvironmentContextFromRequest - Create environment context from HTTP request info
 *
 * @param ipAddress - The client IP address (from remoteAddress or X-Forwarded-For header)
 * @param userAgent - The User-Agent header value
 * @param date - The current date (defaults to now)
 * @returns EnvironmentContextWithMeta for policy evaluation and audit logging
 *
 * @example
 * ```ts
 * const envContext = createEnvironmentContextFromRequest(
 *   "192.168.1.100",
 *   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
 *   new Date()
 * )
 * ```
 */
export const createEnvironmentContextFromRequest = (
  ipAddress: string | undefined,
  userAgent: string | undefined,
  date: Date = new Date()
): EnvironmentContextWithMeta => {
  // Calculate time values directly to ensure they're always defined
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")

  // Build the result with explicit property assignments
  const result: EnvironmentContextWithMeta = {
    currentTime: `${hours}:${minutes}`,
    currentDayOfWeek: date.getDay(),
    userAgent
  }

  // Only add ipAddress if defined (to match EnvironmentContext's optional property semantics)
  if (ipAddress !== undefined) {
    return { ...result, ipAddress }
  }

  return result
}

// =============================================================================
// Layers
// =============================================================================

/**
 * Default environment context for non-HTTP contexts (tests, CLI, etc.)
 *
 * Creates an environment context with current time but no IP or user agent.
 * Use this in tests or non-HTTP contexts where environment context is required
 * but no HTTP request is available.
 */
export const defaultEnvironmentContext = (): EnvironmentContextWithMeta =>
  createEnvironmentContextFromRequest(undefined, undefined, new Date())

/**
 * CurrentEnvironmentContextDefault - Layer providing a default environment context
 *
 * Use this in tests or non-HTTP contexts where CurrentEnvironmentContext is required.
 * Provides current time of day and day of week, but no IP address or user agent.
 */
export const CurrentEnvironmentContextDefault: Layer.Layer<CurrentEnvironmentContext> =
  Layer.sync(CurrentEnvironmentContext, defaultEnvironmentContext)
