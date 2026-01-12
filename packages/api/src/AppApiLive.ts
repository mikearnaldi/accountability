/**
 * AppApiLive - Live implementation of the API handlers
 *
 * This module provides the Effect layer that implements all API endpoints.
 * It connects the API definition to actual service implementations.
 *
 * Note: ReportsApiLive requires repository dependencies, so we provide a stub
 * implementation here for when the web layer doesn't have database access.
 * Use ReportsApiLive directly in tests with mock repositories.
 *
 * @module AppApiLive
 */

import { HttpApiBuilder } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { AppApi, HealthCheckResponse, NotFoundError, ValidationError, BusinessRuleError } from "./AppApi.ts"
import { AuthMiddlewareWithSimpleValidation } from "./AuthMiddleware.ts"

// =============================================================================
// Health API Implementation
// =============================================================================

/**
 * Implement handlers for the health API group
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
// Accounts API Implementation (Stub)
// =============================================================================

/**
 * Stub implementation for accounts API
 * Returns appropriate errors/empty responses for now
 *
 * Protected by AuthMiddleware - requires valid bearer token.
 */
const AccountsLive = HttpApiBuilder.group(AppApi, "accounts", (handlers) =>
  handlers
    .handle("listAccounts", () =>
      Effect.fail(new NotFoundError({ resource: "Company", id: "stub" }))
    )
    .handle("getAccount", () =>
      Effect.fail(new NotFoundError({ resource: "Account", id: "stub" }))
    )
    .handle("createAccount", () =>
      Effect.fail(new ValidationError({
        message: "Account creation not yet implemented",
        field: Option.none(),
        details: Option.none()
      }))
    )
    .handle("updateAccount", () =>
      Effect.fail(new NotFoundError({ resource: "Account", id: "stub" }))
    )
    .handle("deactivateAccount", () =>
      Effect.fail(new NotFoundError({ resource: "Account", id: "stub" }))
    )
).pipe(Layer.provide(AuthMiddlewareWithSimpleValidation))

// =============================================================================
// Companies API Implementation (Stub)
// =============================================================================

/**
 * Stub implementation for companies API
 *
 * Protected by AuthMiddleware - requires valid bearer token.
 */
const CompaniesLive = HttpApiBuilder.group(AppApi, "companies", (handlers) =>
  handlers
    .handle("listOrganizations", () =>
      Effect.succeed({
        organizations: [],
        total: 0
      })
    )
    .handle("getOrganization", () =>
      Effect.fail(new NotFoundError({ resource: "Organization", id: "stub" }))
    )
    .handle("createOrganization", () =>
      Effect.fail(new ValidationError({
        message: "Organization creation not yet implemented",
        field: Option.none(),
        details: Option.none()
      }))
    )
    .handle("updateOrganization", () =>
      Effect.fail(new NotFoundError({ resource: "Organization", id: "stub" }))
    )
    .handle("deleteOrganization", () =>
      Effect.fail(new NotFoundError({ resource: "Organization", id: "stub" }))
    )
    .handle("listCompanies", () =>
      Effect.fail(new NotFoundError({ resource: "Organization", id: "stub" }))
    )
    .handle("getCompany", () =>
      Effect.fail(new NotFoundError({ resource: "Company", id: "stub" }))
    )
    .handle("createCompany", () =>
      Effect.fail(new ValidationError({
        message: "Company creation not yet implemented",
        field: Option.none(),
        details: Option.none()
      }))
    )
    .handle("updateCompany", () =>
      Effect.fail(new NotFoundError({ resource: "Company", id: "stub" }))
    )
    .handle("deactivateCompany", () =>
      Effect.fail(new NotFoundError({ resource: "Company", id: "stub" }))
    )
).pipe(Layer.provide(AuthMiddlewareWithSimpleValidation))

// =============================================================================
// Journal Entries API Implementation (Stub)
// =============================================================================

/**
 * Stub implementation for journal entries API
 *
 * Protected by AuthMiddleware - requires valid bearer token.
 */
const JournalEntriesLive = HttpApiBuilder.group(AppApi, "journal-entries", (handlers) =>
  handlers
    .handle("listJournalEntries", () =>
      Effect.fail(new NotFoundError({ resource: "Company", id: "stub" }))
    )
    .handle("getJournalEntry", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
    .handle("createJournalEntry", () =>
      Effect.fail(new ValidationError({
        message: "Journal entry creation not yet implemented",
        field: Option.none(),
        details: Option.none()
      }))
    )
    .handle("updateJournalEntry", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
    .handle("deleteJournalEntry", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
    .handle("submitForApproval", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
    .handle("approveJournalEntry", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
    .handle("rejectJournalEntry", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
    .handle("postJournalEntry", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
    .handle("reverseJournalEntry", () =>
      Effect.fail(new NotFoundError({ resource: "JournalEntry", id: "stub" }))
    )
).pipe(Layer.provide(AuthMiddlewareWithSimpleValidation))

// =============================================================================
// Reports API Implementation (Stub)
// =============================================================================

/**
 * Stub implementation for reports API
 *
 * This returns NOT_IMPLEMENTED errors. Use ReportsApiLive with proper
 * repository dependencies for actual report generation.
 *
 * Protected by AuthMiddleware - requires valid bearer token.
 */
const ReportsStub = HttpApiBuilder.group(AppApi, "reports", (handlers) =>
  handlers
    .handle("generateTrialBalance", () =>
      Effect.fail(new BusinessRuleError({
        code: "NOT_IMPLEMENTED",
        message: "Trial balance generation requires database connection. Use test layer with mock repositories.",
        details: Option.none()
      }))
    )
    .handle("generateBalanceSheet", () =>
      Effect.fail(new BusinessRuleError({
        code: "NOT_IMPLEMENTED",
        message: "Balance sheet generation requires database connection. Use test layer with mock repositories.",
        details: Option.none()
      }))
    )
    .handle("generateIncomeStatement", () =>
      Effect.fail(new BusinessRuleError({
        code: "NOT_IMPLEMENTED",
        message: "Income statement generation requires database connection. Use test layer with mock repositories.",
        details: Option.none()
      }))
    )
    .handle("generateCashFlowStatement", () =>
      Effect.fail(new BusinessRuleError({
        code: "NOT_IMPLEMENTED",
        message: "Cash flow statement generation requires database connection. Use test layer with mock repositories.",
        details: Option.none()
      }))
    )
    .handle("generateEquityStatement", () =>
      Effect.fail(new BusinessRuleError({
        code: "NOT_IMPLEMENTED",
        message: "Equity statement generation requires database connection. Use test layer with mock repositories.",
        details: Option.none()
      }))
    )
).pipe(Layer.provide(AuthMiddlewareWithSimpleValidation))

// =============================================================================
// Compose All API Layers
// =============================================================================

/**
 * AppApiLive - Complete API layer with all group implementations
 *
 * Composes all group implementations into the full API layer.
 * Uses stub reports layer - for real report generation, use ReportsApiLive
 * with proper repository dependencies.
 */
export const AppApiLive = HttpApiBuilder.api(AppApi).pipe(
  Layer.provide(HealthLive),
  Layer.provide(AccountsLive),
  Layer.provide(CompaniesLive),
  Layer.provide(JournalEntriesLive),
  Layer.provide(ReportsStub)
)
