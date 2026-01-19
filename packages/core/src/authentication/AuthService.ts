/**
 * AuthService - Main authentication service orchestrating multiple providers
 *
 * Provides a unified authentication API that routes requests to the appropriate
 * provider based on AuthProviderType. Manages user sessions, identity linking,
 * and provider registration.
 *
 * Architecture:
 * - Uses the registry pattern to hold multiple AuthProvider implementations
 * - AuthProviderType determines which provider handles a request
 * - Supports concurrent use of multiple authentication methods
 *
 * @module AuthService
 */

import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Chunk from "effect/Chunk"
import type { AuthProviderType } from "./AuthProviderType.ts"
import type { AuthRequest } from "./AuthRequest.ts"
import type { AuthResult } from "./AuthResult.ts"
import type { AuthUser } from "./AuthUser.ts"
import type { Session } from "./Session.ts"
import type { UserIdentity } from "./UserIdentity.ts"
import type { AuthUserId } from "./AuthUserId.ts"
import type { SessionId } from "./SessionId.ts"
import type { Email } from "./Email.ts"
import type {
  AuthError,
  InvalidCredentialsError,
  UserNotFoundError,
  UserAlreadyExistsError,
  ProviderNotEnabledError,
  ProviderAuthFailedError,
  SessionExpiredError,
  SessionNotFoundError,
  SessionCleanupError,
  IdentityAlreadyLinkedError,
  PasswordTooWeakError,
  OAuthStateError
} from "./AuthErrors.ts"

// =============================================================================
// Session Validation Result
// =============================================================================

/**
 * ValidatedSession - Result of successful session validation
 *
 * Contains both the authenticated user and the valid session.
 */
export interface ValidatedSession {
  readonly user: AuthUser
  readonly session: Session
}

/**
 * LoginSuccess - Result of successful login
 *
 * Contains both the authenticated user and the created session.
 */
export interface LoginSuccess {
  readonly user: AuthUser
  readonly session: Session
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * AuthServiceShape - The shape of the authentication service
 *
 * Provides all authentication operations including:
 * - Login with any enabled provider
 * - Registration (local provider only)
 * - OAuth/SAML flow support
 * - Session management
 * - Identity linking
 */
export interface AuthServiceShape {
  /**
   * Login with the specified provider
   *
   * Routes the authentication request to the appropriate provider and creates
   * a session on success. If the user doesn't exist but the provider supports
   * registration, a new user account may be created (auto-registration).
   *
   * @param provider - The provider to authenticate with
   * @param request - The authentication request
   * @returns Effect containing the user and session
   * @errors ProviderNotEnabledError - Provider is not enabled
   * @errors InvalidCredentialsError - Wrong credentials (local)
   * @errors ProviderAuthFailedError - Provider authentication failed
   * @errors UserNotFoundError - User not found and auto-registration disabled
   */
  readonly login: (
    provider: AuthProviderType,
    request: AuthRequest
  ) => Effect.Effect<
    LoginSuccess,
    ProviderNotEnabledError | InvalidCredentialsError | ProviderAuthFailedError | UserNotFoundError | OAuthStateError
  >

  /**
   * Register a new user with local credentials
   *
   * Creates a new user account with email/password authentication.
   * Only available for the 'local' provider.
   *
   * @param email - The user's email address
   * @param password - The user's password (as Redacted string)
   * @param displayName - The user's display name
   * @returns Effect containing the created user
   * @errors UserAlreadyExistsError - Email already registered
   * @errors PasswordTooWeakError - Password doesn't meet requirements
   */
  readonly register: (
    email: Email,
    password: string,
    displayName: string
  ) => Effect.Effect<
    AuthUser,
    UserAlreadyExistsError | PasswordTooWeakError
  >

  /**
   * Get the authorization URL for OAuth/SAML providers
   *
   * Returns the URL to redirect users to for external authentication.
   * Includes a CSRF-protection state parameter.
   *
   * @param provider - The OAuth/SAML provider
   * @param redirectUri - Optional custom redirect URI
   * @returns Effect containing the authorization URL
   * @errors ProviderNotEnabledError - Provider is not enabled
   */
  readonly getAuthorizationUrl: (
    provider: AuthProviderType,
    redirectUri?: string
  ) => Effect.Effect<string, ProviderNotEnabledError>

  /**
   * Handle the OAuth callback after redirect
   *
   * Processes the callback from an OAuth provider, validates the state,
   * exchanges the code for tokens, and creates/authenticates the user.
   *
   * @param provider - The OAuth provider
   * @param code - The authorization code
   * @param state - The state parameter for CSRF validation
   * @returns Effect containing the user and session
   * @errors ProviderNotEnabledError - Provider is not enabled
   * @errors ProviderAuthFailedError - Authentication failed
   * @errors OAuthStateError - State mismatch (CSRF protection)
   */
  readonly handleOAuthCallback: (
    provider: AuthProviderType,
    code: string,
    state: string
  ) => Effect.Effect<
    LoginSuccess,
    ProviderNotEnabledError | ProviderAuthFailedError | OAuthStateError
  >

  /**
   * Logout and invalidate a session
   *
   * Destroys the specified session, preventing further use of that session token.
   *
   * @param sessionId - The session to invalidate
   * @returns Effect completing successfully on logout
   * @errors SessionNotFoundError - Session does not exist
   */
  readonly logout: (
    sessionId: SessionId
  ) => Effect.Effect<void, SessionNotFoundError>

  /**
   * Validate a session and retrieve the associated user
   *
   * Checks if the session is valid (exists and not expired) and returns
   * both the session and the authenticated user.
   *
   * @param sessionId - The session token to validate
   * @returns Effect containing the user and session
   * @errors SessionNotFoundError - Session does not exist
   * @errors SessionExpiredError - Session has expired
   * @errors SessionCleanupError - Failed to delete expired session
   */
  readonly validateSession: (
    sessionId: SessionId
  ) => Effect.Effect<ValidatedSession, SessionNotFoundError | SessionExpiredError | SessionCleanupError>

  /**
   * Link an external identity to an existing user
   *
   * Associates an external provider identity (e.g., Google account) with
   * an existing user. This allows users to login with multiple providers.
   *
   * @param userId - The user to link the identity to
   * @param provider - The provider type
   * @param providerResult - The authentication result from the provider
   * @returns Effect containing the created identity link
   * @errors IdentityAlreadyLinkedError - Identity is linked to another user
   * @errors UserNotFoundError - User does not exist
   */
  readonly linkIdentity: (
    userId: AuthUserId,
    provider: AuthProviderType,
    providerResult: AuthResult
  ) => Effect.Effect<
    UserIdentity,
    IdentityAlreadyLinkedError | UserNotFoundError | ProviderAuthFailedError
  >

  /**
   * Get all enabled authentication providers
   *
   * Returns the list of providers that are currently enabled and available
   * for authentication.
   *
   * @returns Effect containing the list of enabled provider types
   */
  readonly getEnabledProviders: () => Effect.Effect<Chunk.Chunk<AuthProviderType>>
}

/**
 * AuthService - Context.Tag for the authentication service
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const auth = yield* AuthService
 *   const { user, session } = yield* auth.login("local", LocalAuthRequest.make({
 *     email: Email.make("user@example.com"),
 *     password: Redacted.make("password123")
 *   }))
 *   return user
 * })
 *
 * // Provide the implementation
 * program.pipe(Effect.provide(AuthServiceLive))
 * ```
 */
export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  AuthServiceShape
>() {}

// =============================================================================
// Session Error Union
// =============================================================================

/**
 * SessionError - Union of session-related errors
 */
export type SessionError = SessionNotFoundError | SessionExpiredError

/**
 * LoginError - Union of login-related errors
 */
export type LoginError =
  | ProviderNotEnabledError
  | InvalidCredentialsError
  | ProviderAuthFailedError
  | UserNotFoundError
  | OAuthStateError

/**
 * RegistrationError - Union of registration-related errors
 */
export type RegistrationError = UserAlreadyExistsError | PasswordTooWeakError

/**
 * IdentityLinkError - Union of identity linking errors
 */
export type IdentityLinkError =
  | IdentityAlreadyLinkedError
  | UserNotFoundError
  | ProviderAuthFailedError

/**
 * Re-export AuthError for convenience
 */
export type { AuthError }
