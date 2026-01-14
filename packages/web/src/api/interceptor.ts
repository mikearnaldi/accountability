/**
 * API Interceptor - API client with auth middleware
 *
 * This module re-exports the base API client and adds middleware to automatically
 * include the Bearer token from localStorage in the Authorization header.
 *
 * The API client is configured with `credentials: "include"` so it automatically
 * sends httpOnly cookies set by the server.
 *
 * For authenticated requests via bearer tokens, the client stores the session token
 * in localStorage after a successful login, and this middleware sends it as an
 * Authorization header in subsequent requests.
 *
 * @module api/interceptor
 */

import { api as baseApi } from "./client.ts"
import type { paths, ApiClient } from "./client.ts"
import type { Middleware } from "openapi-fetch"

// =============================================================================
// Auth Middleware
// =============================================================================

/**
 * Middleware that adds the Authorization header from localStorage
 *
 * This middleware:
 * 1. Reads the session token from localStorage (set by login/register pages)
 * 2. Adds the Bearer token to the Authorization header
 * 3. Works on client-side only (localStorage is not available on server)
 */
const authMiddleware: Middleware = {
  onRequest: ({ request }) => {
    // Only run on client-side
    if (typeof window === "undefined") {
      return request
    }

    // Get the session token from localStorage
    const token = localStorage.getItem("accountabilitySessionToken")

    // If we have a token and no Authorization header is set, add it
    if (token && !request.headers.has("Authorization")) {
      request.headers.set("Authorization", `Bearer ${token}`)
    }

    return request
  }
}

// Register the middleware
baseApi.use(authMiddleware)

// Re-export with middleware applied
export const api = baseApi
export type { paths, ApiClient }
