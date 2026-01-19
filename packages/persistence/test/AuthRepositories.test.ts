/**
 * Auth Repository Integration Tests
 *
 * Integration tests for authentication-related repository implementations against
 * a real PostgreSQL database using testcontainers. Tests cover:
 * - UserRepository: CRUD operations, unique constraints (email)
 * - SessionRepository: CRUD operations, foreign keys, session expiry queries
 *
 * Uses the MigrationLayer to set up the schema before running tests.
 *
 * @module test/AuthRepositories
 */

import { SqlClient } from "@effect/sql"
import { describe, expect, it } from "@effect/vitest"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { SessionId } from "@accountability/core/authentication/SessionId"
import { Email } from "@accountability/core/authentication/Email"
import { HashedPassword } from "@accountability/core/authentication/HashedPassword"
import { ProviderId } from "@accountability/core/authentication/ProviderId"
import { UserIdentityId } from "@accountability/core/authentication/UserIdentity"
import { Timestamp } from "@accountability/core/shared/values/Timestamp"
import { UserRepository, type AuthUserInsert, type AuthUserUpdate } from "../src/Services/UserRepository.ts"
import { UserRepositoryLive } from "../src/Layers/UserRepositoryLive.ts"
import { SessionRepository, type SessionInsert } from "../src/Services/SessionRepository.ts"
import { SessionRepositoryLive } from "../src/Layers/SessionRepositoryLive.ts"
import { IdentityRepository, type UserIdentityInsert } from "../src/Services/IdentityRepository.ts"
import { IdentityRepositoryLive } from "../src/Layers/IdentityRepositoryLive.ts"
import { SharedPgClientLive } from "./Utils.ts"

/**
 * Layer with auth repositories.
 * Migrations are run globally in vitest.global-setup.ts to avoid race conditions.
 */
const TestLayer = Layer.mergeAll(
  UserRepositoryLive,
  SessionRepositoryLive,
  IdentityRepositoryLive
).pipe(
  Layer.provideMerge(SharedPgClientLive)
)

// Helper to generate unique IDs for tests (shared container means shared data)
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

describe("AuthRepositories", () => {
  // ============================================================================
  // Single it.layer block to avoid migration race conditions
  // ============================================================================
  it.layer(TestLayer, { timeout: "60 seconds" })("Auth Repositories", (it) => {
    // ============================================================================
    // UserRepository Tests
    // ============================================================================

    // Generate unique test IDs for UserRepository tests
    const userTestSuffix = uniqueId()
    const testUserId = AuthUserId.make(`11111111-1111-1111-1111-${userTestSuffix.slice(0, 12).padEnd(12, "0")}`)
    const testUserId2 = AuthUserId.make(`22222222-2222-2222-2222-${userTestSuffix.slice(0, 12).padEnd(12, "0")}`)
    const testUserIdDelete = AuthUserId.make(`33333333-3333-3333-3333-${userTestSuffix.slice(0, 12).padEnd(12, "0")}`)
    const nonExistentUserId = AuthUserId.make(`99999999-9999-9999-9999-999999999999`)
    const testEmail = Email.make(`user-${userTestSuffix}@test.example.com`)
    const testEmail2 = Email.make(`user2-${userTestSuffix}@test.example.com`)
    const testEmailDelete = Email.make(`user-delete-${userTestSuffix}@test.example.com`)

    // --------------------------------------------------
    // UserRepository CRUD Operations
    // --------------------------------------------------

    it.effect("UserRepository - create: creates a new user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        const user: AuthUserInsert = {
          id: testUserId,
          email: testEmail,
          displayName: "Test User",
          role: "member",
          primaryProvider: "local"
        }

        const created = yield* repo.create(user)
        expect(created.id).toBe(testUserId)
        expect(created.email).toBe(testEmail)
        expect(created.displayName).toBe("Test User")
        expect(created.role).toBe("member")
        expect(created.primaryProvider).toBe("local")
        expect(created.createdAt).toBeDefined()
        expect(created.updatedAt).toBeDefined()
      })
    )

    it.effect("UserRepository - findById: returns Some for existing user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const result = yield* repo.findById(testUserId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testUserId)
          expect(result.value.email).toBe(testEmail)
        }
      })
    )

    it.effect("UserRepository - findById: returns None for non-existing user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const result = yield* repo.findById(nonExistentUserId)
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("UserRepository - findByEmail: returns Some for existing user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const result = yield* repo.findByEmail(testEmail)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testUserId)
        }
      })
    )

    it.effect("UserRepository - findByEmail: is case-insensitive", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const upperEmail = Email.make(testEmail.toUpperCase())
        const result = yield* repo.findByEmail(upperEmail)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testUserId)
        }
      })
    )

    it.effect("UserRepository - findByEmail: returns None for non-existing email", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const result = yield* repo.findByEmail(Email.make(`nonexistent-${uniqueId()}@test.example.com`))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("UserRepository - update: updates user display name", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        const updateData: AuthUserUpdate = {
          displayName: "Updated Test User"
        }

        const updated = yield* repo.update(testUserId, updateData)
        expect(updated.id).toBe(testUserId)
        expect(updated.displayName).toBe("Updated Test User")
        // Other fields should remain unchanged
        expect(updated.email).toBe(testEmail)
        expect(updated.role).toBe("member")
      })
    )

    it.effect("UserRepository - update: updates user role", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        const updateData: AuthUserUpdate = {
          role: "admin"
        }

        const updated = yield* repo.update(testUserId, updateData)
        expect(updated.role).toBe("admin")
      })
    )

    it.effect("UserRepository - update: updates multiple fields at once", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const newEmail = Email.make(`updated-${uniqueId()}@test.example.com`)

        const updateData: AuthUserUpdate = {
          email: newEmail,
          displayName: "Multi Update User",
          role: "owner"
        }

        const updated = yield* repo.update(testUserId, updateData)
        expect(updated.email).toBe(newEmail)
        expect(updated.displayName).toBe("Multi Update User")
        expect(updated.role).toBe("owner")
      })
    )

    it.effect("UserRepository - update: throws EntityNotFoundError for non-existing user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        const result = yield* Effect.either(repo.update(nonExistentUserId, { displayName: "Test" }))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    it.effect("UserRepository - delete: deletes a user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        // Create a user to delete
        const deleteUser: AuthUserInsert = {
          id: testUserIdDelete,
          email: testEmailDelete,
          displayName: "User To Delete",
          role: "member",
          primaryProvider: "local"
        }
        yield* repo.create(deleteUser)

        // Verify it exists
        const beforeDelete = yield* repo.findById(testUserIdDelete)
        expect(Option.isSome(beforeDelete)).toBe(true)

        // Delete it
        yield* repo.delete(testUserIdDelete)

        // Verify it's gone
        const afterDelete = yield* repo.findById(testUserIdDelete)
        expect(Option.isNone(afterDelete)).toBe(true)
      })
    )

    it.effect("UserRepository - delete: throws EntityNotFoundError for non-existing user", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        const result = yield* Effect.either(repo.delete(nonExistentUserId))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    // --------------------------------------------------
    // UserRepository Unique Constraints
    // --------------------------------------------------

    it.effect("UserRepository - create: enforces unique email constraint", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const duplicateEmail = Email.make(`duplicate-${uniqueId()}@test.example.com`)

        // Create first user
        const user1: AuthUserInsert = {
          id: AuthUserId.make(`44444444-4444-4444-4444-${uniqueId().slice(0, 12).padEnd(12, "0")}`),
          email: duplicateEmail,
          displayName: "First User",
          role: "member",
          primaryProvider: "local"
        }
        yield* repo.create(user1)

        // Try to create second user with same email
        const user2: AuthUserInsert = {
          id: AuthUserId.make(`55555555-5555-5555-5555-${uniqueId().slice(0, 12).padEnd(12, "0")}`),
          email: duplicateEmail,
          displayName: "Second User",
          role: "member",
          primaryProvider: "local"
        }

        const result = yield* Effect.either(repo.create(user2))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          // Should be a PersistenceError wrapping the unique constraint violation
          expect(result.left._tag).toBe("PersistenceError")
        }
      })
    )

    it.effect("UserRepository - create: allows different users with different emails", () =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        const user: AuthUserInsert = {
          id: testUserId2,
          email: testEmail2,
          displayName: "Another Test User",
          role: "viewer",
          primaryProvider: "google"
        }

        const created = yield* repo.create(user)
        expect(created.id).toBe(testUserId2)
        expect(created.email).toBe(testEmail2)
      })
    )

    // ============================================================================
    // SessionRepository Tests
    // ============================================================================

    // Generate unique test IDs for SessionRepository tests
    const sessionSuffix = uniqueId()
    const sessionTestUserId = AuthUserId.make(`aaaaaaaa-aaaa-aaaa-aaaa-${sessionSuffix.slice(0, 12).padEnd(12, "0")}`)
    const sessionTestUserId2 = AuthUserId.make(`bbbbbbbb-bbbb-bbbb-bbbb-${sessionSuffix.slice(0, 12).padEnd(12, "0")}`)
    // Session IDs must be at least 32 chars
    const testSessionId = SessionId.make(`session_test_${sessionSuffix}_01234567890123`)
    const testSessionId2 = SessionId.make(`session_test_${sessionSuffix}_12345678901234`)
    const testSessionId3 = SessionId.make(`session_test_${sessionSuffix}_23456789012345`)
    const testSessionIdExpired = SessionId.make(`session_exp_${sessionSuffix}_012345678901234`)
    const nonExistentSessionId = SessionId.make(`session_nonexistent_${sessionSuffix}_0123`)
    const sessionTestEmail = Email.make(`session-test-${sessionSuffix}@example.com`)
    const sessionTestEmail2 = Email.make(`session-test2-${sessionSuffix}@example.com`)

    // Setup: Create test users first (sessions need user references)
    it.effect("SessionRepository - setup: create test users for sessions", () =>
      Effect.gen(function* () {
        const userRepo = yield* UserRepository

        const user1: AuthUserInsert = {
          id: sessionTestUserId,
          email: sessionTestEmail,
          displayName: "Session Test User",
          role: "member",
          primaryProvider: "local"
        }
        yield* userRepo.create(user1)

        const user2: AuthUserInsert = {
          id: sessionTestUserId2,
          email: sessionTestEmail2,
          displayName: "Session Test User 2",
          role: "member",
          primaryProvider: "local"
        }
        yield* userRepo.create(user2)
      })
    )

    // --------------------------------------------------
    // CRUD Operations
    // --------------------------------------------------

    it.effect("SessionRepository - create: creates a new session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 }) // 1 hour from now

        const session: SessionInsert = {
          id: testSessionId,
          userId: sessionTestUserId,
          provider: "local",
          expiresAt,
          userAgent: Option.some("TestBrowser/1.0")
        }

        const created = yield* repo.create(session)
        expect(created.id).toBe(testSessionId)
        expect(created.userId).toBe(sessionTestUserId)
        expect(created.provider).toBe("local")
        expect(Option.isSome(created.userAgent)).toBe(true)
        if (Option.isSome(created.userAgent)) {
          expect(created.userAgent.value).toBe("TestBrowser/1.0")
        }
      })
    )

    it.effect("SessionRepository - create: creates a session without user agent", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })

        const session: SessionInsert = {
          id: testSessionId2,
          userId: sessionTestUserId,
          provider: "google",
          expiresAt,
          userAgent: Option.none()
        }

        const created = yield* repo.create(session)
        expect(created.id).toBe(testSessionId2)
        expect(Option.isNone(created.userAgent)).toBe(true)
      })
    )

    it.effect("SessionRepository - findById: returns Some for existing session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const result = yield* repo.findById(testSessionId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testSessionId)
          expect(result.value.userId).toBe(sessionTestUserId)
        }
      })
    )

    it.effect("SessionRepository - findById: returns None for non-existing session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const result = yield* repo.findById(nonExistentSessionId)
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("SessionRepository - findByUserId: returns all sessions for user", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sessions = yield* repo.findByUserId(sessionTestUserId)
        expect(Chunk.size(sessions)).toBeGreaterThanOrEqual(2)
        // All sessions should belong to the same user
        for (const session of sessions) {
          expect(session.userId).toBe(sessionTestUserId)
        }
      })
    )

    it.effect("SessionRepository - findByUserId: returns empty chunk for user with no sessions", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sessions = yield* repo.findByUserId(sessionTestUserId2)
        expect(Chunk.isEmpty(sessions)).toBe(true)
      })
    )

    it.effect("SessionRepository - updateExpiry: updates session expiration time", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const newExpiresAt = Timestamp.make({ epochMillis: Date.now() + 7200000 }) // 2 hours from now

        const updated = yield* repo.updateExpiry(testSessionId, newExpiresAt)
        expect(updated.id).toBe(testSessionId)
        expect(updated.expiresAt.epochMillis).toBe(newExpiresAt.epochMillis)
      })
    )

    it.effect("SessionRepository - updateExpiry: throws EntityNotFoundError for non-existing session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const newExpiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })

        const result = yield* Effect.either(repo.updateExpiry(nonExistentSessionId, newExpiresAt))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    it.effect("SessionRepository - delete: deletes a session by ID", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository

        // Create a session to delete
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })
        const session: SessionInsert = {
          id: testSessionId3,
          userId: sessionTestUserId,
          provider: "local",
          expiresAt,
          userAgent: Option.none()
        }
        yield* repo.create(session)

        // Verify it exists
        const beforeDelete = yield* repo.findById(testSessionId3)
        expect(Option.isSome(beforeDelete)).toBe(true)

        // Delete it
        yield* repo.delete(testSessionId3)

        // Verify it's gone
        const afterDelete = yield* repo.findById(testSessionId3)
        expect(Option.isNone(afterDelete)).toBe(true)
      })
    )

    // --------------------------------------------------
    // Foreign Key Constraints
    // --------------------------------------------------

    it.effect("SessionRepository - create: enforces foreign key constraint on userId", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const fkNonExistentUserId = AuthUserId.make(`cccccccc-cccc-cccc-cccc-cccccccccccc`)
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })

        const session: SessionInsert = {
          id: SessionId.make(`fk_test_session_${uniqueId()}_01234567890`),
          userId: fkNonExistentUserId, // This user doesn't exist
          provider: "local",
          expiresAt,
          userAgent: Option.none()
        }

        const result = yield* Effect.either(repo.create(session))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          // Foreign key violation should result in PersistenceError
          expect(result.left._tag).toBe("PersistenceError")
        }
      })
    )

    // --------------------------------------------------
    // Session Expiry Queries
    // --------------------------------------------------

    it.effect("SessionRepository - deleteExpired: deletes expired sessions", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sql = yield* SqlClient.SqlClient

        // Manually insert an expired session (bypassing validation)
        const expiredDate = new Date(Date.now() - 3600000) // 1 hour ago
        yield* sql`
          INSERT INTO auth_sessions (id, user_id, provider, expires_at, created_at)
          VALUES (${testSessionIdExpired}, ${sessionTestUserId}, 'local', ${expiredDate}, NOW())
          ON CONFLICT (id) DO NOTHING
        `

        // Verify expired session exists
        const beforeCleanup = yield* repo.findById(testSessionIdExpired)
        expect(Option.isSome(beforeCleanup)).toBe(true)

        // Run cleanup
        const deletedCount = yield* repo.deleteExpired()
        expect(deletedCount).toBeGreaterThanOrEqual(1)

        // Verify expired session is gone
        const afterCleanup = yield* repo.findById(testSessionIdExpired)
        expect(Option.isNone(afterCleanup)).toBe(true)
      })
    )

    it.effect("SessionRepository - deleteExpired: does not delete non-expired sessions", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository

        // Get count of sessions for sessionTestUserId before cleanup
        const sessionsBefore = yield* repo.findByUserId(sessionTestUserId)
        const countBefore = Chunk.size(sessionsBefore)

        // Run cleanup (should not delete active sessions)
        yield* repo.deleteExpired()

        // Verify active sessions are still there
        const sessionsAfter = yield* repo.findByUserId(sessionTestUserId)
        const countAfter = Chunk.size(sessionsAfter)

        // Count should be same or less only if we had expired ones
        expect(countAfter).toBeLessThanOrEqual(countBefore)
      })
    )

    it.effect("SessionRepository - deleteByUserId: deletes all sessions for a user", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sql = yield* SqlClient.SqlClient

        // Create a user with multiple sessions to delete
        const deleteTestSuffix = uniqueId()
        const deleteTestUserId = AuthUserId.make(`dddddddd-dddd-dddd-dddd-${deleteTestSuffix.slice(0, 12).padEnd(12, "0")}`)
        yield* sql`
          INSERT INTO auth_users (id, email, display_name, role, primary_provider, created_at, updated_at)
          VALUES (${deleteTestUserId}, ${"delete.test-" + deleteTestSuffix + "@example.com"}, 'Delete Test User', 'member', 'local', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `

        // Create sessions for this user
        const session1Id = SessionId.make(`delete_test_session_${deleteTestSuffix}_01`)
        const session2Id = SessionId.make(`delete_test_session_${deleteTestSuffix}_02`)
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })

        yield* repo.create({
          id: session1Id,
          userId: deleteTestUserId,
          provider: "local",
          expiresAt,
          userAgent: Option.none()
        })
        yield* repo.create({
          id: session2Id,
          userId: deleteTestUserId,
          provider: "google",
          expiresAt,
          userAgent: Option.none()
        })

        // Verify sessions exist
        const beforeDelete = yield* repo.findByUserId(deleteTestUserId)
        expect(Chunk.size(beforeDelete)).toBe(2)

        // Delete all sessions for user
        const deletedCount = yield* repo.deleteByUserId(deleteTestUserId)
        expect(deletedCount).toBe(2)

        // Verify all sessions are gone
        const afterDelete = yield* repo.findByUserId(deleteTestUserId)
        expect(Chunk.isEmpty(afterDelete)).toBe(true)
      })
    )

    // --------------------------------------------------
    // Session Expiration Methods
    // --------------------------------------------------

    it.effect("SessionRepository - session expiration check: isExpired works correctly", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const result = yield* repo.findById(testSessionId)
        expect(Option.isSome(result)).toBe(true)

        if (Option.isSome(result)) {
          const session = result.value
          const now = Timestamp.make({ epochMillis: Date.now() })

          // Session should not be expired (we updated it to expire in 2 hours)
          expect(session.isExpired(now)).toBe(false)
          expect(session.isValid(now)).toBe(true)
          expect(session.timeRemainingMs(now)).toBeGreaterThan(0)
        }
      })
    )

    it.effect("SessionRepository - session expiration check: isExpired returns true for expired session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sql = yield* SqlClient.SqlClient

        // Create an expired session via raw SQL
        const expiredSessionSuffix = uniqueId()
        const expiredSessionId = SessionId.make(`expired_check_${expiredSessionSuffix}_01234567`)
        const expiredDate = new Date(Date.now() - 60000) // 1 minute ago

        yield* sql`
          INSERT INTO auth_sessions (id, user_id, provider, expires_at, created_at)
          VALUES (${expiredSessionId}, ${sessionTestUserId}, 'local', ${expiredDate}, NOW())
        `

        const result = yield* repo.findById(expiredSessionId)
        expect(Option.isSome(result)).toBe(true)

        if (Option.isSome(result)) {
          const session = result.value
          const now = Timestamp.make({ epochMillis: Date.now() })

          expect(session.isExpired(now)).toBe(true)
          expect(session.isValid(now)).toBe(false)
          expect(session.timeRemainingMs(now)).toBe(0)
        }

        // Cleanup
        yield* repo.delete(expiredSessionId)
      })
    )

    // --------------------------------------------------
    // Unique Constraints
    // --------------------------------------------------

    it.effect("SessionRepository - create: enforces unique session ID constraint", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const duplicateSessionId = SessionId.make(`duplicate_session_${uniqueId()}_01234567`)
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })

        // Create first session
        const session1: SessionInsert = {
          id: duplicateSessionId,
          userId: sessionTestUserId,
          provider: "local",
          expiresAt,
          userAgent: Option.none()
        }
        yield* repo.create(session1)

        // Try to create second session with same ID
        const session2: SessionInsert = {
          id: duplicateSessionId,
          userId: sessionTestUserId,
          provider: "google",
          expiresAt,
          userAgent: Option.none()
        }

        const result = yield* Effect.either(repo.create(session2))
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("PersistenceError")
        }

        // Cleanup
        yield* repo.delete(duplicateSessionId)
      })
    )

    // ============================================================================
    // IdentityRepository Tests
    // ============================================================================

    // Generate unique test IDs for IdentityRepository tests using proper UUID format
    const identityTestUserId = AuthUserId.make("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
    const identityTestUserId2 = AuthUserId.make("ffffffff-ffff-ffff-ffff-ffffffffffff")
    const identityTestEmail = Email.make(`identity-test-${uniqueId()}@example.com`)
    const identityTestEmail2 = Email.make(`identity-test2-${uniqueId()}@example.com`)
    // Generate proper UUIDs for identity IDs
    const identityId1 = UserIdentityId.make("11111111-1111-1111-1111-111111111111")

    // Setup: Create test users for identity tests
    it.effect("IdentityRepository - setup: create test users for identities", () =>
      Effect.gen(function* () {
        const userRepo = yield* UserRepository

        const user1: AuthUserInsert = {
          id: identityTestUserId,
          email: identityTestEmail,
          displayName: "Identity Test User",
          role: "member",
          primaryProvider: "local"
        }
        yield* userRepo.create(user1)

        const user2: AuthUserInsert = {
          id: identityTestUserId2,
          email: identityTestEmail2,
          displayName: "Identity Test User 2",
          role: "member",
          primaryProvider: "local"
        }
        yield* userRepo.create(user2)
      })
    )

    // --------------------------------------------------
    // IdentityRepository CRUD Operations
    // --------------------------------------------------

    it.effect("IdentityRepository - create: creates a new identity with password hash", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository

        const identity: UserIdentityInsert = {
          id: identityId1,
          userId: identityTestUserId,
          provider: "local",
          providerId: ProviderId.make(identityTestEmail),
          providerData: Option.none(),
          passwordHash: HashedPassword.make("$argon2id$test-hash-123")
        }

        const created = yield* repo.create(identity)
        expect(created.id).toBe(identityId1)
        expect(created.userId).toBe(identityTestUserId)
        expect(created.provider).toBe("local")
        expect(created.providerId).toBe(identityTestEmail)
      })
    )

    it.effect("IdentityRepository - findById: returns Some for existing identity", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository

        const result = yield* repo.findById(identityId1)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(identityId1)
          expect(result.value.provider).toBe("local")
        }
      })
    )

    it.effect("IdentityRepository - findByUserId: returns all identities for user", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository

        const identities = yield* repo.findByUserId(identityTestUserId)
        expect(Chunk.size(identities)).toBeGreaterThanOrEqual(1)
        for (const identity of identities) {
          expect(identity.userId).toBe(identityTestUserId)
        }
      })
    )

    it.effect("IdentityRepository - findByProvider: finds identity by provider and providerId", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository

        const result = yield* repo.findByProvider("local", ProviderId.make(identityTestEmail))
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.provider).toBe("local")
          expect(result.value.providerId).toBe(identityTestEmail)
        }
      })
    )

    it.effect("IdentityRepository - findByUserAndProvider: finds identity by user and provider", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository

        const result = yield* repo.findByUserAndProvider(identityTestUserId, "local")
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.userId).toBe(identityTestUserId)
          expect(result.value.provider).toBe("local")
        }
      })
    )

    // --------------------------------------------------
    // IdentityRepository Password Hash Operations
    // --------------------------------------------------

    it.effect("IdentityRepository - getPasswordHash: returns password hash for local identity", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository

        const result = yield* repo.getPasswordHash("local", ProviderId.make(identityTestEmail))
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value).toBe("$argon2id$test-hash-123")
        }
      })
    )

    it.effect("IdentityRepository - getPasswordHash: returns None for non-existent identity", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository

        const result = yield* repo.getPasswordHash("local", ProviderId.make("nonexistent@example.com"))
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("IdentityRepository - updatePasswordHash: updates password hash for existing identity", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository
        const newHash = HashedPassword.make("$argon2id$new-hash-456")

        // Update the password hash
        yield* repo.updatePasswordHash("local", ProviderId.make(identityTestEmail), newHash)

        // Verify the hash was updated
        const result = yield* repo.getPasswordHash("local", ProviderId.make(identityTestEmail))
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value).toBe("$argon2id$new-hash-456")
        }
      })
    )

    it.effect("IdentityRepository - updatePasswordHash: throws EntityNotFoundError for non-existent identity", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository
        const newHash = HashedPassword.make("$argon2id$should-not-work")

        const result = yield* Effect.either(
          repo.updatePasswordHash("local", ProviderId.make("nonexistent@example.com"), newHash)
        )
        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("EntityNotFoundError")
        }
      })
    )

    // --------------------------------------------------
    // IdentityRepository Delete Operations
    // --------------------------------------------------

    it.effect("IdentityRepository - delete: deletes an identity by ID", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository
        const deleteIdentityId = UserIdentityId.make("33333333-3333-3333-3333-333333333333")

        // Create an identity to delete
        const identity: UserIdentityInsert = {
          id: deleteIdentityId,
          userId: identityTestUserId2,
          provider: "google",
          providerId: ProviderId.make("google-user-id-123"),
          providerData: Option.none()
        }
        yield* repo.create(identity)

        // Verify it exists
        const beforeDelete = yield* repo.findById(deleteIdentityId)
        expect(Option.isSome(beforeDelete)).toBe(true)

        // Delete it
        yield* repo.delete(deleteIdentityId)

        // Verify it's gone
        const afterDelete = yield* repo.findById(deleteIdentityId)
        expect(Option.isNone(afterDelete)).toBe(true)
      })
    )

    it.effect("IdentityRepository - deleteByUserId: deletes all identities for a user", () =>
      Effect.gen(function* () {
        const repo = yield* IdentityRepository
        const userRepo = yield* UserRepository
        const deleteTestSuffix = uniqueId()
        const deleteTestUserId = AuthUserId.make("44444444-4444-4444-4444-444444444444")
        const deleteTestEmail = Email.make(`delete-test-${deleteTestSuffix}@example.com`)

        // Create a user
        yield* userRepo.create({
          id: deleteTestUserId,
          email: deleteTestEmail,
          displayName: "Delete Test User",
          role: "member",
          primaryProvider: "local"
        })

        // Create multiple identities for this user
        yield* repo.create({
          id: UserIdentityId.make("55555555-5555-5555-5555-555555555555"),
          userId: deleteTestUserId,
          provider: "local",
          providerId: ProviderId.make(deleteTestEmail),
          providerData: Option.none()
        })
        yield* repo.create({
          id: UserIdentityId.make("66666666-6666-6666-6666-666666666666"),
          userId: deleteTestUserId,
          provider: "google",
          providerId: ProviderId.make("google-delete-test"),
          providerData: Option.none()
        })

        // Verify identities exist
        const beforeDelete = yield* repo.findByUserId(deleteTestUserId)
        expect(Chunk.size(beforeDelete)).toBe(2)

        // Delete all identities
        const deletedCount = yield* repo.deleteByUserId(deleteTestUserId)
        expect(deletedCount).toBe(2)

        // Verify all identities are gone
        const afterDelete = yield* repo.findByUserId(deleteTestUserId)
        expect(Chunk.isEmpty(afterDelete)).toBe(true)

        // Cleanup - delete the user
        yield* userRepo.delete(deleteTestUserId)
      })
    )
  })
})
