/**
 * Auth State Atoms
 *
 * Manages authentication state using Effect Atom.
 * Handles session token storage, user state, and authentication status.
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import { AtomRegistry } from "@effect-atom/atom/Registry"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { unsafeCoerce } from "effect/Function"
import { ApiClient } from "./ApiClient.ts"
import { getStoredToken, setStoredToken, clearStoredToken } from "./tokenStorage.ts"
import type { AuthUserResponse, LoginRequest, LoginResponse, LocalLoginCredentials, RegisterRequest } from "@accountability/api/Definitions/AuthApi"

// Re-export for backwards compatibility and convenience
export { setStoredToken, getStoredToken, clearStoredToken } from "./tokenStorage.ts"

// Re-export types for convenience
export type { LoginRequest, LoginResponse, RegisterRequest }

// =============================================================================
// Auth Token Atom
// =============================================================================

/**
 * Version counter to trigger re-reads of localStorage token.
 * Incremented whenever the token is updated via setAuthToken.
 */
const authTokenVersionAtom = Atom.make(0)

/**
 * The current authentication token.
 * Reads from localStorage and re-reads when version changes.
 *
 * To update the token, use setAuthToken() which:
 * 1. Writes to localStorage
 * 2. Increments the version to trigger subscribers
 */
export const authTokenAtom = Atom.readable((get) => {
  // Subscribe to version changes to trigger re-reads
  get(authTokenVersionAtom)
  return getStoredToken()
})


// =============================================================================
// Auth Status Atom
// =============================================================================

/**
 * Derived atom that indicates whether the user has a token (potentially authenticated).
 * Note: Having a token doesn't guarantee the session is valid - use the /me endpoint
 * to verify the session and get user details.
 */
export const hasTokenAtom = Atom.readable((get) => {
  const token = get(authTokenAtom)
  return token !== null && token.length > 0
})

// =============================================================================
// Current User Atom
// =============================================================================

/**
 * currentUserAtom - Async atom that fetches the current user when a token exists
 *
 * Behavior:
 * - Returns Initial state when no token is present
 * - Fetches /api/auth/me when token exists
 * - Automatically refetches when token changes
 * - Caches result for 5 minutes when idle
 *
 * The result includes both the user and their linked identities.
 */
export const currentUserAtom = Atom.readable((get) => {
  const hasToken = get(hasTokenAtom)

  // If no token, return initial state (not authenticated)
  if (!hasToken) {
    return Result.initial<AuthUserResponse, unknown>()
  }

  // Fetch current user from API
  return get(
    ApiClient.query("authSession", "me", {
      timeToLive: Duration.minutes(5)
    })
  )
})

// =============================================================================
// Authentication Status Atom
// =============================================================================

/**
 * isAuthenticatedAtom - Derived atom indicating if user is authenticated
 *
 * Returns true only when:
 * 1. A token exists
 * 2. The /me endpoint returned a successful response
 *
 * This is the definitive source of truth for authentication status,
 * as it verifies the session is valid on the server.
 */
export const isAuthenticatedAtom = Atom.readable((get) => {
  const userResult = get(currentUserAtom)
  return Result.isSuccess(userResult) && !userResult.waiting
})

// =============================================================================
// User Data Helpers
// =============================================================================

/**
 * Helper atom to get the current user if authenticated.
 * Returns undefined if not authenticated or still loading.
 */
export const currentUserValueAtom = Atom.readable((get) => {
  const userResult = get(currentUserAtom)
  if (Result.isSuccess(userResult)) {
    return userResult.value
  }
  return undefined
})

// =============================================================================
// Login Mutation
// =============================================================================

/**
 * Input type for local login credentials (form input)
 * Uses plain strings since form data is untyped at runtime
 */
export interface LocalLoginInput {
  readonly email: string
  readonly password: string
}

/**
 * loginMutation - Login with credentials and store token on success
 *
 * This mutation:
 * 1. Calls the login API endpoint with local credentials
 * 2. On success, stores the returned token in localStorage
 *
 * Usage:
 * ```typescript
 * const [result, login] = useAtom(loginMutation)
 *
 * // Fire-and-forget (Result tracks loading/error)
 * login({
 *   email: "user@example.com",
 *   password: "secret"
 * })
 *
 * // Or with promise mode for navigation after login
 * const [, login] = useAtom(loginMutation, { mode: "promise" })
 * const response = await login({ email, password })
 * navigate(redirectTo)
 * ```
 */
export const loginMutation = ApiClient.runtime.fn<LocalLoginInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry
    // The HttpApiClient will serialize this to JSON and the server will validate via Schema
    // Use unsafeCoerce to convert plain string credentials to the branded types
    // This is safe because the server-side Schema decoder will validate the data
    const credentials: LocalLoginCredentials = unsafeCoerce(input)
    const response: LoginResponse = yield* client.auth.login({
      payload: {
        provider: "local",
        credentials
      }
    })

    // Store the token and trigger atom update
    setStoredToken(response.token)
    registry.update(authTokenVersionAtom, (v) => v + 1)

    return response
  })
)

// =============================================================================
// Register Mutation
// =============================================================================

/**
 * Input type for local registration (form input)
 * Uses plain strings since form data is untyped at runtime
 */
export interface LocalRegisterInput {
  readonly email: string
  readonly password: string
  readonly displayName: string
}

/**
 * registerMutation - Register a new user and auto-login on success
 *
 * This mutation:
 * 1. Calls the register API endpoint with user details
 * 2. On success, automatically logs in and stores the token
 *
 * Usage:
 * ```typescript
 * const [result, register] = useAtom(registerMutation)
 *
 * // Fire-and-forget (Result tracks loading/error)
 * register({
 *   email: "user@example.com",
 *   password: "securepassword",
 *   displayName: "John Doe"
 * })
 *
 * // Or with promise mode for navigation after registration
 * const [, register] = useAtom(registerMutation, { mode: "promise" })
 * const response = await register({ email, password, displayName })
 * navigate(redirectTo)
 * ```
 */
export const registerMutation = ApiClient.runtime.fn<LocalRegisterInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry
    // Register the user - use unsafeCoerce since server validates via Schema
    const registerPayload: RegisterRequest = unsafeCoerce(input)
    yield* client.auth.register({ payload: registerPayload })

    // Auto-login after successful registration
    const credentials: LocalLoginCredentials = unsafeCoerce({
      email: input.email,
      password: input.password
    })
    const loginResponse: LoginResponse = yield* client.auth.login({
      payload: {
        provider: "local",
        credentials
      }
    })

    // Store the token and trigger atom update
    setStoredToken(loginResponse.token)
    registry.update(authTokenVersionAtom, (v) => v + 1)

    return loginResponse
  })
)

// =============================================================================
// Logout Mutation
// =============================================================================

/**
 * logoutMutation - Logout and clear session
 *
 * This mutation:
 * 1. Calls the logout API endpoint to invalidate the session server-side
 * 2. Clears the token from localStorage
 */
export const logoutMutation = ApiClient.runtime.fn<void>()(
  Effect.fnUntraced(function* () {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry
    yield* client.authSession.logout({})

    // Clear the token and trigger atom update
    clearStoredToken()
    registry.update(authTokenVersionAtom, (v) => v + 1)

    return undefined
  })
)

// =============================================================================
// OAuth Callback Mutation
// =============================================================================

/**
 * Input type for OAuth callback handling
 */
export interface OAuthCallbackInput {
  readonly provider: string
  readonly code: string
  readonly state: string
}

/**
 * handleOAuthCallbackMutation - Handle OAuth provider callback
 *
 * This mutation:
 * 1. Calls the OAuth callback API endpoint with the provider, code, and state
 * 2. On success, stores the returned token in localStorage
 *
 * Usage:
 * ```typescript
 * const [result, handleCallback] = useAtom(handleOAuthCallbackMutation, { mode: "promise" })
 *
 * try {
 *   await handleCallback({ provider, code, state })
 *   // Navigation happens after token is stored
 * } catch {
 *   // Error handling
 * }
 * ```
 */
export const handleOAuthCallbackMutation = ApiClient.runtime.fn<OAuthCallbackInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const registry = yield* AtomRegistry
    const response: LoginResponse = yield* client.auth.callback({
      path: { provider: unsafeCoerce(input.provider) },
      urlParams: {
        code: input.code,
        state: input.state
      }
    })

    // Store the token and trigger atom update
    setStoredToken(response.token)
    registry.update(authTokenVersionAtom, (v) => v + 1)

    return response
  })
)

// =============================================================================
// OAuth Link Callback Mutation
// =============================================================================

/**
 * handleOAuthLinkCallbackMutation - Handle OAuth provider link callback
 *
 * This mutation:
 * 1. Calls the OAuth link callback API endpoint with the provider, code, and state
 * 2. On success, returns the updated user with new identity (token already exists)
 *
 * Usage:
 * ```typescript
 * const [result, handleLinkCallback] = useAtom(handleOAuthLinkCallbackMutation, { mode: "promise" })
 *
 * try {
 *   await handleLinkCallback({ provider, code, state })
 *   // Navigate to account settings or refresh user
 * } catch {
 *   // Error handling
 * }
 * ```
 */
export const handleOAuthLinkCallbackMutation = ApiClient.runtime.fn<OAuthCallbackInput>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ApiClient
    const response: AuthUserResponse = yield* client.authSession.linkCallback({
      path: { provider: unsafeCoerce(input.provider) },
      urlParams: {
        code: input.code,
        state: input.state
      }
    })

    return response
  })
)
