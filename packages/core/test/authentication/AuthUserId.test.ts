import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import { AuthUserId, isAuthUserId } from "../../src/authentication/AuthUserId.ts"

describe("AuthUserId", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000"
  const anotherValidUUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

  describe("validation", () => {
    it.effect("accepts valid UUID strings", () =>
      Effect.gen(function* () {
        const id = AuthUserId.make(validUUID)
        expect(id).toBe(validUUID)
      })
    )

    it.effect("accepts another valid UUID format", () =>
      Effect.gen(function* () {
        const id = AuthUserId.make(anotherValidUUID)
        expect(id).toBe(anotherValidUUID)
      })
    )

    it.effect("rejects invalid UUID strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthUserId)
        const result = yield* Effect.exit(decode("not-a-uuid"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthUserId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects malformed UUIDs", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(AuthUserId)
        // Missing one character
        const result = yield* Effect.exit(decode("550e8400-e29b-41d4-a716-44665544000"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isAuthUserId returns true for valid AuthUserId", () => {
      const id = AuthUserId.make(validUUID)
      expect(isAuthUserId(id)).toBe(true)
    })

    it("isAuthUserId returns true for plain UUID string (validates pattern)", () => {
      expect(isAuthUserId(validUUID)).toBe(true)
    })

    it("isAuthUserId returns false for non-string values", () => {
      expect(isAuthUserId(null)).toBe(false)
      expect(isAuthUserId(undefined)).toBe(false)
      expect(isAuthUserId(123)).toBe(false)
      expect(isAuthUserId({})).toBe(false)
    })

    it("isAuthUserId returns false for invalid UUIDs", () => {
      expect(isAuthUserId("not-a-uuid")).toBe(false)
      expect(isAuthUserId("")).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates AuthUserId using Schema's .make()", () => {
      const id = AuthUserId.make(validUUID)
      expect(id).toBe(validUUID)
      expect(isAuthUserId(id)).toBe(true)
    })
  })
})
