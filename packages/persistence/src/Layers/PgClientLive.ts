/**
 * PgClientLive - PostgreSQL client layer for production use
 *
 * Provides a configured PgClient.layer with connection pooling.
 * Configuration is read from environment variables or Config service.
 *
 * @module PgClientLive
 */

import { PgClient } from "@effect/sql-pg"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"

/**
 * Configuration for PgClient connection.
 * Reads from environment variables with sensible defaults.
 */
export const PgClientConfig = Config.all({
  url: Config.redacted("DATABASE_URL").pipe(
    Config.orElse(() =>
      Config.all({
        host: Config.string("PGHOST").pipe(Config.withDefault("localhost")),
        port: Config.integer("PGPORT").pipe(Config.withDefault(5432)),
        user: Config.string("PGUSER").pipe(Config.withDefault("postgres")),
        password: Config.redacted("PGPASSWORD").pipe(Config.withDefault(Redacted.make("postgres"))),
        database: Config.string("PGDATABASE").pipe(Config.withDefault("accountability"))
      }).pipe(
        Config.map(({ host, port, user, password, database }) =>
          Redacted.make(
            `postgresql://${user}:${Redacted.value(password)}@${host}:${port}/${database}`
          )
        )
      )
    )
  ),
  maxConnections: Config.integer("PG_MAX_CONNECTIONS").pipe(Config.withDefault(10)),
  idleTimeout: Config.duration("PG_IDLE_TIMEOUT").pipe(Config.withDefault("60 seconds")),
  connectTimeout: Config.duration("PG_CONNECTION_TIMEOUT").pipe(Config.withDefault("10 seconds"))
})

/**
 * PgClientLive - Layer providing PgClient with production configuration.
 *
 * Reads connection configuration from environment variables:
 * - DATABASE_URL: Full PostgreSQL connection URL (preferred)
 * - Or individual vars: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 * - PG_MAX_CONNECTIONS: Maximum pool connections (default: 10)
 * - PG_IDLE_TIMEOUT: Idle connection timeout (default: 60s)
 * - PG_CONNECTION_TIMEOUT: Connection timeout (default: 10s)
 *
 * Usage:
 * ```typescript
 * import { PgClientLive } from "@accountability/persistence/Layers/PgClientLive"
 *
 * const program = Effect.gen(function*() {
 *   const sql = yield* PgClient.PgClient
 *   // use sql...
 * }).pipe(Effect.provide(PgClientLive))
 * ```
 */
export const PgClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* PgClientConfig
    return PgClient.layer({
      url: config.url,
      maxConnections: config.maxConnections,
      idleTimeout: config.idleTimeout,
      connectTimeout: config.connectTimeout
    })
  })
)
