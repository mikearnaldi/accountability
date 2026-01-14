/**
 * AppApi - Main HTTP API definition for Accountability
 *
 * Combines all API groups (health, accounts, companies, journal entries, reports)
 * into a single HttpApi definition that can be served with HttpApiBuilder.
 *
 * @module AppApi
 */

import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import * as Schema from "effect/Schema"
import { AccountsApi } from "./AccountsApi.ts"
import { AuthApi, AuthSessionApi } from "./AuthApi.ts"
import { CompaniesApi } from "./CompaniesApi.ts"
import { ConsolidationApi } from "./ConsolidationApi.ts"
import { CurrenciesApi } from "./CurrenciesApi.ts"
import { CurrencyApi } from "./CurrencyApi.ts"
import { JurisdictionsApi } from "./JurisdictionsApi.ts"
import { EliminationRulesApi } from "./EliminationRulesApi.ts"
import { FiscalPeriodsApi } from "./FiscalPeriodsApi.ts"
import { IntercompanyTransactionsApi } from "./IntercompanyTransactionsApi.ts"
import { JournalEntriesApi } from "./JournalEntriesApi.ts"
import { ReportsApi } from "./ReportsApi.ts"

// =============================================================================
// Health Check Types
// =============================================================================

/**
 * HealthCheckResponse - Response for the health check endpoint
 */
export class HealthCheckResponse extends Schema.Class<HealthCheckResponse>("HealthCheckResponse")({
  status: Schema.Literal("ok", "degraded", "unhealthy"),
  timestamp: Schema.String,
  version: Schema.OptionFromNullOr(Schema.String)
}) {}

// =============================================================================
// Health API Group
// =============================================================================

/**
 * Health check endpoint
 * GET /api/health
 */
const healthCheck = HttpApiEndpoint.get("healthCheck", "/")
  .addSuccess(HealthCheckResponse)
  .annotateContext(OpenApi.annotations({
    summary: "Health check",
    description: "Returns the current health status of the API"
  }))

/**
 * HealthApi - Unprotected health check group
 *
 * No authentication required - used by load balancers and monitoring.
 */
export class HealthApi extends HttpApiGroup.make("health")
  .add(healthCheck)
  .prefix("/health")
  .annotateContext(OpenApi.annotations({
    title: "Health",
    description: "API health and status endpoints"
  })) {}

// =============================================================================
// Main API Definition
// =============================================================================

/**
 * AppApi - Main API definition combining all groups
 *
 * Groups:
 * - /api/health - Health check (unprotected)
 * - /api/auth - Authentication (mixed public/protected)
 * - /api/v1/accounts - Account management (protected)
 * - /api/v1/organizations - Organization management (protected)
 * - /api/v1/companies - Company management (protected)
 * - /api/v1/journal-entries - Journal entry management (protected)
 * - /api/v1/reports - Financial report generation (protected)
 * - /api/v1/currencies - Currency master data (protected)
 * - /api/v1/jurisdictions - Jurisdiction master data (protected)
 * - /api/v1/exchange-rates - Currency and exchange rate management (protected)
 * - /api/v1/fiscal - Fiscal year and period management (protected)
 * - /api/v1/intercompany-transactions - Intercompany transaction management (protected)
 * - /api/v1/consolidation - Consolidation group and run management (protected)
 * - /api/v1/elimination-rules - Elimination rule management (protected)
 */
export class AppApi extends HttpApi.make("AppApi")
  .add(HealthApi)
  .add(AuthApi)
  .add(AuthSessionApi)
  .add(AccountsApi)
  .add(CompaniesApi)
  .add(JournalEntriesApi)
  .add(ReportsApi)
  .add(CurrenciesApi)
  .add(JurisdictionsApi)
  .add(CurrencyApi)
  .add(FiscalPeriodsApi)
  .add(IntercompanyTransactionsApi)
  .add(ConsolidationApi)
  .add(EliminationRulesApi)
  .prefix("/api")
  .annotateContext(OpenApi.annotations({
    title: "Accountability API",
    description: "Multi-company, multi-currency accounting application API",
    version: "0.0.1"
  })) {}
