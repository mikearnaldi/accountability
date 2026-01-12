/**
 * AppApiLive - Live implementation of the API handlers
 *
 * This module provides the Effect layer that implements all API endpoints.
 * It connects the API definition to actual service implementations using
 * real repository layers for database access.
 *
 * Dependencies:
 * - All live implementations require their respective repositories
 * - AuthMiddleware provides bearer token authentication
 *
 * @module AppApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { AppApi, HealthCheckResponse } from "./AppApi.ts"
import { AuthMiddlewareWithSimpleValidation } from "./AuthMiddleware.ts"
import { AccountsApiLive } from "./AccountsApiLive.ts"
import { CompaniesApiLive } from "./CompaniesApiLive.ts"
import { JournalEntriesApiLive } from "./JournalEntriesApiLive.ts"
import { ReportsApiLive } from "./ReportsApiLive.ts"

// =============================================================================
// Health API Implementation
// =============================================================================

/**
 * Implement handlers for the health API group
 * No authentication required for health checks.
 */
const HealthLive = HttpApiBuilder.group(AppApi, "health", (handlers) =>
  handlers.handle("healthCheck", () =>
    Effect.succeed(
      HealthCheckResponse.make({
        status: "ok" as const,
        timestamp: new Date().toISOString(),
        version: Option.some("0.0.1")
      })
    )
  )
)

// =============================================================================
// Compose API Layers with Auth Middleware
// =============================================================================

/**
 * AccountsLive - Accounts API with authentication middleware
 */
const AccountsLive = AccountsApiLive.pipe(
  Layer.provide(AuthMiddlewareWithSimpleValidation)
)

/**
 * CompaniesLive - Companies API with authentication middleware
 */
const CompaniesLive = CompaniesApiLive.pipe(
  Layer.provide(AuthMiddlewareWithSimpleValidation)
)

/**
 * JournalEntriesLive - Journal entries API with authentication middleware
 */
const JournalEntriesLive = JournalEntriesApiLive.pipe(
  Layer.provide(AuthMiddlewareWithSimpleValidation)
)

/**
 * ReportsLive - Reports API with authentication middleware
 */
const ReportsLive = ReportsApiLive.pipe(
  Layer.provide(AuthMiddlewareWithSimpleValidation)
)

// =============================================================================
// Compose All API Layers
// =============================================================================

/**
 * AppApiLive - Complete API layer with all group implementations
 *
 * Composes all group implementations into the full API layer.
 * Each group handler layer uses live repository implementations.
 *
 * Required dependencies (must be provided by the caller):
 * - AccountRepository
 * - CompanyRepository
 * - OrganizationRepository
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 * - FiscalPeriodRepository
 *
 * Usage:
 * ```typescript
 * import { AppApiLive } from "@accountability/api/AppApiLive"
 * import { AccountRepositoryLive } from "@accountability/persistence/AccountRepositoryLive"
 * // ... other repository imports
 *
 * const FullAppLayer = AppApiLive.pipe(
 *   Layer.provide(AccountRepositoryLive),
 *   Layer.provide(CompanyRepositoryLive),
 *   Layer.provide(OrganizationRepositoryLive),
 *   Layer.provide(JournalEntryRepositoryLive),
 *   Layer.provide(JournalEntryLineRepositoryLive),
 *   Layer.provide(FiscalPeriodRepositoryLive),
 *   Layer.provide(PgClientLive)
 * )
 * ```
 */
export const AppApiLive = HttpApiBuilder.api(AppApi).pipe(
  Layer.provide(HealthLive),
  Layer.provide(AccountsLive),
  Layer.provide(CompaniesLive),
  Layer.provide(JournalEntriesLive),
  Layer.provide(ReportsLive)
)

// =============================================================================
// Re-exports
// =============================================================================

/**
 * Re-export individual API live layers for testing or custom composition
 */
export { AccountsApiLive } from "./AccountsApiLive.ts"
export { CompaniesApiLive } from "./CompaniesApiLive.ts"
export { JournalEntriesApiLive } from "./JournalEntriesApiLive.ts"
export { ReportsApiLive } from "./ReportsApiLive.ts"
