/**
 * Router context types for TanStack Router
 */

/**
 * User object from /api/auth/me endpoint
 */
export interface User {
  readonly id: string
  readonly email: string
  readonly displayName: string
  readonly role: string
  readonly primaryProvider: string
}

/**
 * Router context provided to all routes
 */
export interface RouterContext {
  readonly user: User | null
}
