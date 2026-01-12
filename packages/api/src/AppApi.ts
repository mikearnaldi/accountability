/**
 * AppApi - Main HTTP API definition for the Accountability application
 *
 * This module defines the complete HTTP API structure using Effect HttpApi.
 * It combines all API groups (Accounts, Companies, JournalEntries, Reports)
 * into a single typed API definition that can be used by both server and client.
 *
 * The API is prefixed with /api and includes a health check endpoint.
 *
 * @module AppApi
 */

import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { AccountsApi } from "./AccountsApi.ts"
import { CompaniesApi } from "./CompaniesApi.ts"
import { JournalEntriesApi } from "./JournalEntriesApi.ts"
import { ReportsApi } from "./ReportsApi.ts"
import { InternalServerError, UnauthorizedError } from "./ApiErrors.ts"

// =============================================================================
// Health Check API
// =============================================================================

/**
 * HealthCheckResponse - Response for the health check endpoint
 */
export class HealthCheckResponse extends Schema.Class<HealthCheckResponse>("HealthCheckResponse")({
  status: Schema.Literal("ok").annotations({
    description: "Health status indicator"
  }),
  timestamp: Schema.String.annotations({
    description: "ISO 8601 timestamp of the health check"
  }),
  version: Schema.OptionFromNullOr(Schema.String).annotations({
    description: "Application version number"
  })
}) {}

/**
 * Health check endpoint - simple GET that returns status
 */
const healthCheck = HttpApiEndpoint.get("healthCheck", "/health")
  .addSuccess(HealthCheckResponse)
  .annotateContext(OpenApi.annotations({
    description: "Check if the API is running and healthy",
    summary: "Health check"
  }))

/**
 * HealthApi - API group for health check endpoints
 */
class HealthApi extends HttpApiGroup.make("health")
  .add(healthCheck)
  .annotateContext(OpenApi.annotations({
    title: "Health",
    description: "Health check endpoints for monitoring the API status"
  })) {}

// =============================================================================
// Main App API
// =============================================================================

/**
 * AppApi - The complete API definition for the Accountability application
 *
 * Combines all API groups:
 * - Health: /api/health - Health check endpoints
 * - Accounts: /api/v1/accounts - Account management
 * - Companies: /api/v1/organizations, /api/v1/companies - Organization and company management
 * - JournalEntries: /api/v1/journal-entries - Journal entry management
 * - Reports: /api/v1/reports - Financial report generation
 *
 * Global errors that can occur on any endpoint:
 * - UnauthorizedError (401) - Authentication required
 * - InternalServerError (500) - Unexpected server error
 */
export class AppApi extends HttpApi.make("accountability")
  .add(HealthApi)
  .add(AccountsApi)
  .add(CompaniesApi)
  .add(JournalEntriesApi)
  .add(ReportsApi)
  .addError(UnauthorizedError)
  .addError(InternalServerError)
  .prefix("/api")
  .annotateContext(OpenApi.annotations({
    title: "Accountability API",
    version: "1.0.0",
    description: "Multi-company, multi-currency accounting API. Provides endpoints for managing organizations, companies, accounts, journal entries, and generating financial reports.",
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT"
    }
  })) {}

// =============================================================================
// Re-exports for convenience
// =============================================================================

// Re-export API groups for individual use
export { AccountsApi } from "./AccountsApi.ts"
export { CompaniesApi } from "./CompaniesApi.ts"
export { JournalEntriesApi } from "./JournalEntriesApi.ts"
export { ReportsApi } from "./ReportsApi.ts"

// Re-export error types
export {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError
} from "./ApiErrors.ts"
export type { ApiError } from "./ApiErrors.ts"

// Re-export authentication middleware
export {
  AuthMiddleware,
  AuthMiddlewareLive,
  AuthMiddlewareWithSimpleValidation,
  CurrentUser,
  SimpleTokenValidatorLive,
  TokenValidator,
  User
} from "./AuthMiddleware.ts"
export type { TokenValidatorService } from "./AuthMiddleware.ts"
