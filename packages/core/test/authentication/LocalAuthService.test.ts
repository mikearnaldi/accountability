import { describe, it, expect } from "@effect/vitest"
import { Effect, Layer, Option, Redacted, Chunk, Schema } from "effect"

// Import auth domain types
import { AuthUser } from "../../src/authentication/AuthUser.ts"
import { AuthUserId } from "../../src/authentication/AuthUserId.ts"
import { Email } from "../../src/authentication/Email.ts"
import { Session } from "../../src/authentication/Session.ts"
import { SessionId } from "../../src/authentication/SessionId.ts"
import { ProviderId } from "../../src/authentication/ProviderId.ts"
import { UserIdentity, UserIdentityId } from "../../src/authentication/UserIdentity.ts"
import { HashedPassword } from "../../src/authentication/HashedPassword.ts"
import { LocalAuthRequest, isLocalAuthRequest } from "../../src/authentication/AuthRequest.ts"
import { AuthResult } from "../../src/authentication/AuthResult.ts"
import { Timestamp, addHours, addDays } from "../../src/shared/values/Timestamp.ts"
import type { AuthProviderType } from "../../src/authentication/AuthProviderType.ts"

// Import auth services
import { AuthService, type AuthServiceShape, type LoginSuccess, type ValidatedSession } from "../../src/authentication/AuthService.ts"

// Import auth errors
import {
  InvalidCredentialsError,
  UserNotFoundError,
  UserAlreadyExistsError,
  SessionNotFoundError,
  SessionExpiredError,
  ProviderNotEnabledError,
  PasswordTooWeakError,
  IdentityAlreadyLinkedError,
  isInvalidCredentialsError,
  isUserNotFoundError,
  isUserAlreadyExistsError,
  isSessionNotFoundError,
  isSessionExpiredError,
  isPasswordTooWeakError,
  isProviderNotEnabledError,
  isIdentityAlreadyLinkedError
} from "../../src/authentication/AuthErrors.ts"

// =============================================================================
// Test Fixtures
// =============================================================================

const testUserUUID = "550e8400-e29b-41d4-a716-446655440000"
const testUserUUID2 = "550e8400-e29b-41d4-a716-446655440001"
const testIdentityUUID = "660e8400-e29b-41d4-a716-446655440000"
const testSessionToken = "abcdefghijklmnopqrstuvwxyz123456abcdefghij"

const createTestUser = (
  id: string = testUserUUID,
  email: string = "test@example.com",
  displayName: string = "Test User"
): AuthUser => {
  const now = Timestamp.make({ epochMillis: Date.now() })
  return AuthUser.make({
    id: AuthUserId.make(id),
    email: Email.make(email),
    displayName: Schema.NonEmptyTrimmedString.make(displayName),
    role: "member",
    primaryProvider: "local",
    createdAt: now,
    updatedAt: now
  })
}

const createTestSession = (
  userId: string = testUserUUID,
  sessionId: string = testSessionToken,
  expiresInHours: number = 24
): Session => {
  const now = Timestamp.make({ epochMillis: Date.now() })
  return Session.make({
    id: SessionId.make(sessionId),
    userId: AuthUserId.make(userId),
    provider: "local",
    createdAt: now,
    expiresAt: addHours(now, expiresInHours),
    userAgent: Option.none()
  })
}

const createExpiredSession = (
  userId: string = testUserUUID,
  sessionId: string = testSessionToken
): Session => {
  const now = Timestamp.make({ epochMillis: Date.now() })
  const past = addDays(now, -2) // Expired 2 days ago
  return Session.make({
    id: SessionId.make(sessionId),
    userId: AuthUserId.make(userId),
    provider: "local",
    createdAt: addDays(past, -1), // Created 3 days ago
    expiresAt: past, // Expired 2 days ago
    userAgent: Option.none()
  })
}

// =============================================================================
// Mock Repository Factory
// =============================================================================

interface MockRepositories {
  users: Map<AuthUserId, AuthUser>
  usersByEmail: Map<Email, AuthUser>
  identities: Map<string, UserIdentity> // key: `${provider}_${providerId}`
  sessions: Map<SessionId, Session>
  credentials: Map<AuthUserId, HashedPassword>
}

const createMockRepositories = (
  initialData?: {
    users?: ReadonlyArray<AuthUser>
    identities?: ReadonlyArray<UserIdentity>
    sessions?: ReadonlyArray<Session>
    credentials?: ReadonlyArray<{ userId: AuthUserId; hashedPassword: HashedPassword }>
  }
): MockRepositories => {
  const repos: MockRepositories = {
    users: new Map(),
    usersByEmail: new Map(),
    identities: new Map(),
    sessions: new Map(),
    credentials: new Map()
  }

  if (initialData?.users) {
    for (const user of initialData.users) {
      repos.users.set(user.id, user)
      repos.usersByEmail.set(user.email, user)
    }
  }

  if (initialData?.identities) {
    for (const identity of initialData.identities) {
      const key = `${identity.provider}_${identity.providerId}`
      repos.identities.set(key, identity)
    }
  }

  if (initialData?.sessions) {
    for (const session of initialData.sessions) {
      repos.sessions.set(session.id, session)
    }
  }

  if (initialData?.credentials) {
    for (const cred of initialData.credentials) {
      repos.credentials.set(cred.userId, cred.hashedPassword)
    }
  }

  return repos
}

// =============================================================================
// Mock AuthService Implementation (LocalAuthProvider)
// =============================================================================

/**
 * Creates a mock AuthService implementation that simulates local auth behavior
 * with in-memory repositories
 */
const createMockAuthService = (repos: MockRepositories): AuthServiceShape => {
  // Helper to validate password strength
  const validatePassword = (password: string): Effect.Effect<void, PasswordTooWeakError> => {
    const requirements: string[] = []
    if (password.length < 8) {
      requirements.push("Minimum 8 characters required")
    }
    if (requirements.length > 0) {
      return Effect.fail(new PasswordTooWeakError({ requirements: Chunk.fromIterable(requirements) }))
    }
    return Effect.succeed(undefined)
  }

  // Helper to check if session is valid
  const isSessionValid = (session: Session): boolean => {
    const now = Timestamp.make({ epochMillis: Date.now() })
    return session.isValid(now)
  }

  return {
    login: (provider, request) =>
      Effect.gen(function* () {
        if (provider !== "local") {
          return yield* Effect.fail(new ProviderNotEnabledError({ provider }))
        }

        // Type guard for LocalAuthRequest
        if (!isLocalAuthRequest(request)) {
          return yield* Effect.fail(new ProviderNotEnabledError({ provider }))
        }

        const email = request.email
        const password = Redacted.value(request.password)

        // Find user by email
        const user = repos.usersByEmail.get(email)
        if (!user) {
          return yield* Effect.fail(new UserNotFoundError({ email }))
        }

        // Verify password
        const storedHash = repos.credentials.get(user.id)
        if (!storedHash) {
          return yield* Effect.fail(new InvalidCredentialsError({ email }))
        }

        // Simple mock password check
        const expectedHash = `$2a$04$mockhash_${password}`
        if (storedHash !== expectedHash) {
          return yield* Effect.fail(new InvalidCredentialsError({ email }))
        }

        // Create session
        const now = Timestamp.make({ epochMillis: Date.now() })
        const session = Session.make({
          id: SessionId.make(testSessionToken),
          userId: user.id,
          provider: "local",
          createdAt: now,
          expiresAt: addHours(now, 24),
          userAgent: Option.none()
        })

        repos.sessions.set(session.id, session)

        const result: LoginSuccess = { user, session }
        return result
      }),

    register: (email, password, displayName) =>
      Effect.gen(function* () {
        // Check for existing user
        const existingUser = repos.usersByEmail.get(email)
        if (existingUser) {
          return yield* Effect.fail(new UserAlreadyExistsError({ email }))
        }

        // Validate password
        yield* validatePassword(password)

        // Create user
        const now = Timestamp.make({ epochMillis: Date.now() })
        const userId = AuthUserId.make(testUserUUID2)
        const user = AuthUser.make({
          id: userId,
          email,
          displayName: Schema.NonEmptyTrimmedString.make(displayName),
          role: "member",
          primaryProvider: "local",
          createdAt: now,
          updatedAt: now
        })

        // Store user
        repos.users.set(user.id, user)
        repos.usersByEmail.set(user.email, user)

        // Store credentials (mock hash)
        const hashedPassword = HashedPassword.make(`$2a$04$mockhash_${password}`)
        repos.credentials.set(userId, hashedPassword)

        // Create identity
        const identity = UserIdentity.make({
          id: UserIdentityId.make("770e8400-e29b-41d4-a716-446655440000"),
          userId,
          provider: "local",
          providerId: ProviderId.make(`local_${userId}`),
          providerData: Option.none(),
          createdAt: now
        })
        repos.identities.set(`local_${identity.providerId}`, identity)

        return user
      }),

    logout: (sessionId) =>
      Effect.gen(function* () {
        const session = repos.sessions.get(sessionId)
        if (!session) {
          return yield* Effect.fail(new SessionNotFoundError({ sessionId }))
        }
        repos.sessions.delete(sessionId)
      }),

    validateSession: (sessionId) =>
      Effect.gen(function* () {
        const session = repos.sessions.get(sessionId)
        if (!session) {
          return yield* Effect.fail(new SessionNotFoundError({ sessionId }))
        }

        if (!isSessionValid(session)) {
          return yield* Effect.fail(new SessionExpiredError({ sessionId }))
        }

        const user = repos.users.get(session.userId)
        if (!user) {
          return yield* Effect.fail(new SessionNotFoundError({ sessionId }))
        }

        const result: ValidatedSession = { user, session }
        return result
      }),

    getAuthorizationUrl: (provider, _redirectUri) =>
      Effect.gen(function* () {
        if (provider === "local") {
          return yield* Effect.fail(new ProviderNotEnabledError({ provider }))
        }
        // OAuth providers would return a URL here
        return yield* Effect.fail(new ProviderNotEnabledError({ provider }))
      }),

    handleOAuthCallback: (provider, _code, _state) =>
      Effect.fail(new ProviderNotEnabledError({ provider })),

    linkIdentity: (userId, provider, providerResult) =>
      Effect.gen(function* () {
        const user = repos.users.get(userId)
        if (!user) {
          return yield* Effect.fail(new UserNotFoundError({ email: Email.make("unknown@example.com") }))
        }

        // Check if identity already linked
        const identityKey = `${provider}_${providerResult.providerId}`
        const existingIdentity = repos.identities.get(identityKey)
        if (existingIdentity && existingIdentity.userId !== userId) {
          return yield* Effect.fail(new IdentityAlreadyLinkedError({
            provider,
            providerId: providerResult.providerId,
            existingUserId: existingIdentity.userId
          }))
        }

        const now = Timestamp.make({ epochMillis: Date.now() })
        const identity = UserIdentity.make({
          id: UserIdentityId.make("880e8400-e29b-41d4-a716-446655440000"),
          userId,
          provider,
          providerId: providerResult.providerId,
          providerData: providerResult.providerData,
          createdAt: now
        })

        repos.identities.set(identityKey, identity)
        return identity
      }),

    getEnabledProviders: () =>
      Effect.succeed(Chunk.fromIterable<AuthProviderType>(["local"]))
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("LocalAuthService", () => {
  describe("register", () => {
    describe("successful registration", () => {
      it.effect("creates a new user with valid email and password", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const newEmail = Email.make("newuser@example.com")
          const result = yield* auth.register(newEmail, "password123", "New User")

          expect(result.email).toBe(newEmail)
          expect(result.displayName).toBe("New User")
          expect(result.primaryProvider).toBe("local")
          expect(result.role).toBe("member")

          // Verify user was stored
          expect(repos.usersByEmail.has(newEmail)).toBe(true)
        })
      )

      it.effect("stores hashed password (not plaintext)", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const newEmail = Email.make("newuser@example.com")
          const result = yield* auth.register(newEmail, "password123", "New User")

          // Check that credentials were stored
          const storedHash = repos.credentials.get(result.id)
          expect(storedHash).toBeDefined()
          // Hash should not be plaintext
          expect(storedHash).not.toBe("password123")
          // Hash should contain our mock prefix
          expect(storedHash).toContain("mockhash")
        })
      )

      it.effect("creates identity record for local provider", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const newEmail = Email.make("newuser@example.com")
          yield* auth.register(newEmail, "password123", "New User")

          // Check that identity was created
          expect(repos.identities.size).toBeGreaterThan(0)
        })
      )
    })

    describe("registration errors", () => {
      it.effect("fails with UserAlreadyExistsError for duplicate email", () =>
        Effect.gen(function* () {
          const existingUser = createTestUser()
          const repos = createMockRepositories({
            users: [existingUser]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const result = yield* Effect.exit(
            auth.register(existingUser.email, "password123", "Duplicate User")
          )

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isUserAlreadyExistsError(result.cause.error)).toBe(true)
            if (isUserAlreadyExistsError(result.cause.error)) {
              expect(result.cause.error.email).toBe(existingUser.email)
            }
          }
        })
      )

      it.effect("fails with PasswordTooWeakError for short password", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const result = yield* Effect.exit(
            auth.register(Email.make("newuser@example.com"), "short", "New User")
          )

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isPasswordTooWeakError(result.cause.error)).toBe(true)
          }
        })
      )

      it.effect("fails with PasswordTooWeakError for empty password", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const result = yield* Effect.exit(
            auth.register(Email.make("newuser@example.com"), "", "New User")
          )

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isPasswordTooWeakError(result.cause.error)).toBe(true)
          }
        })
      )
    })
  })

  describe("login", () => {
    describe("successful login", () => {
      it.effect("returns user and session for valid credentials", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const hashedPassword = HashedPassword.make("$2a$04$mockhash_correctpassword")
          const repos = createMockRepositories({
            users: [user],
            credentials: [{ userId: user.id, hashedPassword }]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const request = LocalAuthRequest.make({
            email: user.email,
            password: Redacted.make("correctpassword")
          })
          const result = yield* auth.login("local", request)

          expect(result.user.id).toBe(user.id)
          expect(result.user.email).toBe(user.email)
          expect(result.session.userId).toBe(user.id)
          expect(result.session.provider).toBe("local")
        })
      )

      it.effect("creates session with expiration time", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const hashedPassword = HashedPassword.make("$2a$04$mockhash_correctpassword")
          const repos = createMockRepositories({
            users: [user],
            credentials: [{ userId: user.id, hashedPassword }]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const request = LocalAuthRequest.make({
            email: user.email,
            password: Redacted.make("correctpassword")
          })
          const result = yield* auth.login("local", request)

          const now = Timestamp.make({ epochMillis: Date.now() })
          expect(result.session.isValid(now)).toBe(true)
          expect(result.session.expiresAt.epochMillis).toBeGreaterThan(now.epochMillis)
        })
      )

      it.effect("stores session in repository", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const hashedPassword = HashedPassword.make("$2a$04$mockhash_correctpassword")
          const repos = createMockRepositories({
            users: [user],
            credentials: [{ userId: user.id, hashedPassword }]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const request = LocalAuthRequest.make({
            email: user.email,
            password: Redacted.make("correctpassword")
          })
          const result = yield* auth.login("local", request)

          // Verify session was stored
          expect(repos.sessions.has(result.session.id)).toBe(true)
        })
      )
    })

    describe("login errors", () => {
      it.effect("fails with UserNotFoundError for non-existent email", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const nonExistentEmail = Email.make("notfound@example.com")
          const request = LocalAuthRequest.make({
            email: nonExistentEmail,
            password: Redacted.make("anypassword")
          })
          const result = yield* Effect.exit(auth.login("local", request))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isUserNotFoundError(result.cause.error)).toBe(true)
            if (isUserNotFoundError(result.cause.error)) {
              expect(result.cause.error.email).toBe(nonExistentEmail)
            }
          }
        })
      )

      it.effect("fails with InvalidCredentialsError for wrong password", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const hashedPassword = HashedPassword.make("$2a$04$mockhash_correctpassword")
          const repos = createMockRepositories({
            users: [user],
            credentials: [{ userId: user.id, hashedPassword }]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const request = LocalAuthRequest.make({
            email: user.email,
            password: Redacted.make("wrongpassword")
          })
          const result = yield* Effect.exit(auth.login("local", request))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isInvalidCredentialsError(result.cause.error)).toBe(true)
            if (isInvalidCredentialsError(result.cause.error)) {
              expect(result.cause.error.email).toBe(user.email)
            }
          }
        })
      )

      it.effect("fails with InvalidCredentialsError for missing credentials", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          // User exists but has no credentials stored
          const repos = createMockRepositories({
            users: [user]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const request = LocalAuthRequest.make({
            email: user.email,
            password: Redacted.make("anypassword")
          })
          const result = yield* Effect.exit(auth.login("local", request))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isInvalidCredentialsError(result.cause.error)).toBe(true)
          }
        })
      )

      it.effect("fails with ProviderNotEnabledError for non-local provider", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const request = LocalAuthRequest.make({
            email: Email.make("test@example.com"),
            password: Redacted.make("anypassword")
          })
          const result = yield* Effect.exit(auth.login("google", request))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isProviderNotEnabledError(result.cause.error)).toBe(true)
            if (isProviderNotEnabledError(result.cause.error)) {
              expect(result.cause.error.provider).toBe("google")
            }
          }
        })
      )
    })
  })

  describe("logout", () => {
    describe("successful logout", () => {
      it.effect("removes session from repository", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const session = createTestSession(user.id)
          const repos = createMockRepositories({
            users: [user],
            sessions: [session]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          // Verify session exists before logout
          expect(repos.sessions.has(session.id)).toBe(true)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          yield* auth.logout(session.id)

          // Verify session was removed
          expect(repos.sessions.has(session.id)).toBe(false)
        })
      )

      it.effect("succeeds even for expired sessions", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const expiredSession = createExpiredSession(user.id)
          const repos = createMockRepositories({
            users: [user],
            sessions: [expiredSession]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          yield* auth.logout(expiredSession.id)

          // Should succeed and remove the session
          expect(repos.sessions.has(expiredSession.id)).toBe(false)
        })
      )
    })

    describe("logout errors", () => {
      it.effect("fails with SessionNotFoundError for non-existent session", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const nonExistentSessionId = SessionId.make("nonexistent1234567890123456789012")
          const result = yield* Effect.exit(auth.logout(nonExistentSessionId))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isSessionNotFoundError(result.cause.error)).toBe(true)
            if (isSessionNotFoundError(result.cause.error)) {
              expect(result.cause.error.sessionId).toBe(nonExistentSessionId)
            }
          }
        })
      )
    })
  })

  describe("validateSession", () => {
    describe("successful validation", () => {
      it.effect("returns user and session for valid session", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const session = createTestSession(user.id)
          const repos = createMockRepositories({
            users: [user],
            sessions: [session]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const result = yield* auth.validateSession(session.id)

          expect(result.user.id).toBe(user.id)
          expect(result.session.id).toBe(session.id)
        })
      )

      it.effect("returns correct user for session", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const session = createTestSession(user.id)
          const repos = createMockRepositories({
            users: [user],
            sessions: [session]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const result = yield* auth.validateSession(session.id)

          expect(result.user.email).toBe(user.email)
          expect(result.user.displayName).toBe(user.displayName)
        })
      )
    })

    describe("validation errors", () => {
      it.effect("fails with SessionNotFoundError for non-existent session", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const nonExistentSessionId = SessionId.make("nonexistent1234567890123456789012")
          const result = yield* Effect.exit(auth.validateSession(nonExistentSessionId))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isSessionNotFoundError(result.cause.error)).toBe(true)
          }
        })
      )

      it.effect("fails with SessionExpiredError for expired session", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const expiredSession = createExpiredSession(user.id)
          const repos = createMockRepositories({
            users: [user],
            sessions: [expiredSession]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const result = yield* Effect.exit(auth.validateSession(expiredSession.id))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isSessionExpiredError(result.cause.error)).toBe(true)
            if (isSessionExpiredError(result.cause.error)) {
              expect(result.cause.error.sessionId).toBe(expiredSession.id)
            }
          }
        })
      )

      it.effect("fails with SessionNotFoundError when user no longer exists", () =>
        Effect.gen(function* () {
          // Session exists but user was deleted
          const session = createTestSession()
          const repos = createMockRepositories({
            sessions: [session]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const result = yield* Effect.exit(auth.validateSession(session.id))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isSessionNotFoundError(result.cause.error)).toBe(true)
          }
        })
      )
    })
  })

  describe("linkIdentity", () => {
    describe("successful linking", () => {
      it.effect("links identity to existing user", () =>
        Effect.gen(function* () {
          const user = createTestUser()
          const repos = createMockRepositories({
            users: [user]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const authResult = AuthResult.make({
            provider: "google",
            providerId: ProviderId.make("google_12345"),
            email: Email.make("test@example.com"),
            displayName: Schema.NonEmptyTrimmedString.make("Test User"),
            emailVerified: true,
            providerData: Option.none()
          })

          const identity = yield* auth.linkIdentity(user.id, "google", authResult)

          expect(identity.userId).toBe(user.id)
          expect(identity.provider).toBe("google")
          expect(identity.providerId).toBe(authResult.providerId)
        })
      )
    })

    describe("linking errors", () => {
      it.effect("fails with UserNotFoundError for non-existent user", () =>
        Effect.gen(function* () {
          const repos = createMockRepositories()
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const nonExistentUserId = AuthUserId.make("990e8400-e29b-41d4-a716-446655440000")
          const authResult = AuthResult.make({
            provider: "google",
            providerId: ProviderId.make("google_12345"),
            email: Email.make("test@example.com"),
            displayName: Schema.NonEmptyTrimmedString.make("Test User"),
            emailVerified: true,
            providerData: Option.none()
          })

          const result = yield* Effect.exit(auth.linkIdentity(nonExistentUserId, "google", authResult))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isUserNotFoundError(result.cause.error)).toBe(true)
          }
        })
      )

      it.effect("fails with IdentityAlreadyLinkedError when identity linked to another user", () =>
        Effect.gen(function* () {
          const user1 = createTestUser()
          const user2 = createTestUser(testUserUUID2, "other@example.com", "Other User")
          const existingIdentity = UserIdentity.make({
            id: UserIdentityId.make(testIdentityUUID),
            userId: user1.id,
            provider: "google",
            providerId: ProviderId.make("google_12345"),
            providerData: Option.none(),
            createdAt: Timestamp.make({ epochMillis: Date.now() })
          })
          const repos = createMockRepositories({
            users: [user1, user2],
            identities: [existingIdentity]
          })
          const service = createMockAuthService(repos)
          const TestLayer = Layer.succeed(AuthService, service)

          const auth = yield* Effect.provide(AuthService, TestLayer)
          const authResult = AuthResult.make({
            provider: "google",
            providerId: ProviderId.make("google_12345"), // Same as existing identity
            email: Email.make("other@example.com"),
            displayName: Schema.NonEmptyTrimmedString.make("Other User"),
            emailVerified: true,
            providerData: Option.none()
          })

          const result = yield* Effect.exit(auth.linkIdentity(user2.id, "google", authResult))

          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure" && result.cause._tag === "Fail") {
            expect(isIdentityAlreadyLinkedError(result.cause.error)).toBe(true)
            if (isIdentityAlreadyLinkedError(result.cause.error)) {
              expect(result.cause.error.provider).toBe("google")
              expect(result.cause.error.existingUserId).toBe(user1.id)
            }
          }
        })
      )
    })
  })

  describe("getEnabledProviders", () => {
    it.effect("returns list of enabled providers", () =>
      Effect.gen(function* () {
        const repos = createMockRepositories()
        const service = createMockAuthService(repos)
        const TestLayer = Layer.succeed(AuthService, service)

        const auth = yield* Effect.provide(AuthService, TestLayer)
        const providers = yield* auth.getEnabledProviders()

        expect(Chunk.size(providers)).toBeGreaterThan(0)
        expect(Chunk.toReadonlyArray(providers)).toContain("local")
      })
    )
  })

  describe("complete auth flow integration", () => {
    it.effect("register -> login -> validate -> logout flow works correctly", () =>
      Effect.gen(function* () {
        const repos = createMockRepositories()
        const service = createMockAuthService(repos)
        const TestLayer = Layer.succeed(AuthService, service)

        const auth = yield* Effect.provide(AuthService, TestLayer)

        // Step 1: Register
        const email = Email.make("flowtest@example.com")
        const password = "securepassword123"
        const user = yield* auth.register(email, password, "Flow Test User")
        expect(user.email).toBe(email)

        // Step 2: Login
        const loginRequest = LocalAuthRequest.make({
          email,
          password: Redacted.make(password)
        })
        const loginResult = yield* auth.login("local", loginRequest)
        expect(loginResult.user.id).toBe(user.id)

        // Step 3: Validate session
        const validated = yield* auth.validateSession(loginResult.session.id)
        expect(validated.user.id).toBe(user.id)
        expect(validated.session.id).toBe(loginResult.session.id)

        // Step 4: Logout
        yield* auth.logout(loginResult.session.id)

        // Step 5: Verify session is invalid after logout
        const validateAfterLogout = yield* Effect.exit(
          auth.validateSession(loginResult.session.id)
        )
        expect(validateAfterLogout._tag).toBe("Failure")
      })
    )

    it.effect("handles multiple users correctly", () =>
      Effect.gen(function* () {
        const user1 = createTestUser(testUserUUID, "user1@example.com", "User One")
        const user2 = createTestUser(testUserUUID2, "user2@example.com", "User Two")
        const hash1 = HashedPassword.make("$2a$04$mockhash_password1")
        const hash2 = HashedPassword.make("$2a$04$mockhash_password2")
        const repos = createMockRepositories({
          users: [user1, user2],
          credentials: [
            { userId: user1.id, hashedPassword: hash1 },
            { userId: user2.id, hashedPassword: hash2 }
          ]
        })
        const service = createMockAuthService(repos)
        const TestLayer = Layer.succeed(AuthService, service)

        const auth = yield* Effect.provide(AuthService, TestLayer)

        // Login as user1
        const request1 = LocalAuthRequest.make({
          email: user1.email,
          password: Redacted.make("password1")
        })
        const result1 = yield* auth.login("local", request1)
        expect(result1.user.id).toBe(user1.id)
        expect(result1.user.email).toBe(user1.email)

        // User2 with wrong password should fail
        const wrongRequest = LocalAuthRequest.make({
          email: user2.email,
          password: Redacted.make("password1") // Wrong password for user2
        })
        const wrongResult = yield* Effect.exit(auth.login("local", wrongRequest))
        expect(wrongResult._tag).toBe("Failure")
      })
    )
  })
})

describe("Auth Error Types", () => {
  describe("InvalidCredentialsError", () => {
    it("has correct message", () => {
      const email = Email.make("test@example.com")
      const error = new InvalidCredentialsError({ email })
      expect(error.message).toBe("Invalid email or password")
      expect(error._tag).toBe("InvalidCredentialsError")
    })

    it("type guard works correctly", () => {
      const email = Email.make("test@example.com")
      const error = new InvalidCredentialsError({ email })
      expect(isInvalidCredentialsError(error)).toBe(true)
      expect(isInvalidCredentialsError(null)).toBe(false)
      expect(isInvalidCredentialsError({ _tag: "InvalidCredentialsError" })).toBe(false)
    })
  })

  describe("UserNotFoundError", () => {
    it("has correct message", () => {
      const email = Email.make("notfound@example.com")
      const error = new UserNotFoundError({ email })
      expect(error.message).toContain("User not found")
      expect(error.message).toContain("notfound@example.com")
    })

    it("type guard works correctly", () => {
      const email = Email.make("test@example.com")
      const error = new UserNotFoundError({ email })
      expect(isUserNotFoundError(error)).toBe(true)
      expect(isUserNotFoundError(null)).toBe(false)
    })
  })

  describe("UserAlreadyExistsError", () => {
    it("has correct message", () => {
      const email = Email.make("existing@example.com")
      const error = new UserAlreadyExistsError({ email })
      expect(error.message).toContain("already exists")
      expect(error.message).toContain("existing@example.com")
    })

    it("type guard works correctly", () => {
      const email = Email.make("test@example.com")
      const error = new UserAlreadyExistsError({ email })
      expect(isUserAlreadyExistsError(error)).toBe(true)
      expect(isUserAlreadyExistsError(undefined)).toBe(false)
    })
  })

  describe("SessionNotFoundError", () => {
    it("has correct message", () => {
      const sessionId = SessionId.make("abcdefghijklmnopqrstuvwxyz123456")
      const error = new SessionNotFoundError({ sessionId })
      expect(error.message).toBe("Session not found")
    })

    it("type guard works correctly", () => {
      const sessionId = SessionId.make("abcdefghijklmnopqrstuvwxyz123456")
      const error = new SessionNotFoundError({ sessionId })
      expect(isSessionNotFoundError(error)).toBe(true)
      expect(isSessionNotFoundError(new Error("test"))).toBe(false)
    })
  })

  describe("SessionExpiredError", () => {
    it("has correct message", () => {
      const sessionId = SessionId.make("abcdefghijklmnopqrstuvwxyz123456")
      const error = new SessionExpiredError({ sessionId })
      expect(error.message).toBe("Session has expired")
    })

    it("type guard works correctly", () => {
      const sessionId = SessionId.make("abcdefghijklmnopqrstuvwxyz123456")
      const error = new SessionExpiredError({ sessionId })
      expect(isSessionExpiredError(error)).toBe(true)
      expect(isSessionExpiredError(null)).toBe(false)
    })
  })

  describe("PasswordTooWeakError", () => {
    it("has correct message with requirements", () => {
      const error = new PasswordTooWeakError({
        requirements: Chunk.fromIterable(["Minimum 8 characters", "Must contain number"])
      })
      expect(error.message).toContain("Password does not meet requirements")
      expect(error.message).toContain("Minimum 8 characters")
      expect(error.message).toContain("Must contain number")
    })

    it("type guard works correctly", () => {
      const error = new PasswordTooWeakError({
        requirements: Chunk.fromIterable(["Test requirement"])
      })
      expect(isPasswordTooWeakError(error)).toBe(true)
      expect(isPasswordTooWeakError({})).toBe(false)
    })
  })

  describe("ProviderNotEnabledError", () => {
    it("has correct message", () => {
      const error = new ProviderNotEnabledError({ provider: "github" })
      expect(error.message).toContain("github")
      expect(error.message).toContain("not enabled")
    })

    it("type guard works correctly", () => {
      const error = new ProviderNotEnabledError({ provider: "google" })
      expect(isProviderNotEnabledError(error)).toBe(true)
      expect(isProviderNotEnabledError(undefined)).toBe(false)
    })
  })

  describe("IdentityAlreadyLinkedError", () => {
    it("has correct message", () => {
      const error = new IdentityAlreadyLinkedError({
        provider: "google",
        providerId: ProviderId.make("google_123"),
        existingUserId: AuthUserId.make(testUserUUID)
      })
      expect(error.message).toContain("google")
      expect(error.message).toContain("already linked")
    })

    it("type guard works correctly", () => {
      const error = new IdentityAlreadyLinkedError({
        provider: "google",
        providerId: ProviderId.make("google_123"),
        existingUserId: AuthUserId.make(testUserUUID)
      })
      expect(isIdentityAlreadyLinkedError(error)).toBe(true)
      expect(isIdentityAlreadyLinkedError(null)).toBe(false)
    })
  })
})

describe("Session", () => {
  describe("isExpired", () => {
    it("returns false for valid session", () => {
      const session = createTestSession()
      const now = Timestamp.make({ epochMillis: Date.now() })
      expect(session.isExpired(now)).toBe(false)
    })

    it("returns true for expired session", () => {
      const session = createExpiredSession()
      const now = Timestamp.make({ epochMillis: Date.now() })
      expect(session.isExpired(now)).toBe(true)
    })
  })

  describe("isValid", () => {
    it("returns true for valid session", () => {
      const session = createTestSession()
      const now = Timestamp.make({ epochMillis: Date.now() })
      expect(session.isValid(now)).toBe(true)
    })

    it("returns false for expired session", () => {
      const session = createExpiredSession()
      const now = Timestamp.make({ epochMillis: Date.now() })
      expect(session.isValid(now)).toBe(false)
    })
  })

  describe("timeRemainingMs", () => {
    it("returns positive value for valid session", () => {
      const session = createTestSession()
      const now = Timestamp.make({ epochMillis: Date.now() })
      const remaining = session.timeRemainingMs(now)
      expect(remaining).toBeGreaterThan(0)
    })

    it("returns 0 for expired session", () => {
      const session = createExpiredSession()
      const now = Timestamp.make({ epochMillis: Date.now() })
      const remaining = session.timeRemainingMs(now)
      expect(remaining).toBe(0)
    })
  })
})
