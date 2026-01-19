import { describe, it, expect } from "@effect/vitest"
import { Effect, Chunk } from "effect"
import * as Layer from "effect/Layer"
import type { AuthServiceShape } from "../../src/authentication/AuthService.ts"
import { AuthService } from "../../src/authentication/AuthService.ts"
import type { AuthProviderType } from "../../src/authentication/AuthProviderType.ts"
import {
  ProviderNotEnabledError,
  UserAlreadyExistsError,
  SessionNotFoundError,
  UserNotFoundError
} from "../../src/authentication/AuthErrors.ts"
import { Email } from "../../src/authentication/Email.ts"
import { SessionId } from "../../src/authentication/SessionId.ts"

describe("AuthService", () => {
  // Test fixtures
  const testEmail = Email.make("test@example.com")
  const testSessionId = SessionId.make("abcdefghijklmnopqrstuvwxyz123456")

  describe("Context.Tag", () => {
    it("has correct identifier", () => {
      expect(AuthService.key).toBe("AuthService")
    })

    it("can be used as a Context.Tag", () => {
      // Verify it extends Context.Tag by checking the prototype
      expect(typeof AuthService).toBe("function")
      // The Tag should have a key property
      expect(AuthService.key).toBeDefined()
    })
  })

  describe("service shape", () => {
    /**
     * Mock AuthService implementation for testing the interface
     */
    const mockAuthService: AuthServiceShape = {
      login: (_provider, _request) =>
        Effect.fail(new ProviderNotEnabledError({ provider: "local" })),

      register: (_email, _password, _displayName) =>
        Effect.fail(new UserAlreadyExistsError({ email: testEmail })),

      getAuthorizationUrl: (_provider, _redirectUri) =>
        Effect.fail(new ProviderNotEnabledError({ provider: "google" })),

      handleOAuthCallback: (_provider, _code, _state) =>
        Effect.fail(new ProviderNotEnabledError({ provider: "google" })),

      logout: (_sessionId) =>
        Effect.fail(new SessionNotFoundError({ sessionId: testSessionId })),

      validateSession: (_sessionId) =>
        Effect.fail(new SessionNotFoundError({ sessionId: testSessionId })),

      linkIdentity: (_userId, _provider, _providerResult) =>
        Effect.fail(new UserNotFoundError({ email: testEmail })),

      getEnabledProviders: () =>
        Effect.succeed(Chunk.fromIterable<AuthProviderType>(["local"]))
    }

    it("mock service has all required methods", () => {
      expect(typeof mockAuthService.login).toBe("function")
      expect(typeof mockAuthService.register).toBe("function")
      expect(typeof mockAuthService.getAuthorizationUrl).toBe("function")
      expect(typeof mockAuthService.handleOAuthCallback).toBe("function")
      expect(typeof mockAuthService.logout).toBe("function")
      expect(typeof mockAuthService.validateSession).toBe("function")
      expect(typeof mockAuthService.linkIdentity).toBe("function")
      expect(typeof mockAuthService.getEnabledProviders).toBe("function")
    })

    it.effect("can be provided via Layer", () =>
      Effect.gen(function* () {
        const TestAuthServiceLayer = Layer.succeed(AuthService, mockAuthService)

        const program = Effect.gen(function* () {
          const auth = yield* AuthService
          const providers = yield* auth.getEnabledProviders()
          return providers
        })

        const result = yield* program.pipe(Effect.provide(TestAuthServiceLayer))
        expect(Chunk.toReadonlyArray(result)).toEqual(["local"])
      })
    )

    it.effect("getEnabledProviders returns chunk of provider types", () =>
      Effect.gen(function* () {
        const TestAuthServiceLayer = Layer.succeed(AuthService, {
          ...mockAuthService,
          getEnabledProviders: () =>
            Effect.succeed(Chunk.fromIterable<AuthProviderType>(["local", "google", "github"]))
        })

        const program = Effect.gen(function* () {
          const auth = yield* AuthService
          return yield* auth.getEnabledProviders()
        })

        const result = yield* program.pipe(Effect.provide(TestAuthServiceLayer))
        expect(Chunk.size(result)).toBe(3)
        expect(Chunk.toReadonlyArray(result)).toContain("local")
        expect(Chunk.toReadonlyArray(result)).toContain("google")
        expect(Chunk.toReadonlyArray(result)).toContain("github")
      })
    )
  })

  describe("type safety", () => {
    it("AuthService can be retrieved from Context", () => {
      // This test verifies compile-time type safety
      // We create the effect but don't run it - we just verify it compiles
      const program = Effect.gen(function* () {
        const auth = yield* AuthService
        // TypeScript should know the shape of auth
        // These are runtime checks that also serve as compile-time type checks
        expect(typeof auth.login).toBe("function")
        expect(typeof auth.register).toBe("function")
        expect(typeof auth.logout).toBe("function")
        return true
      })
      // Verify the effect has the right type (requires AuthService)
      expect(typeof program).toBe("object")
    })
  })
})
