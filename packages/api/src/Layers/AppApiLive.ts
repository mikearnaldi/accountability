/**
 * AppApiLive - Live implementation layer for the Accountability API
 *
 * Combines all API group implementations (health, accounts, companies,
 * journal entries, reports) into a complete API layer that can be served.
 *
 * @module AppApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { AppApi, HealthCheckResponse } from "../Definitions/AppApi.ts"
import { AuthMiddlewareWithSimpleValidation } from "./AuthMiddlewareLive.ts"
import { AccountsApiLive } from "./AccountsApiLive.ts"
import { CompaniesApiLive } from "./CompaniesApiLive.ts"
import { JournalEntriesApiLive } from "./JournalEntriesApiLive.ts"
import { ReportsApiLive } from "./ReportsApiLive.ts"

// =============================================================================
// Health API Implementation
// =============================================================================

/**
 * HealthApiLive - Health check endpoint implementation
 *
 * Simple handler that returns the current health status.
 * This endpoint is not protected by authentication.
 */
const HealthApiLive = HttpApiBuilder.group(AppApi, "health", (handlers) =>
  Effect.succeed(
    handlers.handle("healthCheck", () =>
      Effect.succeed(
        HealthCheckResponse.make({
          status: "ok",
          timestamp: new Date().toISOString(),
          version: Option.some("0.0.1")
        })
      )
    )
  )
)

// =============================================================================
// Complete API Layer
// =============================================================================

/**
 * AppApiLive - Complete API layer combining all implementations
 *
 * Provides:
 * - Health check (unprotected)
 * - Accounts API (protected)
 * - Companies API (protected)
 * - Journal entries API (protected)
 * - Reports API (protected)
 *
 * Dependencies (required from consumer):
 * - AccountRepository
 * - CompanyRepository
 * - OrganizationRepository
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 * - FiscalPeriodRepository
 */
export const AppApiLive = HttpApiBuilder.api(AppApi).pipe(
  Layer.provide(HealthApiLive),
  Layer.provide(AccountsApiLive),
  Layer.provide(CompaniesApiLive),
  Layer.provide(JournalEntriesApiLive),
  Layer.provide(ReportsApiLive),
  Layer.provide(AuthMiddlewareWithSimpleValidation)
)
