/**
 * Auth State Atoms
 *
 * Manages authentication state using Effect Atom.
 * Handles session token storage, user state, and authentication status.
 */

import * as Atom from "@effect-atom/atom/Atom"

// =============================================================================
// Token Management
// =============================================================================

const AUTH_TOKEN_KEY = "auth_token"

/**
 * Reads the auth token from localStorage (client-side only)
 */
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

/**
 * Stores the auth token in localStorage
 */
export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return
  if (token === null) {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  } else {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  }
}

// =============================================================================
// Auth Token Atom
// =============================================================================

/**
 * The current authentication token.
 * Initialized from localStorage on client-side.
 * Setting to null clears the token and triggers logout behavior.
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
