import { describe, it, expect } from "@effect/vitest"
import { Effect, Equal, Exit, Option } from "effect"
import * as Schema from "effect/Schema"
import {
  AuthResult,
  isAuthResult,
  LoginResult,
  isLoginResult
} from "../../src/authentication/AuthResult.ts"
import { Email } from "../../src/authentication/Email.ts"
import { ProviderId } from "../../src/authentication/ProviderId.ts"
import { AuthUserId } from "../../src/authentication/AuthUserId.ts"
import { SessionId } from "../../src/authentication/SessionId.ts"

describe("AuthResult", () => {
  const validEmail = Email.make("test@example.com")
  const validProviderId = ProviderId.make("google-user-12345")
  const validUserId = AuthUserId.make("550e8400-e29b-41d4-a716-446655440000")
  const validSessionId = SessionId.make("abcdefghijklmnopqrstuvwxyz123456")

  describe("AuthResult", () => {
    it("creates result with required fields", () => {
      const result = AuthResult.make({
        provider: "google",
        providerId: validProviderId,
        email: validEmail,
        displayName: "Test User",
        emailVerified: true,
        providerData: Option.none()
      })
      expect(result.provider).toBe("google")
      expect(result.providerId).toBe(validProviderId)
      expect(result.email).toBe(validEmail)
      expect(result.displayName).toBe("Test User")
      expect(result.emailVerified).toBe(true)
      expect(Option.isNone(result.providerData)).toBe(true)
    })

    it("creates result with provider data", () => {
      const providerData = {
        profile: { name: "Test User", picture: "https://example.com/avatar.png" },
        metadata: { sub: "12345" }
      }
      const result = AuthResult.make({
        provider: "google",
        providerId: validProviderId,
        email: validEmail,
        displayName: "Test User",
        emailVerified: true,
        providerData: Option.some(providerData)
      })
      expect(Option.isSome(result.providerData)).toBe(true)
      if (Option.isSome(result.providerData)) {
        expect(result.providerData.value.profile).toEqual(providerData.profile)
      }
    })

    it("works with all provider types", () => {
      const providers = ["local", "workos", "google", "github", "saml"] as const
      for (const provider of providers) {
        const result = AuthResult.make({
          provider,
          providerId: validProviderId,
          email: validEmail,
          displayName: "User",
          emailVerified: provider !== "local",
          providerData: Option.none()
        })
        expect(result.provider).toBe(provider)
      }
    })

    it("type guard works correctly", () => {
      const result = AuthResult.make({
        provider: "google",
        providerId: validProviderId,
        email: validEmail,
        displayName: "Test User",
        emailVerified: true,
        providerData: Option.none()
      })
      expect(isAuthResult(result)).toBe(true)
      expect(isAuthResult({ provider: "google" })).toBe(false)
      expect(isAuthResult(null)).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const result = AuthResult.make({
          provider: "github",
          providerId: validProviderId,
          email: validEmail,
          displayName: "GitHub User",
          emailVerified: true,
          providerData: Option.none()
        })
        const encoded = yield* Schema.encode(AuthResult)(result)
        const decoded = yield* Schema.decodeUnknown(AuthResult)(encoded)
        expect(Equal.equals(result, decoded)).toBe(true)
      })
    )

    it.effect("encodes and decodes with provider data", () =>
      Effect.gen(function* () {
        const result = AuthResult.make({
          provider: "google",
          providerId: validProviderId,
          email: validEmail,
          displayName: "Google User",
          emailVerified: true,
          providerData: Option.some({
            profile: { sub: "12345", name: "Test" }
          })
        })
        const encoded = yield* Schema.encode(AuthResult)(result)
        const decoded = yield* Schema.decodeUnknown(AuthResult)(encoded)
        // ProviderData contains Schema.Unknown which may not preserve deep equality through encode/decode
        // Check fields individually instead
        expect(decoded.provider).toBe(result.provider)
        expect(decoded.providerId).toBe(result.providerId)
        expect(decoded.email).toBe(result.email)
        expect(decoded.displayName).toBe(result.displayName)
        expect(decoded.emailVerified).toBe(result.emailVerified)
        expect(Option.isSome(decoded.providerData)).toBe(true)
      })
    )

    it.effect("rejects invalid provider", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(AuthResult)({
            provider: "facebook", // invalid
            providerId: "12345",
            email: "test@example.com",
            displayName: "User",
            emailVerified: true,
            providerData: { _tag: "None" }
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects invalid email", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(AuthResult)({
            provider: "google",
            providerId: "12345",
            email: "not-an-email",
            displayName: "User",
            emailVerified: true,
            providerData: { _tag: "None" }
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty displayName", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(AuthResult)({
            provider: "google",
            providerId: "12345",
            email: "test@example.com",
            displayName: "", // empty
            emailVerified: true,
            providerData: { _tag: "None" }
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("LoginResult", () => {
    const expiresAt = Date.now() + 3600000 // 1 hour from now

    it("creates login result with all fields", () => {
      const result = LoginResult.make({
        userId: validUserId,
        email: validEmail,
        displayName: "Test User",
        sessionId: validSessionId,
        expiresAt,
        provider: "local"
      })
      expect(result.userId).toBe(validUserId)
      expect(result.email).toBe(validEmail)
      expect(result.displayName).toBe("Test User")
      expect(result.sessionId).toBe(validSessionId)
      expect(result.expiresAt).toBe(expiresAt)
      expect(result.provider).toBe("local")
    })

    it("type guard works correctly", () => {
      const result = LoginResult.make({
        userId: validUserId,
        email: validEmail,
        displayName: "Test User",
        sessionId: validSessionId,
        expiresAt,
        provider: "local"
      })
      expect(isLoginResult(result)).toBe(true)
      expect(isLoginResult({ userId: validUserId })).toBe(false)
      expect(isLoginResult(null)).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const result = LoginResult.make({
          userId: validUserId,
          email: validEmail,
          displayName: "Test User",
          sessionId: validSessionId,
          expiresAt,
          provider: "google"
        })
        const encoded = yield* Schema.encode(LoginResult)(result)
        const decoded = yield* Schema.decodeUnknown(LoginResult)(encoded)
        expect(Equal.equals(result, decoded)).toBe(true)
      })
    )

    it.effect("rejects invalid userId", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(LoginResult)({
            userId: "not-a-uuid",
            email: "test@example.com",
            displayName: "User",
            sessionId: "abcdefghijklmnopqrstuvwxyz123456",
            expiresAt: Date.now(),
            provider: "local"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty sessionId", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(LoginResult)({
            userId: "550e8400-e29b-41d4-a716-446655440000",
            email: "test@example.com",
            displayName: "User",
            sessionId: "", // empty string
            expiresAt: Date.now(),
            provider: "local"
          })
        )
        // LoginResult.sessionId uses NonEmptyTrimmedString, so empty strings are rejected
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("structural equality", () => {
    it("AuthResult instances with same values are equal", () => {
      const result1 = AuthResult.make({
        provider: "google",
        providerId: validProviderId,
        email: validEmail,
        displayName: "User",
        emailVerified: true,
        providerData: Option.none()
      })
      const result2 = AuthResult.make({
        provider: "google",
        providerId: validProviderId,
        email: validEmail,
        displayName: "User",
        emailVerified: true,
        providerData: Option.none()
      })
      expect(Equal.equals(result1, result2)).toBe(true)
    })

    it("AuthResult instances with different values are not equal", () => {
      const result1 = AuthResult.make({
        provider: "google",
        providerId: validProviderId,
        email: validEmail,
        displayName: "User 1",
        emailVerified: true,
        providerData: Option.none()
      })
      const result2 = AuthResult.make({
        provider: "google",
        providerId: validProviderId,
        email: validEmail,
        displayName: "User 2",
        emailVerified: true,
        providerData: Option.none()
      })
      expect(Equal.equals(result1, result2)).toBe(false)
    })

    it("LoginResult instances with same values are equal", () => {
      const expiresAt = Date.now() + 3600000
      const result1 = LoginResult.make({
        userId: validUserId,
        email: validEmail,
        displayName: "User",
        sessionId: validSessionId,
        expiresAt,
        provider: "local"
      })
      const result2 = LoginResult.make({
        userId: validUserId,
        email: validEmail,
        displayName: "User",
        sessionId: validSessionId,
        expiresAt,
        provider: "local"
      })
      expect(Equal.equals(result1, result2)).toBe(true)
    })
  })
})
