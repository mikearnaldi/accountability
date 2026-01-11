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

export { handler, dispose }

// Re-export the API definition for client usage
export { AppApi }
