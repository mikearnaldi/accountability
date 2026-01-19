import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import { SessionId, isSessionId } from "../../src/authentication/SessionId.ts"

describe("SessionId", () => {
  // 32+ character base64url-encoded token
  const validSessionId = "abcdefghijklmnopqrstuvwxyz123456"
  const validSessionId2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"

  describe("validation", () => {
    it.effect("accepts valid session tokens (32 chars)", () =>
      Effect.gen(function* () {
        const id = SessionId.make(validSessionId)
        expect(id).toBe(validSessionId)
      })
    )

    it.effect("accepts longer session tokens", () =>
      Effect.gen(function* () {
        const id = SessionId.make(validSessionId2)
        expect(id).toBe(validSessionId2)
      })
    )

    it.effect("accepts tokens with underscores and hyphens (base64url)", () =>
      Effect.gen(function* () {
        const token = "abc_def-ghi_jkl-mno_pqr-stu_vwx123"
        const id = SessionId.make(token)
        expect(id).toBe(token)
      })
    )

    it.effect("rejects tokens shorter than 32 characters", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(SessionId)
        const result = yield* Effect.exit(decode("abc123")) // Too short
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty strings", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(SessionId)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects tokens with invalid characters", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(SessionId)
        // Contains spaces
        const result = yield* Effect.exit(decode("abcdefghijklmnopqrstuvwxyz 12345"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects tokens with special characters", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(SessionId)
        // Contains = and + (not base64url)
        const result = yield* Effect.exit(decode("abcdefghijklmnopqrstuvwxyz12345+"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isSessionId returns true for valid SessionId", () => {
      const id = SessionId.make(validSessionId)
      expect(isSessionId(id)).toBe(true)
    })

    it("isSessionId returns true for plain valid string", () => {
      expect(isSessionId(validSessionId)).toBe(true)
    })

    it("isSessionId returns false for non-string values", () => {
      expect(isSessionId(null)).toBe(false)
      expect(isSessionId(undefined)).toBe(false)
      expect(isSessionId(123)).toBe(false)
      expect(isSessionId({})).toBe(false)
    })

    it("isSessionId returns false for invalid session tokens", () => {
      expect(isSessionId("short")).toBe(false)
      expect(isSessionId("")).toBe(false)
      expect(isSessionId("has space in the middle here!!!")).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates SessionId using Schema's .make()", () => {
      const id = SessionId.make(validSessionId)
      expect(id).toBe(validSessionId)
      expect(isSessionId(id)).toBe(true)
    })
  })
})
