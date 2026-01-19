/**
 * LocalAuthProviderLive - PostgreSQL implementation of LocalAuthProvider
 *
 * Implements the AuthProvider interface for local (email/password) authentication.
 * Uses IdentityRepository for user lookup and PasswordHasher for password verification.
 *
 * @module LocalAuthProviderLive
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"
import { ProviderId } from "@accountability/core/authentication/ProviderId"
import { AuthResult } from "@accountability/core/authentication/AuthResult"
import {
  InvalidCredentialsError,
  ProviderAuthFailedError
} from "@accountability/core/authentication/AuthErrors"
import { isLocalAuthRequest } from "@accountability/core/authentication/AuthRequest"
import { PasswordHasher } from "@accountability/core/authentication/PasswordHasher"
import { IdentityRepository } from "../Services/IdentityRepository.ts"
import { UserRepository } from "../Services/UserRepository.ts"
import { LocalAuthProvider } from "../Services/LocalAuthProvider.ts"

/**
 * Implementation of AuthProvider for local (email/password) authentication
 */
const make = Effect.gen(function* () {
  const identityRepo = yield* IdentityRepository
  const userRepo = yield* UserRepository
  const passwordHasher = yield* PasswordHasher

  const provider: AuthProvider = {
    /**
     * Provider type identifier
     */
    type: "local",

    /**
     * Local provider supports user registration
     */
    supportsRegistration: true,

    /**
     * Authenticate a user with email/password credentials
     *
     * 1. Validates the request is a LocalAuthRequest
     * 2. Looks up the identity by provider='local' and providerId=email
     * 3. Retrieves the password hash
     * 4. Verifies the password against the hash
     * 5. Returns the authenticated user info
     */
    authenticate: (request) =>
      Effect.gen(function* () {
        // Validate request type
        if (!isLocalAuthRequest(request)) {
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: "local",
              reason: "Invalid request type for local authentication"
            })
          )
        }

        const { email, password } = request

        // For local auth, providerId is the email
        const providerId = ProviderId.make(email)

        // Look up the identity
        const maybeIdentity = yield* identityRepo.findByProvider("local", providerId).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: "local",
              reason: "Database error during authentication"
            })
          )
        )

        // Check if identity exists
        if (Option.isNone(maybeIdentity)) {
          return yield* Effect.fail(new InvalidCredentialsError({ email }))
        }

        const identity = maybeIdentity.value

        // Get the password hash for verification
        const maybeHash = yield* identityRepo.getPasswordHash("local", providerId).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: "local",
              reason: "Database error during password retrieval"
            })
          )
        )

        // Check if password hash exists
        if (Option.isNone(maybeHash)) {
          return yield* Effect.fail(new InvalidCredentialsError({ email }))
        }

        const passwordHash = maybeHash.value

        // Verify the password - password is already Redacted from the request
        const isValid = yield* passwordHasher.verify(password, passwordHash)

        if (!isValid) {
          return yield* Effect.fail(new InvalidCredentialsError({ email }))
        }

        // Look up the user to get display name
        const maybeUser = yield* userRepo.findById(identity.userId).pipe(
          Effect.mapError(() =>
            new ProviderAuthFailedError({
              provider: "local",
              reason: "Database error during user lookup"
            })
          )
        )

        if (Option.isNone(maybeUser)) {
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: "local",
              reason: "User not found for identity"
            })
          )
        }

        const user = maybeUser.value

        // Return successful authentication result
        return AuthResult.make({
          provider: "local",
          providerId,
          email,
          displayName: user.displayName,
          emailVerified: true, // Local auth users have verified email
          providerData: identity.providerData
        })
      }),

    /**
     * Get authorization URL - not applicable for local auth
     *
     * Local authentication does not use OAuth redirect flow.
     */
    getAuthorizationUrl: () => Option.none(),

    /**
     * Handle OAuth callback - not applicable for local auth
     *
     * Local authentication does not use OAuth callback flow.
     */
    handleCallback: () =>
      Effect.fail(
        new ProviderAuthFailedError({
          provider: "local",
          reason: "Local authentication does not support OAuth callback"
        })
      )
  }

  return provider
})

/**
 * LocalAuthProviderLive - Layer providing LocalAuthProvider implementation
 *
 * Requires:
 * - IdentityRepository: For looking up user identities and password hashes
 * - UserRepository: For looking up user details
 * - PasswordHasher: For verifying passwords
 */
export const LocalAuthProviderLive: Layer.Layer<
  LocalAuthProvider,
  never,
  IdentityRepository | UserRepository | PasswordHasher
> = Layer.effect(LocalAuthProvider, make)
