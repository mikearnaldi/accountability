import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import * as Schema from "effect/Schema"

// Health check endpoint - simple GET that returns status
const healthCheck = HttpApiEndpoint.get("healthCheck", "/health").addSuccess(
  Schema.Struct({
    status: Schema.Literal("ok"),
    timestamp: Schema.String
  })
)

// Health API group
class HealthApi extends HttpApiGroup.make("health").add(healthCheck) {}

// Main App API - will be extended with more groups in future stories
export class AppApi extends HttpApi.make("accountability").add(HealthApi).prefix("/api") {}
