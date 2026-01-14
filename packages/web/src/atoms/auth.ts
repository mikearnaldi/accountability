/**
 * Auth State Atoms
 *
 * Manages authentication state using Effect Atom.
 * Handles session token storage, user state, and authentication status.
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { unsafeCoerce } from "effect/Function"
import { ApiClient } from "./ApiClient.ts"
import { getStoredToken, setStoredToken, clearStoredToken } from "./tokenStorage.ts"
import type { AuthUserResponse, LoginRequest, LoginResponse, LocalLoginCredentials } from "@accountability/api/Definitions/AuthApi"

// Re-export for backwards compatibility and convenience
export { setStoredToken, getStoredToken, clearStoredToken } from "./tokenStorage.ts"

// Re-export types for convenience
export type { LoginRequest, LoginResponse }

// =============================================================================
// Auth Token Atom
// =============================================================================

/**
 * The current authentication token.
 * Initialized from localStorage on client-side.
 * Setting to null clears the token and triggers logout behavior.
 *
 * This atom is persisted to localStorage - changes are automatically synced.
 */
export const authTokenAtom = Atom.writable(
  () => getStoredToken(),
  (_set, token: string | null) => {
    setStoredToken(token)
    return token
  }
)

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

    // Store the token on successful login
    setStoredToken(response.token)

    return response
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
    yield* client.authSession.logout({})

    // Clear the token from localStorage
    clearStoredToken()

    return undefined
  })
)
