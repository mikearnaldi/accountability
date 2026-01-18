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
import { ConsolidatedReportServiceLive } from "@accountability/core/Services/ConsolidatedReportService"
import { AuthorizationServiceLive } from "@accountability/persistence/Layers/AuthorizationServiceLive"
import { PolicyEngineLive } from "@accountability/persistence/Layers/PolicyEngineLive"
import { AppApi, HealthCheckResponse } from "../Definitions/AppApi.ts"
import { AuthMiddlewareLive } from "./AuthMiddlewareLive.ts"
import { AccountsApiLive } from "./AccountsApiLive.ts"
import { AccountTemplatesApiLive } from "./AccountTemplatesApiLive.ts"
import { AuditLogApiLive } from "./AuditLogApiLive.ts"
import { AuthApiLive, AuthSessionApiLive } from "./AuthApiLive.ts"
import { CompaniesApiLive } from "./CompaniesApiLive.ts"
import { ConsolidationApiLive } from "./ConsolidationApiLive.ts"
import { CurrenciesApiLive } from "./CurrenciesApiLive.ts"
import { CurrencyApiLive } from "./CurrencyApiLive.ts"
import { JurisdictionsApiLive } from "./JurisdictionsApiLive.ts"
import { EliminationRulesApiLive } from "./EliminationRulesApiLive.ts"
import { IntercompanyTransactionsApiLive } from "./IntercompanyTransactionsApiLive.ts"
import { InvitationApiLive } from "./InvitationApiLive.ts"
import { JournalEntriesApiLive } from "./JournalEntriesApiLive.ts"
import { MembershipApiLive } from "./MembershipApiLive.ts"
import { ReportsApiLive } from "./ReportsApiLive.ts"
import { UserOrganizationsApiLive } from "./UserOrganizationsApiLive.ts"

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

/**
 * ConsolidationApiWithDependencies - ConsolidationApiLive with its required services
 */
const ConsolidationApiWithDependencies = Layer.provide(
  ConsolidationApiLive,
  ConsolidatedReportServiceLive
)

/**
 * AuthorizationServiceWithDependencies - AuthorizationServiceLive with PolicyEngineLive
 *
 * AuthorizationServiceLive depends on PolicyEngine for ABAC policy evaluation.
 * We compose them here to reduce the number of Layer.provide calls in the main chain.
 */
const AuthorizationServiceWithDependencies = Layer.provide(
  AuthorizationServiceLive,
  PolicyEngineLive
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
 * - Account templates API (protected)
 * - Companies API (protected)
 * - Journal entries API (protected)
 * - Reports API (protected)
 * - Currencies master data API (protected)
 * - Jurisdictions master data API (protected)
 * - Currency/Exchange rates API (protected)
 * - Intercompany transactions API (protected)
 * - Consolidation API (protected)
 * - Elimination rules API (protected)
 * - Audit log API (protected)
 * - Membership API (protected)
 * - Invitation API (protected)
 * - User Organizations API (protected)
 *
 * Dependencies (required from consumer):
 * - AccountRepository
 * - CompanyRepository
 * - OrganizationRepository
 * - JournalEntryRepository
 * - JournalEntryLineRepository
 * - ExchangeRateRepository
 * - IntercompanyTransactionRepository
 * - ConsolidationRepository
 * - EliminationRuleRepository
 * - AuditLogRepository
 */
export const AppApiLive = HttpApiBuilder.api(AppApi).pipe(
  Layer.provide(HealthApiLive),
  Layer.provide(AuthApiLive),
  Layer.provide(AuthSessionApiLive),
  Layer.provide(AccountsApiLive),
  Layer.provide(AccountTemplatesApiLive),
  Layer.provide(AuditLogApiLive),
  Layer.provide(CompaniesApiLive),
  Layer.provide(InvitationApiLive),
  Layer.provide(JournalEntriesApiLive),
  Layer.provide(MembershipApiLive),
  Layer.provide(ReportsApiLive),
  Layer.provide(CurrenciesApiLive),
  Layer.provide(JurisdictionsApiLive),
  Layer.provide(CurrencyApiLive),
  Layer.provide(IntercompanyTransactionsApiLive),
  Layer.provide(ConsolidationApiWithDependencies),
  Layer.provide(EliminationRulesApiLive),
  Layer.provide(UserOrganizationsApiLive),
  // AuthorizationServiceWithDependencies provides ABAC+RBAC permission checking
  // Uses ABAC when policies exist, falls back to RBAC when no policies
  // Includes PolicyEngineLive for ABAC policy evaluation
  Layer.provide(AuthorizationServiceWithDependencies),
  // AuthMiddlewareLive requires TokenValidator to be provided externally
  // - For production: use SessionTokenValidatorLive (validates against database)
  // - For testing: use SimpleTokenValidatorLive (user_<id>_<role> format)
  Layer.provide(AuthMiddlewareLive)
)
