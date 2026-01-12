/**
 * AuthMiddleware - Authentication middleware for the HTTP API
 *
 * Implements bearer token authentication using HttpApiMiddleware.Tag.
 * Validates bearer tokens and provides a CurrentUser service to handlers.
 *
 * @module AuthMiddleware
 */

import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { UnauthorizedError } from "./ApiErrors.ts"

// =============================================================================
// CurrentUser Service
// =============================================================================

/**
 * User - Represents the authenticated user
 *
 * Contains minimal user information extracted from the bearer token.
 */
export class User extends Schema.Class<User>("User")({
  userId: Schema.String,
  role: Schema.Literal("admin", "user", "readonly")
}) {}

/**
 * CurrentUser - Service tag for accessing the authenticated user in handlers
 *
 * Usage in handlers:
 * ```ts
 * .handle("myEndpoint", (_) =>
 *   Effect.gen(function* () {
 *     const user = yield* CurrentUser
 *     // user.userId, user.role available
 *   })
 * )
 * ```
 */
export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * AuthMiddleware - Bearer token authentication middleware
 *
 * This middleware:
 * 1. Extracts bearer tokens from the Authorization header
 * 2. Validates the token
 * 3. Provides a CurrentUser service to downstream handlers
 * 4. Returns UnauthorizedError (401) for invalid/missing tokens
 *
 * Apply to protected API groups using `.middleware(AuthMiddleware)`
 */
export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()(
  "AuthMiddleware",
  {
    failure: UnauthorizedError,
    provides: CurrentUser,
    security: {
      bearer: HttpApiSecurity.bearer
    }
  }
) {}

// =============================================================================
// Token Validation Service
// =============================================================================

/**
 * TokenValidatorService - Service interface for validating bearer tokens
 *
 * This abstraction allows for different token validation strategies:
 * - JWT validation
 * - Session token lookup
 * - API key validation
 * - Mock validation for testing
 */
export interface TokenValidatorService {
  readonly validate: (
    token: Redacted.Redacted<string>
  ) => Effect.Effect<User, UnauthorizedError>
}

/**
 * TokenValidator - Service tag for token validation
 */
export class TokenValidator extends Context.Tag("TokenValidator")<
  TokenValidator,
  TokenValidatorService
>() {}

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
  }
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
