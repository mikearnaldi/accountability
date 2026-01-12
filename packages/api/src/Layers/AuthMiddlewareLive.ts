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
import * as Redacted from "effect/Redacted"
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
 * 1. Receives the bearer token from the request
 * 2. Delegates validation to the TokenValidator service
 * 3. Returns the validated User or an UnauthorizedError
 *
 * Requires: TokenValidator
 */
export const AuthMiddlewareLive: Layer.Layer<AuthMiddleware, never, TokenValidator> =
  Layer.effect(
    AuthMiddleware,
    Effect.gen(function* () {
      const tokenValidator = yield* TokenValidator

      return AuthMiddleware.of({
        bearer: (token) =>
          tokenValidator.validate(token).pipe(
            Effect.catchAll((error) =>
              Effect.fail(new UnauthorizedError({ message: error.message }))
            )
          )
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

        const [, userId, roleStr] = parts
        if (!userId || userId.trim() === "") {
          return yield* Effect.fail(
            new UnauthorizedError({ message: "Invalid token: missing user ID" })
          )
        }

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
