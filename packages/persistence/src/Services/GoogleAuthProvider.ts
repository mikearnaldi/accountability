/**
 * GoogleAuthProvider - Service definition for Google OAuth authentication
 *
 * Implements the AuthProvider interface from core for Google OAuth2 authentication.
 *
 * @module GoogleAuthProvider
 */

import * as Context from "effect/Context"
import type { AuthProvider } from "@accountability/core/authentication/AuthProvider"

/**
 * GoogleAuthProvider - Context.Tag for dependency injection
 *
 * Implements the AuthProvider interface for Google OAuth authentication.
 * GoogleAuthProvider:
 * - Does NOT support registration (users auto-provision on first OAuth login)
 * - Uses redirect-based OAuth flow (getAuthorizationUrl returns Some)
 * - Handles callback to exchange code for user profile via Google APIs
 *
 * Google OAuth scopes used:
 * - openid: Required for OpenID Connect
 * - email: User's email address
 * - profile: User's basic profile info (name, picture)
 *
 * Usage:
 * ```typescript
 * import { GoogleAuthProvider } from "@accountability/persistence/Services/GoogleAuthProvider"
 *
 * const program = Effect.gen(function* () {
 *   const provider = yield* GoogleAuthProvider
 *   const authUrl = provider.getAuthorizationUrl(state)
 *   // Redirect user to authUrl...
 * })
 * ```
 */
export class GoogleAuthProvider extends Context.Tag("GoogleAuthProvider")<
  GoogleAuthProvider,
  AuthProvider
>() {}
