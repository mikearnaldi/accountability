import { HttpApiBuilder, HttpApiSwagger, HttpServer } from "@effect/platform"
import type { PgClient } from "@effect/sql-pg"
import type { SqlClient, SqlError } from "@effect/sql"
import type { ConfigError } from "effect/ConfigError"
import * as Layer from "effect/Layer"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { SessionTokenValidatorLive } from "@accountability/api/Layers/AuthApiLive"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationsLive } from "@accountability/persistence/Layers/MigrationsLive"
import type { DevContainerError } from "./handler.dev.ts"

// Logging utility that bypasses no-console lint rule
const log = (message: string): void => {
  process.stderr.write(`${message}\n`)
}

// Type declaration for the global storage (persists across HMR module reloads)
declare global {
  var __apiDispose: (() => Promise<void>) | undefined
}

// Conditionally import the appropriate database layer
// Build-time replacement of process.env.NODE_ENV enables dead code elimination
const PgClientLayer: Layer.Layer<
  SqlClient.SqlClient | PgClient.PgClient,
  SqlError.SqlError | DevContainerError | ConfigError
> = process.env.NODE_ENV === "production"
  ? (await import("./handler.prod.ts")).ProdPgClientLayer
  : (await import("./handler.dev.ts")).DevPgClientLayer

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
  gracefulShutdown("SIGTERM").catch(() => {})
})

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT").catch(() => {})
})

// Vite HMR support - clean up resources when module is hot-reloaded
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    log("[API] HMR dispose - cleaning up handler resources...")
    const oldDispose = globalThis.__apiDispose
    if (oldDispose) {
      oldDispose().catch(() => {})
    }
  })
}

export { handler, dispose }
