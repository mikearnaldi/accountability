/**
 * AuthProvider - Strategy pattern interface for authentication providers
 *
 * Defines the contract that each authentication provider must implement.
 * This allows the AuthService to work with multiple providers uniformly
 * while each provider handles its specific authentication flow.
 *
 * Supported providers:
 * - local: Email/password authentication
 * - google: Google OAuth
 * - github: GitHub OAuth
 * - workos: WorkOS SSO
 * - saml: SAML-based enterprise SSO
 *
 * @module AuthProvider
 */

import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import type { AuthProviderType } from "./AuthProviderType.ts"
import type { AuthRequest } from "./AuthRequest.ts"
import type { AuthResult } from "./AuthResult.ts"
import type {
  InvalidCredentialsError,
  ProviderAuthFailedError,
  OAuthStateError
} from "./AuthErrors.ts"

// =============================================================================
// AuthProvider Interface
// =============================================================================

/**
 * AuthProvider - Individual provider implementation contract
 *
 * Each authentication provider (local, Google, GitHub, etc.) implements this
 * interface to provide a consistent API for the AuthService.
 *
 * The strategy pattern allows:
 * - Adding new providers without modifying the AuthService
 * - Testing each provider independently
 * - Runtime selection of providers based on configuration
 */
export interface AuthProvider {
  /**
   * The type identifier for this provider
   */
  readonly type: AuthProviderType

  /**
   * Whether this provider supports user registration
   *
   * - local: true (users can register with email/password)
   * - OAuth providers: typically true (can create accounts on first login)
   * - WorkOS/SAML: may be false (users managed externally by SSO provider)
   */
  readonly supportsRegistration: boolean

  /**
   * Authenticate a user with this provider
   *
   * For local provider: validates email/password credentials
   * For OAuth providers: exchanges auth code for tokens and fetches user info
   * For SAML: validates SAML assertion
   *
   * @param request - The authentication request (type depends on provider)
   * @returns Effect containing AuthResult on success
   * @errors InvalidCredentialsError - For local: wrong email/password
   * @errors ProviderAuthFailedError - For OAuth/SAML: provider returned error
   * @errors OAuthStateError - For OAuth: state parameter mismatch (CSRF)
   */
  readonly authenticate: (
    request: AuthRequest
  ) => Effect.Effect<AuthResult, InvalidCredentialsError | ProviderAuthFailedError | OAuthStateError>

  /**
   * Get the authorization URL for OAuth/SAML providers
   *
   * For providers that require a redirect-based flow (OAuth, SAML), this
   * returns the URL to redirect the user to for authentication.
   *
   * For local provider, this returns None (no redirect needed).
   *
   * @param state - CSRF protection state parameter to include in the URL
   * @param redirectUri - Optional custom redirect URI
   * @returns Option containing the authorization URL, or None for non-redirect providers
   */
  readonly getAuthorizationUrl: (
    state: string,
    redirectUri?: string
  ) => Option.Option<string>

  /**
   * Handle the OAuth/SAML callback after redirect
   *
   * This is called when the user returns from the provider's login page.
   * For OAuth: exchanges the authorization code for tokens
   * For SAML: validates the SAML response
   *
   * For local provider, this method should not be called (use authenticate instead).
   *
   * @param code - The authorization code (OAuth) or SAML response
   * @param state - The state parameter for CSRF validation
   * @returns Effect containing AuthResult on success
   * @errors ProviderAuthFailedError - Provider returned an error
   * @errors OAuthStateError - State parameter mismatch (CSRF protection)
   */
  readonly handleCallback: (
    code: string,
    state: string
  ) => Effect.Effect<AuthResult, ProviderAuthFailedError | OAuthStateError>
}

// =============================================================================
// Provider Registry Type
// =============================================================================

/**
 * AuthProviderRegistry - Registry of enabled authentication providers
 *
 * Used by AuthService to look up providers by type.
 * Implemented as a Map for O(1) lookup performance.
 */
export type AuthProviderRegistry = ReadonlyMap<AuthProviderType, AuthProvider>
