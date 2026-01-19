import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal } from "effect"
import * as Schema from "effect/Schema"
import {
  AuthUser,
  isAuthUser,
  UserRole,
  isUserRole
} from "../../src/authentication/AuthUser.ts"
import { AuthUserId } from "../../src/authentication/AuthUserId.ts"
import { Email } from "../../src/authentication/Email.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("UserRole", () => {
  describe("validation", () => {
    it.effect("accepts 'admin' role", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(UserRole)("admin")
        expect(decoded).toBe("admin")
      })
    )

    it.effect("accepts 'owner' role", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(UserRole)("owner")
        expect(decoded).toBe("owner")
      })
    )

    it.effect("accepts 'member' role", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(UserRole)("member")
        expect(decoded).toBe("member")
      })
    )

    it.effect("accepts 'viewer' role", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(UserRole)("viewer")
        expect(decoded).toBe("viewer")
      })
    )

    it.effect("rejects invalid roles", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(UserRole)
        const result = yield* Effect.exit(decode("superuser"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isUserRole returns true for valid roles", () => {
      expect(isUserRole("admin")).toBe(true)
      expect(isUserRole("owner")).toBe(true)
      expect(isUserRole("member")).toBe(true)
      expect(isUserRole("viewer")).toBe(true)
    })

    it("isUserRole returns false for invalid roles", () => {
      expect(isUserRole("invalid")).toBe(false)
      expect(isUserRole("Admin")).toBe(false)
    })
  })
})

describe("AuthUser", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  const createValidAuthUser = () =>
    AuthUser.make({
      id: AuthUserId.make(validUUID),
      email: Email.make("user@example.com"),
      displayName: "Test User",
      role: "member",
      primaryProvider: "local",
      createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
      updatedAt: Timestamp.make({ epochMillis: 1718409600000 })
    })

  describe("validation", () => {
    it.effect("accepts valid AuthUser data", () =>
      Effect.gen(function* () {
        const user = createValidAuthUser()
        expect(user.id).toBe(validUUID)
        expect(user.email).toBe("user@example.com")
        expect(user.displayName).toBe("Test User")
        expect(user.role).toBe("member")
        expect(user.primaryProvider).toBe("local")
      })
    )

    it.effect("accepts AuthUser with different roles", () =>
      Effect.gen(function* () {
        const admin = AuthUser.make({
          id: AuthUserId.make(validUUID),
          email: Email.make("admin@example.com"),
          displayName: "Admin User",
          role: "admin",
          primaryProvider: "workos",
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          updatedAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(admin.role).toBe("admin")
      })
    )

    it.effect("accepts AuthUser with different providers", () =>
      Effect.gen(function* () {
        const googleUser = AuthUser.make({
          id: AuthUserId.make(validUUID),
          email: Email.make("user@gmail.com"),
          displayName: "Google User",
          role: "member",
          primaryProvider: "google",
          createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
          updatedAt: Timestamp.make({ epochMillis: 1718409600000 })
        })
        expect(googleUser.primaryProvider).toBe("google")
      })
    )

    it.effect("rejects empty display name", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthUser)
        const result = yield* Effect.exit(decode({
          id: validUUID,
          email: "user@example.com",
          displayName: "",
          role: "member",
          primaryProvider: "local",
          createdAt: { epochMillis: 1718409600000 },
          updatedAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid email", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthUser)
        const result = yield* Effect.exit(decode({
          id: validUUID,
          email: "invalid-email",
          displayName: "Test User",
          role: "member",
          primaryProvider: "local",
          createdAt: { epochMillis: 1718409600000 },
          updatedAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid role", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthUser)
        const result = yield* Effect.exit(decode({
          id: validUUID,
          email: "user@example.com",
          displayName: "Test User",
          role: "superuser",
          primaryProvider: "local",
          createdAt: { epochMillis: 1718409600000 },
          updatedAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid provider", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthUser)
        const result = yield* Effect.exit(decode({
          id: validUUID,
          email: "user@example.com",
          displayName: "Test User",
          role: "member",
          primaryProvider: "facebook",
          createdAt: { epochMillis: 1718409600000 },
          updatedAt: { epochMillis: 1718409600000 }
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAuthUser returns true for AuthUser instances", () => {
      const user = createValidAuthUser()
      expect(isAuthUser(user)).toBe(true)
    })

    it("isAuthUser returns false for plain objects", () => {
      expect(isAuthUser({
        id: validUUID,
        email: "user@example.com",
        displayName: "Test User",
        role: "member",
        primaryProvider: "local",
        createdAt: { epochMillis: 1718409600000 },
        updatedAt: { epochMillis: 1718409600000 }
      })).toBe(false)
    })

    it("isAuthUser returns false for non-object values", () => {
      expect(isAuthUser(null)).toBe(false)
      expect(isAuthUser(undefined)).toBe(false)
      expect(isAuthUser("user")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for AuthUser", () => {
      const user1 = createValidAuthUser()
      const user2 = AuthUser.make({
        id: AuthUserId.make(validUUID),
        email: Email.make("user@example.com"),
        displayName: "Test User",
        role: "member",
        primaryProvider: "local",
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        updatedAt: Timestamp.make({ epochMillis: 1718409600000 })
      })
      const user3 = AuthUser.make({
        id: AuthUserId.make(anotherValidUUID),
        email: Email.make("other@example.com"),
        displayName: "Other User",
        role: "viewer",
        primaryProvider: "google",
        createdAt: Timestamp.make({ epochMillis: 1718409600000 }),
        updatedAt: Timestamp.make({ epochMillis: 1718409600000 })
      })

      expect(Equal.equals(user1, user2)).toBe(true)
      expect(Equal.equals(user1, user3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes AuthUser", () =>
      Effect.gen(function* () {
        const original = createValidAuthUser()
        const encoded = yield* Schema.encode(AuthUser)(original)
        const decoded = yield* Schema.decodeUnknown(AuthUser)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const user = createValidAuthUser()
        const encoded = yield* Schema.encode(AuthUser)(user)

        expect(encoded).toHaveProperty("id", validUUID)
        expect(encoded).toHaveProperty("email", "user@example.com")
        expect(encoded).toHaveProperty("displayName", "Test User")
        expect(encoded).toHaveProperty("role", "member")
        expect(encoded).toHaveProperty("primaryProvider", "local")
        expect(encoded).toHaveProperty("createdAt")
        expect(encoded).toHaveProperty("updatedAt")
      })
    )
  })
})
