/**
 * Runtime Configuration
 *
 * Provides the Effect Atom runtime configuration for the application.
 * The runtime is used by atoms that need to run Effects with layers.
 *
 * @module runtime
 */

import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import { ApiClient } from "./ApiClient.ts"

// =============================================================================
// Registry
// =============================================================================

/**
 * Application registry for Effect Atom state management.
 *
 * This is the central store for all atom state. It's provided to the
 * RegistryProvider in the root component.
 *
 * Note: The RegistryProvider in @effect-atom/atom-react creates its own
 * default registry if none is provided, so this export is optional but
 * useful for testing or server-side rendering.
 */
export const registry = Registry.make()

// =============================================================================
// Runtime
// =============================================================================

/**
 * Application runtime for Effect Atom.
 *
 * The ApiClient already includes its own runtime configured with:
 * - FetchHttpClient layer
 * - Authentication (Bearer token) handling
 * - Auto-logout on 401 responses
 *
 * For atoms that need to run Effects with the API client:
 * ```typescript
 * const myAtom = ApiClient.runtime.atom(
 *   Effect.gen(function*() {
 *     const client = yield* ApiClient
 *     return yield* client.accounts.list({})
 *   })
 * )
 * ```
 *
 * For mutations:
 * ```typescript
 * const myMutation = ApiClient.runtime.fn<CreateInput>()(
 *   Effect.fnUntraced(function*(input) {
 *     const client = yield* ApiClient
 *     return yield* client.accounts.create({ payload: input })
 *   })
 * )
 * ```
 */
export const runtime = ApiClient.runtime

/**
 * Re-export the ApiClient layer for composition with other layers.
 */
export const ApiClientLayer = ApiClient.layer

/**
 * Default memo map for layer memoization.
 *
 * This is used by the runtime to memoize layer builds, ensuring
 * services are only instantiated once per registry lifecycle.
 */
export const memoMap = Atom.defaultMemoMap
