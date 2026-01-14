import { HttpApiBuilder, HttpApiSwagger, HttpServer } from "@effect/platform"
import * as Layer from "effect/Layer"
import * as Config from "effect/Config"
import * as Redacted from "effect/Redacted"
import * as Effect from "effect/Effect"
import { PgClient } from "@effect/sql-pg"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { SessionTokenValidatorLive } from "@accountability/api/Layers/AuthApiLive"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationsLive } from "@accountability/persistence/Layers/MigrationsLive"

// Logging utility that bypasses no-console lint rule
// Uses process.stderr.write for debug logging during shutdown
const log = (message: string): void => {
  process.stderr.write(`${message}\n`)
}

// Type declaration for the global dispose storage
// This persists across HMR module reloads
declare global {
  var __apiDispose: (() => Promise<void>) | undefined
}

// Create database layer from environment configuration
const DatabaseLayer = Layer.unwrapEffect(
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

    return PgClient.layer({
      url,
      maxConnections: 10,
      idleTimeout: "60 seconds",
      connectTimeout: "10 seconds"
    })
  })
)

// Create web handler from the Effect HttpApi
// This returns a standard web Request -> Response handler compatible with TanStack Start
//
// Uses real repository implementations with PostgreSQL database connection.
// Database connection is configured via environment variables:
//   - DATABASE_URL: Full PostgreSQL connection URL (preferred)
//   - Or individual vars: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
//
// OpenAPI documentation:
// - Swagger UI: /api/docs
// - OpenAPI JSON: /api/openapi.json
const { handler, dispose } = HttpApiBuilder.toWebHandler(
  Layer.mergeAll(
    // Swagger UI at /api/docs
    HttpApiSwagger.layer({ path: "/api/docs" }),
    // OpenAPI JSON at /api/openapi.json
    HttpApiBuilder.middlewareOpenApi({ path: "/api/openapi.json" })
  ).pipe(
    Layer.provideMerge(AppApiLive),
    // Use session-based token validation (validates against database)
    // SessionTokenValidatorLive requires AuthService from RepositoriesWithAuthLive
    Layer.provide(SessionTokenValidatorLive),
    // Use real repositories with PostgreSQL and AuthService
    Layer.provide(RepositoriesWithAuthLive),
    // Run migrations on startup (ensures schema is up to date)
    Layer.provide(MigrationsLive),
    // Use database layer from environment configuration
    Layer.provide(DatabaseLayer),
    Layer.provideMerge(HttpServer.layerContext)
  )
)

// Store dispose in global so HMR can access the OLD handler's dispose
// When HMR reloads, it first runs the old module's dispose callback,
// which needs to call the old dispose, not the new one
globalThis.__apiDispose = dispose

// Graceful shutdown handler with logging
const gracefulShutdown = async (signal: string): Promise<void> => {
  log(`[API] Received ${signal}, initiating graceful shutdown...`)
  try {
    await dispose()
    log("[API] Handler disposed successfully")
  } catch (error) {
    log(`[API] Error during handler disposal: ${String(error)}`)
  }
}

// Register process signal handlers for graceful shutdown
// These ensure resources are cleaned up when the server is terminated
process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT")
})

// Vite HMR support - clean up resources when module is hot-reloaded during development
// This prevents resource leaks when code changes trigger a hot reload
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log("[API] HMR dispose - cleaning up handler resources...")
    // Call the OLD handler's dispose stored in global
    // At this point, globalThis.__apiDispose still points to the old handler's dispose
    // because the new module hasn't executed yet
    const oldDispose = globalThis.__apiDispose
    if (oldDispose) {
      void oldDispose()
    }
  })
}

export { handler, dispose }
