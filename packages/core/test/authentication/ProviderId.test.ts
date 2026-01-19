import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import { ProviderId, isProviderId } from "../../src/authentication/ProviderId.ts"

describe("ProviderId", () => {
  describe("validation", () => {
    it.effect("accepts valid provider IDs (Google sub)", () =>
      Effect.gen(function* () {
        const id = ProviderId.make("116789012345678901234")
        expect(id).toBe("116789012345678901234")
      })
    )

    it.effect("accepts valid provider IDs (GitHub user ID)", () =>
      Effect.gen(function* () {
        const id = ProviderId.make("12345678")
        expect(id).toBe("12345678")
      })
    )

    it.effect("accepts valid provider IDs (WorkOS user ID)", () =>
      Effect.gen(function* () {
        const id = ProviderId.make("user_01HCZN4YRBD1W7NW5RMW9PMY3Z")
        expect(id).toBe("user_01HCZN4YRBD1W7NW5RMW9PMY3Z")
      })
    )

    it.effect("accepts valid provider IDs (UUID format)", () =>
      Effect.gen(function* () {
        const id = ProviderId.make("550e8400-e29b-41d4-a716-446655440000")
        expect(id).toBe("550e8400-e29b-41d4-a716-446655440000")
      })
    )

    it.effect("accepts email-like provider IDs (SAML NameID)", () =>
      Effect.gen(function* () {
        const id = ProviderId.make("user@domain.com")
        expect(id).toBe("user@domain.com")
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ProviderId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ProviderId)
        const result = yield* Effect.exit(decode("   "))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects strings with leading/trailing whitespace", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(ProviderId)
        const result = yield* Effect.exit(decode("  trimmed  "))
        // NonEmptyTrimmedString validates that string has no leading/trailing whitespace
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isProviderId returns true for valid ProviderId", () => {
      const id = ProviderId.make("user_123")
      expect(isProviderId(id)).toBe(true)
    })

    it("isProviderId returns true for plain valid string", () => {
      expect(isProviderId("user_123")).toBe(true)
    })

    it("isProviderId returns false for non-string values", () => {
      expect(isProviderId(null)).toBe(false)
      expect(isProviderId(undefined)).toBe(false)
      expect(isProviderId(123)).toBe(false)
      expect(isProviderId({})).toBe(false)
    })

    it("isProviderId returns false for empty strings", () => {
      expect(isProviderId("")).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates ProviderId using Schema's .make()", () => {
      const id = ProviderId.make("provider_user_id")
      expect(id).toBe("provider_user_id")
      expect(isProviderId(id)).toBe(true)
    })
  })
})
