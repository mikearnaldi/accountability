/**
 * SessionTokenGenerator - Service for generating secure session tokens
 *
 * Provides cryptographically secure random token generation for session IDs.
 * Uses Effect-idiomatic random generation with configurable token length.
 *
 * Token format: URL-safe base64 (A-Za-z0-9_-) with configurable byte length
 * Default: 32 bytes of entropy = 43 characters in base64url encoding
 *
 * @module SessionTokenGenerator
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { SessionId } from "./SessionId.ts"

// =============================================================================
// Configuration
// =============================================================================

/**
 * SessionTokenConfig - Configuration for session token generation
 *
 * The byteLength determines the entropy of generated tokens.
 * More bytes = more secure but longer tokens.
 *
 * Recommended values:
 * - Minimum: 32 bytes (256 bits of entropy)
 * - High security: 48+ bytes (384+ bits of entropy)
 */
export class SessionTokenConfig extends Schema.Class<SessionTokenConfig>("SessionTokenConfig")({
  /**
   * Number of random bytes to generate for the token
   * Minimum 32 bytes ensures sufficient entropy for security
   */
  byteLength: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(32),
    Schema.annotations({
      description: "Number of random bytes for token entropy (minimum 32)"
    })
  )
}) {
  /**
   * Default configuration: 32 bytes (256 bits) of entropy
   */
  static readonly Default = SessionTokenConfig.make({ byteLength: 32 })

  /**
   * High security configuration: 48 bytes (384 bits) of entropy
   */
  static readonly HighSecurity = SessionTokenConfig.make({ byteLength: 48 })
}

/**
 * SessionTokenConfigTag - Context.Tag for dependency injection
 */
export class SessionTokenConfigTag extends Context.Tag("SessionTokenConfig")<
  SessionTokenConfigTag,
  SessionTokenConfig
>() {
  /**
   * Layer providing default configuration
   */
  static readonly Default = Layer.succeed(SessionTokenConfigTag, SessionTokenConfig.Default)

  /**
   * Layer providing high security configuration
   */
  static readonly HighSecurity = Layer.succeed(SessionTokenConfigTag, SessionTokenConfig.HighSecurity)
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * SessionTokenGeneratorService - Service interface for token generation
 *
 * Provides cryptographically secure random session token generation.
 * The generated tokens are URL-safe base64 encoded.
 */
export interface SessionTokenGeneratorService {
  /**
   * Generate a new cryptographically secure session token
   *
   * Creates a random token using crypto.getRandomValues (or platform equivalent).
   * The resulting token is URL-safe base64 encoded.
   *
   * @returns Effect containing a new SessionId (never fails)
   */
  readonly generate: () => Effect.Effect<SessionId>
}

/**
 * SessionTokenGenerator - Context.Tag for dependency injection
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const generator = yield* SessionTokenGenerator
 *   const sessionId = yield* generator.generate()
 *   // sessionId is a branded SessionId type
 * })
 *
 * // Provide the implementation
 * program.pipe(Effect.provide(SessionTokenGeneratorLive))
 * ```
 */
export class SessionTokenGenerator extends Context.Tag("SessionTokenGenerator")<
  SessionTokenGenerator,
  SessionTokenGeneratorService
>() {}

// =============================================================================
// Crypto Adapter (for dependency injection)
// =============================================================================

/**
 * CryptoRandomAdapter - Adapter interface for crypto random generation
 *
 * Used for dependency injection of the actual crypto implementation.
 * This allows the core package to remain pure while the actual
 * crypto library is injected at runtime.
 *
 * In Node.js: use crypto.randomBytes or crypto.getRandomValues
 * In browsers: use crypto.getRandomValues
 */
export interface CryptoRandomAdapter {
  /**
   * Generate random bytes
   *
   * @param length - Number of random bytes to generate
   * @returns Effect containing a Uint8Array of random bytes
   */
  readonly getRandomBytes: (length: number) => Effect.Effect<Uint8Array>
}

/**
 * CryptoRandomAdapterTag - Context.Tag for dependency injection
 *
 * This tag is used to inject the actual crypto implementation.
 * Provide a platform-specific implementation at runtime.
 */
export class CryptoRandomAdapterTag extends Context.Tag("CryptoRandomAdapter")<
  CryptoRandomAdapterTag,
  CryptoRandomAdapter
>() {}

// =============================================================================
// URL-safe Base64 Encoding
// =============================================================================

/**
 * Encode bytes to URL-safe base64 (base64url)
 *
 * Uses the standard base64 alphabet with URL-safe replacements:
 * - '+' -> '-'
 * - '/' -> '_'
 * - Removes padding '='
 *
 * @param bytes - The bytes to encode
 * @returns URL-safe base64 encoded string
 */
const encodeBase64Url = (bytes: Uint8Array): string => {
  // Convert bytes to base64
  const base64 = btoa(String.fromCharCode(...bytes))
  // Make URL-safe: replace + with -, / with _, remove padding =
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Creates the SessionTokenGenerator service implementation
 */
const makeSessionTokenGenerator = Effect.gen(function* () {
  const config = yield* SessionTokenConfigTag
  const crypto = yield* CryptoRandomAdapterTag

  const service: SessionTokenGeneratorService = {
    generate: () =>
      Effect.gen(function* () {
        const bytes = yield* crypto.getRandomBytes(config.byteLength)
        const token = encodeBase64Url(bytes)
        return SessionId.make(token)
      })
  }
  return service
})

/**
 * SessionTokenGeneratorLive - Layer for session token generation
 *
 * Requires:
 * - CryptoRandomAdapterTag: The actual crypto implementation
 * - SessionTokenConfigTag: Configuration for token length
 *
 * Usage with Web Crypto API:
 * ```typescript
 * const WebCryptoAdapter = Layer.succeed(CryptoRandomAdapterTag, {
 *   getRandomBytes: (length) =>
 *     Effect.sync(() => {
 *       const bytes = new Uint8Array(length)
 *       crypto.getRandomValues(bytes)
 *       return bytes
 *     })
 * })
 *
 * const SessionTokenGeneratorWithCrypto = SessionTokenGeneratorLive.pipe(
 *   Layer.provide(WebCryptoAdapter),
 *   Layer.provide(SessionTokenConfigTag.Default)
 * )
 * ```
 */
export const SessionTokenGeneratorLive: Layer.Layer<
  SessionTokenGenerator,
  never,
  CryptoRandomAdapterTag | SessionTokenConfigTag
> = Layer.effect(SessionTokenGenerator, makeSessionTokenGenerator)
