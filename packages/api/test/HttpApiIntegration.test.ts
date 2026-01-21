/**
 * HTTP API Integration Tests
 *
 * These tests verify the full HTTP API stack using:
 * - NodeHttpServer.layerTest for in-memory testing without a real HTTP server
 * - HttpApiClient.make(AppApi) for type-safe test requests
 * - it.layer(HttpLive) pattern for shared test context
 * - Testcontainers for real PostgreSQL database
 *
 * Tests cover:
 * - Success responses with proper Schema decoding
 * - Error responses (401, 404, 422, etc.)
 * - Authentication middleware
 * - All API groups (health, accounts, companies, journal-entries, reports)
 *
 * @module HttpApiIntegration.test
 */

import { describe, expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { HttpApiBuilder, HttpApiClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { AppApi, HealthCheckResponse } from "@accountability/api/Definitions/AppApi"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { SimpleTokenValidatorLive } from "@accountability/api/Layers/AuthMiddlewareLive"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationLayer } from "@accountability/persistence/Layers/MigrationsLive"
import { AccountId } from "@accountability/core/accounting/Account"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Email } from "@accountability/core/authentication/Email"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { SharedPgClientLive } from "./PgTestUtils.ts"

// =============================================================================
// Test Layer Setup
// =============================================================================

/**
 * DatabaseLayer - Provides PostgreSQL with migrations
 *
 * Uses the shared PostgreSQL container from globalSetup,
 * then runs all migrations to create the schema.
 */
const DatabaseLayer = MigrationLayer.pipe(
  Layer.provideMerge(RepositoriesWithAuthLive),
  Layer.provide(SharedPgClientLive)
)

/**
 * HttpLive - Complete test layer for API integration tests
 *
 * Uses NodeHttpServer.layerTest which provides an in-memory HTTP server
 * for testing without binding to a real port.
 *
 * Uses real repositories with the shared PostgreSQL container from globalSetup.
 * Uses SimpleTokenValidatorLive for testing with user_<id>_<role> token format.
 *
 * Pattern: HttpApiBuilder.serve().pipe(
 *   Layer.provide(ApiLive),
 *   Layer.provide(SimpleTokenValidatorLive), // For test token format
 *   Layer.provide(RepositoriesLive),
 *   Layer.provide(MigrationLayer),
 *   Layer.provide(SharedPgClientLive),
 *   Layer.provideMerge(NodeHttpServer.layerTest)
 * )
 */
const HttpLive = HttpApiBuilder.serve().pipe(
  Layer.provide(AppApiLive),
  // Use simple token validator for tests (user_<id>_<role> format)
  Layer.provide(SimpleTokenValidatorLive),
  // Use provideMerge so UserRepository is accessible to tests
  Layer.provideMerge(DatabaseLayer),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

// =============================================================================
// All Tests - Using Single Shared Layer
// =============================================================================

// Use a single shared layer for all tests to avoid spinning up multiple containers
layer(HttpLive, { timeout: "120 seconds" })("HTTP API Integration Tests", (it) => {
  // =============================================================================
  // Health API Tests
  // =============================================================================

  describe("Health API", () => {
    describe("Health endpoint", () => {
      it.effect("GET /api/health returns health check response", () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(AppApi)
          const response = yield* client.health.healthCheck()

          expect(response.status).toBe("ok")
          expect(response.timestamp).toBeDefined()
          expect(typeof response.timestamp).toBe("string")
          // Validate timestamp is a valid ISO string
          expect(() => new Date(response.timestamp)).not.toThrow()
        })
      )

      it.effect("health check returns version when available", () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(AppApi)
          const response = yield* client.health.healthCheck()

          // Version is optional, but should be present in our implementation
          expect(Option.isSome(response.version)).toBe(true)
          if (Option.isSome(response.version)) {
            expect(response.version.value).toBe("0.0.1")
          }
        })
      )

      it.effect("health check has correct response structure", () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(AppApi)
          const response = yield* client.health.healthCheck()

          // Verify the response is properly decoded as HealthCheckResponse
          expect(response).toBeInstanceOf(HealthCheckResponse)
        })
      )
    })
  })

  // =============================================================================
  // Authentication Tests
  // =============================================================================

  describe("Authentication", () => {
    describe("Unauthorized access", () => {
      it.effect("GET /api/v1/accounts without token returns 401", () =>
        Effect.gen(function* () {
          // Use raw HTTP client to skip auth header
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/accounts").pipe(
            HttpClientRequest.setUrlParams({ companyId: "test-company-id" }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )

      it.effect("POST /api/v1/accounts without token returns 401", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/accounts").pipe(
            HttpClientRequest.bodyUnsafeJson({
              companyId: "test-company-id",
              accountNumber: "1000",
              name: "Test Account",
              accountType: "Asset",
              accountCategory: "CurrentAsset",
              normalBalance: "Debit"
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )

      it.effect("invalid token format returns 401 with error message", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/accounts").pipe(
            HttpClientRequest.setUrlParams({ companyId: "test-company-id" }),
            HttpClientRequest.bearerToken("invalid-token"),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "UnauthorizedError")
        })
      )
    })

    describe("Authorized access", () => {
      // Test user UUID for authorization tests - this user is not a member of any organization
      const testUserId = "550e8400-e29b-41d4-a716-446655440099"

      it.effect("valid token allows access to protected endpoints (but 403 if not org member)", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          // Token format: user_<id>_<role>
          const response = yield* HttpClientRequest.get("/api/v1/accounts").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001"
            }),
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("admin role token is accepted", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/organizations").pipe(
            HttpClientRequest.bearerToken("user_22222222-2222-2222-2222-222222222222_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Auth passed, returns empty list from real database
          expect(response.status).toBe(200)
        })
      )

      it.effect("user role token is accepted", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/organizations").pipe(
            HttpClientRequest.bearerToken("user_33333333-3333-3333-3333-333333333333_user"),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(200)
        })
      )

      it.effect("readonly role token is accepted", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/organizations").pipe(
            HttpClientRequest.bearerToken("user_44444444-4444-4444-4444-444444444444_readonly"),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(200)
        })
      )
    })
  })

  // =============================================================================
  // Accounts API Tests
  // =============================================================================

  describe("Accounts API", () => {
    describe("Account endpoints", () => {
      // Test user UUID for authorization tests - this user is not a member of any organization
      const testUserId = "550e8400-e29b-41d4-a716-446655440099"

      it.effect("GET /api/v1/accounts returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/accounts").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001"
            }),
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("GET /api/v1/accounts/organizations/:organizationId/accounts/:id returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/accounts/organizations/550e8400-e29b-41d4-a716-446655440000/accounts/550e8400-e29b-41d4-a716-446655440002").pipe(
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("POST /api/v1/accounts returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/accounts").pipe(
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            HttpClientRequest.bodyUnsafeJson({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001",
              accountNumber: "1000",
              name: "Cash",
              description: null,
              accountType: "Asset",
              accountCategory: "CurrentAsset",
              normalBalance: "Debit",
              parentAccountId: null,
              isPostable: true,
              isCashFlowRelevant: true,
              cashFlowCategory: "Operating",
              isIntercompany: false,
              intercompanyPartnerId: null,
              currencyRestriction: null
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("PUT /api/v1/accounts/organizations/:organizationId/accounts/:id returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.put("/api/v1/accounts/organizations/550e8400-e29b-41d4-a716-446655440000/accounts/550e8400-e29b-41d4-a716-446655440002").pipe(
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            HttpClientRequest.bodyUnsafeJson({
              name: null,
              description: null,
              parentAccountId: null,
              isPostable: null,
              isCashFlowRelevant: null,
              cashFlowCategory: null,
              isIntercompany: null,
              intercompanyPartnerId: null,
              currencyRestriction: null,
              isActive: null,
              isRetainedEarnings: null
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("DELETE /api/v1/accounts/organizations/:organizationId/accounts/:id returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.del("/api/v1/accounts/organizations/550e8400-e29b-41d4-a716-446655440000/accounts/550e8400-e29b-41d4-a716-446655440002").pipe(
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )
    })
  })

  // =============================================================================
  // Companies API Tests
  // =============================================================================

  describe("Companies API", () => {
    describe("Organizations endpoints", () => {
      it.effect("GET /api/v1/organizations returns empty list from empty database", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/organizations").pipe(
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(200)
          const body = yield* response.json
          expect(body).toHaveProperty("organizations")
          expect(body).toHaveProperty("total")
        })
      )

      it.effect("GET /api/v1/organizations/:id returns 404 for non-existent org", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/organizations/550e8400-e29b-41d4-a716-446655440000").pipe(
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(404)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "OrganizationNotFoundError")
          expect(body).toHaveProperty("organizationId", "550e8400-e29b-41d4-a716-446655440000")
        })
      )

      it.effect("POST /api/v1/organizations creates organization in database", () =>
        Effect.gen(function* () {
          // Use valid UUID for user ID - non-UUID IDs are no longer accepted for organization creation
          const testUserId = "550e8400-e29b-41d4-a716-446655440001"

          // Ensure test user exists in database for membership creation (foreign key constraint)
          const userRepo = yield* UserRepository
          const existingUser = yield* userRepo.findById(AuthUserId.make(testUserId))
          if (existingUser._tag === "None") {
            yield* userRepo.create({
              id: AuthUserId.make(testUserId),
              email: Email.make("testorg@example.com"),
              displayName: "Test Org Creator",
              role: "admin",
              primaryProvider: "local"
            })
          }

          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/organizations").pipe(
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            HttpClientRequest.bodyUnsafeJson({
              name: "Test Org",
              reportingCurrency: "USD",
              settings: null
            }),
            httpClient.execute,
            Effect.scoped
          )

          // With real database, creates successfully (201 Created)
          expect(response.status).toBe(201)
          const body = yield* response.json
          expect(body).toHaveProperty("name", "Test Org")
          expect(body).toHaveProperty("reportingCurrency", "USD")
          expect(body).toHaveProperty("id")
        })
      )
    })

    describe("Companies endpoints", () => {
      // Test user UUID for authorization tests - this user is not a member of any organization
      const testUserId = "550e8400-e29b-41d4-a716-446655440099"

      it.effect("GET /api/v1/companies returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/companies").pipe(
            HttpClientRequest.setUrlParams({ organizationId: "550e8400-e29b-41d4-a716-446655440000" }),
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("GET /api/v1/organizations/:orgId/companies/:id returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/organizations/550e8400-e29b-41d4-a716-446655440000/companies/550e8400-e29b-41d4-a716-446655440001").pipe(
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("POST /api/v1/companies returns 403 for non-member of organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/companies").pipe(
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            HttpClientRequest.bodyUnsafeJson({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              name: "Test Company",
              legalName: "Test Company Inc.",
              jurisdiction: "US",
              taxId: null,
              incorporationDate: null,
              registrationNumber: null,
              registeredAddress: null,
              industryCode: null,
              companyType: null,
              incorporationJurisdiction: null,
              functionalCurrency: "USD",
              reportingCurrency: "USD",
              fiscalYearEnd: { month: 12, day: 31 },
              parentCompanyId: null,
              ownershipPercentage: null
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )
    })
  })

  // =============================================================================
  // Journal Entries API Tests
  // =============================================================================

  describe("Journal Entries API", () => {
    describe("Journal entry endpoints", () => {
      it.effect("GET /api/v1/journal-entries returns 403 for unauthorized user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/journal-entries").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001"
            }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 403 because user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("GET /api/v1/journal-entries/:id returns 403 for unauthorized user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/journal-entries/550e8400-e29b-41d4-a716-446655440010").pipe(
            HttpClientRequest.setUrlParams({ organizationId: "550e8400-e29b-41d4-a716-446655440000" }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 403 because user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("POST /api/v1/journal-entries with invalid body returns 400", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          // Send with invalid/empty lines which violates minimum items constraint
          // Note: transactionDate is ISO string format (YYYY-MM-DD) per LocalDateFromString schema
          const response = yield* HttpClientRequest.post("/api/v1/journal-entries").pipe(
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            HttpClientRequest.bodyUnsafeJson({
              companyId: "550e8400-e29b-41d4-a716-446655440001",
              description: "Test entry",
              transactionDate: "2024-01-15",
              documentDate: null,
              fiscalPeriod: { year: 2024, period: 1 },
              entryType: "Manual",
              sourceModule: "GeneralLedger",
              referenceNumber: null,
              sourceDocumentRef: null,
              lines: []  // Invalid - needs at least 2 lines
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 400 because lines must have at least 2 items
          expect(response.status).toBe(400)
        })
      )

      it.effect("POST /api/v1/journal-entries/:id/submit returns 403 for unauthorized user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/journal-entries/550e8400-e29b-41d4-a716-446655440010/submit").pipe(
            HttpClientRequest.setUrlParams({ organizationId: "550e8400-e29b-41d4-a716-446655440000" }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 403 because user is not a member of the organization
          expect(response.status).toBe(403)
        })
      )

      it.effect("POST /api/v1/journal-entries/:id/approve returns 403 for unauthorized user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/journal-entries/550e8400-e29b-41d4-a716-446655440010/approve").pipe(
            HttpClientRequest.setUrlParams({ organizationId: "550e8400-e29b-41d4-a716-446655440000" }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 403 because user is not a member of the organization
          expect(response.status).toBe(403)
        })
      )

      it.effect("POST /api/v1/journal-entries/:id/reject returns 403 for unauthorized user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/journal-entries/550e8400-e29b-41d4-a716-446655440010/reject").pipe(
            HttpClientRequest.setUrlParams({ organizationId: "550e8400-e29b-41d4-a716-446655440000" }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            HttpClientRequest.bodyUnsafeJson({ reason: "Test rejection" }),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 403 because user is not a member of the organization
          expect(response.status).toBe(403)
        })
      )

      it.effect("POST /api/v1/journal-entries/:id/post returns 403 for unauthorized user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/journal-entries/550e8400-e29b-41d4-a716-446655440010/post").pipe(
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            // PostJournalEntryRequest requires organizationId, postedBy (UUID) and optional postingDate
            HttpClientRequest.bodyUnsafeJson({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              postedBy: "550e8400-e29b-41d4-a716-446655440100",
              postingDate: null
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 403 because user is not a member of the organization
          expect(response.status).toBe(403)
        })
      )

      it.effect("POST /api/v1/journal-entries/:id/reverse returns 403 for unauthorized user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.post("/api/v1/journal-entries/550e8400-e29b-41d4-a716-446655440010/reverse").pipe(
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            // ReverseJournalEntryRequest schema - organizationId, reversedBy is a UUID, reversalDate is ISO string (YYYY-MM-DD)
            HttpClientRequest.bodyUnsafeJson({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              reversalDate: "2024-02-01",
              reversalDescription: null,
              reversedBy: "550e8400-e29b-41d4-a716-446655440100"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Returns 403 because user is not a member of the organization
          expect(response.status).toBe(403)
        })
      )
    })
  })

  // =============================================================================
  // Reports API Tests
  // =============================================================================

  describe("Reports API", () => {
    describe("Report endpoints", () => {
      it.effect("GET /api/v1/reports/trial-balance returns 403 for non-member organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/reports/trial-balance").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001",
              asOfDate: "2024-01-31"
            }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs first - user is not a member of this organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("GET /api/v1/reports/balance-sheet returns 403 for non-member organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/reports/balance-sheet").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001",
              asOfDate: "2024-01-31"
            }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs first - user is not a member of this organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("GET /api/v1/reports/income-statement returns 403 for non-member organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/reports/income-statement").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001",
              periodStartDate: "2024-01-01",
              periodEndDate: "2024-01-31"
            }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs first - user is not a member of this organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("GET /api/v1/reports/cash-flow returns 403 for non-member organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/reports/cash-flow").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001",
              periodStartDate: "2024-01-01",
              periodEndDate: "2024-01-31"
            }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs first - user is not a member of this organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("GET /api/v1/reports/equity-statement returns 403 for non-member organization", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/reports/equity-statement").pipe(
            HttpClientRequest.setUrlParams({
              organizationId: "550e8400-e29b-41d4-a716-446655440000",
              companyId: "550e8400-e29b-41d4-a716-446655440001",
              periodStartDate: "2024-01-01",
              periodEndDate: "2024-01-31"
            }),
            HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs first - user is not a member of this organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )
    })
  })

  // =============================================================================
  // Error Response Tests
  // =============================================================================

  describe("Error Responses", () => {
    describe("Error serialization", () => {
      // Test user UUID for authorization tests - this user is not a member of any organization
      const testUserId = "550e8400-e29b-41d4-a716-446655440099"

      it.effect("ForbiddenError has correct structure (authorization check before business logic)", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/accounts/organizations/550e8400-e29b-41d4-a716-446655440000/accounts/550e8400-e29b-41d4-a716-446655440099").pipe(
            // Use valid UUID as userId so the database query works correctly
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          // Authorization check runs before business logic - user is not a member of the organization
          expect(response.status).toBe(403)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "ForbiddenError")
        })
      )

      it.effect("UnauthorizedError has correct structure", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const response = yield* HttpClientRequest.get("/api/v1/accounts").pipe(
            HttpClientRequest.setUrlParams({ companyId: "test" }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "UnauthorizedError")
          expect(body).toHaveProperty("message")
        })
      )

      it.effect("NotFoundError has correct structure (for organizations without permission checks)", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          // Use organizations endpoint which doesn't require org membership
          const response = yield* HttpClientRequest.get("/api/v1/organizations/550e8400-e29b-41d4-a716-446655440000").pipe(
            HttpClientRequest.bearerToken(`user_${testUserId}_admin`),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(404)
          const body = yield* response.json
          expect(body).toHaveProperty("_tag", "OrganizationNotFoundError")
          expect(body).toHaveProperty("organizationId", "550e8400-e29b-41d4-a716-446655440000")
        })
      )
    })
  })

  // =============================================================================
  // Type-Safe Client Tests (HttpApiClient.make pattern)
  // =============================================================================

  describe("Type-Safe HttpApiClient", () => {
    describe("Client type safety", () => {
      it.effect("client groups are properly typed", () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(AppApi)

          // Verify all groups exist
          expect(client.health).toBeDefined()
          expect(client.accounts).toBeDefined()
          expect(client.companies).toBeDefined()
          expect(client["journal-entries"]).toBeDefined()
          expect(client.reports).toBeDefined()
        })
      )

      it.effect("client endpoints are properly typed", () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(AppApi)

          // Health endpoints
          expect(typeof client.health.healthCheck).toBe("function")

          // Account endpoints
          expect(typeof client.accounts.listAccounts).toBe("function")
          expect(typeof client.accounts.getAccount).toBe("function")
          expect(typeof client.accounts.createAccount).toBe("function")
          expect(typeof client.accounts.updateAccount).toBe("function")
          expect(typeof client.accounts.deactivateAccount).toBe("function")
        })
      )

      it.effect("health check via typed client works", () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(AppApi)
          const response = yield* client.health.healthCheck()

          expect(response.status).toBe("ok")
          expect(response).toBeInstanceOf(HealthCheckResponse)
        })
      )

      it.effect("error responses are properly typed via Effect.flip", () =>
        Effect.gen(function* () {
          // Test user UUID for authorization tests - this user is not a member of any organization
          const testUserId = "550e8400-e29b-41d4-a716-446655440099"

          // Use HttpApiClient.makeWith with custom httpClient that adds bearer token
          const client = yield* HttpApiClient.makeWith(AppApi, {
            httpClient: (yield* HttpClient.HttpClient).pipe(
              // Use valid UUID as userId so the database query works correctly
              HttpClient.mapRequest(HttpClientRequest.bearerToken(`user_${testUserId}_admin`))
            )
          })

          // Use Effect.flip to get the error from the API
          const testOrganizationId = "550e8400-e29b-41d4-a716-446655440000"
          const testAccountId = AccountId.make("550e8400-e29b-41d4-a716-446655440099")
          const error = yield* client.accounts.getAccount({
            path: { organizationId: testOrganizationId, id: testAccountId }
          }).pipe(Effect.flip)

          // Authorization check runs before business logic - user is not a member of the organization
          expect(error._tag).toBe("ForbiddenError")
        })
      )

      it.effect("withResponse returns both response and data", () =>
        Effect.gen(function* () {
          const client = yield* HttpApiClient.make(AppApi)
          const [data, response] = yield* client.health.healthCheck({ withResponse: true })

          expect(data.status).toBe("ok")
          expect(response.status).toBe(200)
        })
      )
    })
  })
})
