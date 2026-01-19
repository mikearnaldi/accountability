import { describe, it, expect } from "@effect/vitest"
import { Chunk, Effect, Exit, Equal } from "effect"
import * as Schema from "effect/Schema"
import {
  InvalidCredentialsError,
  isInvalidCredentialsError,
  UserNotFoundError,
  isUserNotFoundError,
  UserAlreadyExistsError,
  isUserAlreadyExistsError,
  IdentityAlreadyLinkedError,
  isIdentityAlreadyLinkedError,
  ProviderNotEnabledError,
  isProviderNotEnabledError,
  ProviderAuthFailedError,
  isProviderAuthFailedError,
  SessionExpiredError,
  isSessionExpiredError,
  SessionNotFoundError,
  isSessionNotFoundError,
  PasswordTooWeakError,
  isPasswordTooWeakError,
  OAuthStateError,
  isOAuthStateError
} from "../../src/authentication/AuthErrors.ts"
import { Email } from "../../src/authentication/Email.ts"
import { SessionId } from "../../src/authentication/SessionId.ts"
import { AuthUserId } from "../../src/authentication/AuthUserId.ts"
import { ProviderId } from "../../src/authentication/ProviderId.ts"

describe("AuthErrors", () => {
  const validEmail = Email.make("test@example.com")
  const validSessionId = SessionId.make("abcdefghijklmnopqrstuvwxyz123456")
  const validAuthUserId = AuthUserId.make("550e8400-e29b-41d4-a716-446655440000")
  const validProviderId = ProviderId.make("google-user-12345")

  describe("InvalidCredentialsError", () => {
    it("creates error with email", () => {
      const error = new InvalidCredentialsError({ email: validEmail })
      expect(error._tag).toBe("InvalidCredentialsError")
      expect(error.email).toBe(validEmail)
      expect(error.message).toBe("Invalid email or password")
    })

    it("type guard works correctly", () => {
      const error = new InvalidCredentialsError({ email: validEmail })
      expect(isInvalidCredentialsError(error)).toBe(true)
      expect(isInvalidCredentialsError({ _tag: "InvalidCredentialsError" })).toBe(false)
      expect(isInvalidCredentialsError(null)).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new InvalidCredentialsError({ email: validEmail })
        const encoded = yield* Schema.encode(InvalidCredentialsError)(error)
        const decoded = yield* Schema.decodeUnknown(InvalidCredentialsError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("SessionExpiredError", () => {
    it("creates error with session ID", () => {
      const error = new SessionExpiredError({ sessionId: validSessionId })
      expect(error._tag).toBe("SessionExpiredError")
      expect(error.sessionId).toBe(validSessionId)
      expect(error.message).toBe("Session has expired")
    })

    it("type guard works correctly", () => {
      const error = new SessionExpiredError({ sessionId: validSessionId })
      expect(isSessionExpiredError(error)).toBe(true)
      expect(isSessionExpiredError({ _tag: "SessionExpiredError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new SessionExpiredError({ sessionId: validSessionId })
        const encoded = yield* Schema.encode(SessionExpiredError)(error)
        const decoded = yield* Schema.decodeUnknown(SessionExpiredError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("SessionNotFoundError", () => {
    it("creates error with session ID", () => {
      const error = new SessionNotFoundError({ sessionId: validSessionId })
      expect(error._tag).toBe("SessionNotFoundError")
      expect(error.sessionId).toBe(validSessionId)
      expect(error.message).toBe("Session not found")
    })

    it("type guard works correctly", () => {
      const error = new SessionNotFoundError({ sessionId: validSessionId })
      expect(isSessionNotFoundError(error)).toBe(true)
      expect(isSessionNotFoundError({ _tag: "SessionNotFoundError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new SessionNotFoundError({ sessionId: validSessionId })
        const encoded = yield* Schema.encode(SessionNotFoundError)(error)
        const decoded = yield* Schema.decodeUnknown(SessionNotFoundError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("ProviderAuthFailedError", () => {
    it("creates error with provider and reason", () => {
      const error = new ProviderAuthFailedError({
        provider: "google",
        reason: "Invalid token"
      })
      expect(error._tag).toBe("ProviderAuthFailedError")
      expect(error.provider).toBe("google")
      expect(error.reason).toBe("Invalid token")
      expect(error.message).toBe("Authentication with google failed: Invalid token")
    })

    it("type guard works correctly", () => {
      const error = new ProviderAuthFailedError({
        provider: "workos",
        reason: "Connection timeout"
      })
      expect(isProviderAuthFailedError(error)).toBe(true)
      expect(isProviderAuthFailedError({ _tag: "ProviderAuthFailedError" })).toBe(false)
    })

    it.effect("works with all provider types", () =>
      Effect.gen(function* () {
        const providers = ["local", "workos", "google", "github", "saml"] as const
        for (const provider of providers) {
          const error = new ProviderAuthFailedError({
            provider,
            reason: "Test failure"
          })
          expect(error.provider).toBe(provider)
        }
      })
    )

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new ProviderAuthFailedError({
          provider: "google",
          reason: "Invalid token"
        })
        const encoded = yield* Schema.encode(ProviderAuthFailedError)(error)
        const decoded = yield* Schema.decodeUnknown(ProviderAuthFailedError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("UserNotFoundError", () => {
    it("creates error with email", () => {
      const error = new UserNotFoundError({ email: validEmail })
      expect(error._tag).toBe("UserNotFoundError")
      expect(error.email).toBe(validEmail)
      expect(error.message).toBe(`User not found: ${validEmail}`)
    })

    it("type guard works correctly", () => {
      const error = new UserNotFoundError({ email: validEmail })
      expect(isUserNotFoundError(error)).toBe(true)
      expect(isUserNotFoundError({ _tag: "UserNotFoundError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new UserNotFoundError({ email: validEmail })
        const encoded = yield* Schema.encode(UserNotFoundError)(error)
        const decoded = yield* Schema.decodeUnknown(UserNotFoundError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("ProviderNotEnabledError", () => {
    it("creates error with provider", () => {
      const error = new ProviderNotEnabledError({ provider: "saml" })
      expect(error._tag).toBe("ProviderNotEnabledError")
      expect(error.provider).toBe("saml")
      expect(error.message).toBe("Authentication provider 'saml' is not enabled")
    })

    it("type guard works correctly", () => {
      const error = new ProviderNotEnabledError({ provider: "google" })
      expect(isProviderNotEnabledError(error)).toBe(true)
      expect(isProviderNotEnabledError({ _tag: "ProviderNotEnabledError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new ProviderNotEnabledError({ provider: "workos" })
        const encoded = yield* Schema.encode(ProviderNotEnabledError)(error)
        const decoded = yield* Schema.decodeUnknown(ProviderNotEnabledError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("UserAlreadyExistsError", () => {
    it("creates error with email", () => {
      const error = new UserAlreadyExistsError({ email: validEmail })
      expect(error._tag).toBe("UserAlreadyExistsError")
      expect(error.email).toBe(validEmail)
      expect(error.message).toBe(`User with email '${validEmail}' already exists`)
    })

    it("type guard works correctly", () => {
      const error = new UserAlreadyExistsError({ email: validEmail })
      expect(isUserAlreadyExistsError(error)).toBe(true)
      expect(isUserAlreadyExistsError({ _tag: "UserAlreadyExistsError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new UserAlreadyExistsError({ email: validEmail })
        const encoded = yield* Schema.encode(UserAlreadyExistsError)(error)
        const decoded = yield* Schema.decodeUnknown(UserAlreadyExistsError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("IdentityAlreadyLinkedError", () => {
    it("creates error with provider, providerId, and existingUserId", () => {
      const error = new IdentityAlreadyLinkedError({
        provider: "google",
        providerId: validProviderId,
        existingUserId: validAuthUserId
      })
      expect(error._tag).toBe("IdentityAlreadyLinkedError")
      expect(error.provider).toBe("google")
      expect(error.providerId).toBe(validProviderId)
      expect(error.existingUserId).toBe(validAuthUserId)
      expect(error.message).toBe("Identity from 'google' is already linked to another user")
    })

    it("type guard works correctly", () => {
      const error = new IdentityAlreadyLinkedError({
        provider: "github",
        providerId: validProviderId,
        existingUserId: validAuthUserId
      })
      expect(isIdentityAlreadyLinkedError(error)).toBe(true)
      expect(isIdentityAlreadyLinkedError({ _tag: "IdentityAlreadyLinkedError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new IdentityAlreadyLinkedError({
          provider: "google",
          providerId: validProviderId,
          existingUserId: validAuthUserId
        })
        const encoded = yield* Schema.encode(IdentityAlreadyLinkedError)(error)
        const decoded = yield* Schema.decodeUnknown(IdentityAlreadyLinkedError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("PasswordTooWeakError", () => {
    it("creates error with requirements", () => {
      const requirements = Chunk.make(
        "at least 8 characters",
        "at least one uppercase letter"
      )
      const error = new PasswordTooWeakError({ requirements })
      expect(error._tag).toBe("PasswordTooWeakError")
      expect(Equal.equals(error.requirements, requirements)).toBe(true)
      expect(error.message).toBe(
        "Password does not meet requirements: at least 8 characters, at least one uppercase letter"
      )
    })

    it("type guard works correctly", () => {
      const error = new PasswordTooWeakError({ requirements: Chunk.make("too short") })
      expect(isPasswordTooWeakError(error)).toBe(true)
      expect(isPasswordTooWeakError({ _tag: "PasswordTooWeakError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new PasswordTooWeakError({
          requirements: Chunk.make("at least 8 characters", "at least one number")
        })
        const encoded = yield* Schema.encode(PasswordTooWeakError)(error)
        const decoded = yield* Schema.decodeUnknown(PasswordTooWeakError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("OAuthStateError", () => {
    it("creates error with provider", () => {
      const error = new OAuthStateError({ provider: "google" })
      expect(error._tag).toBe("OAuthStateError")
      expect(error.provider).toBe("google")
      expect(error.message).toBe(
        "OAuth state mismatch for google. Please restart the authentication flow."
      )
    })

    it("type guard works correctly", () => {
      const error = new OAuthStateError({ provider: "github" })
      expect(isOAuthStateError(error)).toBe(true)
      expect(isOAuthStateError({ _tag: "OAuthStateError" })).toBe(false)
    })

    it.effect("encodes and decodes correctly", () =>
      Effect.gen(function* () {
        const error = new OAuthStateError({ provider: "google" })
        const encoded = yield* Schema.encode(OAuthStateError)(error)
        const decoded = yield* Schema.decodeUnknown(OAuthStateError)(encoded)
        expect(Equal.equals(error, decoded)).toBe(true)
      })
    )
  })

  describe("all errors have proper _tag", () => {
    it("each error has unique _tag", () => {
      const tags = [
        new InvalidCredentialsError({ email: validEmail })._tag,
        new UserNotFoundError({ email: validEmail })._tag,
        new UserAlreadyExistsError({ email: validEmail })._tag,
        new IdentityAlreadyLinkedError({
          provider: "google",
          providerId: validProviderId,
          existingUserId: validAuthUserId
        })._tag,
        new ProviderNotEnabledError({ provider: "saml" })._tag,
        new ProviderAuthFailedError({ provider: "google", reason: "test" })._tag,
        new SessionExpiredError({ sessionId: validSessionId })._tag,
        new SessionNotFoundError({ sessionId: validSessionId })._tag,
        new PasswordTooWeakError({ requirements: Chunk.empty<string>() })._tag,
        new OAuthStateError({ provider: "google" })._tag
      ]

      // Verify all tags are unique
      const uniqueTags = new Set(tags)
      expect(uniqueTags.size).toBe(tags.length)

      // Verify expected tag values
      expect(tags).toContain("InvalidCredentialsError")
      expect(tags).toContain("UserNotFoundError")
      expect(tags).toContain("UserAlreadyExistsError")
      expect(tags).toContain("IdentityAlreadyLinkedError")
      expect(tags).toContain("ProviderNotEnabledError")
      expect(tags).toContain("ProviderAuthFailedError")
      expect(tags).toContain("SessionExpiredError")
      expect(tags).toContain("SessionNotFoundError")
      expect(tags).toContain("PasswordTooWeakError")
      expect(tags).toContain("OAuthStateError")
    })
  })

  describe("schema validation", () => {
    it.effect("InvalidCredentialsError rejects invalid email", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(InvalidCredentialsError)({
            _tag: "InvalidCredentialsError",
            email: "not-an-email"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("SessionExpiredError rejects short session ID", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(SessionExpiredError)({
            _tag: "SessionExpiredError",
            sessionId: "short"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("ProviderAuthFailedError rejects invalid provider", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(ProviderAuthFailedError)({
            _tag: "ProviderAuthFailedError",
            provider: "facebook",
            reason: "test"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("IdentityAlreadyLinkedError rejects invalid UUID", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Schema.decodeUnknown(IdentityAlreadyLinkedError)({
            _tag: "IdentityAlreadyLinkedError",
            provider: "google",
            providerId: "valid-provider-id",
            existingUserId: "not-a-uuid"
          })
        )
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })
})
