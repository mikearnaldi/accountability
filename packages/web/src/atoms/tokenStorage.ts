/**
 * Token Storage
 *
 * Provides localStorage-based token storage functions.
 * This module has no dependencies to avoid circular imports.
 *
 * @module tokenStorage
 */

// =============================================================================
// Constants
// =============================================================================

const AUTH_TOKEN_KEY = "auth_token"

// =============================================================================
// Token Storage Functions
// =============================================================================

/**
 * Reads the auth token from localStorage (client-side only)
 */
export function getStoredToken(): string | null {
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

/**
 * Clears the auth token from localStorage
 */
export function clearStoredToken(): void {
  setStoredToken(null)
}
