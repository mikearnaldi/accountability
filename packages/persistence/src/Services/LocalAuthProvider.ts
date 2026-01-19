/**
 * LocalAuthProvider - Service definition for local (email/password) authentication
 *
 * Implements the AuthProvider interface from core for local authentication.
 * Uses email/password credentials with bcrypt password hashing.
 *
 * @module LocalAuthProvider
 */

import * as Context from "effect/Context"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"

/**
 * LocalAuthProvider - Context.Tag for dependency injection
 *
 * Implements the AuthProvider interface for local (email/password) authentication.
 *
 * Usage:
 * ```typescript
 * import { LocalAuthProvider } from "@accountability/persistence/Services/LocalAuthProvider"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* LocalAuthProvider
 *   const result = yield* provider.authenticate(localAuthRequest)
 *   // ...
 * })
 * ```
 */
export class LocalAuthProvider extends Context.Tag("LocalAuthProvider")<
  LocalAuthProvider,
  AuthProvider
>() {}
