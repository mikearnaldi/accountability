/**
 * AuthErrors - Tagged error types for authentication failure scenarios
 *
 * Defines all authentication-related errors for multiple providers.
 * Each error extends Schema.TaggedError.
 *
 * HTTP Status Codes (for API layer reference):
 * - 400 Bad Request: PasswordTooWeakError, OAuthStateError
 * - 401 Unauthorized: InvalidCredentialsError, SessionExpiredError, SessionNotFoundError, ProviderAuthFailedError
 * - 404 Not Found: UserNotFoundError, ProviderNotEnabledError
 * - 409 Conflict: UserAlreadyExistsError, IdentityAlreadyLinkedError
 *
 * @module AuthErrors
 */

import { HttpApiSchema } from "@effect/platform"
import { Chunk } from "effect"
import * as Schema from "effect/Schema"
import { AuthProviderType } from "./AuthProviderType.ts"
import { Email } from "./Email.ts"
import { AuthUserId } from "./AuthUserId.ts"
import { SessionId } from "./SessionId.ts"
import { ProviderId } from "./ProviderId.ts"

// =============================================================================
// 401 Unauthorized Errors - Authentication failures
// =============================================================================

/**
 * InvalidCredentialsError - Wrong username/password (local provider)
 *
 * Returned when local authentication fails due to incorrect credentials.
 * For security, this error is intentionally vague and does not specify
 * whether the email or password was incorrect.
 *
 * HTTP Status: 401 Unauthorized
 */
export class InvalidCredentialsError extends Schema.TaggedError<InvalidCredentialsError>()(
  "InvalidCredentialsError",
  {
    email: Email.annotations({
      description: "The email address that was used for authentication"
    })
  },
  HttpApiSchema.annotations({ status: 401 })
) {
  get message(): string {
    return "Invalid email or password"
  }
}

/**
 * Type guard for InvalidCredentialsError
 */
export const isInvalidCredentialsError = Schema.is(InvalidCredentialsError)

/**
 * SessionExpiredError - Session has expired
 *
 * Returned when attempting to use a session that has exceeded its lifetime.
 *
 * HTTP Status: 401 Unauthorized
 */
export class SessionExpiredError extends Schema.TaggedError<SessionExpiredError>()(
  "SessionExpiredError",
  {
    sessionId: SessionId.annotations({
      description: "The expired session token"
    })
  },
  HttpApiSchema.annotations({ status: 401 })
) {
  get message(): string {
    return "Session has expired"
  }
}

/**
 * Type guard for SessionExpiredError
 */
export const isSessionExpiredError = Schema.is(SessionExpiredError)

/**
 * SessionNotFoundError - Invalid session token
 *
 * Returned when the provided session token does not correspond to a valid session.
 *
 * HTTP Status: 401 Unauthorized
 */
export class SessionNotFoundError extends Schema.TaggedError<SessionNotFoundError>()(
  "SessionNotFoundError",
  {
    sessionId: SessionId.annotations({
      description: "The invalid session token"
    })
  },
  HttpApiSchema.annotations({ status: 401 })
) {
  get message(): string {
    return "Session not found"
  }
}

/**
 * Type guard for SessionNotFoundError
 */
export const isSessionNotFoundError = Schema.is(SessionNotFoundError)

/**
 * ProviderAuthFailedError - External provider auth failed (WorkOS, OAuth)
 *
 * Returned when authentication with an external provider fails.
 * This includes OAuth errors, SAML assertion failures, and WorkOS SSO errors.
 *
 * HTTP Status: 401 Unauthorized
 */
export class ProviderAuthFailedError extends Schema.TaggedError<ProviderAuthFailedError>()(
  "ProviderAuthFailedError",
  {
    provider: AuthProviderType.annotations({
      description: "The authentication provider that failed"
    }),
    reason: Schema.String.annotations({
      description: "A description of why the authentication failed"
    })
  },
  HttpApiSchema.annotations({ status: 401 })
) {
  get message(): string {
    return `Authentication with ${this.provider} failed: ${this.reason}`
  }
}

/**
 * Type guard for ProviderAuthFailedError
 */
export const isProviderAuthFailedError = Schema.is(ProviderAuthFailedError)

// =============================================================================
// 404 Not Found Errors - Resource does not exist
// =============================================================================

/**
 * UserNotFoundError - User does not exist
 *
 * Returned when attempting to authenticate or look up a user that does not exist.
 *
 * HTTP Status: 404 Not Found
 */
export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  {
    email: Email.annotations({
      description: "The email address that was not found"
    })
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `User not found: ${this.email}`
  }
}

/**
 * Type guard for UserNotFoundError
 */
export const isUserNotFoundError = Schema.is(UserNotFoundError)

/**
 * ProviderNotEnabledError - Auth provider not configured/enabled
 *
 * Returned when attempting to use an authentication provider that has not been
 * configured or enabled for the current context (organization/tenant).
 *
 * HTTP Status: 404 Not Found
 */
export class ProviderNotEnabledError extends Schema.TaggedError<ProviderNotEnabledError>()(
  "ProviderNotEnabledError",
  {
    provider: AuthProviderType.annotations({
      description: "The authentication provider that is not enabled"
    })
  },
  HttpApiSchema.annotations({ status: 404 })
) {
  get message(): string {
    return `Authentication provider '${this.provider}' is not enabled`
  }
}

/**
 * Type guard for ProviderNotEnabledError
 */
export const isProviderNotEnabledError = Schema.is(ProviderNotEnabledError)

// =============================================================================
// 409 Conflict Errors - Resource already exists or is in conflict
// =============================================================================

/**
 * UserAlreadyExistsError - Duplicate registration (email already taken)
 *
 * Returned when attempting to register a new user with an email that is
 * already associated with an existing account.
 *
 * HTTP Status: 409 Conflict
 */
export class UserAlreadyExistsError extends Schema.TaggedError<UserAlreadyExistsError>()(
  "UserAlreadyExistsError",
  {
    email: Email.annotations({
      description: "The email address that is already registered"
    })
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `User with email '${this.email}' already exists`
  }
}

/**
 * Type guard for UserAlreadyExistsError
 */
export const isUserAlreadyExistsError = Schema.is(UserAlreadyExistsError)

/**
 * IdentityAlreadyLinkedError - Provider identity already linked to another user
 *
 * Returned when attempting to link an external provider identity (e.g., Google account)
 * that is already linked to a different user in the system.
 *
 * HTTP Status: 409 Conflict
 */
export class IdentityAlreadyLinkedError extends Schema.TaggedError<IdentityAlreadyLinkedError>()(
  "IdentityAlreadyLinkedError",
  {
    provider: AuthProviderType.annotations({
      description: "The authentication provider"
    }),
    providerId: ProviderId.annotations({
      description: "The external provider's user identifier"
    }),
    existingUserId: AuthUserId.annotations({
      description: "The user ID that the identity is already linked to"
    })
  },
  HttpApiSchema.annotations({ status: 409 })
) {
  get message(): string {
    return `Identity from '${this.provider}' is already linked to another user`
  }
}

/**
 * Type guard for IdentityAlreadyLinkedError
 */
export const isIdentityAlreadyLinkedError = Schema.is(IdentityAlreadyLinkedError)

// =============================================================================
// 400 Bad Request Errors - Invalid request data
// =============================================================================

/**
 * PasswordTooWeakError - Password validation failed (local provider)
 *
 * Returned when a password does not meet the required strength criteria.
 * Includes details about which specific requirements were not met.
 *
 * HTTP Status: 400 Bad Request
 */
export class PasswordTooWeakError extends Schema.TaggedError<PasswordTooWeakError>()(
  "PasswordTooWeakError",
  {
    requirements: Schema.Chunk(Schema.String).annotations({
      description: "List of password requirements that were not met"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `Password does not meet requirements: ${Chunk.toReadonlyArray(this.requirements).join(", ")}`
  }
}

/**
 * Type guard for PasswordTooWeakError
 */
export const isPasswordTooWeakError = Schema.is(PasswordTooWeakError)

/**
 * OAuthStateError - OAuth state mismatch (CSRF protection)
 *
 * Returned when the OAuth state parameter does not match, indicating a potential
 * CSRF attack or session corruption. The OAuth flow should be restarted.
 *
 * HTTP Status: 400 Bad Request
 */
export class OAuthStateError extends Schema.TaggedError<OAuthStateError>()(
  "OAuthStateError",
  {
    provider: AuthProviderType.annotations({
      description: "The OAuth provider where the state mismatch occurred"
    })
  },
  HttpApiSchema.annotations({ status: 400 })
) {
  get message(): string {
    return `OAuth state mismatch for ${this.provider}. Please restart the authentication flow.`
  }
}

/**
 * Type guard for OAuthStateError
 */
export const isOAuthStateError = Schema.is(OAuthStateError)

// =============================================================================
// 500 Internal Server Errors - System failures
// =============================================================================

/**
 * SessionCleanupError - Failed to delete expired or old session
 *
 * Returned when the system fails to clean up an expired session during validation
 * or an old session during refresh. Session cleanup is critical for security
 * (prevents session hijacking) and database hygiene (prevents stale data accumulation).
 *
 * HTTP Status: 500 Internal Server Error
 */
export class SessionCleanupError extends Schema.TaggedError<SessionCleanupError>()(
  "SessionCleanupError",
  {
    sessionId: SessionId.annotations({
      description: "The session that could not be deleted"
    }),
    operation: Schema.String.annotations({
      description: "The cleanup operation that failed (e.g., 'expiry', 'refresh')"
    }),
    cause: Schema.Unknown.annotations({
      description: "The underlying error that caused the cleanup to fail"
    })
  },
  HttpApiSchema.annotations({ status: 500 })
) {
  get message(): string {
    return `Failed to clean up session during ${this.operation}: ${String(this.cause)}`
  }
}

/**
 * Type guard for SessionCleanupError
 */
export const isSessionCleanupError = Schema.is(SessionCleanupError)

// =============================================================================
// Union Types
// =============================================================================

/**
 * Union type for all authentication errors
 */
export type AuthError =
  | InvalidCredentialsError
  | UserNotFoundError
  | UserAlreadyExistsError
  | IdentityAlreadyLinkedError
  | ProviderNotEnabledError
  | ProviderAuthFailedError
  | SessionExpiredError
  | SessionNotFoundError
  | PasswordTooWeakError
  | OAuthStateError
  | SessionCleanupError

/**
 * HTTP status code mapping for API layer
 *
 * Use this map when configuring HttpApiSchema.annotations in the API package:
 * ```typescript
 * import { HttpApiSchema } from "@effect/platform"
 * import { InvalidCredentialsError, AUTH_ERROR_STATUS_CODES } from "@accountability/core/authentication/AuthErrors"
 *
 * // In API definition:
 * .addError(InvalidCredentialsError, HttpApiSchema.annotations({
 *   status: AUTH_ERROR_STATUS_CODES.InvalidCredentialsError
 * }))
 * ```
 */
export const AUTH_ERROR_STATUS_CODES = {
  // 401 Unauthorized
  InvalidCredentialsError: 401,
  SessionExpiredError: 401,
  SessionNotFoundError: 401,
  ProviderAuthFailedError: 401,
  // 404 Not Found
  UserNotFoundError: 404,
  ProviderNotEnabledError: 404,
  // 409 Conflict
  UserAlreadyExistsError: 409,
  IdentityAlreadyLinkedError: 409,
  // 400 Bad Request
  PasswordTooWeakError: 400,
  OAuthStateError: 400,
  // 500 Internal Server Error
  SessionCleanupError: 500
} as const
