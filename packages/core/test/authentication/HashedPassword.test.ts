import { describe, it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"
import * as Schema from "effect/Schema"
import { HashedPassword } from "../../src/authentication/HashedPassword.ts"

describe("HashedPassword", () => {
  describe("schema validation", () => {
    it("accepts valid bcrypt hash format", () => {
      // A valid bcrypt hash is 60 characters starting with $2a$ or $2b$
      const bcryptHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3P3sPTLXeNY2"
      const result = HashedPassword.make(bcryptHash)
      expect(result).toBe(bcryptHash)
    })

    it("accepts valid argon2 hash format", () => {
      // A valid argon2 hash starts with $argon2
      const argon2Hash = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$hash"
      const result = HashedPassword.make(argon2Hash)
      expect(result).toBe(argon2Hash)
    })

    it("accepts any non-empty string (schema validates structure, not format)", () => {
      // The schema only validates that it's a non-empty trimmed string
      // The actual hash format is enforced by the hashing algorithm
      const simpleHash = "somehashvalue"
      const result = HashedPassword.make(simpleHash)
      expect(result).toBe(simpleHash)
    })

    it.effect("rejects empty string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(HashedPassword)
        const result = yield* Effect.exit(decode(""))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects whitespace-only string", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(HashedPassword)
        const result = yield* Effect.exit(decode("   "))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )

    it.effect("rejects strings with leading/trailing whitespace", () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknown(HashedPassword)
        // NonEmptyTrimmedString validates that the string is already trimmed
        const result = yield* Effect.exit(decode("  $2a$10$validhash  "))
        expect(Exit.isFailure(result)).toBe(true)
      })
    )
  })

  describe("branding", () => {
    it("creates a branded type", () => {
      const hash = HashedPassword.make("$2a$10$somehashvalue")
      // The brand is applied at the type level
      // At runtime, it's still just a string
      expect(typeof hash).toBe("string")
    })

    it("different hashes are different values", () => {
      const hash1 = HashedPassword.make("$2a$10$hash1")
      const hash2 = HashedPassword.make("$2a$10$hash2")
      expect(hash1).not.toBe(hash2)
    })

    it("same hash values are equal", () => {
      const hashValue = "$2a$10$samehash"
      const hash1 = HashedPassword.make(hashValue)
      const hash2 = HashedPassword.make(hashValue)
      expect(hash1).toBe(hash2)
    })
  })

  describe("type safety", () => {
    it("HashedPassword type is a string at runtime", () => {
      const hash: HashedPassword = HashedPassword.make("$2a$10$hash")
      // This verifies the type is assignable from string
      expect(typeof hash).toBe("string")
    })
  })
})
