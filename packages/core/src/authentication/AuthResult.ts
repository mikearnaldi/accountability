/**
 * AuthResult - Result types for authentication operations
 *
 * Defines the result of successful authentication from any provider.
 * Contains the authenticated user information and provider-specific data.
 *
 * @module AuthResult
 */

import * as Schema from "effect/Schema"
import { AuthProviderType } from "./AuthProviderType.ts"
import { ProviderId } from "./ProviderId.ts"
import { Email } from "./Email.ts"
import { ProviderData } from "./UserIdentity.ts"

// =============================================================================
// AuthResult
// =============================================================================

/**
 * AuthResult - Successful authentication result from a provider
 *
 * This is the normalized result returned by any AuthProvider after
 * successful authentication. It contains the essential user information
 * needed to either:
 * - Create a new user and identity (registration)
 * - Link an identity to an existing user
 * - Authenticate an existing user
 */
export class AuthResult extends Schema.Class<AuthResult>("AuthResult")({
  /**
   * The type of provider that authenticated the user
   */
  provider: AuthProviderType,

  /**
   * The user's unique identifier from the provider
   * (e.g., Google 'sub', GitHub user ID, WorkOS user ID)
   */
  providerId: ProviderId,

  /**
   * The user's email address from the provider
   */
  email: Email,

  /**
   * The user's display name from the provider
   */
  displayName: Schema.NonEmptyTrimmedString.annotations({
    title: "Display Name",
    description: "The user's display name from the provider"
  }),

  /**
   * Whether the email is verified by the provider
   * For local auth, this may be false until email verification is complete.
   * For OAuth providers, this is typically true.
   */
  emailVerified: Schema.Boolean.annotations({
    title: "Email Verified",
    description: "Whether the provider has verified the email address"
  }),

  /**
   * Optional provider-specific data (profile info, tokens, etc.)
   */
  providerData: Schema.Option(ProviderData)
}) {}

/**
 * Type guard for AuthResult using Schema.is
 */
export const isAuthResult = Schema.is(AuthResult)

// =============================================================================
// LoginResult
// =============================================================================

/**
 * LoginResult - Result of a successful login operation
 *
 * Returned by AuthService.login after successful authentication.
 * Contains the authenticated user and the created session.
 */
export class LoginResult extends Schema.Class<LoginResult>("LoginResult")({
  /**
   * The authenticated user's ID
   */
  userId: Schema.UUID.pipe(Schema.brand("AuthUserId")),

  /**
   * The authenticated user's email
   */
  email: Email,

  /**
   * The authenticated user's display name
   */
  displayName: Schema.NonEmptyTrimmedString,

  /**
   * The created session ID (token)
   */
  sessionId: Schema.NonEmptyTrimmedString.pipe(Schema.brand("SessionId")),

  /**
   * When the session expires
   */
  expiresAt: Schema.Number.annotations({
    title: "Expires At",
    description: "Session expiration time in epoch milliseconds"
  }),

  /**
   * The provider used for authentication
   */
  provider: AuthProviderType
}) {}

/**
 * Type guard for LoginResult using Schema.is
 */
export const isLoginResult = Schema.is(LoginResult)
