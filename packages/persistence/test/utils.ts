import { PgClient } from "@effect/sql-pg"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Data, Effect, Layer, Redacted } from "effect"

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
 * import { PgContainer } from "./utils.ts"
 *
 * it.layer(PgContainer.ClientLive, { timeout: "30 seconds" })("MyTests", (it) => {
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
