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
import { ConsolidatedReportServiceLive } from "@accountability/core/reporting/ConsolidatedReportService"
import { AuthorizationConfigLive } from "@accountability/core/authorization/AuthorizationConfig"
import { AuthorizationServiceLive } from "@accountability/persistence/Layers/AuthorizationServiceLive"
import { PolicyEngineLive } from "@accountability/persistence/Layers/PolicyEngineLive"
import { YearEndCloseServiceLive } from "@accountability/persistence/Layers/YearEndCloseServiceLive"
import { AppApi, HealthCheckResponse } from "../Definitions/AppApi.ts"
import { AuthMiddlewareLive } from "./AuthMiddlewareLive.ts"
import { AccountsApiLive } from "./AccountsApiLive.ts"
import { AccountTemplatesApiLive } from "./AccountTemplatesApiLive.ts"
import { AuditLogApiLive } from "./AuditLogApiLive.ts"
import { AuthApiLive, AuthSessionApiLive } from "./AuthApiLive.ts"
import { AuthorizationAuditApiLive } from "./AuthorizationAuditApiLive.ts"
import { CompaniesApiLive } from "./CompaniesApiLive.ts"
import { ConsolidationApiLive } from "./ConsolidationApiLive.ts"
import { CurrenciesApiLive } from "./CurrenciesApiLive.ts"
import { CurrencyApiLive } from "./CurrencyApiLive.ts"
import { JurisdictionsApiLive } from "./JurisdictionsApiLive.ts"
import { EliminationRulesApiLive } from "./EliminationRulesApiLive.ts"
import { FiscalPeriodApiLive } from "./FiscalPeriodApiLive.ts"
import { IntercompanyTransactionsApiLive } from "./IntercompanyTransactionsApiLive.ts"
import { InvitationApiLive } from "./InvitationApiLive.ts"
import { JournalEntriesApiLive } from "./JournalEntriesApiLive.ts"
import { MembershipApiLive } from "./MembershipApiLive.ts"
import { PlatformAdminApiLive } from "./PlatformAdminApiLive.ts"
import { PolicyApiLive } from "./PolicyApiLive.ts"
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
 * MembershipPolicyApiGroup - Combined layer for membership and policy APIs
 *
 * Combined to reduce the number of Layer.provide calls in the main chain
 * (TypeScript has a limit on pipe arguments).
 *
 * PolicyApiLive requires PolicyEngine for policy testing/evaluation,
 * so we provide PolicyEngineLive here.
 */
const MembershipPolicyApiGroup = Layer.mergeAll(
  MembershipApiLive,
  PolicyApiLive
).pipe(Layer.provide(PolicyEngineLive))

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

/**
 * CoreApiGroup1 - First group of core API implementations
 *
 * Merged to reduce the number of Layer.provide calls in the main chain
 * (TypeScript has a limit of ~20 arguments in pipe).
 */
const CoreApiGroup1 = Layer.mergeAll(
  HealthApiLive,
  AuthApiLive,
  AuthSessionApiLive,
  AccountsApiLive,
  AccountTemplatesApiLive
)

/**
 * CoreApiGroup2 - Second group of core API implementations
 */
const CoreApiGroup2 = Layer.mergeAll(
  AuditLogApiLive,
  AuthorizationAuditApiLive,
  CompaniesApiLive,
  InvitationApiLive,
  JournalEntriesApiLive,
  ReportsApiLive
)

/**
 * MasterDataApiGroup - Master data API implementations
 */
const MasterDataApiGroup = Layer.mergeAll(
  CurrenciesApiLive,
  JurisdictionsApiLive,
  CurrencyApiLive,
  PlatformAdminApiLive,
  UserOrganizationsApiLive
)

/**
 * FiscalPeriodApiWithDependencies - FiscalPeriodApiLive with its required services
 *
 * FiscalPeriodApiLive requires YearEndCloseService for year-end close preview.
 */
const FiscalPeriodApiWithDependencies = Layer.provide(
  FiscalPeriodApiLive,
  YearEndCloseServiceLive
)

/**
 * AdvancedApiGroup - Advanced feature API implementations
 */
const AdvancedApiGroup = Layer.mergeAll(
  IntercompanyTransactionsApiLive,
  EliminationRulesApiLive,
  FiscalPeriodApiWithDependencies
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
 * - Policy API (protected)
 * - Fiscal Period API (protected)
 * - Platform Admin API (protected, admin-only)
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
 * - FiscalPeriodRepository
 * - FiscalPeriodService
 */
export const AppApiLive = HttpApiBuilder.api(AppApi).pipe(
  // Core API groups (merged to reduce pipe arguments)
  Layer.provide(CoreApiGroup1),
  Layer.provide(CoreApiGroup2),
  Layer.provide(MasterDataApiGroup),
  Layer.provide(AdvancedApiGroup),
  // Feature-specific APIs with dependencies
  Layer.provide(MembershipPolicyApiGroup),
  Layer.provide(ConsolidationApiWithDependencies),
  // Authorization infrastructure
  // AuthorizationServiceWithDependencies provides ABAC+RBAC permission checking
  // Uses ABAC when policies exist, falls back to RBAC when no policies
  // Includes PolicyEngineLive for ABAC policy evaluation
  Layer.provide(AuthorizationServiceWithDependencies),
  // AuthorizationConfigLive provides AUTHORIZATION_ENFORCEMENT env var
  // Set to false for grace period (skip membership checks), true for strict enforcement
  Layer.provide(AuthorizationConfigLive),
  // AuthMiddlewareLive requires TokenValidator to be provided externally
  // - For production: use SessionTokenValidatorLive (validates against database)
  // - For testing: use SimpleTokenValidatorLive (user_<id>_<role> format)
  Layer.provide(AuthMiddlewareLive)
)
