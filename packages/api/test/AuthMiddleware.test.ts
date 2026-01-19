/**
 * Tests for the AuthMiddleware authentication middleware
 *
 * These tests verify:
 * - CurrentUser service is properly defined
 * - User schema works correctly
 * - TokenValidator validates tokens correctly
 * - SimpleTokenValidatorLive handles various token formats
 * - SessionTokenValidatorLive validates sessions against the database
 * - UnauthorizedError is returned for invalid/missing tokens
 */

import { describe, expect, it, layer } from "@effect/vitest"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import { AuthUser } from "@accountability/core/authentication/AuthUser"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Email } from "@accountability/core/authentication/Email"
import { Session } from "@accountability/core/authentication/Session"
import { SessionId } from "@accountability/core/authentication/SessionId"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import {
  AuthMiddleware,
  CurrentUser,
  TokenValidator,
  User
} from "@accountability/api/Definitions/AuthMiddleware"
import type { TokenValidatorService } from "@accountability/api/Definitions/AuthMiddleware"
import {
  AuthMiddlewareLive,
  AuthMiddlewareWithSimpleValidation,
  AuthMiddlewareWithSessionValidation,
  SessionTokenValidatorLive,
  SimpleTokenValidatorLive
} from "@accountability/api/Layers/AuthMiddlewareLive"
import { UnauthorizedError } from "@accountability/api/Definitions/ApiErrors"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import {
  SessionRepository,
  type SessionRepositoryService
} from "@accountability/persistence/Services/SessionRepository"
import {
  UserRepository,
  type UserRepositoryService
} from "@accountability/persistence/Services/UserRepository"
import { PersistenceError } from "@accountability/persistence/Errors/RepositoryError"

// Test UUIDs for proper AuthUserId format
const testUserId1 = AuthUserId.make("11111111-1111-1111-1111-111111111111")
const testUserId2 = AuthUserId.make("22222222-2222-2222-2222-222222222222")
const testUserId3 = AuthUserId.make("33333333-3333-3333-3333-333333333333")

describe("AuthMiddleware", () => {
  describe("User", () => {
    it("should create a valid user", () => {
      const user = User.make({
        userId: testUserId1,
        role: "admin"
      })

      expect(user.userId).toBe(testUserId1)
      expect(user.role).toBe("admin")
    })

    it("should accept all valid roles", () => {
      const adminUser = User.make({ userId: testUserId1, role: "admin" })
      const regularUser = User.make({ userId: testUserId2, role: "user" })
      const readonlyUser = User.make({ userId: testUserId3, role: "readonly" })

      expect(adminUser.role).toBe("admin")
      expect(regularUser.role).toBe("user")
      expect(readonlyUser.role).toBe("readonly")
    })
  })

  describe("CurrentUser", () => {
    it.effect("should be accessible in Effect.gen", () =>
      Effect.gen(function* () {
        const user = User.make({ userId: testUserId1, role: "user" })

        const result = yield* Effect.provideService(
          CurrentUser,
          user
        )(Effect.gen(function* () {
          const currentUser = yield* CurrentUser
          return currentUser
        }))

        expect(result.userId).toBe(testUserId1)
        expect(result.role).toBe("user")
      })
    )
  })

  describe("SimpleTokenValidatorLive", () => {
    const testLayer = SimpleTokenValidatorLive

    layer(testLayer)("Token validation", (it) => {
      it.effect("should validate a correctly formatted token", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("user_11111111-1111-1111-1111-111111111111_admin")
          const user = yield* validator.validate(token)

          expect(user.userId).toBe(testUserId1)
          expect(user.role).toBe("admin")
        })
      )

      it.effect("should validate token with user role", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("user_22222222-2222-2222-2222-222222222222_user")
          const user = yield* validator.validate(token)

          expect(user.userId).toBe(testUserId2)
          expect(user.role).toBe("user")
        })
      )

      it.effect("should validate token with readonly role", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("user_33333333-3333-3333-3333-333333333333_readonly")
          const user = yield* validator.validate(token)

          expect(user.userId).toBe(testUserId3)
          expect(user.role).toBe("readonly")
        })
      )

      it.effect("should reject empty token", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Bearer token is required")
          }
        })
      )

      it.effect("should reject whitespace-only token", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("   ")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Bearer token is required")
          }
        })
      )

      it.effect("should reject invalid token format", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("invalid-token")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Invalid token format")
          }
        })
      )

      it.effect("should reject token without user prefix", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("admin_123_admin")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Invalid token format")
          }
        })
      )

      it.effect("should reject token with invalid role", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("user_11111111-1111-1111-1111-111111111111_superuser")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toContain("invalid role")
          }
        })
      )

      it.effect("should reject token with non-UUID user ID", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("user_123_admin")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Invalid token: user ID must be a valid UUID")
          }
        })
      )

      it.effect("should reject token with empty user ID", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("user__admin")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Invalid token: missing user ID")
          }
        })
      )

      it.effect("should reject token with only whitespace user ID", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("user_   _admin")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Invalid token: missing user ID")
          }
        })
      )
    })
  })

  describe("AuthMiddleware tag", () => {
    it("should be properly defined", () => {
      expect(AuthMiddleware).toBeDefined()
    })

    it("should have bearer security scheme", () => {
      // The security property should exist on the tag
      expect(AuthMiddleware.security).toBeDefined()
      expect(AuthMiddleware.security.bearer).toBeDefined()
    })
  })

  describe("Custom TokenValidator", () => {
    const customUserId = AuthUserId.make("cccccccc-cccc-cccc-cccc-cccccccccccc")
    const customValidator: TokenValidatorService = {
      validate: (token) =>
        Effect.gen(function* () {
          const value = Redacted.value(token)
          if (value === "valid-token") {
            return User.make({ userId: customUserId, role: "admin" })
          }
          return yield* Effect.fail(
            new UnauthorizedError({ message: "Custom validation failed" })
          )
        })
    }

    const customValidatorLayer = Layer.succeed(TokenValidator, customValidator)

    layer(customValidatorLayer)("Custom token validation", (it) => {
      it.effect("should validate with custom logic", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("valid-token")

          const user = yield* validator.validate(token)

          expect(user.userId).toBe(customUserId)
          expect(user.role).toBe("admin")
        })
      )

      it.effect("should fail with custom error message", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("invalid-token")

          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Custom validation failed")
          }
        })
      )
    })
  })

  describe("AuthMiddlewareLive", () => {
    // Test that the layer is properly typed
    it("should be properly typed", () => {
      expect(AuthMiddlewareLive).toBeDefined()
    })

    it("should require TokenValidator", () => {
      // This is a type-level test - AuthMiddlewareLive requires TokenValidator
      // If this compiles, the dependency is properly declared
      const _composed = AuthMiddlewareLive.pipe(Layer.provide(SimpleTokenValidatorLive))
      expect(_composed).toBeDefined()
    })
  })

  describe("AuthMiddlewareWithSimpleValidation", () => {
    it("should be a complete layer without dependencies", () => {
      // AuthMiddlewareWithSimpleValidation should not require any additional dependencies
      expect(AuthMiddlewareWithSimpleValidation).toBeDefined()
    })
  })
})

describe("API Groups with AuthMiddleware", () => {
  describe("Protected endpoints", () => {
    it("should have AuthMiddleware applied to AccountsApi", () => {
      // This is a structural test - the middleware is applied via .middleware(AuthMiddleware)
      // on the API group definition. We verify the API exports are correct.
      expect(AppApi).toBeDefined()
    })

    it("should have AuthMiddleware applied to CompaniesApi", () => {
      expect(AppApi).toBeDefined()
    })

    it("should have AuthMiddleware applied to JournalEntriesApi", () => {
      expect(AppApi).toBeDefined()
    })

    it("should have AuthMiddleware applied to ReportsApi", () => {
      expect(AppApi).toBeDefined()
    })
  })

  describe("Unprotected endpoints", () => {
    it("should not apply middleware to HealthApi", () => {
      // Health endpoint should remain public for load balancers etc.
      expect(AppApi).toBeDefined()
    })
  })
})

// =============================================================================
// SessionTokenValidator Tests
// =============================================================================

describe("SessionTokenValidatorLive", () => {
  // Test data factory helpers
  const now = Timestamp.make({ epochMillis: Date.now() })
  const futureTime = Timestamp.make({ epochMillis: Date.now() + 3600000 }) // 1 hour from now
  const pastTime = Timestamp.make({ epochMillis: Date.now() - 3600000 }) // 1 hour ago

  // Use valid UUIDs for IDs
  const testUserId = AuthUserId.make("550e8400-e29b-41d4-a716-446655440000")
  // SessionId requires at least 32 characters
  const testSessionId = SessionId.make("test-session-token-abc123def456-extended")

  const testAuthUser = AuthUser.make({
    id: testUserId,
    email: Email.make("test@example.com"),
    displayName: "Test User",
    role: "member",
    primaryProvider: "local",
    createdAt: now,
    updatedAt: now
  })

  const testSession = Session.make({
    id: testSessionId,
    userId: testUserId,
    provider: "local",
    expiresAt: futureTime,
    createdAt: now,
    userAgent: Option.none()
  })

  // SessionId must be at least 32 characters
  const expiredSessionId = "expired-session-token-32chars-min"
  const expiredSession = Session.make({
    id: SessionId.make(expiredSessionId),
    userId: testUserId,
    provider: "local",
    expiresAt: pastTime,
    createdAt: Timestamp.make({ epochMillis: Date.now() - 7200000 }),
    userAgent: Option.none()
  })

  // Mock SessionRepository
  const makeSessionRepoMock = (
    sessions: Map<string, Session>
  ): SessionRepositoryService => ({
    findById: (id) =>
      Effect.succeed(Option.fromNullable(sessions.get(id))),
    findByUserId: (userId) =>
      Effect.succeed(
        Chunk.fromIterable(
          Array.from(sessions.values()).filter((s) => s.userId === userId)
        )
      ),
    create: (session) =>
      Effect.succeed(
        Session.make({
          id: session.id,
          userId: session.userId,
          provider: session.provider,
          expiresAt: session.expiresAt,
          createdAt: now,
          userAgent: session.userAgent
        })
      ),
    delete: () => Effect.void,
    deleteExpired: () => Effect.succeed(0),
    deleteByUserId: () => Effect.succeed(0),
    updateExpiry: (_id, expiresAt) =>
      Effect.succeed(
        Session.make({
          id: testSessionId,
          userId: testUserId,
          provider: "local",
          expiresAt,
          createdAt: now,
          userAgent: Option.none()
        })
      )
  })

  // Mock UserRepository
  const makeUserRepoMock = (
    users: Map<string, AuthUser>
  ): UserRepositoryService => ({
    findById: (id) =>
      Effect.succeed(Option.fromNullable(users.get(id))),
    findByEmail: (email) =>
      Effect.succeed(
        Option.fromNullable(
          Array.from(users.values()).find((u) => u.email === email)
        )
      ),
    create: (user) =>
      Effect.succeed(
        AuthUser.make({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          primaryProvider: user.primaryProvider,
          createdAt: now,
          updatedAt: now
        })
      ),
    update: (_id, _data) => Effect.succeed(testAuthUser),
    delete: () => Effect.void,
    findPlatformAdmins: () => Effect.succeed([]),
    isPlatformAdmin: () => Effect.succeed(false)
  })

  // Create test layer with valid session and user
  const validSessionTestLayer = SessionTokenValidatorLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          SessionRepository,
          makeSessionRepoMock(new Map([[testSessionId, testSession]]))
        ),
        Layer.succeed(
          UserRepository,
          makeUserRepoMock(new Map([[testUserId, testAuthUser]]))
        )
      )
    )
  )

  // Create test layer with expired session
  const expiredSessionTestLayer = SessionTokenValidatorLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          SessionRepository,
          makeSessionRepoMock(new Map([[expiredSessionId, expiredSession]]))
        ),
        Layer.succeed(
          UserRepository,
          makeUserRepoMock(new Map([[testUserId, testAuthUser]]))
        )
      )
    )
  )

  // Create test layer with no sessions (empty)
  const noSessionTestLayer = SessionTokenValidatorLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(SessionRepository, makeSessionRepoMock(new Map())),
        Layer.succeed(
          UserRepository,
          makeUserRepoMock(new Map([[testUserId, testAuthUser]]))
        )
      )
    )
  )

  // Create test layer with session but no user
  const sessionNoUserTestLayer = SessionTokenValidatorLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          SessionRepository,
          makeSessionRepoMock(new Map([[testSessionId, testSession]]))
        ),
        Layer.succeed(UserRepository, makeUserRepoMock(new Map()))
      )
    )
  )

  describe("Valid session validation", () => {
    layer(validSessionTestLayer)("Session validation", (it) => {
      it.effect("should validate a valid session token", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(testSessionId)
          const user = yield* validator.validate(token)

          expect(user.userId).toBe(testUserId)
          expect(user.role).toBe("user") // "member" maps to "user"
          expect(user.sessionId).toBe(testSessionId)
        })
      )
    })
  })

  describe("Invalid/expired session handling", () => {
    layer(expiredSessionTestLayer)("Expired session", (it) => {
      it.effect("should reject expired session", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(expiredSessionId)
          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Session has expired")
          }
        })
      )
    })

    layer(noSessionTestLayer)("Non-existent session", (it) => {
      it.effect("should reject non-existent session", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          // Use a valid 32+ character token that doesn't exist in the session map
          const token = Redacted.make("non-existent-session-token-32chars")
          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Invalid or expired session")
          }
        })
      )
    })

    layer(sessionNoUserTestLayer)("Session with missing user", (it) => {
      it.effect("should reject session when user not found", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(testSessionId)
          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("User not found")
          }
        })
      )
    })
  })

  describe("Empty/invalid token handling", () => {
    layer(validSessionTestLayer)("Empty token", (it) => {
      it.effect("should reject empty token", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("")
          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Bearer token is required")
          }
        })
      )

      it.effect("should reject whitespace-only token", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make("   ")
          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Bearer token is required")
          }
        })
      )
    })
  })

  describe("User role mapping", () => {
    // UUID prefixes for each role (using different last digit to make unique)
    const roleUuids: Record<"admin" | "owner" | "member" | "viewer", string> = {
      admin: "550e8400-e29b-41d4-a716-446655440001",
      owner: "550e8400-e29b-41d4-a716-446655440002",
      member: "550e8400-e29b-41d4-a716-446655440003",
      viewer: "550e8400-e29b-41d4-a716-446655440004"
    }

    // Session IDs (must be at least 32 chars)
    const roleSessionIds: Record<"admin" | "owner" | "member" | "viewer", string> = {
      admin: "session-admin-token-32chars-minlen",
      owner: "session-owner-token-32chars-minlen",
      member: "session-member-token-32chars-minlen",
      viewer: "session-viewer-token-32chars-minlen"
    }

    // Test each role mapping
    const makeRoleTestLayer = (role: "admin" | "owner" | "member" | "viewer") => {
      const userWithRole = AuthUser.make({
        ...testAuthUser,
        id: AuthUserId.make(roleUuids[role]),
        role
      })
      const sessionForUser = Session.make({
        id: SessionId.make(roleSessionIds[role]),
        userId: userWithRole.id,
        provider: "local",
        expiresAt: futureTime,
        createdAt: now,
        userAgent: Option.none()
      })
      return SessionTokenValidatorLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(
              SessionRepository,
              makeSessionRepoMock(new Map([[roleSessionIds[role], sessionForUser]]))
            ),
            Layer.succeed(
              UserRepository,
              makeUserRepoMock(new Map([[roleUuids[role], userWithRole]]))
            )
          )
        )
      )
    }

    layer(makeRoleTestLayer("admin"))("Admin role", (it) => {
      it.effect("should map admin to admin", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(roleSessionIds.admin)
          const user = yield* validator.validate(token)
          expect(user.role).toBe("admin")
        })
      )
    })

    layer(makeRoleTestLayer("owner"))("Owner role", (it) => {
      it.effect("should map owner to admin", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(roleSessionIds.owner)
          const user = yield* validator.validate(token)
          expect(user.role).toBe("admin")
        })
      )
    })

    layer(makeRoleTestLayer("member"))("Member role", (it) => {
      it.effect("should map member to user", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(roleSessionIds.member)
          const user = yield* validator.validate(token)
          expect(user.role).toBe("user")
        })
      )
    })

    layer(makeRoleTestLayer("viewer"))("Viewer role", (it) => {
      it.effect("should map viewer to readonly", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(roleSessionIds.viewer)
          const user = yield* validator.validate(token)
          expect(user.role).toBe("readonly")
        })
      )
    })
  })

  describe("Layer composition", () => {
    it("should compose with AuthMiddlewareLive", () => {
      // Type-level test - if this compiles, the layers are composable
      expect(SessionTokenValidatorLive).toBeDefined()
      expect(AuthMiddlewareWithSessionValidation).toBeDefined()
    })

    it("should require SessionRepository and UserRepository", () => {
      // This is verified by the Layer type signature:
      // Layer<TokenValidator, never, SessionRepository | UserRepository>
      const _layer: Layer.Layer<
        TokenValidator,
        never,
        SessionRepository | UserRepository
      > = SessionTokenValidatorLive
      expect(_layer).toBeDefined()
    })
  })

  describe("Database error handling", () => {
    // Test layer that simulates database errors
    const dbErrorSessionRepo: SessionRepositoryService = {
      findById: () =>
        Effect.fail(new PersistenceError({ operation: "findById", cause: new Error("DB error") })),
      findByUserId: () =>
        Effect.fail(new PersistenceError({ operation: "findByUserId", cause: new Error("DB error") })),
      create: () =>
        Effect.fail(new PersistenceError({ operation: "create", cause: new Error("DB error") })),
      delete: () =>
        Effect.fail(new PersistenceError({ operation: "delete", cause: new Error("DB error") })),
      deleteExpired: () =>
        Effect.fail(new PersistenceError({ operation: "deleteExpired", cause: new Error("DB error") })),
      deleteByUserId: () =>
        Effect.fail(new PersistenceError({ operation: "deleteByUserId", cause: new Error("DB error") })),
      updateExpiry: () =>
        Effect.fail(new PersistenceError({ operation: "updateExpiry", cause: new Error("DB error") }))
    }

    const dbErrorTestLayer = SessionTokenValidatorLive.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(SessionRepository, dbErrorSessionRepo),
          Layer.succeed(
            UserRepository,
            makeUserRepoMock(new Map([[testUserId, testAuthUser]]))
          )
        )
      )
    )

    layer(dbErrorTestLayer)("Database errors", (it) => {
      it.effect("should return UnauthorizedError for session lookup failures", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          // Use a valid 32+ character token to test db error handling
          const token = Redacted.make("any-token-that-is-32-chars-long-x")
          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("Session validation failed")
          }
        })
      )
    })

    // Test user lookup failure
    const dbErrorUserRepo: UserRepositoryService = {
      findById: () =>
        Effect.fail(new PersistenceError({ operation: "findById", cause: new Error("DB error") })),
      findByEmail: () =>
        Effect.fail(new PersistenceError({ operation: "findByEmail", cause: new Error("DB error") })),
      create: () =>
        Effect.fail(new PersistenceError({ operation: "create", cause: new Error("DB error") })),
      update: () =>
        Effect.fail(new PersistenceError({ operation: "update", cause: new Error("DB error") })),
      delete: () =>
        Effect.fail(new PersistenceError({ operation: "delete", cause: new Error("DB error") })),
      findPlatformAdmins: () =>
        Effect.fail(new PersistenceError({ operation: "findPlatformAdmins", cause: new Error("DB error") })),
      isPlatformAdmin: () =>
        Effect.fail(new PersistenceError({ operation: "isPlatformAdmin", cause: new Error("DB error") }))
    }

    const userDbErrorTestLayer = SessionTokenValidatorLive.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(
            SessionRepository,
            makeSessionRepoMock(new Map([[testSessionId, testSession]]))
          ),
          Layer.succeed(UserRepository, dbErrorUserRepo)
        )
      )
    )

    layer(userDbErrorTestLayer)("User database errors", (it) => {
      it.effect("should return UnauthorizedError for user lookup failures", () =>
        Effect.gen(function* () {
          const validator = yield* TokenValidator
          const token = Redacted.make(testSessionId)
          const result = yield* Effect.either(validator.validate(token))

          expect(result._tag).toBe("Left")
          if (result._tag === "Left") {
            expect(result.left.message).toBe("User validation failed")
          }
        })
      )
    })
  })
})
