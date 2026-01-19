/**
 * AuthMiddlewareLive - Live implementation of the authentication middleware
 *
 * Provides the actual token validation and middleware implementation.
 * This module contains implementations - definitions are in Definitions/.
 *
 * @module AuthMiddlewareLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import type { UserRole } from "@accountability/core/authentication/AuthUser"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { SessionId } from "@accountability/core/authentication/SessionId"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import { SessionRepository } from "@accountability/persistence/Services/SessionRepository"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { UnauthorizedError } from "../Definitions/ApiErrors.ts"
import {
  AuthMiddleware,
  TokenValidator,
  User,
  type TokenValidatorService
} from "../Definitions/AuthMiddleware.ts"

// =============================================================================
// Middleware Implementation
// =============================================================================

/**
 * AuthMiddlewareLive - Live implementation of the authentication middleware
 *
 * This layer:
 * 1. Receives the bearer token from the request Authorization header
 * 2. Falls back to checking the accountability_session cookie
 * 3. Delegates validation to the TokenValidator service
 * 4. Returns the validated User or an UnauthorizedError
 *
 * Requires: TokenValidator
 */
export const AuthMiddlewareLive: Layer.Layer<AuthMiddleware, never, TokenValidator> =
  Layer.effect(
    AuthMiddleware,
    Effect.gen(function* () {
      const tokenValidator = yield* TokenValidator

      return AuthMiddleware.of({
        bearer: (token) => {
          return tokenValidator.validate(token).pipe(
            Effect.catchAll((error) =>
              Effect.fail(new UnauthorizedError({ message: error.message }))
            )
          )
        },
        cookie: (token) => {
          // Cookie-based authentication using accountability_session cookie
          return tokenValidator.validate(token).pipe(
            Effect.catchAll((error) =>
              Effect.fail(new UnauthorizedError({ message: error.message }))
            )
          )
        }
      })
    })
  )

// =============================================================================
// Token Validator Implementations
// =============================================================================

/**
 * SimpleTokenValidatorLive - Simple token validation for development/testing
 *
 * This implementation accepts tokens in the format: "user_<userId>_<role>"
 * For example: "user_123_admin" creates a user with userId="123" and role="admin"
 *
 * In production, replace this with JWT validation or session lookup.
 */
export const SimpleTokenValidatorLive: Layer.Layer<TokenValidator> = Layer.succeed(
  TokenValidator,
  {
    validate: (token) =>
      Effect.gen(function* () {
        const tokenValue = Redacted.value(token)

        // Check for valid token format
        if (!tokenValue || tokenValue.trim() === "") {
          return yield* Effect.fail(
            new UnauthorizedError({ message: "Bearer token is required" })
          )
        }

        // Simple token format: "user_<userId>_<role>"
        const parts = tokenValue.split("_")
        if (parts.length !== 3 || parts[0] !== "user") {
          return yield* Effect.fail(
            new UnauthorizedError({ message: "Invalid token format" })
          )
        }

        const [, userIdStr, roleStr] = parts
        if (!userIdStr || userIdStr.trim() === "") {
          return yield* Effect.fail(
            new UnauthorizedError({ message: "Invalid token: missing user ID" })
          )
        }

        // Decode the userId as AuthUserId (UUID format)
        const userId = yield* Schema.decodeUnknown(AuthUserId)(userIdStr).pipe(
          Effect.mapError(() =>
            new UnauthorizedError({ message: "Invalid token: user ID must be a valid UUID" })
          )
        )

        // Validate role
        if (roleStr === "admin" || roleStr === "user" || roleStr === "readonly") {
          return User.make({ userId, role: roleStr })
        }

        return yield* Effect.fail(
          new UnauthorizedError({
            message: `Invalid token: invalid role "${roleStr}"`
          })
        )
      })
  } satisfies TokenValidatorService
)

/**
 * AuthMiddlewareWithSimpleValidation - Convenience layer that combines
 * AuthMiddlewareLive with SimpleTokenValidatorLive
 *
 * Use this for development and testing. In production, provide a real
 * TokenValidator implementation.
 */
export const AuthMiddlewareWithSimpleValidation: Layer.Layer<AuthMiddleware> =
  AuthMiddlewareLive.pipe(Layer.provide(SimpleTokenValidatorLive))

// =============================================================================
// Session Token Validator (Database-backed)
// =============================================================================

/**
 * Map database UserRole to middleware User role
 *
 * The auth database uses a more granular role system (admin, owner, member, viewer)
 * while the middleware uses a simpler role system (admin, user, readonly).
 *
 * @param role - The database UserRole
 * @returns The middleware role
 */
const mapUserRole = (role: UserRole): "admin" | "user" | "readonly" => {
  switch (role) {
    case "admin":
    case "owner":
      return "admin"
    case "member":
      return "user"
    case "viewer":
      return "readonly"
  }
}

/**
 * SessionTokenValidator - Session-based token validation against the database
 *
 * This implementation:
 * 1. Validates the token exists as a session ID in the auth_sessions table
 * 2. Checks the session has not expired
 * 3. Loads the full user from the auth_users table
 * 4. Maps the database user to the CurrentUser service
 *
 * Use this in production for secure session-based authentication.
 *
 * Requires: SessionRepository, UserRepository
 */
const makeSessionTokenValidator = Effect.gen(function* () {
  const sessionRepo = yield* SessionRepository
  const userRepo = yield* UserRepository

  const validate: TokenValidatorService["validate"] = (token) =>
    Effect.gen(function* () {
      const tokenValue = Redacted.value(token)

      // Check for valid token
      if (!tokenValue || tokenValue.trim() === "") {
        return yield* Effect.fail(
          new UnauthorizedError({ message: "Bearer token is required" })
        )
      }

      // Validate and create a SessionId from the token
      // Using decodeUnknown to gracefully handle invalid token formats
      const sessionId = yield* Schema.decodeUnknown(SessionId)(tokenValue).pipe(
        Effect.mapError(() =>
          new UnauthorizedError({ message: "Invalid session token format" })
        )
      )

      // Look up the session in the database
      const maybeSession = yield* sessionRepo.findById(sessionId).pipe(
        Effect.mapError(() =>
          new UnauthorizedError({ message: "Session validation failed" })
        )
      )

      // Check if session exists
      if (Option.isNone(maybeSession)) {
        return yield* Effect.fail(
          new UnauthorizedError({ message: "Invalid or expired session" })
        )
      }

      const session = maybeSession.value

      // Check if session has expired
      const now = Timestamp.now()
      if (session.isExpired(now)) {
        return yield* Effect.fail(
          new UnauthorizedError({ message: "Session has expired" })
        )
      }

      // Load the full user from the database
      const maybeUser = yield* userRepo.findById(session.userId).pipe(
        Effect.mapError(() =>
          new UnauthorizedError({ message: "User validation failed" })
        )
      )

      // Check if user exists
      if (Option.isNone(maybeUser)) {
        return yield* Effect.fail(
          new UnauthorizedError({ message: "User not found" })
        )
      }

      const authUser = maybeUser.value

      // Map database user to CurrentUser
      return User.make({
        userId: authUser.id,
        role: mapUserRole(authUser.role),
        sessionId: session.id
      })
    })

  return { validate } satisfies TokenValidatorService
})

/**
 * SessionTokenValidatorLive - Layer providing SessionTokenValidator
 *
 * Requires: SessionRepository, UserRepository
 *
 * Usage:
 * ```typescript
 * const AuthMiddlewareWithSessionValidation = AuthMiddlewareLive.pipe(
 *   Layer.provide(SessionTokenValidatorLive),
 *   Layer.provide(SessionRepositoryLive),
 *   Layer.provide(UserRepositoryLive),
 *   Layer.provide(PgClient.layer(...))
 * )
 * ```
 */
export const SessionTokenValidatorLive: Layer.Layer<
  TokenValidator,
  never,
  SessionRepository | UserRepository
> = Layer.effect(TokenValidator, makeSessionTokenValidator)

/**
 * AuthMiddlewareWithSessionValidation - Convenience layer that combines
 * AuthMiddlewareLive with SessionTokenValidatorLive
 *
 * Requires: SessionRepository, UserRepository
 *
 * Use this in production for session-based authentication.
 */
export const AuthMiddlewareWithSessionValidation: Layer.Layer<
  AuthMiddleware,
  never,
  SessionRepository | UserRepository
> = AuthMiddlewareLive.pipe(Layer.provide(SessionTokenValidatorLive))
