/**
 * WorkOSAuthProvider - Service definition for WorkOS SSO authentication
 *
 * Implements the AuthProvider interface from core for WorkOS-based
 * enterprise SSO authentication.
 *
 * @module WorkOSAuthProvider
 */

import * as Context from "effect/Context"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"

/**
 * WorkOSAuthProvider - Context.Tag for dependency injection
 *
 * Implements the AuthProvider interface for WorkOS SSO authentication.
 * Unlike LocalAuthProvider, WorkOSAuthProvider:
 * - Does NOT support registration (users auto-provision via SSO)
 * - Uses redirect-based OAuth flow (getAuthorizationUrl returns Some)
 * - Handles callback to exchange code for user profile
 *
 * Usage:
 * ```typescript
 * import { WorkOSAuthProvider } from "@accountability/persistence/Services/WorkOSAuthProvider"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* WorkOSAuthProvider
 *   const authUrl = provider.getAuthorizationUrl(state)
 *   // Redirect user to authUrl...
 * })
 * ```
 */
export class WorkOSAuthProvider extends Context.Tag("WorkOSAuthProvider")<
  WorkOSAuthProvider,
  AuthProvider
>() {}
