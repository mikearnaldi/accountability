/**
 * Auth State Atoms
 *
 * Manages authentication state using Effect Atom.
 * Handles session token storage, user state, and authentication status.
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import * as Duration from "effect/Duration"
import { ApiClient } from "./ApiClient.ts"
import { getStoredToken, setStoredToken } from "./tokenStorage.ts"
import type { AuthUserResponse } from "@accountability/api/Definitions/AuthApi"

// Re-export for backwards compatibility and convenience
export { setStoredToken, getStoredToken, clearStoredToken } from "./tokenStorage.ts"

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
