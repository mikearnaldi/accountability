/**
 * ApiClient - Type-safe API client using Effect Atom and HttpApiClient
 *
 * This module provides a type-safe API client for the Accountability application
 * using Effect Atom's AtomHttpApi integration. It creates atoms for API queries
 * and mutations that integrate seamlessly with React components.
 *
 * The client automatically includes the auth token from localStorage in all
 * requests, enabling authenticated API calls.
 *
 * @module ApiClient
 */

import * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"
import { TypeId } from "@effect-atom/atom/Atom"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import { AppApi } from "@accountability/api/Definitions/AppApi"

const AUTH_TOKEN_KEY = "accountability_auth_token"

/**
 * Gets the stored auth token from localStorage
 */
const getStoredToken = (): string | null => {
  if (typeof window === "undefined") {
    return null
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

/**
 * Layer that provides an authenticated HttpClient
 *
 * This layer wraps FetchHttpClient and adds the Bearer token from localStorage
 * to every request. If no token is present, requests are made without auth.
 */
const AuthenticatedHttpClient = FetchHttpClient.layer.pipe(
  Layer.map((context) => {
    const client = Context.get(context, HttpClient.HttpClient)
    const authenticatedClient = HttpClient.mapRequest(client, (request) => {
      const token = getStoredToken()
      if (token) {
        return HttpClientRequest.bearerToken(request, token)
      }
      return request
    })
    return Context.add(context, HttpClient.HttpClient, authenticatedClient)
  })
)

/**
 * ApiClient - Type-safe HTTP API client service
 *
 * This service is automatically created using AtomHttpApi.Tag which provides:
 * - Type-safe API calls matching the AppApi definition
 * - Automatic layer with authenticated FetchHttpClient for browser requests
 * - Query and mutation methods for creating atoms
 * - Automatic auth token injection from localStorage
 *
 * Usage:
 * ```typescript
 * // Create a query atom
 * const healthAtom = ApiClient.query("health", "healthCheck", {})
 *
 * // Create a mutation atom
 * const createAccountMutation = ApiClient.mutation("accounts", "create")
 * ```
 */
export class ApiClient extends AtomHttpApi.Tag<ApiClient>()(
  "ApiClient",
  {
    api: AppApi,
    httpClient: AuthenticatedHttpClient,
    // Use relative URL so it works in both SSR and CSR
    baseUrl: typeof window !== "undefined" ? window.location.origin : ""
  }
) {
  readonly [TypeId] = TypeId
}
