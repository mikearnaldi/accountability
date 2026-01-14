import { HttpApiBuilder, HttpApiSwagger, HttpServer } from "@effect/platform"
import { PgClient } from "@effect/sql-pg"
import type { SqlClient, SqlError } from "@effect/sql"
import type { ConfigError } from "effect/ConfigError"
import * as Config from "effect/Config"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as fs from "node:fs"
import * as path from "node:path"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { SessionTokenValidatorLive } from "@accountability/api/Layers/AuthApiLive"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationsLive } from "@accountability/persistence/Layers/MigrationsLive"

// Logging utility that bypasses no-console lint rule
const log = (message: string): void => {
  process.stderr.write(`${message}\n`)
}

// Type declaration for the global storage (persists across HMR module reloads)
declare global {
  var __apiDispose: (() => Promise<void>) | undefined
}

// Error for dev container failures
class DevContainerError extends Data.TaggedError("DevContainerError")<{
  message: string
  cause?: unknown
}> {}

const isDev = process.env.NODE_ENV !== "production"
const DB_DIR = path.resolve(process.cwd(), ".db")

// Development layer using testcontainers with persistent storage
const DevPgClientLayer = Layer.unwrapScoped(
  Effect.gen(function* () {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    yield* Effect.log(`Starting PostgreSQL container with data in ${DB_DIR}`)

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

// Production layer using environment variables
const ProdPgClientLayer = Layer.unwrapEffect(
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

// Select the appropriate database layer based on environment
// The type annotation ensures TypeScript unifies both Layer types correctly
function getPgClientLayer(): Layer.Layer<
  SqlClient.SqlClient | PgClient.PgClient,
  SqlError.SqlError | DevContainerError | ConfigError
> {
  if (isDev) {
    return DevPgClientLayer
  }
  return ProdPgClientLayer
}

const PgClientLayer = getPgClientLayer()

// Create web handler from the Effect HttpApi
// Database configuration:
//   - Dev mode: Automatically starts a PostgreSQL container via testcontainers, data persists in .db/
//   - Production: Uses DATABASE_URL or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
// OpenAPI: Swagger UI at /api/docs, OpenAPI JSON at /api/openapi.json
const { handler, dispose } = HttpApiBuilder.toWebHandler(
  Layer.mergeAll(
    HttpApiSwagger.layer({ path: "/api/docs" }),
    HttpApiBuilder.middlewareOpenApi({ path: "/api/openapi.json" })
  ).pipe(
    Layer.provideMerge(AppApiLive),
    Layer.provide(SessionTokenValidatorLive),
    Layer.provide(RepositoriesWithAuthLive),
    Layer.provide(MigrationsLive),
    Layer.provide(PgClientLayer),
    Layer.provideMerge(HttpServer.layerContext)
  )
)

// Store dispose in global so HMR can access the OLD handler's dispose
globalThis.__apiDispose = dispose

const gracefulShutdown = async (signal: string): Promise<void> => {
  log(`[API] Received ${signal}, initiating graceful shutdown...`)
  try {
    await dispose()
    log("[API] Handler disposed successfully")
  } catch (error) {
    log(`[API] Error during handler disposal: ${String(error)}`)
  }
}

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT")
})

// Vite HMR support - clean up resources when module is hot-reloaded
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log("[API] HMR dispose - cleaning up handler resources...")
    const oldDispose = globalThis.__apiDispose
    if (oldDispose) {
      void oldDispose()
    }
  })
}

export { handler, dispose }
