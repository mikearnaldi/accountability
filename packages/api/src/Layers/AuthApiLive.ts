/**
 * AuthApiLive - Live implementation of authentication API handlers
 *
 * Implements the AuthApi (public) and AuthSessionApi (protected) endpoints.
 * This is a stub implementation that returns placeholder responses.
 * Full implementation will be provided when integrating with the AuthService.
 *
 * @module AuthApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { AppApi } from "../Definitions/AppApi.ts"
import { CurrentUser } from "../Definitions/AuthMiddleware.ts"
import {
  ProvidersResponse,
  ProviderMetadata,
  LoginResponse,
  AuthUserResponse,
  RefreshResponse,
  AuthorizeRedirectResponse,
  LinkInitiateResponse,
  AuthValidationError,
  PasswordWeakError,
  OAuthStateInvalidError,
  ProviderAuthError,
  ProviderNotFoundError
} from "../Definitions/AuthApi.ts"
import { AuthUser } from "@accountability/core/Auth/AuthUser"
import { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { Email } from "@accountability/core/Auth/Email"
import { SessionId } from "@accountability/core/Auth/SessionId"
import { UserIdentity, UserIdentityId } from "@accountability/core/Auth/UserIdentity"
import { ProviderId } from "@accountability/core/Auth/ProviderId"
import { now as timestampNow } from "@accountability/core/Domains/Timestamp"

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a stub user for testing
 */
const createStubUser = (email: Email, displayName: string): AuthUser => {
  const now = timestampNow()
  return AuthUser.make({
    id: AuthUserId.make(crypto.randomUUID()),
    email,
    displayName,
    role: "member",
    primaryProvider: "local",
    createdAt: now,
    updatedAt: now
  })
}

/**
 * Create a stub session token
 */
const createStubSessionId = (): SessionId => {
  // Generate a 43 character base64url-encoded string (32 bytes)
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  return SessionId.make(base64)
}

/**
 * Create a stub identity
 */
const createStubIdentity = (userId: AuthUserId, provider: "local" | "google" | "github" | "workos" | "saml"): UserIdentity => {
  return UserIdentity.make({
    id: UserIdentityId.make(crypto.randomUUID()),
    userId,
    provider,
    providerId: ProviderId.make(`provider_${crypto.randomUUID()}`),
    providerData: Option.none(),
    createdAt: timestampNow()
  })
}

/**
 * Get provider metadata based on provider type
 */
const getProviderMetadata = (providerType: "local" | "google" | "github" | "workos" | "saml"): ProviderMetadata => {
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

// =============================================================================
// Public Auth API Implementation (Stub)
// =============================================================================

/**
 * AuthApiLive - Layer providing public AuthApi handlers (stub implementation)
 *
 * This stub implementation returns placeholder responses.
 * Full implementation will integrate with AuthService when available.
 */
export const AuthApiLive = HttpApiBuilder.group(AppApi, "auth", (handlers) =>
  Effect.succeed(
    handlers
      .handle("getProviders", () =>
        Effect.succeed(
          ProvidersResponse.make({
            providers: [getProviderMetadata("local")]
          })
        )
      )
      .handle("register", (_) =>
        Effect.gen(function* () {
          const { email, password, displayName } = _.payload

          // Validate password length (stub validation)
          if (password.length < 8) {
            return yield* Effect.fail(new PasswordWeakError({
              requirements: ["Password must be at least 8 characters"]
            }))
          }

          // Create stub user
          const user = createStubUser(email, displayName)
          const identity = createStubIdentity(user.id, "local")

          return AuthUserResponse.make({
            user,
            identities: [identity]
          })
        })
      )
      .handle("login", (_) =>
        Effect.gen(function* () {
          const { provider, credentials } = _.payload

          // Validate provider is enabled (only local for now)
          if (provider !== "local") {
            return yield* Effect.fail(new ProviderNotFoundError({ provider }))
          }

          // Validate credentials based on provider type
          if (!("email" in credentials)) {
            return yield* Effect.fail(new AuthValidationError({
              message: "Email and password required for local authentication",
              field: Option.some("credentials")
            }))
          }

          // Create stub user and session
          const user = createStubUser(credentials.email, "Test User")
          const sessionId = createStubSessionId()
          const expiresAt = DateTime.unsafeMake(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

          return LoginResponse.make({
            token: sessionId,
            user,
            provider: "local",
            expiresAt
          })
        })
      )
      .handle("authorize", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path

          // Only OAuth providers can authorize
          if (provider === "local") {
            return yield* Effect.fail(new ProviderNotFoundError({ provider }))
          }

          // Return stub OAuth URL
          const state = crypto.randomUUID()
          const redirectUrl = `https://oauth.example.com/authorize?provider=${provider}&state=${state}`

          return AuthorizeRedirectResponse.make({
            redirectUrl,
            state
          })
        })
      )
      .handle("callback", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path
          const { code, state, error, error_description } = _.urlParams

          // Check for OAuth error
          if (error !== undefined) {
            return yield* Effect.fail(new ProviderAuthError({
              provider,
              reason: error_description ?? error
            }))
          }

          // Validate state (stub - always valid)
          if (!state || state.length < 1) {
            return yield* Effect.fail(new OAuthStateInvalidError({ provider }))
          }

          // Create stub user and session
          const email = Email.make(`oauth_user_${code}@example.com`)
          const user = createStubUser(email, "OAuth User")
          const sessionId = createStubSessionId()
          const expiresAt = DateTime.unsafeMake(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

          return LoginResponse.make({
            token: sessionId,
            user,
            provider,
            expiresAt
          })
        })
      )
  )
)

// =============================================================================
// Protected Auth Session API Implementation (Stub)
// =============================================================================

/**
 * AuthSessionApiLive - Layer providing protected AuthSessionApi handlers (stub implementation)
 *
 * This stub implementation returns placeholder responses.
 * Full implementation will integrate with AuthService when available.
 */
export const AuthSessionApiLive = HttpApiBuilder.group(AppApi, "authSession", (handlers) =>
  Effect.succeed(
    handlers
      .handle("logout", () =>
        Effect.gen(function* () {
          // Get current user (provided by AuthMiddleware)
          yield* CurrentUser
          // Stub: just succeed (session would be invalidated in real implementation)
        })
      )
      .handle("me", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser

          // Create stub user based on current user context
          const email = Email.make(`${currentUser.userId}@example.com`)
          const now = timestampNow()
          // Map CurrentUser.role to AuthUser UserRole
          const role = currentUser.role === "admin" ? "admin" as const
            : currentUser.role === "readonly" ? "viewer" as const
            : "member" as const
          const user = AuthUser.make({
            id: AuthUserId.make(currentUser.userId),
            email,
            displayName: "Authenticated User",
            role,
            primaryProvider: "local",
            createdAt: now,
            updatedAt: now
          })

          const identity = createStubIdentity(user.id, "local")

          return AuthUserResponse.make({
            user,
            identities: [identity]
          })
        })
      )
      .handle("refresh", () =>
        Effect.gen(function* () {
          yield* CurrentUser

          // Create new stub session
          const sessionId = createStubSessionId()
          const expiresAt = DateTime.unsafeMake(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

          return RefreshResponse.make({
            token: sessionId,
            expiresAt
          })
        })
      )
      .handle("linkProvider", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path
          yield* CurrentUser

          // Only OAuth providers can be linked
          if (provider === "local") {
            return yield* Effect.fail(new ProviderNotFoundError({ provider }))
          }

          // Return stub OAuth URL for linking
          const state = crypto.randomUUID()
          const redirectUrl = `https://oauth.example.com/authorize?provider=${provider}&state=${state}&link=true`

          return LinkInitiateResponse.make({
            redirectUrl,
            state
          })
        })
      )
      .handle("linkCallback", (_) =>
        Effect.gen(function* () {
          const { provider } = _.path
          const { state, error, error_description } = _.urlParams
          const currentUser = yield* CurrentUser

          // Check for OAuth error
          if (error !== undefined) {
            return yield* Effect.fail(new ProviderAuthError({
              provider,
              reason: error_description ?? error
            }))
          }

          // Validate state
          if (!state || state.length < 1) {
            return yield* Effect.fail(new OAuthStateInvalidError({ provider }))
          }

          // Create stub user and linked identity
          const email = Email.make(`${currentUser.userId}@example.com`)
          const now = timestampNow()
          // Map CurrentUser.role to AuthUser UserRole
          const role = currentUser.role === "admin" ? "admin" as const
            : currentUser.role === "readonly" ? "viewer" as const
            : "member" as const
          const user = AuthUser.make({
            id: AuthUserId.make(currentUser.userId),
            email,
            displayName: "Authenticated User",
            role,
            primaryProvider: "local",
            createdAt: now,
            updatedAt: now
          })

          const localIdentity = createStubIdentity(user.id, "local")
          const linkedIdentity = createStubIdentity(user.id, provider)

          return AuthUserResponse.make({
            user,
            identities: [localIdentity, linkedIdentity]
          })
        })
      )
      .handle("unlinkIdentity", (_) =>
        Effect.gen(function* () {
          yield* CurrentUser
          // Stub: validate identity exists
          // In real implementation, would check if user owns this identity
          // and if they have other identities remaining
          // For stub, just return success (simulating single identity check)
          // Real implementation would fail if this is the last identity
          void _.path.identityId
        })
      )
  )
)
