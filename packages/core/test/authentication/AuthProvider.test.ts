import { describe, it, expect } from "@effect/vitest"
import { Effect, Option, Redacted } from "effect"
import type { AuthProvider, AuthProviderRegistry } from "../../src/authentication/AuthProvider.ts"
import type { AuthProviderType } from "../../src/authentication/AuthProviderType.ts"
import type { AuthRequest } from "../../src/authentication/AuthRequest.ts"
import { LocalAuthRequest, OAuthAuthRequest } from "../../src/authentication/AuthRequest.ts"
import { AuthResult } from "../../src/authentication/AuthResult.ts"
import { Email } from "../../src/authentication/Email.ts"
import { ProviderId } from "../../src/authentication/ProviderId.ts"
import {
  InvalidCredentialsError,
  ProviderAuthFailedError,
  OAuthStateError
} from "../../src/authentication/AuthErrors.ts"

describe("AuthProvider", () => {
  /**
   * Mock local auth provider for testing the interface contract
   */
  const createMockLocalProvider = (): AuthProvider => ({
    type: "local",
    supportsRegistration: true,

    authenticate: (request: AuthRequest) =>
      Effect.gen(function* () {
        if (request._tag !== "LocalAuthRequest") {
          return yield* Effect.fail(
            new InvalidCredentialsError({ email: Email.make("unknown@example.com") })
          )
        }

        const localRequest = request
        const password = Redacted.value(localRequest.password)

        // Simulate password validation
        if (password !== "correct-password") {
          return yield* Effect.fail(
            new InvalidCredentialsError({ email: localRequest.email })
          )
        }

        return AuthResult.make({
          provider: "local",
          providerId: ProviderId.make("local-user-123"),
          email: localRequest.email,
          displayName: "Test User",
          emailVerified: false,
          providerData: Option.none()
        })
      }),

    getAuthorizationUrl: (_state: string, _redirectUri?: string) => Option.none(),

    handleCallback: (_code: string, _state: string) =>
      Effect.fail(
        new ProviderAuthFailedError({
          provider: "local",
          reason: "Local provider does not support OAuth callbacks"
        })
      )
  })

  /**
   * Mock OAuth provider for testing the interface contract
   */
  const createMockOAuthProvider = (providerType: AuthProviderType): AuthProvider => ({
    type: providerType,
    supportsRegistration: true,

    authenticate: (request: AuthRequest) =>
      Effect.gen(function* () {
        if (request._tag !== "OAuthAuthRequest") {
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: providerType,
              reason: "Invalid request type for OAuth provider"
            })
          )
        }

        const oauthRequest = request

        // Simulate state validation
        if (!oauthRequest.state.startsWith("valid")) {
          return yield* Effect.fail(new OAuthStateError({ provider: providerType }))
        }

        return AuthResult.make({
          provider: providerType,
          providerId: ProviderId.make(`${providerType}-user-456`),
          email: Email.make("oauth@example.com"),
          displayName: "OAuth User",
          emailVerified: true,
          providerData: Option.none()
        })
      }),

    getAuthorizationUrl: (state: string, redirectUri?: string) => {
      const baseUrl = `https://oauth.${providerType}.com/authorize`
      const params = new URLSearchParams({
        client_id: "test-client",
        redirect_uri: redirectUri ?? "https://example.com/callback",
        state,
        scope: "openid email profile"
      })
      return Option.some(`${baseUrl}?${params.toString()}`)
    },

    handleCallback: (code: string, state: string) =>
      Effect.gen(function* () {
        if (!state.startsWith("valid")) {
          return yield* Effect.fail(new OAuthStateError({ provider: providerType }))
        }

        if (code === "invalid-code") {
          return yield* Effect.fail(
            new ProviderAuthFailedError({
              provider: providerType,
              reason: "Invalid authorization code"
            })
          )
        }

        return AuthResult.make({
          provider: providerType,
          providerId: ProviderId.make(`${providerType}-callback-789`),
          email: Email.make("callback@example.com"),
          displayName: "Callback User",
          emailVerified: true,
          providerData: Option.none()
        })
      })
  })

  describe("AuthProvider interface", () => {
    describe("local provider", () => {
      const localProvider = createMockLocalProvider()

      it("has correct type", () => {
        expect(localProvider.type).toBe("local")
      })

      it("supports registration", () => {
        expect(localProvider.supportsRegistration).toBe(true)
      })

      it("returns None for authorization URL", () => {
        const url = localProvider.getAuthorizationUrl("some-state")
        expect(Option.isNone(url)).toBe(true)
      })

      it.effect("authenticates with valid credentials", () =>
        Effect.gen(function* () {
          const request = LocalAuthRequest.make({
            email: Email.make("user@example.com"),
            password: Redacted.make("correct-password")
          })
          const result = yield* localProvider.authenticate(request)
          expect(result.provider).toBe("local")
          expect(result.email).toBe("user@example.com")
          expect(result.emailVerified).toBe(false)
        })
      )

      it.effect("fails with invalid credentials", () =>
        Effect.gen(function* () {
          const request = LocalAuthRequest.make({
            email: Email.make("user@example.com"),
            password: Redacted.make("wrong-password")
          })
          const result = yield* Effect.exit(localProvider.authenticate(request))
          expect(result._tag).toBe("Failure")
        })
      )

      it.effect("fails on callback (not supported)", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(
            localProvider.handleCallback("code", "state")
          )
          expect(result._tag).toBe("Failure")
        })
      )
    })

    describe("OAuth provider", () => {
      const googleProvider = createMockOAuthProvider("google")

      it("has correct type", () => {
        expect(googleProvider.type).toBe("google")
      })

      it("supports registration", () => {
        expect(googleProvider.supportsRegistration).toBe(true)
      })

      it("returns authorization URL", () => {
        const url = googleProvider.getAuthorizationUrl("csrf-state")
        expect(Option.isSome(url)).toBe(true)
        if (Option.isSome(url)) {
          expect(url.value).toContain("oauth.google.com")
          expect(url.value).toContain("state=csrf-state")
        }
      })

      it("includes custom redirect URI in authorization URL", () => {
        const url = googleProvider.getAuthorizationUrl(
          "csrf-state",
          "https://custom.com/callback"
        )
        expect(Option.isSome(url)).toBe(true)
        if (Option.isSome(url)) {
          expect(url.value).toContain("redirect_uri=https%3A%2F%2Fcustom.com%2Fcallback")
        }
      })

      it.effect("authenticates with valid OAuth request", () =>
        Effect.gen(function* () {
          const request = OAuthAuthRequest.make({
            code: "auth-code-123",
            state: "valid-csrf-state"
          })
          const result = yield* googleProvider.authenticate(request)
          expect(result.provider).toBe("google")
          expect(result.emailVerified).toBe(true)
        })
      )

      it.effect("fails authentication with invalid state", () =>
        Effect.gen(function* () {
          const request = OAuthAuthRequest.make({
            code: "auth-code-123",
            state: "invalid-state"
          })
          const result = yield* Effect.exit(googleProvider.authenticate(request))
          expect(result._tag).toBe("Failure")
        })
      )

      it.effect("handles callback with valid code and state", () =>
        Effect.gen(function* () {
          const result = yield* googleProvider.handleCallback(
            "valid-auth-code",
            "valid-csrf-state"
          )
          expect(result.provider).toBe("google")
          expect(result.providerId).toBe("google-callback-789")
        })
      )

      it.effect("fails callback with invalid state", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(
            googleProvider.handleCallback("code", "bad-state")
          )
          expect(result._tag).toBe("Failure")
        })
      )

      it.effect("fails callback with invalid code", () =>
        Effect.gen(function* () {
          const result = yield* Effect.exit(
            googleProvider.handleCallback("invalid-code", "valid-state")
          )
          expect(result._tag).toBe("Failure")
        })
      )
    })

    describe("WorkOS provider (SSO without registration)", () => {
      const workosProvider: AuthProvider = {
        type: "workos",
        supportsRegistration: false, // Users managed externally

        authenticate: (_request: AuthRequest) =>
          Effect.fail(
            new ProviderAuthFailedError({
              provider: "workos",
              reason: "Use handleCallback for WorkOS SSO"
            })
          ),

        getAuthorizationUrl: (state: string, _redirectUri?: string) =>
          Option.some(
            `https://api.workos.com/sso/authorize?state=${state}&connection=test`
          ),

        handleCallback: (code: string, state: string) =>
          Effect.gen(function* () {
            if (!state.startsWith("valid")) {
              return yield* Effect.fail(new OAuthStateError({ provider: "workos" }))
            }

            if (code !== "workos-valid-code") {
              return yield* Effect.fail(
                new ProviderAuthFailedError({
                  provider: "workos",
                  reason: "Invalid SSO code"
                })
              )
            }

            return AuthResult.make({
              provider: "workos",
              providerId: ProviderId.make("workos-sso-user"),
              email: Email.make("enterprise@company.com"),
              displayName: "Enterprise User",
              emailVerified: true,
              providerData: Option.some({
                metadata: { organization: "company-123" }
              })
            })
          })
      }

      it("does not support registration", () => {
        expect(workosProvider.supportsRegistration).toBe(false)
      })

      it("returns WorkOS authorization URL", () => {
        const url = workosProvider.getAuthorizationUrl("my-state")
        expect(Option.isSome(url)).toBe(true)
        if (Option.isSome(url)) {
          expect(url.value).toContain("workos.com")
          expect(url.value).toContain("state=my-state")
        }
      })

      it.effect("handles SSO callback successfully", () =>
        Effect.gen(function* () {
          const result = yield* workosProvider.handleCallback(
            "workos-valid-code",
            "valid-state"
          )
          expect(result.provider).toBe("workos")
          expect(result.email).toBe("enterprise@company.com")
          expect(Option.isSome(result.providerData)).toBe(true)
        })
      )
    })
  })

  describe("AuthProviderRegistry", () => {
    it("can store and retrieve providers by type", () => {
      const localProvider = createMockLocalProvider()
      const googleProvider = createMockOAuthProvider("google")
      const githubProvider = createMockOAuthProvider("github")

      const registry: AuthProviderRegistry = new Map([
        ["local", localProvider],
        ["google", googleProvider],
        ["github", githubProvider]
      ])

      expect(registry.get("local")).toBe(localProvider)
      expect(registry.get("google")).toBe(googleProvider)
      expect(registry.get("github")).toBe(githubProvider)
      expect(registry.get("workos")).toBeUndefined()
      expect(registry.get("saml")).toBeUndefined()
    })

    it("can check if provider is enabled", () => {
      const registry: AuthProviderRegistry = new Map([
        ["local", createMockLocalProvider()],
        ["google", createMockOAuthProvider("google")]
      ])

      expect(registry.has("local")).toBe(true)
      expect(registry.has("google")).toBe(true)
      expect(registry.has("github")).toBe(false)
      expect(registry.has("workos")).toBe(false)
    })

    it("can iterate over enabled providers", () => {
      const registry: AuthProviderRegistry = new Map([
        ["local", createMockLocalProvider()],
        ["google", createMockOAuthProvider("google")]
      ])

      const types = Array.from(registry.keys())
      expect(types).toContain("local")
      expect(types).toContain("google")
      expect(types.length).toBe(2)
    })
  })
})
