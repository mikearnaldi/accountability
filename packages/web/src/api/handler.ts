import { HttpApiBuilder, HttpApiSwagger, HttpServer } from "@effect/platform"
import * as Layer from "effect/Layer"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { RepositoriesLive, PgClientLive } from "@accountability/persistence/RepositoriesLive"

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
    // Swagger UI at /docs (requires Api, provided by AppApiLive)
    HttpApiSwagger.layer({ path: "/docs" }),
    // OpenAPI JSON at /openapi.json (requires Api, provided by AppApiLive)
    HttpApiBuilder.middlewareOpenApi({ path: "/openapi.json" })
  ).pipe(
    Layer.provideMerge(AppApiLive),
    // Use real repositories with PostgreSQL
    Layer.provide(RepositoriesLive),
    Layer.provide(PgClientLive),
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
