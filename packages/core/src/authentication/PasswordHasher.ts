/**
 * PasswordHasher - Service abstraction for secure password hashing
 *
 * Provides a type-safe interface for hashing and verifying passwords.
 * The service uses Effect's Redacted type for plain text passwords
 * to prevent accidental exposure in logs or error messages.
 *
 * Implementations:
 * - BcryptPasswordHasher: Uses bcrypt algorithm (recommended for most cases)
 * - Argon2PasswordHasher: Uses argon2id algorithm (for higher security requirements)
 *
 * @module PasswordHasher
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import { HashedPassword } from "./HashedPassword.ts"

// =============================================================================
// Configuration
// =============================================================================

/**
 * PasswordHasherConfig - Configuration for password hashing
 *
 * The work factor (cost) determines the computational cost of hashing.
 * Higher values are more secure but slower.
 *
 * Recommended values:
 * - Development: 4-6 (fast for testing)
 * - Production: 10-12 (balance of security and performance)
 * - High security: 14+ (for sensitive applications)
 */
export class PasswordHasherConfig extends Schema.Class<PasswordHasherConfig>("PasswordHasherConfig")({
  /**
   * Work factor / cost parameter for the hashing algorithm
   * For bcrypt: number of rounds (2^cost iterations)
   * For argon2: time cost parameter
   */
  workFactor: Schema.Number.pipe(
    Schema.int(),
    Schema.between(4, 31),
    Schema.annotations({
      description: "Work factor for hashing algorithm (4-31). Higher = more secure but slower."
    })
  )
}) {
  /**
   * Default configuration for production use
   */
  static readonly Default = PasswordHasherConfig.make({ workFactor: 10 })

  /**
   * Fast configuration for development/testing
   */
  static readonly Fast = PasswordHasherConfig.make({ workFactor: 4 })
}

/**
 * PasswordHasherConfig Context.Tag for dependency injection
 */
export class PasswordHasherConfigTag extends Context.Tag("PasswordHasherConfig")<
  PasswordHasherConfigTag,
  PasswordHasherConfig
>() {
  /**
   * Layer providing default production configuration
   */
  static readonly Default = Layer.succeed(PasswordHasherConfigTag, PasswordHasherConfig.Default)

  /**
   * Layer providing fast configuration for testing
   */
  static readonly Fast = Layer.succeed(PasswordHasherConfigTag, PasswordHasherConfig.Fast)
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * PasswordHasherService - Service interface for password hashing
 *
 * Provides type-safe password hashing and verification.
 * All operations are effectful to support async hashing algorithms.
 */
export interface PasswordHasherService {
  /**
   * Hash a plain text password
   *
   * Takes a Redacted password and returns a hashed version.
   * The result is branded as HashedPassword for type safety.
   *
   * @param plaintext - The plain text password wrapped in Redacted
   * @returns Effect containing the hashed password (never fails for valid input)
   */
  readonly hash: (plaintext: Redacted.Redacted<string>) => Effect.Effect<HashedPassword>

  /**
   * Verify a plain text password against a hash
   *
   * Compares the plain text password with the stored hash.
   * Uses constant-time comparison to prevent timing attacks.
   *
   * @param plaintext - The plain text password to verify wrapped in Redacted
   * @param hash - The stored hashed password
   * @returns Effect<boolean> - true if password matches, false otherwise
   */
  readonly verify: (
    plaintext: Redacted.Redacted<string>,
    hash: HashedPassword
  ) => Effect.Effect<boolean>
}

/**
 * PasswordHasher Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const hasher = yield* PasswordHasher
 *   const password = Redacted.make("my-secure-password")
 *   const hash = yield* hasher.hash(password)
 *   const isValid = yield* hasher.verify(password, hash)
 * })
 *
 * // Provide the implementation
 * program.pipe(Effect.provide(BcryptPasswordHasherLive))
 * ```
 */
export class PasswordHasher extends Context.Tag("PasswordHasher")<
  PasswordHasher,
  PasswordHasherService
>() {}

// =============================================================================
// Bcrypt Implementation
// =============================================================================

/**
 * HashFunction type for bcrypt-compatible hash function
 *
 * Used for dependency injection of the actual bcrypt implementation.
 * This allows the core package to remain pure while the actual
 * bcrypt library is injected at runtime.
 */
export interface BcryptAdapter {
  /**
   * Hash a password with the given cost/rounds
   */
  readonly hash: (password: string, rounds: number) => Effect.Effect<string>

  /**
   * Compare a password with a hash
   */
  readonly compare: (password: string, hash: string) => Effect.Effect<boolean>
}

/**
 * BcryptAdapter Context.Tag for dependency injection
 *
 * This tag is used to inject the actual bcrypt implementation.
 * In production, provide BcryptjsAdapter which wraps the bcryptjs package.
 * In tests, you can provide a mock implementation.
 */
export class BcryptAdapterTag extends Context.Tag("BcryptAdapter")<
  BcryptAdapterTag,
  BcryptAdapter
>() {}

/**
 * BcryptPasswordHasher implementation
 *
 * Creates a PasswordHasher that uses bcrypt algorithm.
 * Requires BcryptAdapter and PasswordHasherConfig to be provided.
 */
const makeBcryptPasswordHasher = Effect.gen(function* () {
  const config = yield* PasswordHasherConfigTag
  const bcrypt = yield* BcryptAdapterTag

  const service: PasswordHasherService = {
    hash: (plaintext) =>
      Effect.gen(function* () {
        const password = Redacted.value(plaintext)
        const hashed = yield* bcrypt.hash(password, config.workFactor)
        return HashedPassword.make(hashed)
      }),

    verify: (plaintext, hash) =>
      Effect.gen(function* () {
        const password = Redacted.value(plaintext)
        return yield* bcrypt.compare(password, hash)
      })
  }
  return service
})

/**
 * BcryptPasswordHasherLive - Layer for bcrypt-based password hashing
 *
 * Requires:
 * - BcryptAdapterTag: The actual bcrypt implementation
 * - PasswordHasherConfigTag: Configuration for work factor
 *
 * Usage with bcryptjs:
 * ```typescript
 * import bcrypt from "bcryptjs"
 *
 * const BcryptjsAdapter = Layer.succeed(BcryptAdapterTag, {
 *   hash: (password, rounds) =>
 *     Effect.promise(() => bcrypt.hash(password, rounds)),
 *   compare: (password, hash) =>
 *     Effect.promise(() => bcrypt.compare(password, hash))
 * })
 *
 * const PasswordHasherLive = BcryptPasswordHasherLive.pipe(
 *   Layer.provide(BcryptjsAdapter),
 *   Layer.provide(PasswordHasherConfigTag.Default)
 * )
 * ```
 */
export const BcryptPasswordHasherLive: Layer.Layer<
  PasswordHasher,
  never,
  BcryptAdapterTag | PasswordHasherConfigTag
> = Layer.effect(PasswordHasher, makeBcryptPasswordHasher)
