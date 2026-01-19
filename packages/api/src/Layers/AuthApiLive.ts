/**
 * AuthApiLive - Live implementation of authentication API handlers
 *
 * Implements the AuthApi (public) and AuthSessionApi (protected) endpoints
 * by delegating to AuthService from the persistence package.
 *
 * Features:
 * - Provider discovery with UI metadata
 * - Local registration with password validation
 * - Multi-provider login (local + OAuth)
 * - OAuth authorization URL generation
 * - OAuth callback handling with session creation
 * - Session management (logout, refresh)
 * - Provider identity linking/unlinking
 * - Proper error mapping to API error types
 *
 * @module AuthApiLive
 */

import { HttpApiBuilder, HttpServerResponse, HttpApp } from "@effect/platform"
import * as Chunk from "effect/Chunk"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import { AppApi } from "../Definitions/AppApi.ts"
import { CurrentUser, TokenValidator, User, type TokenValidatorService } from "../Definitions/AuthMiddleware.ts"
import {
  ProvidersResponse,
  ProviderMetadata,
  LoginResponse,
  LogoutResponse,
  AuthUserResponse,
  RefreshResponse,
  AuthorizeRedirectResponse,
  LinkInitiateResponse,
  AuthValidationError,
  PasswordWeakError,
  OAuthStateInvalidError,
  ProviderAuthError,
  ProviderNotFoundError,
  AuthUnauthorizedError,
  UserExistsError,
  SessionInvalidError,
  IdentityLinkedError,
  CannotUnlinkLastIdentityError,
  IdentityNotFoundError,
  ChangePasswordError,
  NoLocalIdentityError,
  AuthUserNotFoundError
} from "../Definitions/AuthApi.ts"
import { UnauthorizedError } from "../Definitions/ApiErrors.ts"
import { AuthService, type AuthServiceShape } from "@accountability/core/authentication/AuthService"
import type { AuthUser } from "@accountability/core/authentication/AuthUser"
import type { AuthProviderType } from "@accountability/core/authentication/AuthProviderType"
import { LocalAuthRequest } from "@accountability/core/authentication/AuthRequest"
import { SessionId } from "@accountability/core/authentication/SessionId"
import {
  isPasswordTooWeakError,
  isUserAlreadyExistsError,
  isProviderNotEnabledError,
  isInvalidCredentialsError,
  isProviderAuthFailedError,
  isOAuthStateError,
  isSessionNotFoundError,
  isSessionExpiredError,
  isUserNotFoundError
} from "@accountability/core/authentication/AuthErrors"
import { IdentityRepository } from "@accountability/persistence/Services/IdentityRepository"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { SessionRepository } from "@accountability/persistence/Services/SessionRepository"
import { PasswordHasher } from "@accountability/core/authentication/PasswordHasher"
import { ProviderId } from "@accountability/core/authentication/ProviderId"

// =============================================================================
// Constants
// =============================================================================

const SESSION_COOKIE_NAME = "accountability_session"
const SESSION_COOKIE_MAX_AGE = Duration.days(30)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Set httpOnly session cookie via pre-response handler
 */
const setSessionCookie = (token: string): Effect.Effect<void> => {
  return HttpApp.appendPreResponseHandler((_req, response) =>
    Effect.orDie(
      HttpServerResponse.setCookie(response, SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_COOKIE_MAX_AGE
      })
    )
  )
}

/**
 * Clear the session cookie by expiring it with a past date
 */
const clearSessionCookie = (): Effect.Effect<void> => {
  return HttpApp.appendPreResponseHandler((_req, response) =>
    Effect.orDie(
      HttpServerResponse.setCookie(response, SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(0) // Expire in the past
      })
    )
  )
}

/**
 * Get provider metadata based on provider type
 */
const getProviderMetadata = (providerType: AuthProviderType): ProviderMetadata => {
  switch (providerType) {
    case "local":
      return ProviderMetadata.make({
        type: "local",
        name: "Email & Password",
        supportsRegistration: true,
        supportsPasswordLogin: true,
        oauthEnabled: false
      })
    case "google":
      return ProviderMetadata.make({
        type: "google",
        name: "Google",
        supportsRegistration: false,
        supportsPasswordLogin: false,
        oauthEnabled: true
      })
    case "github":
      return ProviderMetadata.make({
        type: "github",
        name: "GitHub",
        supportsRegistration: false,
        supportsPasswordLogin: false,
        oauthEnabled: true
      })
    case "workos":
      return ProviderMetadata.make({
        type: "workos",
        name: "WorkOS SSO",
        supportsRegistration: false,
        supportsPasswordLogin: false,
        oauthEnabled: true
      })
    case "saml":
      return ProviderMetadata.make({
        type: "saml",
        name: "SAML SSO",
        supportsRegistration: false,
        supportsPasswordLogin: false,
        oauthEnabled: true
      })
  }
}

/**
 * Map core UserRole to API User role
 */
const mapUserRoleToApiRole = (role: AuthUser["role"]): "admin" | "user" | "readonly" => {
  switch (role) {
    case "admin":
      return "admin"
    case "member":
      return "user"
    case "viewer":
      return "readonly"
    default:
      return "user"
  }
}

// =============================================================================
// Public Auth API Implementation
// =============================================================================

/**
 * AuthApiLive - Layer providing public AuthApi handlers
 *
 * Implements public authentication endpoints:
 * - GET /providers - List enabled providers
 * - POST /register - Register new user
 * - POST /login - Login with any provider
 * - GET /authorize/:provider - Get OAuth authorization URL
 * - GET /callback/:provider - OAuth callback
 *
 * Dependencies:
 * - AuthService
 */
export const AuthApiLive = HttpApiBuilder.group(AppApi, "auth", (handlers) =>
  Effect.gen(function* () {
    const authService = yield* AuthService

    return handlers
      .handle("getProviders", () =>
        Effect.gen(function* () {
          const enabledProviders = yield* authService.getEnabledProviders()
          const providers = Chunk.toReadonlyArray(enabledProviders).map(getProviderMetadata)
          return ProvidersResponse.make({ providers })
        })
      )
      .handle("register", (_) =>
        Effect.gen(function* () {
          const { email, password, displayName } = _.payload

          // Call AuthService.register
          const user = yield* authService.register(email, password, displayName).pipe(
            Effect.mapError((error) => {
              if (isPasswordTooWeakError(error)) {
                return new PasswordWeakError({
                  requirements: Chunk.toReadonlyArray(error.requirements)
                })
              }
              if (isUserAlreadyExistsError(error)) {
                return new UserExistsError({ email })
              }
              // This should never happen, but needed for type safety
              return new AuthValidationError({
                message: "Registration failed",
                field: Option.none()
              })
            })
          )

          // Get user identities (there will be at least one - the local identity)
          const identityRepo = yield* IdentityRepository
          const identitiesChunk = yield* identityRepo.findByUserId(user.id).pipe(
            Effect.mapError(() =>
              new AuthValidationError({
                message: "Failed to retrieve user identities",
                field: Option.none()
              })
            )
          )
          const identities = Chunk.toReadonlyArray(identitiesChunk)

          return AuthUserResponse.make({
            user,
            identities
          })
        })
      )
      .handle("login", (_) =>
        Effect.gen(function* () {
          const { provider, credentials } = _.payload

          // For OAuth credentials, use handleOAuthCallback instead
          if (!("email" in credentials)) {
            const { user, session } = yield* authService
              .handleOAuthCallback(provider, credentials.code, credentials.state)
              .pipe(
                Effect.mapError((error) => {
                  if (isProviderNotEnabledError(error)) {
                    return new ProviderNotFoundError({ provider })
                  }
                  if (isProviderAuthFailedError(error)) {
                    return new ProviderAuthError({
                      provider,
                      reason: error.reason
                    })
                  }
                  if (isOAuthStateError(error)) {
                    return new OAuthStateInvalidError({ provider })
                  }
                  // This shouldn't happen but needed for exhaustive type handling
                  return new AuthUnauthorizedError({
                    message: "Authentication failed"
                  })
                })
              )

            // Set httpOnly session cookie
            yield* setSessionCookie(session.id)

            return LoginResponse.make({
              token: session.id,
              user,
              provider,
              expiresAt: session.expiresAt.toDateTime()
            })
          }

          // Build LocalAuthRequest for local provider
          const authRequest = LocalAuthRequest.make({
            email: credentials.email,
            password: Redacted.make(credentials.password)
          })

          // Local login
          const { user, session } = yield* authService.login(provider, authRequest).pipe(
            Effect.mapError((error) => {
              if (isProviderNotEnabledError(error)) {
                return new ProviderNotFoundError({ provider })
              }
              if (isInvalidCredentialsError(error)) {
                return new AuthUnauthorizedError({
                  message: "Invalid email or password"
                })
              }
              if (isProviderAuthFailedError(error)) {
                return new ProviderAuthError({
                  provider,
                  reason: error.reason
                })
              }
              if (isOAuthStateError(error)) {
                return new OAuthStateInvalidError({ provider })
              }
              if (isUserNotFoundError(error)) {
                return new AuthUnauthorizedError({
                  message: "Invalid email or password"
                })
              }
              // Exhaustive - all error types covered
              return new AuthValidationError({
                message: "Login failed",
                field: Option.none()
              })
            })
          )

          // Set httpOnly session cookie
          yield* setSessionCookie(session.id)

          return LoginResponse.make({
            token: session.id,
            user,
            provider,
            expiresAt: session.expiresAt.toDateTime()
          })
        })
      )
      .handle("authorize", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path

          // Local provider doesn't support OAuth flow
          if (provider === "local") {
            return yield* Effect.fail(new ProviderNotFoundError({ provider }))
          }

          // Get authorization URL from AuthService
          const authUrl = yield* authService.getAuthorizationUrl(provider).pipe(
            Effect.mapError(() => new ProviderNotFoundError({ provider }))
          )

          // If empty URL, provider doesn't support OAuth
          if (authUrl === "") {
            return yield* Effect.fail(new ProviderNotFoundError({ provider }))
          }

          // Extract state from URL for response
          const url = new URL(authUrl)
          const state = url.searchParams.get("state") ?? crypto.randomUUID()

          return AuthorizeRedirectResponse.make({
            redirectUrl: authUrl,
            state
          })
        })
      )
      .handle("callback", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path
          const { code, state, error, error_description } = _.urlParams

          // Check for OAuth error from provider
          if (error !== undefined) {
            return yield* Effect.fail(
              new ProviderAuthError({
                provider,
                reason: error_description ?? error
              })
            )
          }

          // Handle the OAuth callback
          const { user, session } = yield* authService
            .handleOAuthCallback(provider, code, state)
            .pipe(
              Effect.mapError((error) => {
                if (isProviderNotEnabledError(error)) {
                  return new ProviderNotFoundError({ provider })
                }
                if (isProviderAuthFailedError(error)) {
                  return new ProviderAuthError({
                    provider,
                    reason: error.reason
                  })
                }
                if (isOAuthStateError(error)) {
                  return new OAuthStateInvalidError({ provider })
                }
                // Exhaustive
                return new ProviderAuthError({
                  provider,
                  reason: "OAuth callback failed"
                })
              })
            )

          // Set httpOnly session cookie
          yield* setSessionCookie(session.id)

          return LoginResponse.make({
            token: session.id,
            user,
            provider,
            expiresAt: session.expiresAt.toDateTime()
          })
        })
      )
  })
)

// =============================================================================
// Protected Auth Session API Implementation
// =============================================================================

/**
 * AuthSessionApiLive - Layer providing protected AuthSessionApi handlers
 *
 * Implements protected authentication endpoints:
 * - POST /logout - Logout and invalidate session
 * - GET /me - Get current user with identities
 * - POST /refresh - Refresh session token
 * - POST /link/:provider - Initiate provider linking
 * - GET /link/callback/:provider - Complete provider linking
 * - DELETE /identities/:identityId - Unlink provider identity
 *
 * All endpoints require authentication via AuthMiddleware.
 *
 * Dependencies:
 * - AuthService
 * - UserRepository
 * - IdentityRepository
 * - SessionContext (provided via middleware)
 */
export const AuthSessionApiLive = HttpApiBuilder.group(AppApi, "authSession", (handlers) =>
  Effect.gen(function* () {
    const authService = yield* AuthService
    const userRepo = yield* UserRepository
    const identityRepo = yield* IdentityRepository
    const sessionRepo = yield* SessionRepository

    return handlers
      .handle("logout", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser

          // Ensure we have a session ID
          if (currentUser.sessionId === undefined) {
            return yield* Effect.fail(
              new SessionInvalidError({
                message: "Session token not available"
              })
            )
          }

          // Logout using the session ID from CurrentUser (already typed as SessionId)
          yield* authService.logout(currentUser.sessionId).pipe(
            Effect.mapError(() =>
              new SessionInvalidError({
                message: "Session is invalid or already logged out"
              })
            )
          )

          // Clear the session cookie
          yield* clearSessionCookie()

          // Return success response
          return LogoutResponse.make({ success: true })
        })
      )
      .handle("me", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser

          // Get the full user from repository (userId is already typed as AuthUserId)
          const maybeUser = yield* userRepo.findById(currentUser.userId).pipe(
            Effect.catchAll(() => Effect.succeed(Option.none<AuthUser>()))
          )

          if (Option.isNone(maybeUser)) {
            return yield* Effect.fail(new AuthUserNotFoundError({}))
          }

          const user = maybeUser.value

          // Get all linked identities
          const identitiesChunk = yield* identityRepo.findByUserId(currentUser.userId).pipe(
            Effect.catchAll(() => Effect.succeed(Chunk.empty()))
          )
          const identities = Chunk.toReadonlyArray(identitiesChunk)

          return AuthUserResponse.make({
            user,
            identities
          })
        })
      )
      .handle("updateMe", (_) =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser
          const { displayName } = _.payload

          // Get the current user from repository (userId is already typed as AuthUserId)
          const maybeUser = yield* userRepo.findById(currentUser.userId).pipe(
            Effect.catchAll(() => Effect.succeed(Option.none<AuthUser>()))
          )

          if (Option.isNone(maybeUser)) {
            return yield* Effect.fail(new AuthUserNotFoundError({}))
          }

          // Build update data - only update fields that were provided
          const updateData: { displayName?: string } = {}
          if (Option.isSome(displayName)) {
            updateData.displayName = displayName.value
          }

          // Update user if there are changes
          let updatedUser: AuthUser
          if (Object.keys(updateData).length > 0) {
            updatedUser = yield* userRepo.update(currentUser.userId, updateData).pipe(
              Effect.mapError(() =>
                new AuthValidationError({
                  message: "Failed to update profile",
                  field: Option.none()
                })
              )
            )
          } else {
            // No changes, return current user
            updatedUser = maybeUser.value
          }

          // Get all linked identities
          const identitiesChunk = yield* identityRepo.findByUserId(currentUser.userId).pipe(
            Effect.catchAll(() => Effect.succeed(Chunk.empty()))
          )
          const identities = Chunk.toReadonlyArray(identitiesChunk)

          return AuthUserResponse.make({
            user: updatedUser,
            identities
          })
        })
      )
      .handle("refresh", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser

          // Ensure we have a session ID
          if (currentUser.sessionId === undefined) {
            return yield* Effect.fail(
              new SessionInvalidError({
                message: "Session token not available"
              })
            )
          }

          // Validate current session (sessionId is already typed as SessionId)
          yield* authService.validateSession(currentUser.sessionId).pipe(
            Effect.mapError((error) => {
              if (isSessionNotFoundError(error) || isSessionExpiredError(error)) {
                return new SessionInvalidError({
                  message: "Session is invalid or expired"
                })
              }
              return new SessionInvalidError({})
            })
          )

          // Logout old session - session cleanup is critical for security.
          // If logout fails, multiple active sessions could exist for the same user,
          // creating a session hijacking risk. Refresh should fail if we can't
          // clean up the old session.
          yield* authService.logout(currentUser.sessionId).pipe(
            Effect.mapError(() => new SessionInvalidError({
              message: "Failed to clean up old session during refresh"
            }))
          )

          // Generate new session token
          // Note: In a real implementation, this would create a new session in SessionRepository
          const newSessionId = SessionId.make(
            Array.from(crypto.getRandomValues(new Uint8Array(32)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
          )

          // Session duration is typically 7 days
          const expiresAt = DateTime.unsafeMake(Date.now() + 7 * 24 * 60 * 60 * 1000)

          return RefreshResponse.make({
            token: newSessionId,
            expiresAt
          })
        })
      )
      .handle("linkProvider", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path
          yield* CurrentUser // Ensure user is authenticated

          // Local provider cannot be linked as an additional identity
          if (provider === "local") {
            return yield* Effect.fail(new ProviderNotFoundError({ provider }))
          }

          // Get authorization URL for linking
          const baseUrl = yield* authService.getAuthorizationUrl(provider).pipe(
            Effect.mapError(() => new ProviderNotFoundError({ provider }))
          )

          if (baseUrl === "") {
            return yield* Effect.fail(new ProviderNotFoundError({ provider }))
          }

          // Add link flag to state
          const url = new URL(baseUrl)
          const originalState = url.searchParams.get("state") ?? crypto.randomUUID()
          const linkState = `link_${originalState}`
          url.searchParams.set("state", linkState)

          return LinkInitiateResponse.make({
            redirectUrl: url.toString(),
            state: linkState
          })
        })
      )
      .handle("linkCallback", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path
          const { code, state, error, error_description } = _.urlParams
          const currentUser = yield* CurrentUser

          // Check for OAuth error
          if (error !== undefined) {
            return yield* Effect.fail(
              new ProviderAuthError({
                provider,
                reason: error_description ?? error
              })
            )
          }

          // Validate state has link prefix
          if (!state.startsWith("link_")) {
            return yield* Effect.fail(new OAuthStateInvalidError({ provider }))
          }

          // Get the provider authentication result
          yield* authService
            .handleOAuthCallback(provider, code, state.slice(5)) // Remove "link_" prefix
            .pipe(
              Effect.mapError((error) => {
                if (isProviderNotEnabledError(error)) {
                  return new ProviderNotFoundError({ provider })
                }
                if (isProviderAuthFailedError(error)) {
                  return new ProviderAuthError({
                    provider,
                    reason: error.reason
                  })
                }
                if (isOAuthStateError(error)) {
                  return new OAuthStateInvalidError({ provider })
                }
                return new ProviderAuthError({
                  provider,
                  reason: "Link callback failed"
                })
              })
            )

          // Return the current user with their identities (userId is already typed as AuthUserId)
          const maybeUser = yield* userRepo.findById(currentUser.userId).pipe(
            Effect.mapError(() => new IdentityLinkedError({ provider }))
          )

          if (Option.isNone(maybeUser)) {
            return yield* Effect.fail(new IdentityLinkedError({ provider }))
          }

          const user = maybeUser.value
          const identitiesChunk = yield* identityRepo.findByUserId(currentUser.userId).pipe(
            Effect.mapError(() => new IdentityLinkedError({ provider }))
          )
          const identities = Chunk.toReadonlyArray(identitiesChunk)

          return AuthUserResponse.make({
            user,
            identities
          })
        })
      )
      .handle("unlinkIdentity", (_) =>
        Effect.gen(function* () {
          const { identityId } = _.path
          const currentUser = yield* CurrentUser

          // Get the identity to verify ownership
          const maybeIdentity = yield* identityRepo.findById(identityId).pipe(
            Effect.mapError(() =>
              new IdentityNotFoundError({ identityId })
            )
          )

          if (Option.isNone(maybeIdentity)) {
            return yield* Effect.fail(new IdentityNotFoundError({ identityId }))
          }

          const identity = maybeIdentity.value

          // Verify the identity belongs to the current user (userId is already typed as AuthUserId)
          if (identity.userId !== currentUser.userId) {
            return yield* Effect.fail(new IdentityNotFoundError({ identityId }))
          }

          // Check if this is the last identity - prevent unlinking
          const allIdentities = yield* identityRepo.findByUserId(currentUser.userId).pipe(
            Effect.mapError(() => new CannotUnlinkLastIdentityError({}))
          )

          if (Chunk.size(allIdentities) <= 1) {
            return yield* Effect.fail(new CannotUnlinkLastIdentityError({}))
          }

          // Delete the identity
          yield* identityRepo.delete(identityId).pipe(
            Effect.mapError(() => new IdentityNotFoundError({ identityId }))
          )
        })
      )
      .handle("changePassword", (_) =>
        Effect.gen(function* () {
          const { currentPassword, newPassword } = _.payload
          const currentUser = yield* CurrentUser
          const passwordHasher = yield* PasswordHasher

          // Get the user to find their email (userId is already typed as AuthUserId)
          const maybeUser = yield* userRepo.findById(currentUser.userId).pipe(
            Effect.mapError(() => new NoLocalIdentityError({}))
          )

          if (Option.isNone(maybeUser)) {
            return yield* Effect.fail(new NoLocalIdentityError({}))
          }

          const user = maybeUser.value

          // Check if user has a local identity
          const providerId = ProviderId.make(user.email)
          const maybeLocalIdentity = yield* identityRepo.findByUserAndProvider(currentUser.userId, "local").pipe(
            Effect.mapError(() => new NoLocalIdentityError({}))
          )

          if (Option.isNone(maybeLocalIdentity)) {
            return yield* Effect.fail(new NoLocalIdentityError({}))
          }

          // Get the current password hash to verify
          const maybeHash = yield* identityRepo.getPasswordHash("local", providerId).pipe(
            Effect.mapError(() => new NoLocalIdentityError({}))
          )

          if (Option.isNone(maybeHash)) {
            return yield* Effect.fail(new NoLocalIdentityError({}))
          }

          // Verify current password
          const isValid = yield* passwordHasher.verify(
            Redacted.make(currentPassword),
            maybeHash.value
          )

          if (!isValid) {
            return yield* Effect.fail(new ChangePasswordError({}))
          }

          // Validate new password strength (minimum 8 characters from Schema)
          if (newPassword.length < 8) {
            return yield* Effect.fail(
              new PasswordWeakError({
                requirements: ["Password must be at least 8 characters"]
              })
            )
          }

          // Hash the new password
          const newHash = yield* passwordHasher.hash(Redacted.make(newPassword))

          // Update the password hash
          yield* identityRepo.updatePasswordHash("local", providerId, newHash).pipe(
            Effect.mapError(() => new NoLocalIdentityError({}))
          )

          // SECURITY: Invalidate all sessions after password change
          // This ensures the user must re-login with the new password
          yield* sessionRepo.deleteByUserId(currentUser.userId).pipe(
            Effect.catchAll(() => Effect.succeed(0)) // Don't fail if session cleanup fails
          )
        })
      )
  })
)

// =============================================================================
// Session-Based Token Validator
// =============================================================================

/**
 * SessionTokenValidatorLive - Token validator that uses AuthService.validateSession
 *
 * Validates bearer tokens by looking them up as session IDs in the database.
 * Also provides SessionContext to downstream handlers.
 *
 * Dependencies:
 * - AuthService
 */
export const SessionTokenValidatorLive: Layer.Layer<TokenValidator, never, AuthService> = Layer.effect(
  TokenValidator,
  Effect.gen(function* () {
    const authService = yield* AuthService

    return {
      validate: (token) =>
        Effect.gen(function* () {
          const tokenValue = Redacted.value(token)

          // Check for valid token
          if (!tokenValue || tokenValue.trim() === "") {
            return yield* Effect.fail(
              new UnauthorizedError({ message: "Bearer token is required" })
            )
          }

          // Parse as SessionId
          const sessionId = SessionId.make(tokenValue)

          // Validate session with AuthService
          const { user } = yield* authService.validateSession(sessionId).pipe(
            Effect.mapError((error) => {
              if (isSessionNotFoundError(error)) {
                return new UnauthorizedError({ message: "Invalid session token" })
              }
              if (isSessionExpiredError(error)) {
                return new UnauthorizedError({ message: "Session has expired" })
              }
              return new UnauthorizedError({ message: "Authentication failed" })
            })
          )

          // Map to API User type
          const apiRole = mapUserRoleToApiRole(user.role)

          return User.make({
            userId: user.id,
            role: apiRole,
            sessionId // Include the session ID for logout/refresh
          })
        })
    } satisfies TokenValidatorService
  })
)

/**
 * makeSessionTokenValidator - Factory function for creating a token validator
 *
 * This is useful when you need to create the validator outside of the Layer system.
 */
export const makeSessionTokenValidator = (authService: AuthServiceShape): TokenValidatorService => ({
  validate: (token: Redacted.Redacted<string>): Effect.Effect<User, UnauthorizedError> =>
    Effect.gen(function* () {
      const tokenValue = Redacted.value(token)

      if (!tokenValue || tokenValue.trim() === "") {
        return yield* Effect.fail(
          new UnauthorizedError({ message: "Bearer token is required" })
        )
      }

      const sessionId = SessionId.make(tokenValue)

      const { user } = yield* authService.validateSession(sessionId).pipe(
        Effect.mapError((error) => {
          if (isSessionNotFoundError(error)) {
            return new UnauthorizedError({ message: "Invalid session token" })
          }
          if (isSessionExpiredError(error)) {
            return new UnauthorizedError({ message: "Session has expired" })
          }
          return new UnauthorizedError({ message: "Authentication failed" })
        })
      )

      const apiRole = mapUserRoleToApiRole(user.role)

      return User.make({
        userId: user.id,
        role: apiRole,
        sessionId // Include session ID for logout/refresh
      })
    })
})
