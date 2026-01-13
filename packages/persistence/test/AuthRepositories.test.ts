/**
 * Auth Repository Integration Tests
 *
 * Tests for authentication-related repository implementations against a testcontainers
 * PostgreSQL database. Uses the MigrationLayer to set up the schema before running tests.
 *
 * @module test/AuthRepositories
 */

import { SqlClient } from "@effect/sql"
import { describe, expect, it } from "@effect/vitest"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { AuthUserId } from "@accountability/core/Auth/AuthUserId"
import { SessionId } from "@accountability/core/Auth/SessionId"
import { Email } from "@accountability/core/Auth/Email"
import { Timestamp } from "@accountability/core/Domains/Timestamp"
import { UserRepository, type AuthUserInsert } from "../src/Services/UserRepository.ts"
import { UserRepositoryLive } from "../src/Layers/UserRepositoryLive.ts"
import { SessionRepository, type SessionInsert } from "../src/Services/SessionRepository.ts"
import { SessionRepositoryLive } from "../src/Layers/SessionRepositoryLive.ts"
import { MigrationLayer } from "../src/Layers/MigrationsLive.ts"
import { SharedPgClientLive } from "./Utils.ts"

/**
 * Layer with migrations and auth repositories
 */
const TestLayer = Layer.mergeAll(
  UserRepositoryLive,
  SessionRepositoryLive
).pipe(
  Layer.provideMerge(MigrationLayer),
  Layer.provideMerge(SharedPgClientLive)
)

// Test IDs for auth entities
const testUserId = AuthUserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
const testUserId2 = AuthUserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab")
// Session IDs must be at least 32 chars in base64url format
const testSessionId = SessionId.make("session_test_01234567890123456789")
const testSessionId2 = SessionId.make("session_test_12345678901234567890")
const testSessionId3 = SessionId.make("session_test_23456789012345678901")
const testSessionIdExpired = SessionId.make("session_expired_012345678901234567")
const nonExistentSessionId = SessionId.make("session_nonexistent_0123456789012")

describe("AuthRepositories", () => {
  // ============================================================================
  // SessionRepository Tests
  // ============================================================================
  it.layer(TestLayer, { timeout: "60 seconds" })("SessionRepository", (it) => {
    // Setup: Create test users first (sessions need user references)
    it.effect("setup: create test users", () =>
      Effect.gen(function* () {
        const userRepo = yield* UserRepository

        const user1: AuthUserInsert = {
          id: testUserId,
          email: Email.make("session.test@example.com"),
          displayName: "Session Test User",
          role: "member",
          primaryProvider: "local"
        }
        yield* userRepo.create(user1)

        const user2: AuthUserInsert = {
          id: testUserId2,
          email: Email.make("session.test2@example.com"),
          displayName: "Session Test User 2",
          role: "member",
          primaryProvider: "local"
        }
        yield* userRepo.create(user2)
      })
    )

    it.effect("create: creates a new session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 }) // 1 hour from now

        const session: SessionInsert = {
          id: testSessionId,
          userId: testUserId,
          provider: "local",
          expiresAt,
          userAgent: Option.some("TestBrowser/1.0")
        }

        const created = yield* repo.create(session)
        expect(created.id).toBe(testSessionId)
        expect(created.userId).toBe(testUserId)
        expect(created.provider).toBe("local")
        expect(Option.isSome(created.userAgent)).toBe(true)
        if (Option.isSome(created.userAgent)) {
          expect(created.userAgent.value).toBe("TestBrowser/1.0")
        }
      })
    )

    it.effect("create: creates a session without user agent", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })

        const session: SessionInsert = {
          id: testSessionId2,
          userId: testUserId,
          provider: "google",
          expiresAt,
          userAgent: Option.none()
        }

        const created = yield* repo.create(session)
        expect(created.id).toBe(testSessionId2)
        expect(Option.isNone(created.userAgent)).toBe(true)
      })
    )

    it.effect("findById: returns Some for existing session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const result = yield* repo.findById(testSessionId)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(testSessionId)
          expect(result.value.userId).toBe(testUserId)
        }
      })
    )

    it.effect("findById: returns None for non-existing session", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const result = yield* repo.findById(nonExistentSessionId)
        expect(Option.isNone(result)).toBe(true)
      })
    )

    it.effect("findByUserId: returns all sessions for user", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sessions = yield* repo.findByUserId(testUserId)
        expect(Chunk.size(sessions)).toBeGreaterThanOrEqual(2)
        // All sessions should belong to the same user
        for (const session of sessions) {
          expect(session.userId).toBe(testUserId)
        }
      })
    )

    it.effect("findByUserId: returns empty chunk for user with no sessions", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sessions = yield* repo.findByUserId(testUserId2)
        expect(Chunk.isEmpty(sessions)).toBe(true)
      })
    )

    it.effect("updateExpiry: updates session expiration time", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const newExpiresAt = Timestamp.make({ epochMillis: Date.now() + 7200000 }) // 2 hours from now

        const updated = yield* repo.updateExpiry(testSessionId, newExpiresAt)
        expect(updated.id).toBe(testSessionId)
        expect(updated.expiresAt.epochMillis).toBe(newExpiresAt.epochMillis)
      })
    )

    it.effect("updateExpiry: throws EntityNotFoundError for non-existing session", () =>
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

    it.effect("delete: deletes a session by ID", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository

        // Create a session to delete
        const expiresAt = Timestamp.make({ epochMillis: Date.now() + 3600000 })
        const session: SessionInsert = {
          id: testSessionId3,
          userId: testUserId,
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

    it.effect("deleteExpired: deletes expired sessions", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sql = yield* SqlClient.SqlClient

        // Manually insert an expired session (bypassing validation)
        const expiredDate = new Date(Date.now() - 3600000) // 1 hour ago
        yield* sql`
          INSERT INTO auth_sessions (id, user_id, provider, expires_at, created_at)
          VALUES (${testSessionIdExpired}, ${testUserId}, 'local', ${expiredDate}, NOW())
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

    it.effect("deleteByUserId: deletes all sessions for a user", () =>
      Effect.gen(function* () {
        const repo = yield* SessionRepository
        const sql = yield* SqlClient.SqlClient

        // Create a user with multiple sessions to delete
        const deleteTestUserId = AuthUserId.make("dddddddd-dddd-dddd-dddd-dddddddddddd")
        yield* sql`
          INSERT INTO auth_users (id, email, display_name, role, primary_provider, created_at, updated_at)
          VALUES (${deleteTestUserId}, 'delete.test@example.com', 'Delete Test User', 'member', 'local', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `

        // Create sessions for this user
        const session1Id = SessionId.make("delete_test_session_01234567890123")
        const session2Id = SessionId.make("delete_test_session_12345678901234")
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

    it.effect("session expiration check: isExpired works correctly", () =>
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
  })
})
