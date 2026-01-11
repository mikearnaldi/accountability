import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { AppApi } from "./AppApi.ts"

// Implement handlers for the health API group
const HealthLive = HttpApiBuilder.group(AppApi, "health", (handlers) =>
  handlers.handle("healthCheck", () =>
    Effect.succeed({
      status: "ok" as const,
      timestamp: new Date().toISOString()
    })
  )
)

// Compose all group implementations into the full API layer
export const AppApiLive = HttpApiBuilder.api(AppApi).pipe(
  Layer.provide(HealthLive)
)
