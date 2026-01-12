/**
 * PgClientLayer - Unified PostgreSQL client layer for dev and production
 *
 * In development (NODE_ENV !== "production"):
 * - Uses testcontainers to auto-create a PostgreSQL container
 * - Persists data in local .db directory
 * - Container is reused between restarts
 *
 * In production (NODE_ENV === "production"):
 * - Uses PgClientLive with DATABASE_URL or PG* environment variables
 *
 * @module PgClientLayer
 */

import { PgClient } from "@effect/sql-pg"
import type { SqlClient, SqlError } from "@effect/sql"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Config from "effect/Config"
import type * as ConfigError from "effect/ConfigError"
import * as Data from "effect/Data"
import * as path from "node:path"
import * as fs from "node:fs"

/**
 * Error for dev container failures
 */
export class DevContainerError extends Data.TaggedError("DevContainerError")<{
  message: string
  cause?: unknown
}> {}

/**
 * Check if we're in development mode
 */
const isDev = process.env.NODE_ENV !== "production"

/**
 * Path to the local database directory for persistent storage (dev only)
 */
const DB_DIR = path.resolve(process.cwd(), ".db")

/**
 * Development layer using testcontainers with persistent storage
 * Uses dynamic import to avoid bundling testcontainers in production
 */
const DevLayer = Layer.unwrapScoped(
  Effect.gen(function* () {
    // Ensure .db directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    yield* Effect.log(`Starting PostgreSQL container with data in ${DB_DIR}`)

    // Dynamic import to avoid bundling testcontainers in production
    const { PostgreSqlContainer } = yield* Effect.tryPromise({
      try: () => import("@testcontainers/postgresql"),
      catch: (cause) => new DevContainerError({ message: "Failed to load testcontainers", cause })
    })

    const container = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const started = await new PostgreSqlContainer("postgres:16-alpine")
            .withDatabase("accountability_dev")
            .withUsername("dev")
            .withPassword("dev")
            .withBindMounts([{
              source: DB_DIR,
              target: "/var/lib/postgresql/data"
            }])
            .start()

          return started
        },
        catch: (cause) => new DevContainerError({ message: "Failed to start PostgreSQL container", cause })
      }),
      (container) =>
        Effect.gen(function* () {
          yield* Effect.log("Stopping PostgreSQL container...")
          yield* Effect.promise(() => container.stop().catch(() => {}))
          yield* Effect.log("PostgreSQL container stopped")
        })
    )

    yield* Effect.log(`Container started: ${container.getHost()}:${container.getMappedPort(5432)}`)

    const connectionUri = container.getConnectionUri()
    yield* Effect.log(`Connecting to: ${connectionUri.replace(/:[^:@]+@/, ":***@")}`)

    return PgClient.layer({
      url: Redacted.make(connectionUri),
      maxConnections: 5,
      idleTimeout: "60 seconds",
      connectTimeout: "10 seconds"
    })
  })
)

/**
 * Production layer using environment variables
 */
const ProdLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL").pipe(
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
    )

    yield* Effect.log("Connecting to production database")

    return PgClient.layer({
      url,
      maxConnections: 10,
      idleTimeout: "60 seconds",
      connectTimeout: "10 seconds"
    })
  })
)

/**
 * PgClientLayer - Provides PgClient based on environment
 *
 * Usage:
 * ```typescript
 * import { PgClientLayer } from "./PgClientLayer.ts"
 *
 * Layer.provide(PgClientLayer)
 * ```
 */
type PgClientLayerError = DevContainerError | SqlError.SqlError | ConfigError.ConfigError

export const PgClientLayer: Layer.Layer<
  SqlClient.SqlClient | PgClient.PgClient,
  PgClientLayerError
> = isDev ? DevLayer : ProdLayer
