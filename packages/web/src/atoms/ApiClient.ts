/**
 * ApiClient - Type-safe API client using Effect Atom and HttpApiClient
 *
 * This module provides a type-safe API client for the Accountability application
 * using Effect Atom's AtomHttpApi integration. It creates atoms for API queries
 * and mutations that integrate seamlessly with React components.
 *
 * @module ApiClient
 */

import * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"
import { TypeId } from "@effect-atom/atom/Atom"
import { FetchHttpClient } from "@effect/platform"
import { AppApi } from "@accountability/api/AppApi"

/**
 * ApiClient - Type-safe HTTP API client service
 *
 * This service is automatically created using AtomHttpApi.Tag which provides:
 * - Type-safe API calls matching the AppApi definition
 * - Automatic layer with FetchHttpClient for browser requests
 * - Query and mutation methods for creating atoms
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
    httpClient: FetchHttpClient.layer,
    // Use relative URL so it works in both SSR and CSR
    baseUrl: typeof window !== "undefined" ? window.location.origin : ""
  }
) {
  readonly [TypeId] = TypeId
}
