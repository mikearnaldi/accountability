/**
 * AccountTemplatesApi Tests
 *
 * Tests for the account templates API endpoints.
 * Verifies:
 * - GET /api/v1/account-templates returns list of templates
 * - GET /api/v1/account-templates/:type returns template with accounts
 * - POST /api/v1/account-templates/:type/apply applies template to company
 * - Authentication is required for all endpoints
 *
 * @module AccountTemplatesApi.test
 */

import { describe, expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { HttpApiBuilder, HttpApiClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import {
  AccountTemplateListResponse,
  AccountTemplateItem,
  AccountTemplateDetailResponse
} from "@accountability/api/Definitions/AccountTemplatesApi"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { SimpleTokenValidatorLive } from "@accountability/api/Layers/AuthMiddlewareLive"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationLayer } from "@accountability/persistence/Layers/MigrationsLive"
import { UserRepository } from "@accountability/persistence/Services/UserRepository"
import { AuthUserId } from "@accountability/core/authentication/AuthUserId"
import { Email } from "@accountability/core/authentication/Email"
import {
  getAllTemplates,
  getTemplateByType
} from "@accountability/core/accounting/AccountTemplate"
import { SharedPgClientLive } from "./PgTestUtils.ts"

// =============================================================================
// Test Layer Setup
// =============================================================================

/**
 * DatabaseLayer - Provides PostgreSQL with migrations
 */
const DatabaseLayer = MigrationLayer.pipe(
  Layer.provideMerge(RepositoriesWithAuthLive),
  Layer.provide(SharedPgClientLive)
)

/**
 * HttpLive - Complete test layer for API integration tests
 * Uses provideMerge for DatabaseLayer to expose repositories to tests
 */
const HttpLive = HttpApiBuilder.serve().pipe(
  Layer.provide(AppApiLive),
  Layer.provide(SimpleTokenValidatorLive),
  Layer.provideMerge(DatabaseLayer),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Test user UUID - used for authentication tokens that need valid UUID format
 * This is required because organization membership checks validate UUID format
 */
const TEST_USER_UUID = "550e8400-e29b-41d4-a716-446655440000"
const TEST_TOKEN = `user_${TEST_USER_UUID}_admin`

/**
 * Schema for extracting id from API response
 */
const EntityWithIdSchema = Schema.Struct({ id: Schema.String })

/**
 * Ensures the test user exists in the database
 * Required for organization membership to be created successfully
 */
const ensureTestUserExists = Effect.gen(function* () {
  const userRepo = yield* UserRepository
  const userId = AuthUserId.make(TEST_USER_UUID)
  const existingUser = yield* userRepo.findById(userId)
  if (existingUser._tag === "None") {
    yield* userRepo.create({
      id: userId,
      email: Email.make("test@example.com"),
      displayName: "Test User",
      role: "admin",
      primaryProvider: "local"
    })
  }
})

/**
 * Create a test organization via API
 * Also ensures the test user exists first so membership can be created
 */
const createTestOrganizationViaApi = (httpClient: HttpClient.HttpClient) =>
  Effect.gen(function* () {
    // Ensure test user exists in database for membership creation
    yield* ensureTestUserExists

    const response = yield* HttpClientRequest.post("/api/v1/organizations").pipe(
      HttpClientRequest.bearerToken(TEST_TOKEN),
      HttpClientRequest.bodyUnsafeJson({
        name: `Test Org ${Date.now()}`,
        reportingCurrency: "USD",
        settings: null
      }),
      httpClient.execute,
      Effect.scoped
    )
    expect(response.status).toBe(201)
    const body = yield* response.json
    const decoded = yield* Schema.decodeUnknown(EntityWithIdSchema)(body)
    return decoded
  })

/**
 * Create a test company via API
 */
const createTestCompanyViaApi = (httpClient: HttpClient.HttpClient, organizationId: string) =>
  Effect.gen(function* () {
    const response = yield* HttpClientRequest.post("/api/v1/companies").pipe(
      HttpClientRequest.bearerToken(TEST_TOKEN),
      HttpClientRequest.bodyUnsafeJson({
        organizationId,
        name: `Test Company ${Date.now()}`,
        legalName: `Test Company Legal ${Date.now()}`,
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
    expect(response.status).toBe(201)
    const body = yield* response.json
    const decoded = yield* Schema.decodeUnknown(EntityWithIdSchema)(body)
    return decoded
  })

// =============================================================================
// Tests
// =============================================================================

layer(HttpLive, { timeout: "120 seconds" })("AccountTemplatesApi", (it) => {
  describe("GET /api/v1/account-templates", () => {
    it.effect("returns list of templates with authentication", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/account-templates").pipe(
          HttpClientRequest.bearerToken(TEST_TOKEN),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
        const body = yield* response.json
        expect(body).toHaveProperty("templates")
        expect(body).toMatchObject({
          templates: expect.arrayContaining([expect.any(Object)])
        })
      })
    )

    it.effect("returns templates in expected format using typed client", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.listAccountTemplates()

        expect(response.templates.length).toBe(4) // 4 template types

        // Verify structure of first template
        const firstTemplate = response.templates[0]
        expect(typeof firstTemplate.templateType).toBe("string")
        expect(typeof firstTemplate.name).toBe("string")
        expect(typeof firstTemplate.description).toBe("string")
        expect(typeof firstTemplate.accountCount).toBe("number")
      })
    )

    it.effect("returns all predefined templates", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.listAccountTemplates()

        const allTemplates = getAllTemplates()
        expect(response.templates.length).toBe(allTemplates.length)

        // Verify all expected template types are present
        const types = new Set(response.templates.map((t) => t.templateType))
        expect(types.has("GeneralBusiness")).toBe(true)
        expect(types.has("Manufacturing")).toBe(true)
        expect(types.has("ServiceBusiness")).toBe(true)
        expect(types.has("HoldingCompany")).toBe(true)
      })
    )

    it.effect("returns correct account counts", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.listAccountTemplates()

        // Verify account counts match the actual templates
        for (const templateItem of response.templates) {
          const template = getTemplateByType(templateItem.templateType)
          expect(templateItem.accountCount).toBe(template.accountCount)
        }
      })
    )
  })

  describe("GET /api/v1/account-templates/:type", () => {
    it.effect("returns GeneralBusiness template with all accounts", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.getAccountTemplate({
          path: { type: "GeneralBusiness" }
        })

        expect(response.template.templateType).toBe("GeneralBusiness")
        expect(response.template.name).toBe("General Business")
        expect(response.template.accounts.length).toBeGreaterThan(0)

        // Verify account structure
        const firstAccount = response.template.accounts[0]
        expect(typeof firstAccount.accountNumber).toBe("string")
        expect(typeof firstAccount.name).toBe("string")
        expect(typeof firstAccount.accountType).toBe("string")
        expect(typeof firstAccount.accountCategory).toBe("string")
        expect(typeof firstAccount.isPostable).toBe("boolean")
        expect(typeof firstAccount.isCashFlowRelevant).toBe("boolean")
        expect(typeof firstAccount.isIntercompany).toBe("boolean")
      })
    )

    it.effect("returns Manufacturing template", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.getAccountTemplate({
          path: { type: "Manufacturing" }
        })

        expect(response.template.templateType).toBe("Manufacturing")
        expect(response.template.name).toBe("Manufacturing")
        // Manufacturing template has more accounts than general business
        expect(response.template.accounts.length).toBeGreaterThan(50)
      })
    )

    it.effect("returns ServiceBusiness template", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.getAccountTemplate({
          path: { type: "ServiceBusiness" }
        })

        expect(response.template.templateType).toBe("ServiceBusiness")
        expect(response.template.name).toBe("Service Business")
      })
    )

    it.effect("returns HoldingCompany template", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.getAccountTemplate({
          path: { type: "HoldingCompany" }
        })

        expect(response.template.templateType).toBe("HoldingCompany")
        expect(response.template.name).toBe("Holding Company")
      })
    )

    it.effect("returns 400 for invalid template type", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/account-templates/InvalidType").pipe(
          HttpClientRequest.bearerToken(TEST_TOKEN),
          httpClient.execute,
          Effect.scoped
        )

        // Invalid template type should result in a 400 Bad Request
        expect(response.status).toBe(400)
      })
    )
  })

  describe("POST /api/v1/account-templates/:type/apply", () => {
    it.effect("applies template to company and creates accounts", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        // Create test organization and company via API
        const org = yield* createTestOrganizationViaApi(httpClient)
        const company = yield* createTestCompanyViaApi(httpClient, org.id)

        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: httpClient.pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        // Apply template
        const response = yield* client.accountTemplates.applyAccountTemplate({
          path: { type: "GeneralBusiness" },
          payload: { organizationId: org.id, companyId: company.id }
        })

        expect(response.templateType).toBe("GeneralBusiness")
        expect(response.companyId).toBe(company.id)

        // Verify correct number of accounts created
        const template = getTemplateByType("GeneralBusiness")
        expect(response.createdCount).toBe(template.accountCount)
      })
    )

    it.effect("returns error when company not found", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const fakeCompanyId = crypto.randomUUID()

        // Create a real organization so the organization context check passes
        const org = yield* createTestOrganizationViaApi(httpClient)

        const response = yield* HttpClientRequest.post("/api/v1/account-templates/GeneralBusiness/apply").pipe(
          HttpClientRequest.bearerToken(TEST_TOKEN),
          HttpClientRequest.bodyUnsafeJson({ organizationId: org.id, companyId: fakeCompanyId }),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(404)
        const body = yield* response.json
        expect(body).toHaveProperty("_tag", "CompanyNotFoundError")
      })
    )

    it.effect("returns error when company already has accounts", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        // Create test organization and company via API
        const org = yield* createTestOrganizationViaApi(httpClient)
        const company = yield* createTestCompanyViaApi(httpClient, org.id)

        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: httpClient.pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        // Apply template first time - should succeed
        yield* client.accountTemplates.applyAccountTemplate({
          path: { type: "GeneralBusiness" },
          payload: { organizationId: org.id, companyId: company.id }
        })

        // Try to apply template second time - should fail
        const response = yield* HttpClientRequest.post("/api/v1/account-templates/GeneralBusiness/apply").pipe(
          HttpClientRequest.bearerToken(TEST_TOKEN),
          HttpClientRequest.bodyUnsafeJson({ organizationId: org.id, companyId: company.id }),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(409) // AccountsAlreadyExistError is a conflict (409)
        const body = yield* response.json
        expect(body).toHaveProperty("_tag", "AccountsAlreadyExistError")
        expect(body).toHaveProperty("accountCount")
      })
    )

    it.effect("applies ServiceBusiness template successfully", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        // Create test organization and company via API
        const org = yield* createTestOrganizationViaApi(httpClient)
        const company = yield* createTestCompanyViaApi(httpClient, org.id)

        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: httpClient.pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        // Apply ServiceBusiness template
        const response = yield* client.accountTemplates.applyAccountTemplate({
          path: { type: "ServiceBusiness" },
          payload: { organizationId: org.id, companyId: company.id }
        })

        expect(response.templateType).toBe("ServiceBusiness")
        expect(response.createdCount).toBeGreaterThan(0)
      })
    )

    it.effect("creates audit log entries when applying template", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        // Create test organization and company via API
        const org = yield* createTestOrganizationViaApi(httpClient)
        const company = yield* createTestCompanyViaApi(httpClient, org.id)

        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: httpClient.pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        // Apply HoldingCompany template (smallest template for faster test)
        const applyResponse = yield* client.accountTemplates.applyAccountTemplate({
          path: { type: "HoldingCompany" },
          payload: { organizationId: org.id, companyId: company.id }
        })

        expect(applyResponse.createdCount).toBeGreaterThan(0)

        // Query audit log for Account Create entries in this organization
        const auditResponse = yield* client.auditLog.listAuditLog({
          path: { organizationId: org.id },
          urlParams: {
            entityType: "Account",
            action: "Create",
            limit: 100
          }
        })

        // Should have audit entries for each account created from template
        expect(auditResponse.entries.length).toBe(applyResponse.createdCount)

        // Each entry should have the correct entity type and action
        for (const entry of auditResponse.entries) {
          expect(entry.entityType).toBe("Account")
          expect(entry.action).toBe("Create")
          // Should have entity name captured
          expect(entry.entityName._tag).toBe("Some")
          // Should have user ID from the test token
          expect(entry.userId._tag).toBe("Some")
        }
      })
    )
  })

  describe("Authentication", () => {
    it.effect("returns 401 without authentication for list", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/account-templates").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )

    it.effect("returns 401 without authentication for get", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/account-templates/GeneralBusiness").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )

    it.effect("returns 401 without authentication for apply", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.post("/api/v1/account-templates/GeneralBusiness/apply").pipe(
          HttpClientRequest.bodyUnsafeJson({ companyId: crypto.randomUUID() }),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )

    it.effect("returns 401 with invalid token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/account-templates").pipe(
          HttpClientRequest.bearerToken("invalid-token"),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )

    it.effect("accepts valid token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/account-templates").pipe(
          HttpClientRequest.bearerToken("user_22222222-2222-2222-2222-222222222222_user"),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
      })
    )
  })

  describe("Type-Safe HttpApiClient", () => {
    it.effect("accountTemplates group is properly typed", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi)

        expect(client.accountTemplates).toBeDefined()
        expect(typeof client.accountTemplates.listAccountTemplates).toBe("function")
        expect(typeof client.accountTemplates.getAccountTemplate).toBe("function")
        expect(typeof client.accountTemplates.applyAccountTemplate).toBe("function")
      })
    )

    it.effect("listAccountTemplates returns typed response with valid token", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.listAccountTemplates()

        expect(response).toBeInstanceOf(AccountTemplateListResponse)
        expect(Array.isArray(response.templates)).toBe(true)
        expect(response.templates.length).toBeGreaterThan(0)

        // Each template should be an AccountTemplateItem
        for (const template of response.templates) {
          expect(template).toBeInstanceOf(AccountTemplateItem)
        }
      })
    )

    it.effect("getAccountTemplate returns typed response", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken(TEST_TOKEN))
          )
        })

        const response = yield* client.accountTemplates.getAccountTemplate({
          path: { type: "GeneralBusiness" }
        })

        expect(response).toBeInstanceOf(AccountTemplateDetailResponse)
        expect(response.template.templateType).toBe("GeneralBusiness")
        expect(Array.isArray(response.template.accounts)).toBe(true)
      })
    )
  })
})
