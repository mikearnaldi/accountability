import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit, Equal, Redacted } from "effect"
import * as Schema from "effect/Schema"
import {
  LocalCredentials,
  isLocalCredentials,
  Password,
  RedactedPassword
} from "../../src/authentication/LocalCredentials.ts"
import { Email } from "../../src/authentication/Email.ts"

describe("Password", () => {
  describe("validation", () => {
    it.effect("accepts valid passwords (8+ characters)", () =>
      Effect.gen(function* () {
        const password = yield* Schema.decodeUnknown(Password)("password123")
        expect(password).toBe("password123")
      })
    )

    it.effect("accepts passwords exactly 8 characters", () =>
      Effect.gen(function* () {
        const password = yield* Schema.decodeUnknown(Password)("12345678")
        expect(password).toBe("12345678")
      })
    )

    it.effect("accepts long passwords", () =>
      Effect.gen(function* () {
        const longPassword = "a".repeat(100)
        const password = yield* Schema.decodeUnknown(Password)(longPassword)
        expect(password).toBe(longPassword)
      })
    )

    it.effect("rejects passwords shorter than 8 characters", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Password)
        const result = yield* Effect.exit(decode("short"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects empty passwords", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Password)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects 7 character passwords", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(Password)
        const result = yield* Effect.exit(decode("1234567"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })
})

describe("RedactedPassword", () => {
  describe("validation", () => {
    it.effect("accepts valid passwords and wraps in Redacted", () =>
      Effect.gen(function* () {
        const redacted = yield* Schema.decodeUnknown(RedactedPassword)("password123")
        expect(Redacted.isRedacted(redacted)).toBe(true)
        expect(Redacted.value(redacted)).toBe("password123")
      })
    )

    it.effect("rejects passwords shorter than 8 characters", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(RedactedPassword)
        const result = yield* Effect.exit(decode("short"))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("redaction behavior", () => {
    it("toString does not reveal password", () => {
      const password = Redacted.make("secretpassword")
      const stringified = String(password)
      expect(stringified).not.toContain("secretpassword")
      expect(stringified).toContain("redacted")
    })

    it("value() retrieves the original password", () => {
      const password = Redacted.make("secretpassword")
      expect(Redacted.value(password)).toBe("secretpassword")
    })
  })
})

describe("LocalCredentials", () => {
  const createValidCredentials = () =>
    LocalCredentials.make({
      email: Email.make("user@example.com"),
      password: Redacted.make("password123")
    })

  describe("validation", () => {
    it.effect("accepts valid credentials", () =>
      Effect.gen(function* () {
        const creds = createValidCredentials()
        expect(creds.email).toBe("user@example.com")
        expect(Redacted.value(creds.password)).toBe("password123")
      })
    )

    it.effect("accepts credentials with different valid emails", () =>
      Effect.gen(function* () {
        const creds = LocalCredentials.make({
          email: Email.make("admin@company.org"),
          password: Redacted.make("securepassword")
        })
        expect(creds.email).toBe("admin@company.org")
      })
    )

    it.effect("rejects invalid email", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalCredentials)
        const result = yield* Effect.exit(decode({
          email: "not-an-email",
          password: "password123"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects password too short", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalCredentials)
        const result = yield* Effect.exit(decode({
          email: "user@example.com",
          password: "short"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing email", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalCredentials)
        const result = yield* Effect.exit(decode({
          password: "password123"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects missing password", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(LocalCredentials)
        const result = yield* Effect.exit(decode({
          email: "user@example.com"
        }))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("type guard", () => {
    it("isLocalCredentials returns true for LocalCredentials instances", () => {
      const creds = createValidCredentials()
      expect(isLocalCredentials(creds)).toBe(true)
    })

    it("isLocalCredentials returns false for plain objects", () => {
      expect(isLocalCredentials({
        email: "user@example.com",
        password: "password123"
      })).toBe(false)
    })

    it("isLocalCredentials returns false for non-object values", () => {
      expect(isLocalCredentials(null)).toBe(false)
      expect(isLocalCredentials(undefined)).toBe(false)
      expect(isLocalCredentials("credentials")).toBe(false)
    })
  })

  describe("equality", () => {
    it("Equal.equals works for LocalCredentials", () => {
      const creds1 = createValidCredentials()
      const creds2 = LocalCredentials.make({
        email: Email.make("user@example.com"),
        password: Redacted.make("password123")
      })
      const creds3 = LocalCredentials.make({
        email: Email.make("other@example.com"),
        password: Redacted.make("differentpassword")
      })

      expect(Equal.equals(creds1, creds2)).toBe(true)
      expect(Equal.equals(creds1, creds3)).toBe(false)
    })
  })

  describe("encoding", () => {
    it.effect("encodes and decodes LocalCredentials", () =>
      Effect.gen(function* () {
        const original = createValidCredentials()
        const encoded = yield* Schema.encode(LocalCredentials)(original)
        const decoded = yield* Schema.decodeUnknown(LocalCredentials)(encoded)

        expect(Equal.equals(original, decoded)).toBe(true)
      })
    )

    it.effect("encodes to expected JSON structure", () =>
      Effect.gen(function* () {
        const creds = createValidCredentials()
        const encoded = yield* Schema.encode(LocalCredentials)(creds)

        expect(encoded).toHaveProperty("email", "user@example.com")
        expect(encoded).toHaveProperty("password", "password123")
      })
    )
  })

  describe("security", () => {
    it("password is not exposed when logging credentials object", () => {
      const creds = createValidCredentials()
      // The password field is a Redacted, so it won't show the actual password
      const stringified = JSON.stringify(creds, (_, value) => {
        if (Redacted.isRedacted(value)) {
          return "<redacted>"
        }
        return value
      })
      expect(stringified).not.toContain("password123")
    })
  })
})
