import { HttpApiBuilder, HttpServer } from "@effect/platform"
import * as Layer from "effect/Layer"
import { AppApi } from "@accountability/api/AppApi"
import { AppApiLive } from "@accountability/api/AppApiLive"

// Create web handler from the Effect HttpApi
// This returns a standard web Request -> Response handler compatible with TanStack Start
const { handler, dispose } = HttpApiBuilder.toWebHandler(
  Layer.mergeAll(
    AppApiLive,
    HttpServer.layerContext
  )
)

// Graceful shutdown handler with logging
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`[API] Received ${signal}, initiating graceful shutdown...`)
  try {
    await dispose()
    console.log("[API] Handler disposed successfully")
  } catch (error) {
    console.error("[API] Error during handler disposal:", error)
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
    console.log("[API] HMR dispose - cleaning up handler resources...")
    void dispose()
  })
}

export { handler, dispose }

// Re-export the API definition for client usage
export { AppApi }
