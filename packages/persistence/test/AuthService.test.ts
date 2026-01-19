/**
 * AuthService Integration Tests
 *
 * Tests for AuthServiceLive implementation against a testcontainers
 * PostgreSQL database. Tests cover:
 * - Login with provider routing
 * - User registration
 * - Session management (create, validate, logout)
 * - User auto-provisioning
 * - Identity linking by email
 * - OAuth callback handling
 *
 * @module test/AuthService
 */

import { describe, expect, it } from "@effect/vitest"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { AuthService } from "@accountability/core/authentication/AuthService"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Email } from "@accountability/core/authentication/Email"
import { ProviderId } from "@accountability/core/authentication/ProviderId"
import { SessionId } from "@accountability/core/authentication/SessionId"
import { LocalAuthRequest, OAuthAuthRequest } from "@accountability/core/authentication/AuthRequest"
import { AuthResult } from "@accountability/core/authentication/AuthResult"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"
import { ProviderAuthFailedError } from "@accountability/core/authentication/AuthErrors"
import {
  BcryptAdapterTag,
  BcryptPasswordHasherLive,
  PasswordHasherConfigTag
} from "@accountability/core/authentication/PasswordHasher"
import {
  CryptoRandomAdapterTag,
  SessionTokenGeneratorLive,
  SessionTokenConfigTag
} from "@accountability/core/authentication/SessionTokenGenerator"
import { UserRepositoryLive } from "../src/Layers/UserRepositoryLive.ts"
import { IdentityRepositoryLive } from "../src/Layers/IdentityRepositoryLive.ts"
import { SessionRepositoryLive } from "../src/Layers/SessionRepositoryLive.ts"
import { AuthServiceConfig, SessionDurationConfig } from "../src/Services/AuthServiceConfig.ts"
import { AuthServiceLive } from "../src/Layers/AuthServiceLive.ts"
import { LocalAuthProvider } from "../src/Services/LocalAuthProvider.ts"
import { LocalAuthProviderLive } from "../src/Layers/LocalAuthProviderLive.ts"
import { SharedPgClientLive } from "./Utils.ts"

/**
 * Mock bcrypt adapter for testing
 */
const MockBcryptAdapter = Layer.succeed(BcryptAdapterTag, {
  hash: (password, _rounds) => Effect.succeed(`hashed_${password}`),
  compare: (password, hash) => Effect.succeed(hash === `hashed_${password}`)
})

/**
 * Mock crypto adapter for testing
 */
let tokenCounter = 0
const MockCryptoAdapter = Layer.succeed(CryptoRandomAdapterTag, {
  getRandomBytes: (length) =>
    Effect.sync(() => {
      tokenCounter++
      // Generate predictable tokens for testing
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = (tokenCounter + i) % 256
      }
      return bytes
    })
})

/**
 * Password hasher layer for tests
 */
const PasswordHasherTestLive = BcryptPasswordHasherLive.pipe(
  Layer.provide(MockBcryptAdapter),
  Layer.provide(PasswordHasherConfigTag.Fast)
)

/**
 * Session token generator layer for tests
 */
const SessionTokenGeneratorTestLive = SessionTokenGeneratorLive.pipe(
  Layer.provide(MockCryptoAdapter),
  Layer.provide(SessionTokenConfigTag.Default)
)

/**
 * Base layer with repositories.
 * Migrations are run globally in vitest.global-setup.ts to avoid race conditions.
 */
const RepositoriesLayer = Layer.mergeAll(
  UserRepositoryLive,
  IdentityRepositoryLive,
  SessionRepositoryLive
).pipe(
  Layer.provideMerge(SharedPgClientLive)
)

/**
 * Mock OAuth provider for testing
 *
 * Returns a successful authentication result with the provided email.
 */
const createMockOAuthProvider = (type: "google" | "github"): AuthProvider => ({
  type,
  supportsRegistration: true,
  authenticate: (request) => {
    if (request._tag !== "OAuthAuthRequest") {
      return Effect.fail(
        new ProviderAuthFailedError({
          provider: type,
          reason: "Invalid request type"
        })
      )
    }
    // Return a mock auth result
    return Effect.succeed(
      AuthResult.make({
        provider: type,
        providerId: ProviderId.make(`${type}-user-${request.code}`),
        email: Email.make(`${request.code}@${type}.com`),
        displayName: `${type} User`,
        emailVerified: true,
        providerData: Option.none()
      })
    )
  },
  getAuthorizationUrl: (state, redirectUri) =>
    Option.some(`https://${type}.com/auth?state=${state}&redirect=${redirectUri || ""}`),
  handleCallback: (code, _state) =>
    Effect.succeed(
      AuthResult.make({
        provider: type,
        providerId: ProviderId.make(`${type}-user-${code}`),
        email: Email.make(`${code}@${type}.com`),
        displayName: `${type} User`,
        emailVerified: true,
        providerData: Option.none()
      })
    )
})

/**
 * Full test layer with AuthService
 *
 * Note: Each test group using different options MUST call this function
 * to get a fresh layer. The layer construction is done inline to prevent
 * Effect's layer memoization from reusing incorrect configs.
 */
const createTestLayer = (options: {
  autoProvisionUsers?: boolean
  linkIdentitiesByEmail?: boolean
} = {}) => {
  // Create a fresh LocalAuthProvider layer for this test
  const LocalAuthLayer = LocalAuthProviderLive.pipe(
    Layer.provideMerge(PasswordHasherTestLive),
    Layer.provideMerge(RepositoriesLayer)
  )

  // Capture the option values explicitly to prevent closure issues
  const autoProvision = options.autoProvisionUsers ?? true
  const linkByEmail = options.linkIdentitiesByEmail ?? true

  // Create AuthConfig layer that depends on LocalAuthProvider
  const AuthConfigLayer = Layer.effect(
    AuthServiceConfig,
    Effect.gen(function* () {
      const localProvider = yield* LocalAuthProvider
      return {
        providers: Chunk.make(
          localProvider,
          createMockOAuthProvider("google"),
          createMockOAuthProvider("github")
        ),
        sessionDurations: SessionDurationConfig.Default,
        autoProvisionUsers: autoProvision,
        linkIdentitiesByEmail: linkByEmail
      }
    })
  ).pipe(Layer.provide(LocalAuthLayer))

  // Full AuthService layer
  // NOTE: Layer.fresh() IS needed here because AuthServiceLive is a module-level constant.
  // Layers are memoized by REFERENCE identity, not by their dependencies. Without fresh(),
  // the first test to build AuthServiceLive memoizes it with its config, and subsequent
  // tests reuse that memoized layer even when providing different configs.
  // See specs/EFFECT_LAYERS.md for details on layer memoization semantics.
  return Layer.fresh(AuthServiceLive).pipe(
    Layer.provideMerge(AuthConfigLayer),
    Layer.provideMerge(SessionTokenGeneratorTestLive),
    Layer.provideMerge(PasswordHasherTestLive),
    Layer.provideMerge(LocalAuthLayer)
  )
}

// Test data
const testEmail = Email.make("authservice@example.com")
const testPassword = "TestPassword123"
const testDisplayName = "Auth Service Test User"

describe("AuthServiceLive", () => {
  describe("Registration", () => {
    const TestLayer = createTestLayer()

    it.layer(TestLayer, { timeout: "60 seconds" })("registration", (it) => {
      it.effect("register: creates user with local identity", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const user = yield* auth.register(
            Email.make("register.test@example.com"),
            "ValidPass123",
            "Register Test User"
          )

          expect(user.email).toBe("register.test@example.com")
          expect(user.displayName).toBe("Register Test User")
          expect(user.primaryProvider).toBe("local")
          expect(user.role).toBe("member")
        })
      )

      it.effect("register: fails with weak password (no uppercase)", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const result = yield* Effect.either(
            auth.register(
              Email.make("weakpass1@example.com"),
              "weakpassword123",
              "Test User"
            )
          )

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("PasswordTooWeakError")
          }
        })
      )

      it.effect("register: fails with weak password (no lowercase)", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const result = yield* Effect.either(
            auth.register(
              Email.make("weakpass2@example.com"),
              "WEAKPASSWORD123",
              "Test User"
            )
          )

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("PasswordTooWeakError")
          }
        })
      )

      it.effect("register: fails with weak password (no digit)", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const result = yield* Effect.either(
            auth.register(
              Email.make("weakpass3@example.com"),
              "WeakPassword",
              "Test User"
            )
          )

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("PasswordTooWeakError")
          }
        })
      )

      it.effect("register: fails with weak password (too short)", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const result = yield* Effect.either(
            auth.register(
              Email.make("weakpass4@example.com"),
              "Weak1",
              "Test User"
            )
          )

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("PasswordTooWeakError")
          }
        })
      )

      it.effect("register: fails when email already exists", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // First registration succeeds
          yield* auth.register(
            Email.make("duplicate@example.com"),
            "ValidPass123",
            "First User"
          )

          // Second registration with same email fails
          const result = yield* Effect.either(
            auth.register(
              Email.make("duplicate@example.com"),
              "ValidPass456",
              "Second User"
            )
          )

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("UserAlreadyExistsError")
          }
        })
      )
    })
  })

  describe("Login", () => {
    const TestLayer = createTestLayer()

    it.layer(TestLayer, { timeout: "60 seconds" })("login", (it) => {
      // Setup: Create a test user first
      it.effect("setup: create test user", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService
          yield* auth.register(testEmail, testPassword, testDisplayName)
        })
      )

      it.effect("login: succeeds with correct credentials", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const request = LocalAuthRequest.make({
            email: testEmail,
            password: Redacted.make(testPassword)
          })

          const { user, session } = yield* auth.login("local", request)

          expect(user.email).toBe(testEmail)
          expect(user.displayName).toBe(testDisplayName)
          expect(session.userId).toBe(user.id)
          expect(session.provider).toBe("local")
        })
      )

      it.effect("login: fails with wrong password", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const request = LocalAuthRequest.make({
            email: testEmail,
            password: Redacted.make("WrongPassword123")
          })

          const result = yield* Effect.either(auth.login("local", request))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("InvalidCredentialsError")
          }
        })
      )

      it.effect("login: fails with non-existent user", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const request = LocalAuthRequest.make({
            email: Email.make("nonexistent@example.com"),
            password: Redacted.make("SomePassword123")
          })

          const result = yield* Effect.either(auth.login("local", request))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("InvalidCredentialsError")
          }
        })
      )

      it.effect("login: fails with disabled provider", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const request = LocalAuthRequest.make({
            email: testEmail,
            password: Redacted.make(testPassword)
          })

          // Try to login with saml provider which is not configured
          const result = yield* Effect.either(auth.login("saml", request))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("ProviderNotEnabledError")
          }
        })
      )
    })
  })

  describe("Session Management", () => {
    const TestLayer = createTestLayer()

    it.layer(TestLayer, { timeout: "60 seconds" })("sessions", (it) => {
      it.effect("validateSession: succeeds with valid session", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Use unique email to avoid conflicts with other test runs
          const uniqueEmail = Email.make(`session.test.${Date.now()}@example.com`)

          // Register and login
          yield* auth.register(
            uniqueEmail,
            "ValidPass123",
            "Session Test User"
          )

          const request = LocalAuthRequest.make({
            email: uniqueEmail,
            password: Redacted.make("ValidPass123")
          })

          const { session } = yield* auth.login("local", request)

          // Validate the session
          const validated = yield* auth.validateSession(session.id)

          expect(validated.user.email).toBe(uniqueEmail)
          expect(validated.session.id).toBe(session.id)
        })
      )

      it.effect("validateSession: fails with invalid session", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Try to validate a non-existent session
          // Session ID needs to be at least 32 chars with base64url chars
          const fakeSessionId = Schema.decodeSync(SessionId)("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

          const result = yield* Effect.either(auth.validateSession(fakeSessionId))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("SessionNotFoundError")
          }
        })
      )

      it.effect("logout: invalidates session", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Use unique email to avoid conflicts with other test runs
          const uniqueEmail = Email.make(`logout.test.${Date.now()}@example.com`)

          // Register and login
          yield* auth.register(
            uniqueEmail,
            "ValidPass123",
            "Logout Test User"
          )

          const request = LocalAuthRequest.make({
            email: uniqueEmail,
            password: Redacted.make("ValidPass123")
          })

          const { session } = yield* auth.login("local", request)

          // Logout
          yield* auth.logout(session.id)

          // Session should no longer be valid
          const result = yield* Effect.either(auth.validateSession(session.id))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("SessionNotFoundError")
          }
        })
      )

      it.effect("logout: fails with non-existent session", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const fakeSessionId = Schema.decodeSync(SessionId)("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")

          const result = yield* Effect.either(auth.logout(fakeSessionId))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("SessionNotFoundError")
          }
        })
      )
    })
  })

  describe("OAuth Provider Routing", () => {
    const TestLayer = createTestLayer()

    it.layer(TestLayer, { timeout: "60 seconds" })("oauth", (it) => {
      it.effect("login: routes to Google provider", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Use OAuth request for Google
          const request = OAuthAuthRequest.make({
            code: "google-auth-code",
            state: "some-state"
          })

          const { user, session } = yield* auth.login("google", request)

          // User should be auto-provisioned from Google auth result
          expect(user.email).toBe("google-auth-code@google.com")
          expect(user.displayName).toBe("google User")
          expect(user.primaryProvider).toBe("google")
          expect(session.provider).toBe("google")
        })
      )

      it.effect("login: routes to GitHub provider", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const request = OAuthAuthRequest.make({
            code: "github-auth-code",
            state: "some-state"
          })

          const { user, session } = yield* auth.login("github", request)

          expect(user.email).toBe("github-auth-code@github.com")
          expect(user.displayName).toBe("github User")
          expect(user.primaryProvider).toBe("github")
          expect(session.provider).toBe("github")
        })
      )

      it.effect("handleOAuthCallback: creates user from callback", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const { user, session } = yield* auth.handleOAuthCallback(
            "google",
            "callback-user",
            "callback-state"
          )

          expect(user.email).toBe("callback-user@google.com")
          expect(session.provider).toBe("google")
        })
      )

      it.effect("getAuthorizationUrl: returns URL for OAuth provider", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const url = yield* auth.getAuthorizationUrl("google", "http://localhost/callback")

          expect(url).toContain("https://google.com/auth")
          expect(url).toContain("state=")
        })
      )

      it.effect("getAuthorizationUrl: returns empty string for local provider", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const url = yield* auth.getAuthorizationUrl("local")

          expect(url).toBe("")
        })
      )
    })
  })

  describe("Auto-Provisioning", () => {
    // Test with auto-provisioning disabled AND email linking disabled
    // Both must be disabled to ensure login fails for non-existent users
    const TestLayerNoAutoProvision = createTestLayer({
      autoProvisionUsers: false,
      linkIdentitiesByEmail: false
    })

    it.layer(TestLayerNoAutoProvision, { timeout: "60 seconds" })("no-auto-provision", (it) => {
      it.effect("login: fails when user doesn't exist and auto-provision disabled", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Use a unique email that won't exist from other tests
          // Combine timestamp with crypto-quality random for true uniqueness
          const uniqueCode = `no-auto-provision-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
          const request = OAuthAuthRequest.make({
            code: uniqueCode,
            state: "some-state"
          })

          const result = yield* Effect.either(auth.login("google", request))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            // Could be UserNotFoundError or ProviderAuthFailedError wrapping it
            expect(["UserNotFoundError", "ProviderAuthFailedError"]).toContain(result.left._tag)
          }
        })
      )
    })
  })

  describe("Email-Based Identity Linking", () => {
    const TestLayer = createTestLayer({ linkIdentitiesByEmail: true })

    it.layer(TestLayer, { timeout: "60 seconds" })("email-linking", (it) => {
      it.effect("login: links identity to existing user by email", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // First, create a user via local registration
          const localUser = yield* auth.register(
            Email.make("link.test@google.com"), // Email that matches what Google will return
            "ValidPass123",
            "Link Test User"
          )

          // Now login via Google which will return same email
          // Our mock Google provider returns {code}@google.com as email
          // So we need to use "link.test" as the code
          const request = OAuthAuthRequest.make({
            code: "link.test",
            state: "some-state"
          })

          const { user: googleUser, session } = yield* auth.login("google", request)

          // The user should be the same (linked by email)
          expect(googleUser.id).toBe(localUser.id)
          expect(googleUser.email).toBe("link.test@google.com")

          // But now they have a Google session
          expect(session.provider).toBe("google")
        })
      )
    })

    // Test with email linking disabled but auto-provisioning enabled
    // This tests that a new user can still be created via OAuth when no matching email exists
    const TestLayerNoEmailLinking = createTestLayer({
      linkIdentitiesByEmail: false,
      autoProvisionUsers: true
    })

    it.layer(TestLayerNoEmailLinking, { timeout: "60 seconds" })("no-email-linking", (it) => {
      it.effect("login: fails when email exists but linking disabled", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Use a unique suffix to avoid conflicts with other tests
          const uniqueSuffix = `nolink-${Date.now()}-${Math.random().toString(36).slice(2)}`

          // Create a user via local registration
          yield* auth.register(
            Email.make(`${uniqueSuffix}@google.com`),
            "ValidPass123",
            "No Link Test User"
          )

          // Login via Google with same email
          // When linkIdentitiesByEmail is false, the system will try to create a new user
          // But since the email already exists, this should fail with a constraint violation
          const request = OAuthAuthRequest.make({
            code: uniqueSuffix,
            state: "some-state"
          })

          const result = yield* Effect.either(auth.login("google", request))

          // Should fail because the email already exists and we're not linking
          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            // The error will be ProviderAuthFailedError wrapping the DB constraint violation
            expect(result.left._tag).toBe("ProviderAuthFailedError")
          }
        })
      )

      it.effect("login: succeeds with new email when linking disabled", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Use a unique email that doesn't exist
          const uniqueSuffix = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
          const request = OAuthAuthRequest.make({
            code: uniqueSuffix,
            state: "some-state"
          })

          const { user: googleUser, session } = yield* auth.login("google", request)

          // Should succeed and create a new user
          expect(googleUser.email).toBe(`${uniqueSuffix}@google.com`)
          expect(googleUser.primaryProvider).toBe("google")
          expect(session.provider).toBe("google")
        })
      )
    })
  })

  describe("Identity Linking", () => {
    const TestLayer = createTestLayer()

    it.layer(TestLayer, { timeout: "60 seconds" })("identity-linking", (it) => {
      it.effect("linkIdentity: links new provider to existing user", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Create a local user
          const user = yield* auth.register(
            Email.make("linkid.test@example.com"),
            "ValidPass123",
            "Link Identity Test User"
          )

          // Create a mock AuthResult for GitHub
          const githubResult = AuthResult.make({
            provider: "github",
            providerId: ProviderId.make("github-user-12345"),
            email: Email.make("linkid.test@github.com"),
            displayName: "GitHub User",
            emailVerified: true,
            providerData: Option.none()
          })

          // Link the identity
          const identity = yield* auth.linkIdentity(user.id, "github", githubResult)

          expect(identity.userId).toBe(user.id)
          expect(identity.provider).toBe("github")
          expect(identity.providerId).toBe("github-user-12345")
        })
      )

      it.effect("linkIdentity: fails when identity already linked to another user", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Create two users
          const user1 = yield* auth.register(
            Email.make("user1.linkid@example.com"),
            "ValidPass123",
            "User 1"
          )

          const user2 = yield* auth.register(
            Email.make("user2.linkid@example.com"),
            "ValidPass123",
            "User 2"
          )

          // Create a GitHub auth result
          const githubResult = AuthResult.make({
            provider: "github",
            providerId: ProviderId.make("github-shared-123"),
            email: Email.make("shared@github.com"),
            displayName: "GitHub User",
            emailVerified: true,
            providerData: Option.none()
          })

          // Link to user1 first
          yield* auth.linkIdentity(user1.id, "github", githubResult)

          // Try to link same identity to user2
          const result = yield* Effect.either(
            auth.linkIdentity(user2.id, "github", githubResult)
          )

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("IdentityAlreadyLinkedError")
          }
        })
      )

      it.effect("linkIdentity: returns existing identity if already linked to same user", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const user = yield* auth.register(
            Email.make("sameuser.linkid@example.com"),
            "ValidPass123",
            "Same User"
          )

          const githubResult = AuthResult.make({
            provider: "github",
            providerId: ProviderId.make("github-same-user-123"),
            email: Email.make("sameuser@github.com"),
            displayName: "GitHub User",
            emailVerified: true,
            providerData: Option.none()
          })

          // Link first time
          const identity1 = yield* auth.linkIdentity(user.id, "github", githubResult)

          // Link second time (same user, same identity)
          const identity2 = yield* auth.linkIdentity(user.id, "github", githubResult)

          // Should return the same identity
          expect(identity2.id).toBe(identity1.id)
        })
      )

      it.effect("linkIdentity: fails with non-existent user", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          // Use a UUID that won't exist in the database (not used by any other test)
          const fakeUserId = AuthUserId.make("00000000-0000-0000-0000-000000000001")

          const githubResult = AuthResult.make({
            provider: "github",
            providerId: ProviderId.make("github-fake-user"),
            email: Email.make("fake@github.com"),
            displayName: "GitHub User",
            emailVerified: true,
            providerData: Option.none()
          })

          const result = yield* Effect.either(
            auth.linkIdentity(fakeUserId, "github", githubResult)
          )

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left._tag).toBe("UserNotFoundError")
          }
        })
      )
    })
  })

  describe("Enabled Providers", () => {
    const TestLayer = createTestLayer()

    it.layer(TestLayer, { timeout: "60 seconds" })("enabled-providers", (it) => {
      it.effect("getEnabledProviders: returns all configured providers", () =>
        Effect.gen(function* () {
          const auth = yield* AuthService

          const providers = yield* auth.getEnabledProviders()
          const providerList = Chunk.toReadonlyArray(providers)

          expect(providerList).toContain("local")
          expect(providerList).toContain("google")
          expect(providerList).toContain("github")
          expect(providerList).not.toContain("saml")
          expect(providerList).not.toContain("workos")
        })
      )
    })
  })
})
