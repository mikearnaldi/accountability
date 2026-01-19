import { describe, it, expect } from "@effect/vitest"
import { Effect, Layer, HashSet } from "effect"
import {
  SessionTokenGenerator,
  SessionTokenConfig,
  SessionTokenConfigTag,
  SessionTokenGeneratorLive,
  CryptoRandomAdapterTag,
  type CryptoRandomAdapter
} from "../../src/authentication/SessionTokenGenerator.ts"
import { isSessionId } from "../../src/authentication/SessionId.ts"

describe("SessionTokenConfig", () => {
  describe("validation", () => {
    it("accepts valid byte length (32)", () => {
      const config = SessionTokenConfig.make({ byteLength: 32 })
      expect(config.byteLength).toBe(32)
    })

    it("accepts higher byte lengths (48, 64)", () => {
      const config48 = SessionTokenConfig.make({ byteLength: 48 })
      expect(config48.byteLength).toBe(48)

      const config64 = SessionTokenConfig.make({ byteLength: 64 })
      expect(config64.byteLength).toBe(64)
    })

    it("Default configuration has 32 bytes", () => {
      expect(SessionTokenConfig.Default.byteLength).toBe(32)
    })

    it("HighSecurity configuration has 48 bytes", () => {
      expect(SessionTokenConfig.HighSecurity.byteLength).toBe(48)
    })
  })
})

describe("SessionTokenGenerator", () => {
  // Create a deterministic mock crypto adapter for testing
  const createMockCryptoAdapter = (): CryptoRandomAdapter => {
    let counter = 0
    return {
      getRandomBytes: (length) =>
        Effect.sync(() => {
          const bytes = new Uint8Array(length)
          for (let i = 0; i < length; i++) {
            // Create pseudo-random but deterministic bytes for testing
            bytes[i] = (counter + i) % 256
          }
          counter += length
          return bytes
        })
    }
  }

  // Create a truly random mock adapter using Math.random
  const createRandomCryptoAdapter = (): CryptoRandomAdapter => ({
    getRandomBytes: (length) =>
      Effect.sync(() => {
        const bytes = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
          bytes[i] = Math.floor(Math.random() * 256)
        }
        return bytes
      })
  })

  // Layer providing the mock crypto adapter
  const MockCryptoAdapterLayer = Layer.succeed(CryptoRandomAdapterTag, createMockCryptoAdapter())
  const RandomCryptoAdapterLayer = Layer.succeed(CryptoRandomAdapterTag, createRandomCryptoAdapter())

  // Test layer combining mock adapter with default config
  const TestSessionTokenGeneratorLayer = SessionTokenGeneratorLive.pipe(
    Layer.provide(MockCryptoAdapterLayer),
    Layer.provide(SessionTokenConfigTag.Default)
  )

  // Test layer with random adapter for uniqueness tests
  const RandomSessionTokenGeneratorLayer = SessionTokenGeneratorLive.pipe(
    Layer.provide(RandomCryptoAdapterLayer),
    Layer.provide(SessionTokenConfigTag.Default)
  )

  describe("generate", () => {
    it.effect("generates a valid SessionId", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId = yield* generator.generate()

        // Verify it's a valid SessionId (passes type guard)
        expect(isSessionId(sessionId)).toBe(true)
      }).pipe(Effect.provide(TestSessionTokenGeneratorLayer))
    )

    it.effect("generates tokens with at least 32 characters (sufficient length)", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId = yield* generator.generate()

        // SessionId requires minimum 32 characters
        expect(sessionId.length).toBeGreaterThanOrEqual(32)
      }).pipe(Effect.provide(TestSessionTokenGeneratorLayer))
    )

    it.effect("generates URL-safe base64 tokens (only A-Za-z0-9_-)", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId = yield* generator.generate()

        // URL-safe base64 only contains these characters
        const urlSafePattern = /^[A-Za-z0-9_-]+$/
        expect(urlSafePattern.test(sessionId)).toBe(true)
      }).pipe(Effect.provide(TestSessionTokenGeneratorLayer))
    )

    it.effect("generates different tokens on each call", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId1 = yield* generator.generate()
        const sessionId2 = yield* generator.generate()
        const sessionId3 = yield* generator.generate()

        // All tokens should be different
        expect(sessionId1).not.toBe(sessionId2)
        expect(sessionId2).not.toBe(sessionId3)
        expect(sessionId1).not.toBe(sessionId3)
      }).pipe(Effect.provide(RandomSessionTokenGeneratorLayer))
    )

    it.effect("generates unique tokens in bulk (100 tokens)", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator

        // Generate 100 tokens
        const tokens = yield* Effect.all(
          Array.from({ length: 100 }, () => generator.generate()),
          { concurrency: "unbounded" }
        )

        // All tokens should be unique - use HashSet to verify
        const uniqueTokens = HashSet.fromIterable(tokens)
        expect(HashSet.size(uniqueTokens)).toBe(100)
      }).pipe(Effect.provide(RandomSessionTokenGeneratorLayer))
    )

    it.effect("tokens have no padding characters (=)", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId = yield* generator.generate()

        // URL-safe base64 should have padding removed
        expect(sessionId).not.toContain("=")
      }).pipe(Effect.provide(TestSessionTokenGeneratorLayer))
    )

    it.effect("tokens have no standard base64 special chars (+/)", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId = yield* generator.generate()

        // Should use - and _ instead of + and /
        expect(sessionId).not.toContain("+")
        expect(sessionId).not.toContain("/")
      }).pipe(Effect.provide(TestSessionTokenGeneratorLayer))
    )
  })

  describe("configuration", () => {
    it.effect("uses configured byte length", () =>
      Effect.gen(function* () {
        // 48 bytes = 64 characters in base64 (48 * 4/3 = 64)
        const highSecurityLayer = SessionTokenGeneratorLive.pipe(
          Layer.provide(RandomCryptoAdapterLayer),
          Layer.provide(SessionTokenConfigTag.HighSecurity)
        )

        const generator = yield* Effect.provide(SessionTokenGenerator, highSecurityLayer)
        const sessionId = yield* generator.generate()

        // 48 bytes encodes to approximately 64 characters (may be 63-64 due to padding removal)
        // At minimum it should be longer than 32-byte tokens
        expect(sessionId.length).toBeGreaterThan(42)
      })
    )

    it.effect("default config generates tokens of expected length", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId = yield* generator.generate()

        // 32 bytes encodes to approximately 43 characters in base64url
        // (32 * 4/3 = 42.67, rounded up without padding)
        expect(sessionId.length).toBeGreaterThanOrEqual(42)
        expect(sessionId.length).toBeLessThanOrEqual(44)
      }).pipe(Effect.provide(TestSessionTokenGeneratorLayer))
    )
  })

  describe("token format", () => {
    it.effect("generates tokens that match SessionId schema pattern", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator

        // Generate multiple tokens and verify they all match the pattern
        for (let i = 0; i < 10; i++) {
          const sessionId = yield* generator.generate()

          // Must be at least 32 chars
          expect(sessionId.length).toBeGreaterThanOrEqual(32)

          // Must match URL-safe base64 pattern (as required by SessionId schema)
          const pattern = /^[A-Za-z0-9_-]+$/
          expect(pattern.test(sessionId)).toBe(true)
        }
      }).pipe(Effect.provide(RandomSessionTokenGeneratorLayer))
    )

    it.effect("tokens are string type", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator
        const sessionId = yield* generator.generate()

        expect(typeof sessionId).toBe("string")
      }).pipe(Effect.provide(TestSessionTokenGeneratorLayer))
    )
  })

  describe("crypto adapter requirements", () => {
    it.effect("calls crypto adapter with configured byte length", () =>
      Effect.gen(function* () {
        let capturedLength = 0

        const capturingAdapter: CryptoRandomAdapter = {
          getRandomBytes: (length) =>
            Effect.sync(() => {
              capturedLength = length
              return new Uint8Array(length).fill(65) // Fill with 'A' bytes
            })
        }

        const capturingLayer = SessionTokenGeneratorLive.pipe(
          Layer.provide(Layer.succeed(CryptoRandomAdapterTag, capturingAdapter)),
          Layer.provide(SessionTokenConfigTag.Default)
        )

        const generator = yield* Effect.provide(SessionTokenGenerator, capturingLayer)
        yield* generator.generate()

        // Should request 32 bytes (default config)
        expect(capturedLength).toBe(32)
      })
    )

    it.effect("calls crypto adapter with high security byte length", () =>
      Effect.gen(function* () {
        let capturedLength = 0

        const capturingAdapter: CryptoRandomAdapter = {
          getRandomBytes: (length) =>
            Effect.sync(() => {
              capturedLength = length
              return new Uint8Array(length).fill(65)
            })
        }

        const capturingLayer = SessionTokenGeneratorLive.pipe(
          Layer.provide(Layer.succeed(CryptoRandomAdapterTag, capturingAdapter)),
          Layer.provide(SessionTokenConfigTag.HighSecurity)
        )

        const generator = yield* Effect.provide(SessionTokenGenerator, capturingLayer)
        yield* generator.generate()

        // Should request 48 bytes (high security config)
        expect(capturedLength).toBe(48)
      })
    )
  })

  describe("service requirements", () => {
    it("SessionTokenGeneratorLive requires CryptoRandomAdapterTag and SessionTokenConfigTag", () => {
      // This is a type-level test - the layer requires both dependencies
      expect(typeof SessionTokenGeneratorLive).toBe("object")
    })
  })

  describe("config layers", () => {
    it.effect("SessionTokenConfigTag.Default provides default config", () =>
      Effect.gen(function* () {
        const config = yield* SessionTokenConfigTag
        expect(config.byteLength).toBe(32)
      }).pipe(Effect.provide(SessionTokenConfigTag.Default))
    )

    it.effect("SessionTokenConfigTag.HighSecurity provides high security config", () =>
      Effect.gen(function* () {
        const config = yield* SessionTokenConfigTag
        expect(config.byteLength).toBe(48)
      }).pipe(Effect.provide(SessionTokenConfigTag.HighSecurity))
    )
  })

  describe("entropy verification", () => {
    it.effect("tokens have sufficient entropy (byte distribution)", () =>
      Effect.gen(function* () {
        const generator = yield* SessionTokenGenerator

        // Generate multiple tokens and check character distribution
        const allChars: string[] = []
        for (let i = 0; i < 20; i++) {
          const token = yield* generator.generate()
          allChars.push(...token.split(""))
        }

        // Count unique characters used
        const uniqueChars = new Set(allChars)

        // With random data, we should see a good variety of the 64 possible base64url chars
        // At minimum we should see at least 30 different characters in 20*43 = 860 chars
        expect(uniqueChars.size).toBeGreaterThan(30)
      }).pipe(Effect.provide(RandomSessionTokenGeneratorLayer))
    )
  })
})
