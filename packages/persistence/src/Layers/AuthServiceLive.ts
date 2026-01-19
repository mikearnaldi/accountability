/**
 * AuthServiceLive - PostgreSQL implementation of AuthService
 *
 * Implements the AuthService interface from core, orchestrating authentication
 * across multiple providers. Handles user provisioning, identity linking,
 * and session management.
 *
 * Features:
 * - Routes authentication requests to appropriate provider by type
 * - Auto-provisions users for external provider authentication
 * - Links identities to existing users by email (configurable)
 * - Creates and manages sessions via SessionRepository
 * - Configurable session duration per provider
 *
 * @module AuthServiceLive
 */

import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import { AuthService, type AuthServiceShape, type LoginSuccess, type ValidatedSession } from "@accountability/core/authentication/AuthService"
import type { AuthProvider, AuthProviderRegistry } from "@accountability/core/authentication/AuthProvider"
import type { AuthProviderType } from "@accountability/core/authentication/AuthProviderType"
import type { AuthResult } from "@accountability/core/authentication/AuthResult"
import { type AuthUser } from "@accountability/core/authentication/AuthUser"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { type UserIdentity, UserIdentityId } from "@accountability/core/authentication/UserIdentity"
import { PasswordHasher } from "@accountability/core/authentication/PasswordHasher"
import { SessionTokenGenerator } from "@accountability/core/authentication/SessionTokenGenerator"
import { ProviderId } from "@accountability/core/authentication/ProviderId"
import * as Timestamp from "@accountability/core/shared/values/Timestamp"
import {
  ProviderNotEnabledError,
  ProviderAuthFailedError,
  UserNotFoundError,
  UserAlreadyExistsError,
  IdentityAlreadyLinkedError,
  SessionNotFoundError,
  SessionExpiredError,
  PasswordTooWeakError,
  SessionCleanupError
} from "@accountability/core/authentication/AuthErrors"
import { UserRepository } from "../Services/UserRepository.ts"
import { IdentityRepository } from "../Services/IdentityRepository.ts"
import { SessionRepository } from "../Services/SessionRepository.ts"
import { AuthServiceConfig } from "../Services/AuthServiceConfig.ts"

/**
 * Build a provider registry from the providers chunk
 */
const buildProviderRegistry = (
  providers: Chunk.Chunk<AuthProvider>
): AuthProviderRegistry => {
  const entries = Chunk.toReadonlyArray(providers).map(
    (p): [AuthProviderType, AuthProvider] => [p.type, p]
  )
  return new Map(entries)
}

/**
 * Password validation requirements
 */
const validatePassword = (password: string): Chunk.Chunk<string> => {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long")
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one digit")
  }

  return Chunk.fromIterable(errors)
}

/**
 * Creates the AuthService implementation
 */
const make = Effect.gen(function* () {
  // Get dependencies
  const config = yield* AuthServiceConfig
  const userRepo = yield* UserRepository
  const identityRepo = yield* IdentityRepository
  const sessionRepo = yield* SessionRepository
  const tokenGenerator = yield* SessionTokenGenerator
  const passwordHasher = yield* PasswordHasher

  // Build provider registry
  const providerRegistry = buildProviderRegistry(config.providers)

  /**
   * Get a provider by type, failing if not enabled
   */
  const getProvider = (
    providerType: AuthProviderType
  ): Effect.Effect<AuthProvider, ProviderNotEnabledError> => {
    const provider = providerRegistry.get(providerType)
    if (provider === undefined) {
      return Effect.fail(new ProviderNotEnabledError({ provider: providerType }))
    }
    return Effect.succeed(provider)
  }

  /**
   * Create a new session for a user
   */
  const createSession = (
    userId: AuthUserId,
    provider: AuthProviderType,
    userAgent: Option.Option<string>
  ) =>
    Effect.gen(function* () {
      const sessionId = yield* tokenGenerator.generate()
      const now = Timestamp.now()
      const duration = config.sessionDurations.getForProvider(provider)
      const expiresAt = Timestamp.addMillis(now, duration)

      const session = yield* sessionRepo.create({
        id: sessionId,
        userId,
        provider,
        expiresAt,
        userAgent: Option.map(userAgent, (ua) => ua.slice(0, 1024))
      }).pipe(
        Effect.mapError(() =>
          new ProviderAuthFailedError({
            provider,
            reason: "Failed to create session"
          })
        )
      )

      return session
    })

  /**
   * Find or create a user based on authentication result
   *
   * If linkIdentitiesByEmail is enabled and a user with the same email exists,
   * returns that user. Otherwise creates a new user if autoProvisionUsers is enabled.
   */
  const findOrCreateUser = (
    authResult: AuthResult
  ): Effect.Effect<
    AuthUser,
    UserNotFoundError | ProviderAuthFailedError
  > =>
    Effect.gen(function* () {
      // First, check if identity already exists
      const existingIdentity = yield* identityRepo.findByProvider(
        authResult.provider,
        authResult.providerId
      ).pipe(
        Effect.mapError(() =>
          new ProviderAuthFailedError({
            provider: authResult.provider,
            reason: "Database error during identity lookup"
          })
        )
      )

      // If identity exists, return the associated user
      if (Option.isSome(existingIdentity)) {
        const identity = existingIdentity.value
        const maybeUser = yield* userRepo.findById(identity.userId).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: authResult.provider,
              reason: "Database error during user lookup"
            })
          )
        )

        if (Option.isNone(maybeUser)) {
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: authResult.provider,
              reason: "User not found for existing identity"
            })
          )
        }

        return maybeUser.value
      }

      // Identity doesn't exist - try to link by email or create new user
      if (config.linkIdentitiesByEmail) {
        const maybeUserByEmail = yield* userRepo.findByEmail(authResult.email).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: authResult.provider,
              reason: "Database error during email lookup"
            })
          )
        )

        if (Option.isSome(maybeUserByEmail)) {
          const existingUser = maybeUserByEmail.value

          // Link the identity to the existing user
          yield* createIdentityForUser(existingUser.id, authResult)

          return existingUser
        }
      }

      // No existing user found - create a new one if auto-provisioning is enabled
      if (!config.autoProvisionUsers) {
        return yield* Effect.fail(
          new UserNotFoundError({ email: authResult.email })
        )
      }

      // Create new user and identity
      const newUser = yield* createUserWithIdentity(authResult)
      return newUser
    })

  /**
   * Create a new identity for an existing user
   */
  const createIdentityForUser = (
    userId: AuthUserId,
    authResult: AuthResult
  ): Effect.Effect<UserIdentity, ProviderAuthFailedError> =>
    Effect.gen(function* () {
      const identityId = UserIdentityId.make(crypto.randomUUID())

      const identity = yield* identityRepo.create({
        id: identityId,
        userId,
        provider: authResult.provider,
        providerId: authResult.providerId,
        providerData: authResult.providerData
      }).pipe(
        Effect.mapError(() =>
          new ProviderAuthFailedError({
            provider: authResult.provider,
            reason: "Failed to create identity"
          })
        )
      )

      return identity
    })

  /**
   * Create a new user with an identity from auth result
   */
  const createUserWithIdentity = (
    authResult: AuthResult
  ): Effect.Effect<AuthUser, ProviderAuthFailedError> =>
    Effect.gen(function* () {
      const userId = AuthUserId.make(crypto.randomUUID())

      // Create the user
      const user = yield* userRepo.create({
        id: userId,
        email: authResult.email,
        displayName: authResult.displayName,
        role: "member",
        primaryProvider: authResult.provider
      }).pipe(
        Effect.mapError(() =>
          new ProviderAuthFailedError({
            provider: authResult.provider,
            reason: "Failed to create user"
          })
        )
      )

      // Create the identity
      yield* createIdentityForUser(userId, authResult)

      return user
    })

  /**
   * AuthService implementation
   */
  const service: AuthServiceShape = {
    /**
     * Login with the specified provider
     */
    login: (providerType, request) =>
      Effect.gen(function* () {
        // Get the provider
        const provider = yield* getProvider(providerType)

        // Authenticate with the provider
        const authResult = yield* provider.authenticate(request)

        // Find or create the user
        const user = yield* findOrCreateUser(authResult)

        // Create a session
        const session = yield* createSession(user.id, providerType, Option.none())

        return { user, session } satisfies LoginSuccess
      }),

    /**
     * Register a new user with local credentials
     */
    register: (email, password, displayName) =>
      Effect.gen(function* () {
        // Validate password strength
        const passwordErrors = validatePassword(password)
        if (!Chunk.isEmpty(passwordErrors)) {
          return yield* Effect.fail(
            new PasswordTooWeakError({ requirements: passwordErrors })
          )
        }

        // Check if user already exists
        const existingUser = yield* userRepo.findByEmail(email).pipe(
          Effect.mapError(() =>
            new UserAlreadyExistsError({ email })
          )
        )

        if (Option.isSome(existingUser)) {
          return yield* Effect.fail(
            new UserAlreadyExistsError({ email })
          )
        }

        // Hash the password
        const hashedPassword = yield* passwordHasher.hash(Redacted.make(password))

        // Create user
        const userId = AuthUserId.make(crypto.randomUUID())

        const user = yield* userRepo.create({
          id: userId,
          email,
          displayName,
          role: "member",
          primaryProvider: "local"
        }).pipe(
          Effect.mapError(() =>
            new UserAlreadyExistsError({ email })
          )
        )

        // Create local identity with password hash
        const identityId = UserIdentityId.make(crypto.randomUUID())
        const providerId = ProviderId.make(email)

        yield* identityRepo.create({
          id: identityId,
          userId,
          provider: "local",
          providerId,
          providerData: Option.none(),
          passwordHash: hashedPassword
        }).pipe(
          Effect.mapError(() =>
            new UserAlreadyExistsError({ email })
          )
        )

        return user
      }),

    /**
     * Get authorization URL for OAuth/SAML providers
     */
    getAuthorizationUrl: (providerType, redirectUri) =>
      Effect.gen(function* () {
        const provider = yield* getProvider(providerType)

        // Generate a state parameter for CSRF protection
        const stateBytes = new Uint8Array(32)
        crypto.getRandomValues(stateBytes)
        const state = btoa(String.fromCharCode(...stateBytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "")

        const url = provider.getAuthorizationUrl(state, redirectUri)

        if (Option.isNone(url)) {
          // Provider doesn't support redirect-based auth (e.g., local)
          // Return empty string to indicate no redirect needed
          return ""
        }

        return url.value
      }),

    /**
     * Handle OAuth callback
     */
    handleOAuthCallback: (providerType, code, state) =>
      Effect.gen(function* () {
        const provider = yield* getProvider(providerType)

        // Let the provider handle the callback (includes state validation)
        const authResult = yield* provider.handleCallback(code, state)

        // Find or create the user
        const user = yield* findOrCreateUser(authResult).pipe(
          Effect.mapError((err) => {
            if (err._tag === "UserNotFoundError") {
              return new ProviderAuthFailedError({
                provider: providerType,
                reason: "User not found and auto-provisioning is disabled"
              })
            }
            return err
          })
        )

        // Create a session
        const session = yield* createSession(user.id, providerType, Option.none())

        return { user, session } satisfies LoginSuccess
      }),

    /**
     * Logout and invalidate session
     */
    logout: (sessionId) =>
      Effect.gen(function* () {
        // Try to find the session first
        const maybeSession = yield* sessionRepo.findById(sessionId).pipe(
          Effect.mapError(() =>
            new SessionNotFoundError({ sessionId })
          )
        )

        if (Option.isNone(maybeSession)) {
          return yield* Effect.fail(
            new SessionNotFoundError({ sessionId })
          )
        }

        // Delete the session
        yield* sessionRepo.delete(sessionId).pipe(
          Effect.mapError(() =>
            new SessionNotFoundError({ sessionId })
          )
        )
      }),

    /**
     * Validate a session and retrieve the user
     */
    validateSession: (sessionId) =>
      Effect.gen(function* () {
        // Find the session
        const maybeSession = yield* sessionRepo.findById(sessionId).pipe(
          Effect.mapError(() =>
            new SessionNotFoundError({ sessionId })
          )
        )

        if (Option.isNone(maybeSession)) {
          return yield* Effect.fail(
            new SessionNotFoundError({ sessionId })
          )
        }

        const session = maybeSession.value

        // Check if expired
        const now = Timestamp.now()
        if (session.isExpired(now)) {
          // Delete expired session - session cleanup is critical for security and
          // database hygiene. If deletion fails, the operation fails with SessionCleanupError.
          // Expired sessions accumulating in the database is a serious issue that
          // must be visible and not silently ignored.
          yield* sessionRepo.delete(sessionId).pipe(
            Effect.mapError((cause) => new SessionCleanupError({
              sessionId,
              operation: "expiry",
              cause
            }))
          )
          return yield* Effect.fail(
            new SessionExpiredError({ sessionId })
          )
        }

        // Get the user
        const maybeUser = yield* userRepo.findById(session.userId).pipe(
          Effect.mapError(() =>
            new SessionNotFoundError({ sessionId })
          )
        )

        if (Option.isNone(maybeUser)) {
          return yield* Effect.fail(
            new SessionNotFoundError({ sessionId })
          )
        }

        return { user: maybeUser.value, session } satisfies ValidatedSession
      }),

    /**
     * Link an external identity to an existing user
     */
    linkIdentity: (userId, providerType, providerResult) =>
      Effect.gen(function* () {
        // Verify user exists
        const maybeUser = yield* userRepo.findById(userId).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: providerType,
              reason: "Database error during user lookup"
            })
          )
        )

        if (Option.isNone(maybeUser)) {
          return yield* Effect.fail(
            new UserNotFoundError({ email: providerResult.email })
          )
        }

        // Check if identity already exists (linked to any user)
        const existingIdentity = yield* identityRepo.findByProvider(
          providerResult.provider,
          providerResult.providerId
        ).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: providerType,
              reason: "Database error during identity lookup"
            })
          )
        )

        if (Option.isSome(existingIdentity)) {
          const identity = existingIdentity.value
          // Identity is already linked - check if it's to the same user
          if (identity.userId !== userId) {
            return yield* Effect.fail(
              new IdentityAlreadyLinkedError({
                provider: providerResult.provider,
                providerId: providerResult.providerId,
                existingUserId: identity.userId
              })
            )
          }
          // Identity is already linked to this user - return it
          return identity
        }

        // Create the identity link
        const identityId = UserIdentityId.make(crypto.randomUUID())

        const identity = yield* identityRepo.create({
          id: identityId,
          userId,
          provider: providerResult.provider,
          providerId: providerResult.providerId,
          providerData: providerResult.providerData
        }).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: providerType,
              reason: "Failed to create identity link"
            })
          )
        )

        return identity
      }),

    /**
     * Get all enabled authentication providers
     */
    getEnabledProviders: () =>
      Effect.succeed(
        Chunk.fromIterable(providerRegistry.keys())
      )
  }

  return service
})

/**
 * AuthServiceLive - Layer providing AuthService implementation
 *
 * Requires:
 * - AuthServiceConfig: Configuration including providers and settings
 * - UserRepository: For user CRUD operations
 * - IdentityRepository: For identity CRUD operations
 * - SessionRepository: For session CRUD operations
 * - SessionTokenGenerator: For generating secure session tokens
 * - PasswordHasher: For password hashing (registration)
 *
 * Usage:
 * ```typescript
 * import { AuthServiceLive } from "@accountability/persistence/Layers/AuthServiceLive"
 * import { AuthServiceConfig } from "@accountability/persistence/Services/AuthServiceConfig"
 *
 * // Create config layer with providers
 * const ConfigLayer = AuthServiceConfig.layer(
 *   Chunk.make(localAuthProvider, googleAuthProvider)
 * )
 *
 * // Compose all layers
 * const AuthLayer = AuthServiceLive.pipe(
 *   Layer.provide(ConfigLayer),
 *   Layer.provide(UserRepositoryLive),
 *   Layer.provide(IdentityRepositoryLive),
 *   Layer.provide(SessionRepositoryLive),
 *   Layer.provide(SessionTokenGeneratorLive),
 *   Layer.provide(PasswordHasherLive)
 * )
 * ```
 */
export const AuthServiceLive: Layer.Layer<
  AuthService,
  never,
  | AuthServiceConfig
  | UserRepository
  | IdentityRepository
  | SessionRepository
  | SessionTokenGenerator
  | PasswordHasher
> = Layer.effect(AuthService, make)
