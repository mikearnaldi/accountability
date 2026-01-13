/**
 * PostgreSQL test utilities for API integration tests
 *
 * Uses testcontainers to provide a real PostgreSQL instance for testing.
 *
 * @module PgTestUtils
 */

import { PgClient } from "@effect/sql-pg"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Data, Effect, Layer, Redacted } from "effect"
import { inject } from "vitest"

/**
 * Error type for container startup failures.
 */
export class ContainerError extends Data.TaggedError("ContainerError")<{
  cause: unknown
}> {}

/**
 * PostgreSQL container service for integration tests.
 *
 * Uses Effect.acquireRelease to manage container lifecycle:
 * - Container starts when the layer is built
 * - Container stops automatically when tests complete
 *
 * Usage:
 * ```typescript
 * import { it } from "@effect/vitest"
 * import { PgContainer } from "./PgTestUtils.ts"
 *
 * it.layer(PgContainer.ClientLive, { timeout: "60 seconds" })("MyTests", (it) => {
 *   it.effect("test", () => Effect.gen(function*() {
 *     const sql = yield* PgClient.PgClient
 *     // use sql...
 *   }))
 * })
 * ```
 */
export class PgContainer extends Effect.Service<PgContainer>()("test/PgContainer", {
  scoped: Effect.acquireRelease(
    Effect.tryPromise({
      try: () => new PostgreSqlContainer("postgres:alpine").start(),
      catch: (cause) => new ContainerError({ cause })
    }),
    (container) => Effect.promise(() => container.stop())
  )
}) {
  /**
   * Layer that provides PgClient.PgClient from the container.
   * Use this in tests with it.layer().
   */
  static ClientLive = Layer.unwrapEffect(
    Effect.gen(function*() {
      const container = yield* PgContainer
      return PgClient.layer({
        url: Redacted.make(container.getConnectionUri())
      })
    })
  ).pipe(Layer.provide(this.Default))
}

/**
 * Shared PgClient layer that uses the container from globalSetup.
 *
 * The container URL is injected via vitest's inject() mechanism,
 * which reads from the globalSetup's provide() calls.
 *
 * This layer enables sharing a single PostgreSQL container across
 * ALL test files instead of creating one per it.layer() block.
 *
 * Usage:
 * ```typescript
 * const TestLayer = RepositoriesLayer.pipe(
 *   Layer.provideMerge(MigrationLayer),
 *   Layer.provideMerge(SharedPgClientLive)  // Uses global container
 * )
 * ```
 *
 * @see vitest.global-setup.ts for container lifecycle
 * @see specs/EFFECT_TESTING.md for migration instructions
 */
export const SharedPgClientLive = PgClient.layer({
  url: Redacted.make(inject("dbUrl"))
})
