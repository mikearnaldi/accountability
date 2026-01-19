import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import { Email, isEmail } from "../../src/authentication/Email.ts"

describe("Email", () => {
  describe("validation", () => {
    it.effect("accepts valid email addresses", () =>
      Effect.gen(function* () {
        const email = Email.make("user@example.com")
        expect(email).toBe("user@example.com")
      })
    )

    it.effect("accepts email with subdomain", () =>
      Effect.gen(function* () {
        const email = Email.make("user@mail.example.com")
        expect(email).toBe("user@mail.example.com")
      })
    )

    it.effect("accepts email with plus sign", () =>
      Effect.gen(function* () {
        const email = Email.make("user+tag@example.com")
        expect(email).toBe("user+tag@example.com")
      })
    )

    it.effect("accepts email with dots in local part", () =>
      Effect.gen(function* () {
        const email = Email.make("first.last@example.com")
        expect(email).toBe("first.last@example.com")
      })
    )

    it.effect("accepts email with numbers", () =>
      Effect.gen(function* () {
        const email = Email.make("user123@example123.com")
        expect(email).toBe("user123@example123.com")
      })
    )

    it.effect("accepts email with hyphen in domain", () =>
      Effect.gen(function* () {
        const email = Email.make("user@my-domain.com")
        expect(email).toBe("user@my-domain.com")
      })
    )

    it.effect("rejects email without @ symbol", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Email)
        const result = yield* Effect.exit(decode("userexample.com"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects email without domain", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Email)
        const result = yield* Effect.exit(decode("user@"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects email without local part", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Email)
        const result = yield* Effect.exit(decode("@example.com"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects email without TLD", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Email)
        const result = yield* Effect.exit(decode("user@example"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Email)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects email with spaces", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Email)
        const result = yield* Effect.exit(decode("user @example.com"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isEmail returns true for valid Email", () => {
      const email = Email.make("test@example.com")
      expect(isEmail(email)).toBe(true)
    })

    it("isEmail returns true for plain valid email string", () => {
      expect(isEmail("test@example.com")).toBe(true)
    })

    it("isEmail returns false for invalid emails", () => {
      expect(isEmail("notanemail")).toBe(false)
      expect(isEmail("@domain.com")).toBe(false)
      expect(isEmail("user@")).toBe(false)
      expect(isEmail("")).toBe(false)
    })

    it("isEmail returns false for non-string values", () => {
      expect(isEmail(null)).toBe(false)
      expect(isEmail(undefined)).toBe(false)
      expect(isEmail(123)).toBe(false)
      expect(isEmail({})).toBe(false)
    })
  })

  describe("Schema.make() constructor", () => {
    it("creates Email using Schema's .make()", () => {
      const email = Email.make("user@example.com")
      expect(email).toBe("user@example.com")
      expect(isEmail(email)).toBe(true)
    })
  })
})
