/**
 * Atom Runtime - Effect runtime configuration for atoms
 *
 * This module provides the configured Effect runtime for atoms that need
 * access to Effect services. It combines the necessary layers for API
 * client functionality.
 *
 * @module runtime
 */

import * as Atom from "@effect-atom/atom/Atom"
import { FetchHttpClient } from "@effect/platform"
import * as Layer from "effect/Layer"

/**
 * AtomRuntime - Runtime with HttpClient layer for atoms needing HTTP access
 *
 * This runtime provides the FetchHttpClient layer which enables atoms to
 * make HTTP requests. Use this when creating atoms that need to make
 * custom HTTP calls outside of the type-safe ApiClient.
 *
 * Usage:
 * ```typescript
 * const customFetchAtom = atomRuntime.atom(
 *   Effect.gen(function* () {
 *     const client = yield* HttpClient.HttpClient
 *     // ... custom fetch logic
 *   })
 * )
 * ```
 */
export const atomRuntime = Atom.runtime(
  Layer.mergeAll(
    FetchHttpClient.layer
  )
)
