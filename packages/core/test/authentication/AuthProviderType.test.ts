import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import {
  AuthProviderType,
  isAuthProviderType,
  AUTH_PROVIDER_TYPES
} from "../../src/authentication/AuthProviderType.ts"

describe("AuthProviderType", () => {
  describe("validation", () => {
    it.effect("accepts 'local' provider", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(AuthProviderType)("local")
        expect(decoded).toBe("local")
      })
    )

    it.effect("accepts 'workos' provider", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(AuthProviderType)("workos")
        expect(decoded).toBe("workos")
      })
    )

    it.effect("accepts 'google' provider", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(AuthProviderType)("google")
        expect(decoded).toBe("google")
      })
    )

    it.effect("accepts 'github' provider", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(AuthProviderType)("github")
        expect(decoded).toBe("github")
      })
    )

    it.effect("accepts 'saml' provider", () =>
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknown(AuthProviderType)("saml")
        expect(decoded).toBe("saml")
      })
    )

    it.effect("rejects invalid provider types", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthProviderType)
        const result = yield* Effect.exit(decode("invalid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthProviderType)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects case variations (case sensitive)", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthProviderType)
        const result = yield* Effect.exit(decode("Google"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAuthProviderType returns true for valid provider types", () => {
      expect(isAuthProviderType("local")).toBe(true)
      expect(isAuthProviderType("workos")).toBe(true)
      expect(isAuthProviderType("google")).toBe(true)
      expect(isAuthProviderType("github")).toBe(true)
      expect(isAuthProviderType("saml")).toBe(true)
    })

    it("isAuthProviderType returns false for invalid provider types", () => {
      expect(isAuthProviderType("invalid")).toBe(false)
      expect(isAuthProviderType("Local")).toBe(false)
      expect(isAuthProviderType("")).toBe(false)
    })

    it("isAuthProviderType returns false for non-string values", () => {
      expect(isAuthProviderType(null)).toBe(false)
      expect(isAuthProviderType(undefined)).toBe(false)
      expect(isAuthProviderType(123)).toBe(false)
      expect(isAuthProviderType({})).toBe(false)
    })
  })

  describe("AUTH_PROVIDER_TYPES constant", () => {
    it("contains all supported provider types", () => {
      expect(AUTH_PROVIDER_TYPES).toContain("local")
      expect(AUTH_PROVIDER_TYPES).toContain("workos")
      expect(AUTH_PROVIDER_TYPES).toContain("google")
      expect(AUTH_PROVIDER_TYPES).toContain("github")
      expect(AUTH_PROVIDER_TYPES).toContain("saml")
    })

    it("has exactly 5 provider types", () => {
      expect(AUTH_PROVIDER_TYPES).toHaveLength(5)
    })

    it("all items pass type guard", () => {
      for (const provider of AUTH_PROVIDER_TYPES) {
        expect(isAuthProviderType(provider)).toBe(true)
      }
    })
  })
})
