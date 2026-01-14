/**
 * ApiClient - Type-safe Effect Atom HTTP API Client
 *
 * Provides a type-safe API client using AtomHttpApi.Tag with authentication support.
 * The client automatically adds Bearer tokens to requests and handles 401 responses
 * by clearing the stored token.
 *
 * @module ApiClient
 */

import * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import { setStoredToken } from "./auth.ts"

// =============================================================================
// Auth Token Storage Key
// =============================================================================

const AUTH_TOKEN_KEY = "auth_token"

// =============================================================================
// Authenticated HTTP Client Layer
// =============================================================================

/**
 * Reads the auth token from localStorage (client-side only)
 */
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

/**
 * AuthenticatedHttpClient - HTTP client layer that adds Bearer token authentication
 *
 * Features:
 * - Automatically adds Bearer token from localStorage to all requests
 * - Intercepts 401 responses and clears the stored token (auto-logout)
 */
export const AuthenticatedHttpClient = FetchHttpClient.layer.pipe(
  Layer.map((context) => {
    const client = Context.get(context, HttpClient.HttpClient)

    // Add Bearer token to requests
    const withAuth = HttpClient.mapRequest(client, (request) => {
      const token = getStoredToken()
      return token
        ? HttpClientRequest.bearerToken(request, token)
        : request
    })

    // Intercept responses to handle 401 (unauthorized)
    const withAutoLogout = HttpClient.transformResponse(withAuth, (effect) =>
      Effect.tap(effect, (response) =>
        Effect.sync(() => {
          if (response.status === 401) {
            // Clear token on 401 responses (session expired/invalid)
            setStoredToken(null)
          }
        })
      )
    )

    return Context.add(context, HttpClient.HttpClient, withAutoLogout)
  })
)

// =============================================================================
// API Client
// =============================================================================

/**
 * ApiClient - Type-safe API client for the Accountability application
 *
 * Extends AtomHttpApi.Tag with the AppApi definition, providing:
 * - Type-safe query and mutation atoms
 * - Automatic Bearer token authentication
 * - Auto-logout on 401 responses
 *
 * @example
 * ```typescript
 * // Query - creates an Atom<Result<A, E>>
 * const accountsAtom = ApiClient.query("accounts", "list", {
 *   urlParams: { companyId },
 *   timeToLive: Duration.minutes(5)
 * })
 *
 * // Mutation - creates an AtomResultFn<Arg, A, E>
 * const createAccountMutation = ApiClient.mutation("accounts", "create")
 * ```
 */
export class ApiClient extends AtomHttpApi.Tag<ApiClient>()(
  "ApiClient",
  {
    api: AppApi,
    httpClient: AuthenticatedHttpClient,
    baseUrl: typeof window !== "undefined" ? window.location.origin : ""
  }
) {}
