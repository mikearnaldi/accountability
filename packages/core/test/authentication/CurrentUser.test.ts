import { describe, it, expect } from "@effect/vitest"
import { Effect } from "effect"
import * as Layer from "effect/Layer"
import {
  CurrentUser,
  getCurrentUser,
  withCurrentUser
} from "../../src/authentication/CurrentUser.ts"
import { AuthUser } from "../../src/authentication/AuthUser.ts"
import { AuthUserId } from "../../src/authentication/AuthUserId.ts"
import { Email } from "../../src/authentication/Email.ts"
import { Timestamp } from "../../src/shared/values/Timestamp.ts"

describe("CurrentUser", () => {
  // Helper to create a test user
  const createTestUser = (displayName: string = "Test User"): AuthUser => {
    const now = Timestamp.make({ epochMillis: Date.now() })
    return AuthUser.make({
      id: AuthUserId.make("550e8400-e29b-41d4-a716-446655440000"),
      email: Email.make("test@example.com"),
      displayName,
      role: "member",
      primaryProvider: "local",
      createdAt: now,
      updatedAt: now
    })
  }

  describe("Context.Tag", () => {
    it("has correct identifier", () => {
      expect(CurrentUser.key).toBe("CurrentUser")
    })
  })

  describe("getCurrentUser", () => {
    it.effect("retrieves user from context", () =>
      Effect.gen(function* () {
        const testUser = createTestUser()
        const CurrentUserLayer = Layer.succeed(CurrentUser, testUser)

        const program = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          return user
        })

        const result = yield* program.pipe(Effect.provide(CurrentUserLayer))
        expect(result.id).toBe(testUser.id)
        expect(result.email).toBe(testUser.email)
        expect(result.displayName).toBe(testUser.displayName)
      })
    )

    it("effect requires CurrentUser context", () => {
      // This is a compile-time check - getCurrentUser() returns Effect<AuthUser, never, CurrentUser>
      // The third type parameter being CurrentUser means it requires that context
      // In Effect, Context.Tags can be used as effects directly and may be functions
      const program = getCurrentUser()
      // We can verify the effect exists
      expect(program).toBeDefined()
    })

    it.effect("can access user properties", () =>
      Effect.gen(function* () {
        const testUser = createTestUser("Alice")
        const CurrentUserLayer = Layer.succeed(CurrentUser, testUser)

        const program = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            provider: user.primaryProvider
          }
        })

        const result = yield* program.pipe(Effect.provide(CurrentUserLayer))
        expect(result.displayName).toBe("Alice")
        expect(result.role).toBe("member")
        expect(result.provider).toBe("local")
      })
    )
  })

  describe("withCurrentUser", () => {
    it.effect("provides user to effect", () =>
      Effect.gen(function* () {
        const testUser = createTestUser("Bob")

        const program = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          return `Hello, ${user.displayName}!`
        })

        const result = yield* program.pipe(withCurrentUser(testUser))
        expect(result).toBe("Hello, Bob!")
      })
    )

    it.effect("can be composed with other effects", () =>
      Effect.gen(function* () {
        const testUser = createTestUser("Charlie")

        const getUserEmail = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          return user.email
        })

        const getUserRole = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          return user.role
        })

        const combined = Effect.gen(function* () {
          const email = yield* getUserEmail
          const role = yield* getUserRole
          return { email, role }
        })

        const result = yield* combined.pipe(withCurrentUser(testUser))
        expect(result.email).toBe("test@example.com")
        expect(result.role).toBe("member")
      })
    )

    it.effect("can be overridden", () =>
      Effect.gen(function* () {
        const user1 = createTestUser("User One")
        const user2 = createTestUser("User Two")

        const getDisplayName = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          return user.displayName
        })

        // Override with second user (inner takes precedence)
        const innerProgram = Effect.gen(function* () {
          const name = yield* getDisplayName.pipe(withCurrentUser(user2))
          return name
        })

        const result = yield* innerProgram.pipe(withCurrentUser(user1))
        expect(result).toBe("User Two")
      })
    )

    it.effect("works with different user roles", () =>
      Effect.gen(function* () {
        const now = Timestamp.make({ epochMillis: Date.now() })

        const adminUser = AuthUser.make({
          id: AuthUserId.make("550e8400-e29b-41d4-a716-446655440001"),
          email: Email.make("admin@example.com"),
          displayName: "Admin User",
          role: "admin",
          primaryProvider: "local",
          createdAt: now,
          updatedAt: now
        })

        const viewerUser = AuthUser.make({
          id: AuthUserId.make("550e8400-e29b-41d4-a716-446655440002"),
          email: Email.make("viewer@example.com"),
          displayName: "Viewer User",
          role: "viewer",
          primaryProvider: "google",
          createdAt: now,
          updatedAt: now
        })

        const checkIsAdmin = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          return user.role === "admin"
        })

        const adminResult = yield* checkIsAdmin.pipe(withCurrentUser(adminUser))
        const viewerResult = yield* checkIsAdmin.pipe(withCurrentUser(viewerUser))

        expect(adminResult).toBe(true)
        expect(viewerResult).toBe(false)
      })
    )
  })

  describe("integration", () => {
    it.effect("typical middleware usage pattern", () =>
      Effect.gen(function* () {
        // Simulate middleware setting current user after auth
        const authenticatedUser = createTestUser("Authenticated User")

        // Business logic that requires authenticated user
        const businessLogic = Effect.gen(function* () {
          const user = yield* getCurrentUser()
          // Perform some operation with the user
          return {
            userId: user.id,
            greeting: `Welcome back, ${user.displayName}!`,
            timestamp: Date.now()
          }
        })

        // Middleware provides the user context
        const result = yield* businessLogic.pipe(withCurrentUser(authenticatedUser))

        expect(result.userId).toBe(authenticatedUser.id)
        expect(result.greeting).toContain("Authenticated User")
      })
    )

    it.effect("can be used with Layer.provide", () =>
      Effect.gen(function* () {
        const testUser = createTestUser("Layer User")

        const program = Effect.gen(function* () {
          const user = yield* CurrentUser
          return user.displayName
        })

        const UserLayer = Layer.succeed(CurrentUser, testUser)
        const result = yield* program.pipe(Effect.provide(UserLayer))

        expect(result).toBe("Layer User")
      })
    )
  })
})
