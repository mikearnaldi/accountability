import { describe, it, expect } from "@effect/vitest"
import { Effect, Layer, Redacted } from "effect"
import {
  PasswordHasher,
  PasswordHasherConfig,
  PasswordHasherConfigTag,
  BcryptPasswordHasherLive,
  BcryptAdapterTag,
  type BcryptAdapter
} from "../../src/authentication/PasswordHasher.ts"
import { HashedPassword } from "../../src/authentication/HashedPassword.ts"

describe("PasswordHasherConfig", () => {
  describe("validation", () => {
    it("accepts valid work factor (10)", () => {
      const config = PasswordHasherConfig.make({ workFactor: 10 })
      expect(config.workFactor).toBe(10)
    })

    it("accepts minimum work factor (4)", () => {
      const config = PasswordHasherConfig.make({ workFactor: 4 })
      expect(config.workFactor).toBe(4)
    })

    it("accepts maximum work factor (31)", () => {
      const config = PasswordHasherConfig.make({ workFactor: 31 })
      expect(config.workFactor).toBe(31)
    })

    it("Default configuration has work factor 10", () => {
      expect(PasswordHasherConfig.Default.workFactor).toBe(10)
    })

    it("Fast configuration has work factor 4", () => {
      expect(PasswordHasherConfig.Fast.workFactor).toBe(4)
    })
  })
})

describe("PasswordHasher", () => {
  // Mock bcrypt adapter for testing
  const createMockBcryptAdapter = (): BcryptAdapter => ({
    hash: (password, rounds) =>
      Effect.succeed(`$2a$${String(rounds).padStart(2, "0")}$mockhash_${password}`),
    compare: (password, hash) => {
      // Extract the password from our mock hash format
      const mockPrefix = /^\$2a\$\d{2}\$mockhash_/
      if (mockPrefix.test(hash)) {
        const storedPassword = hash.replace(mockPrefix, "")
        return Effect.succeed(password === storedPassword)
      }
      return Effect.succeed(false)
    }
  })

  // Layer providing the mock bcrypt adapter
  const MockBcryptAdapterLayer = Layer.succeed(BcryptAdapterTag, createMockBcryptAdapter())

  // Test layer combining mock adapter with fast config
  const TestPasswordHasherLayer = BcryptPasswordHasherLive.pipe(
    Layer.provide(MockBcryptAdapterLayer),
    Layer.provide(PasswordHasherConfigTag.Fast)
  )

  describe("hash", () => {
    it.effect("hashes a password and returns HashedPassword", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const plaintext = Redacted.make("mysecretpassword")
        const hash = yield* hasher.hash(plaintext)

        // Verify it's a non-empty string (HashedPassword is branded string)
        expect(typeof hash).toBe("string")
        expect(hash.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("produces different hashes for different passwords", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const password1 = Redacted.make("password1")
        const password2 = Redacted.make("password2")

        const hash1 = yield* hasher.hash(password1)
        const hash2 = yield* hasher.hash(password2)

        expect(hash1).not.toBe(hash2)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("includes work factor in the hash", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const password = Redacted.make("testpassword")
        const hash = yield* hasher.hash(password)

        // Our mock adapter includes the work factor in the hash
        expect(hash).toContain("$2a$04$") // Fast config uses work factor 4
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("uses configured work factor", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const password = Redacted.make("testpassword")
        const hash = yield* hasher.hash(password)

        // With work factor 10 (default), the hash should include $10$
        expect(hash).toContain("$2a$10$")
      }).pipe(
        Effect.provide(
          BcryptPasswordHasherLive.pipe(
            Layer.provide(MockBcryptAdapterLayer),
            Layer.provide(PasswordHasherConfigTag.Default)
          )
        )
      )
    )

    it.effect("handles empty password", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const emptyPassword = Redacted.make("")
        const hash = yield* hasher.hash(emptyPassword)

        // Hashing should work even for empty passwords (validation is separate)
        expect(typeof hash).toBe("string")
        expect(hash.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("handles long passwords", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const longPassword = Redacted.make("a".repeat(1000))
        const hash = yield* hasher.hash(longPassword)

        expect(typeof hash).toBe("string")
        expect(hash.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("handles special characters in password", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const specialPassword = Redacted.make("P@$$w0rd!#%^&*(){}[]|\\:\";<>,.?/~`")
        const hash = yield* hasher.hash(specialPassword)

        expect(typeof hash).toBe("string")
        expect(hash.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("handles unicode characters in password", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const unicodePassword = Redacted.make("password123")
        const hash = yield* hasher.hash(unicodePassword)

        expect(typeof hash).toBe("string")
        expect(hash.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )
  })

  describe("verify", () => {
    it.effect("returns true for matching password and hash", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const password = Redacted.make("correctpassword")
        const hash = yield* hasher.hash(password)

        const isValid = yield* hasher.verify(password, hash)
        expect(isValid).toBe(true)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("returns false for non-matching password", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const correctPassword = Redacted.make("correctpassword")
        const wrongPassword = Redacted.make("wrongpassword")
        const hash = yield* hasher.hash(correctPassword)

        const isValid = yield* hasher.verify(wrongPassword, hash)
        expect(isValid).toBe(false)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("returns false for similar but different passwords", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const password = Redacted.make("password123")
        const hash = yield* hasher.hash(password)

        // Test with similar passwords
        const similarPasswords = [
          "Password123", // Different case
          "password1234", // Extra character
          "password12", // Missing character
          " password123", // Leading space
          "password123 " // Trailing space
        ]

        for (const similar of similarPasswords) {
          const isValid = yield* hasher.verify(Redacted.make(similar), hash)
          expect(isValid).toBe(false)
        }
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("returns false for invalid hash format", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const password = Redacted.make("testpassword")
        const invalidHash = HashedPassword.make("invalid_hash_format")

        const isValid = yield* hasher.verify(password, invalidHash)
        expect(isValid).toBe(false)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("verifies empty password against its hash", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const emptyPassword = Redacted.make("")
        const hash = yield* hasher.hash(emptyPassword)

        const isValid = yield* hasher.verify(emptyPassword, hash)
        expect(isValid).toBe(true)

        // But not against a non-empty password's hash
        const nonEmptyHash = yield* hasher.hash(Redacted.make("notempty"))
        const isInvalid = yield* hasher.verify(emptyPassword, nonEmptyHash)
        expect(isInvalid).toBe(false)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("verification is case sensitive", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher
        const password = Redacted.make("CaseSensitive")
        const hash = yield* hasher.hash(password)

        const isValidSame = yield* hasher.verify(password, hash)
        expect(isValidSame).toBe(true)

        const isValidDifferentCase = yield* hasher.verify(
          Redacted.make("casesensitive"),
          hash
        )
        expect(isValidDifferentCase).toBe(false)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )
  })

  describe("hash and verify integration", () => {
    it.effect("hash then verify workflow works correctly", () =>
      Effect.gen(function* () {
        const hasher = yield* PasswordHasher

        // Simulate user registration
        const userPassword = Redacted.make("userpassword123")
        const storedHash = yield* hasher.hash(userPassword)

        // Simulate login attempt - correct password
        const loginPassword = Redacted.make("userpassword123")
        const loginValid = yield* hasher.verify(loginPassword, storedHash)
        expect(loginValid).toBe(true)

        // Simulate login attempt - wrong password
        const wrongLogin = Redacted.make("wrongpassword")
        const loginInvalid = yield* hasher.verify(wrongLogin, storedHash)
        expect(loginInvalid).toBe(false)
      }).pipe(Effect.provide(TestPasswordHasherLayer))
    )

    it.effect("multiple users with same password get different hashes (with real-like mock)", () =>
      Effect.gen(function* () {
        // Create a mock adapter that simulates salt behavior
        const saltedMockAdapter: BcryptAdapter = {
          hash: (password, rounds) => {
            const salt = Math.random().toString(36).substring(2, 15)
            return Effect.succeed(`$2a$${String(rounds).padStart(2, "0")}$${salt}$${password}`)
          },
          compare: (password, hash) => {
            // Extract password from hash (last part after the salt)
            const parts = hash.split("$")
            if (parts.length >= 5) {
              const storedPassword = parts[4]
              return Effect.succeed(password === storedPassword)
            }
            return Effect.succeed(false)
          }
        }

        const saltedLayer = BcryptPasswordHasherLive.pipe(
          Layer.provide(Layer.succeed(BcryptAdapterTag, saltedMockAdapter)),
          Layer.provide(PasswordHasherConfigTag.Fast)
        )

        // Use the salted layer for this test
        const hasher = yield* Effect.provide(PasswordHasher, saltedLayer)

        const samePassword = Redacted.make("samepassword")
        const hash1 = yield* hasher.hash(samePassword)
        const hash2 = yield* hasher.hash(samePassword)

        // With salting, same password should produce different hashes
        expect(hash1).not.toBe(hash2)

        // But both should verify correctly
        const verify1 = yield* hasher.verify(samePassword, hash1)
        const verify2 = yield* hasher.verify(samePassword, hash2)
        expect(verify1).toBe(true)
        expect(verify2).toBe(true)
      })
    )
  })

  describe("service requirements", () => {
    it("BcryptPasswordHasherLive requires BcryptAdapterTag and PasswordHasherConfigTag", () => {
      // This is a type-level test - the layer requires both dependencies
      // At runtime, we just verify the layer exists and has the right shape
      expect(typeof BcryptPasswordHasherLive).toBe("object")

      // The Layer type signature enforces that both BcryptAdapterTag and
      // PasswordHasherConfigTag must be provided. This is verified at compile
      // time, not runtime. If you try to use the layer without providing
      // these dependencies, TypeScript will produce a compile error.
    })
  })

  describe("config layers", () => {
    it.effect("PasswordHasherConfigTag.Default provides default config", () =>
      Effect.gen(function* () {
        const config = yield* PasswordHasherConfigTag
        expect(config.workFactor).toBe(10)
      }).pipe(Effect.provide(PasswordHasherConfigTag.Default))
    )

    it.effect("PasswordHasherConfigTag.Fast provides fast config", () =>
      Effect.gen(function* () {
        const config = yield* PasswordHasherConfigTag
        expect(config.workFactor).toBe(4)
      }).pipe(Effect.provide(PasswordHasherConfigTag.Fast))
    )
  })
})
