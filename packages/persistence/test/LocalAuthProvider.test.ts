/**
 * LocalAuthProvider Integration Tests
 *
 * Tests for LocalAuthProvider implementation against a testcontainers
 * PostgreSQL database. Uses the MigrationLayer to set up the schema before running tests.
 *
 * @module test/LocalAuthProvider
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Email } from "@accountability/core/authentication/Email"
import { ProviderId } from "@accountability/core/authentication/ProviderId"
import { UserIdentityId } from "@accountability/core/authentication/UserIdentity"
import { LocalAuthRequest } from "@accountability/core/authentication/AuthRequest"
import { OAuthAuthRequest } from "@accountability/core/authentication/AuthRequest"
import {
  PasswordHasher,
  BcryptAdapterTag,
  BcryptPasswordHasherLive,
  PasswordHasherConfigTag
} from "@accountability/core/authentication/PasswordHasher"
import { UserRepository, type AuthUserInsert } from "../src/Services/UserRepository.ts"
import { UserRepositoryLive } from "../src/Layers/UserRepositoryLive.ts"
import { IdentityRepository, type UserIdentityInsert } from "../src/Services/IdentityRepository.ts"
import { IdentityRepositoryLive } from "../src/Layers/IdentityRepositoryLive.ts"
import { LocalAuthProvider } from "../src/Services/LocalAuthProvider.ts"
import { LocalAuthProviderLive } from "../src/Layers/LocalAuthProviderLive.ts"
import { SharedPgClientLive } from "./Utils.ts"

/**
 * Mock bcrypt adapter for testing
 *
 * Uses a simple hash that prepends "hashed_" to the password.
 * This is NOT secure and is only for testing purposes.
 */
const MockBcryptAdapter = Layer.succeed(BcryptAdapterTag, {
  hash: (password, _rounds) => Effect.succeed(`hashed_${password}`),
  compare: (password, hash) => Effect.succeed(hash === `hashed_${password}`)
})

/**
 * Password hasher layer for tests
 */
const PasswordHasherTestLive = BcryptPasswordHasherLive.pipe(
  Layer.provide(MockBcryptAdapter),
  Layer.provide(PasswordHasherConfigTag.Fast)
)

/**
 * Base layer with repositories.
 * Migrations are run globally in vitest.global-setup.ts to avoid race conditions.
 */
const RepositoriesLayer = Layer.mergeAll(
  UserRepositoryLive,
  IdentityRepositoryLive
).pipe(
  Layer.provideMerge(SharedPgClientLive)
)

/**
 * Layer with migrations, repositories, PasswordHasher, and LocalAuthProvider
 */
const TestLayer = LocalAuthProviderLive.pipe(
  Layer.provideMerge(PasswordHasherTestLive),
  Layer.provideMerge(RepositoriesLayer)
)

// Helper to generate unique IDs for tests (shared container means shared data)
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

// Test IDs - generated once per test file load to ensure uniqueness
const testSuffix = uniqueId()
const testUserId = AuthUserId.make(`bbbbbbbb-bbbb-bbbb-bbbb-${testSuffix.slice(0, 12).padEnd(12, "0")}`)
const testIdentityId = UserIdentityId.make(`cccccccc-cccc-cccc-cccc-${testSuffix.slice(0, 12).padEnd(12, "0")}`)
const testEmail = Email.make(`localauth-${testSuffix}@example.com`)
const testPassword = "testpassword123"
const testProviderId = ProviderId.make(testEmail)

describe("LocalAuthProvider", () => {
  it.layer(TestLayer, { timeout: "60 seconds" })("LocalAuthProvider", (it) => {
    // Setup: Create test user and identity with password hash
    it.effect("setup: create test user and identity", () =>
      Effect.gen(function* () {
        const userRepo = yield* UserRepository
        const identityRepo = yield* IdentityRepository
        const passwordHasher = yield* PasswordHasher

        // Create user
        const user: AuthUserInsert = {
          id: testUserId,
          email: testEmail,
          displayName: "Local Auth Test User",
          role: "member",
          primaryProvider: "local"
        }
        yield* userRepo.create(user)

        // Hash the password
        const hashedPassword = yield* passwordHasher.hash(Redacted.make(testPassword))

        // Create identity with password hash
        const identity: UserIdentityInsert = {
          id: testIdentityId,
          userId: testUserId,
          provider: "local",
          providerId: testProviderId,
          providerData: Option.none(),
          passwordHash: hashedPassword
        }
        yield* identityRepo.create(identity)
      })
    )

    // Test provider type
    it.effect("type: returns 'local'", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider
        expect(provider.type).toBe("local")
      })
    )

    // Test supportsRegistration
    it.effect("supportsRegistration: returns true", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider
        expect(provider.supportsRegistration).toBe(true)
      })
    )

    // Test successful authentication
    it.effect("authenticate: succeeds with correct credentials", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider

        const request = LocalAuthRequest.make({
          email: testEmail,
          password: Redacted.make(testPassword)
        })

        const result = yield* provider.authenticate(request)

        expect(result.provider).toBe("local")
        expect(result.email).toBe(testEmail)
        expect(result.displayName).toBe("Local Auth Test User")
        expect(result.emailVerified).toBe(true)
        expect(result.providerId).toBe(testProviderId)
      })
    )

    // Test authentication with wrong password
    it.effect("authenticate: fails with wrong password", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider

        const request = LocalAuthRequest.make({
          email: testEmail,
          password: Redacted.make("wrongpassword")
        })

        const result = yield* Effect.either(provider.authenticate(request))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("InvalidCredentialsError")
        }
      })
    )

    // Test authentication with non-existent user
    it.effect("authenticate: fails with non-existent user", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider

        const request = LocalAuthRequest.make({
          email: Email.make("nonexistent@example.com"),
          password: Redacted.make(testPassword)
        })

        const result = yield* Effect.either(provider.authenticate(request))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("InvalidCredentialsError")
        }
      })
    )

    // Test authenticate with wrong request type
    it.effect("authenticate: fails with non-LocalAuthRequest", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider

        // Use OAuth request type instead of LocalAuthRequest
        const request = OAuthAuthRequest.make({
          code: "some-code",
          state: "some-state"
        })

        const result = yield* Effect.either(provider.authenticate(request))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
        }
      })
    )

    // Test getAuthorizationUrl returns None
    it.effect("getAuthorizationUrl: returns None", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider
        const result = provider.getAuthorizationUrl("some-state", "http://callback.url")
        expect(Option.isNone(result)).toBe(true)
      })
    )

    // Test handleCallback returns error
    it.effect("handleCallback: returns ProviderAuthFailedError", () =>
      Effect.gen(function* () {
        const provider = yield* LocalAuthProvider
        const result = yield* Effect.either(provider.handleCallback("code", "state"))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
        }
      })
    )

    // =========================================================================
    // IdentityRepository.getPasswordHash Tests
    // =========================================================================

    // Test getting password hash for existing identity
    it.effect("getPasswordHash: returns password hash for local identity", () =>
      Effect.gen(function* () {
        const identityRepo = yield* IdentityRepository
        const result = yield* identityRepo.getPasswordHash("local", testProviderId)

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          // The hash should be our mock format
          expect(result.value.startsWith("hashed_")).toBe(true)
        }
      })
    )

    // Test getting password hash for non-existent identity
    it.effect("getPasswordHash: returns None for non-existent identity", () =>
      Effect.gen(function* () {
        const identityRepo = yield* IdentityRepository
        const nonExistentProviderId = ProviderId.make("nonexistent@example.com")
        const result = yield* identityRepo.getPasswordHash("local", nonExistentProviderId)

        expect(Option.isNone(result)).toBe(true)
      })
    )

    // Test getting password hash for identity without password
    it.effect("getPasswordHash: returns None for identity without password hash", () =>
      Effect.gen(function* () {
        const userRepo = yield* UserRepository
        const identityRepo = yield* IdentityRepository

        // Create user and identity without password hash (like Google OAuth)
        // Use unique IDs based on test suffix
        const oauthUserSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
        const oauthUserId = AuthUserId.make(`eeeeeeee-eeee-eeee-eeee-${oauthUserSuffix.slice(0, 12).padEnd(12, "0")}`)
        const oauthIdentityId = UserIdentityId.make(`ffffffff-ffff-ffff-ffff-${oauthUserSuffix.slice(0, 12).padEnd(12, "0")}`)
        const oauthEmail = Email.make(`oauth.user-${oauthUserSuffix}@example.com`)
        const oauthProviderId = ProviderId.make(`google-user-id-${oauthUserSuffix}`)

        yield* userRepo.create({
          id: oauthUserId,
          email: oauthEmail,
          displayName: "OAuth User",
          role: "member",
          primaryProvider: "google"
        })

        yield* identityRepo.create({
          id: oauthIdentityId,
          userId: oauthUserId,
          provider: "google",
          providerId: oauthProviderId,
          providerData: Option.none()
          // No passwordHash - this is an OAuth identity
        })

        const result = yield* identityRepo.getPasswordHash("google", oauthProviderId)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})
