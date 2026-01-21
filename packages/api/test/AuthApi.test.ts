/**
 * Auth API Integration Tests
 *
 * These tests verify the authentication API endpoints:
 * - POST /api/auth/register - User registration
 * - POST /api/auth/login - User login
 * - POST /api/auth/logout - Session logout
 * - GET /api/auth/me - Get current user
 * - Protected endpoints return 401 without token
 * - Expired sessions return 401
 *
 * Uses HttpApiClient for type-safe test requests and testcontainers
 * for real PostgreSQL database testing.
 *
 * @module AuthApi.test
 */

import { describe, expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { HttpApiBuilder, HttpApiClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { ConsolidatedReportServiceLive } from "@accountability/core/reporting/ConsolidatedReportService"
import { AppApi, HealthCheckResponse } from "@accountability/api/Definitions/AppApi"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationLayer } from "@accountability/persistence/Layers/MigrationsLive"
import { SharedPgClientLive } from "./PgTestUtils.ts"
import { AuthMiddlewareWithSessionValidation } from "@accountability/api/Layers/AuthMiddlewareLive"
import { AccountsApiLive } from "@accountability/api/Layers/AccountsApiLive"
import { AccountTemplatesApiLive } from "@accountability/api/Layers/AccountTemplatesApiLive"
import { AuditLogApiLive } from "@accountability/api/Layers/AuditLogApiLive"
import { AuthApiLive, AuthSessionApiLive } from "@accountability/api/Layers/AuthApiLive"
import { CompaniesApiLive } from "@accountability/api/Layers/CompaniesApiLive"
import { ConsolidationApiLive } from "@accountability/api/Layers/ConsolidationApiLive"
import { CurrenciesApiLive } from "@accountability/api/Layers/CurrenciesApiLive"
import { CurrencyApiLive } from "@accountability/api/Layers/CurrencyApiLive"
import { JurisdictionsApiLive } from "@accountability/api/Layers/JurisdictionsApiLive"
import { EliminationRulesApiLive } from "@accountability/api/Layers/EliminationRulesApiLive"
import { FiscalPeriodApiLive } from "@accountability/api/Layers/FiscalPeriodApiLive"
import { IntercompanyTransactionsApiLive } from "@accountability/api/Layers/IntercompanyTransactionsApiLive"
import { InvitationApiLive } from "@accountability/api/Layers/InvitationApiLive"
import { JournalEntriesApiLive } from "@accountability/api/Layers/JournalEntriesApiLive"
import { MembershipApiLive } from "@accountability/api/Layers/MembershipApiLive"
import { PlatformAdminApiLive } from "@accountability/api/Layers/PlatformAdminApiLive"
import { PolicyApiLive } from "@accountability/api/Layers/PolicyApiLive"
import { ReportsApiLive } from "@accountability/api/Layers/ReportsApiLive"
import { UserOrganizationsApiLive } from "@accountability/api/Layers/UserOrganizationsApiLive"
import { AuthorizationAuditApiLive } from "@accountability/api/Layers/AuthorizationAuditApiLive"
import { AuthorizationServiceLive } from "@accountability/persistence/Layers/AuthorizationServiceLive"
import { PolicyEngineLive } from "@accountability/persistence/Layers/PolicyEngineLive"
import { YearEndCloseServiceLive } from "@accountability/persistence/Layers/YearEndCloseServiceLive"
import { AuthorizationConfigGracePeriod } from "@accountability/core/authorization/AuthorizationConfig"

/**
 * AuthorizationServiceWithDependencies - AuthorizationServiceLive with PolicyEngineLive
 */
const AuthorizationServiceWithDependencies = Layer.provide(
  AuthorizationServiceLive,
  PolicyEngineLive
)

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
 * HealthApiLive - Health check endpoint implementation
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
 * AppApiLiveWithSessionAuth - API layer with session-based authentication
 *
 * Unlike AppApiLive which uses SimpleTokenValidation (user_<id>_<role> format),
 * this layer uses SessionTokenValidation which validates real session tokens
 * from the database. This is required for testing the actual auth flow.
 */
const AppApiLiveWithSessionAuth = HttpApiBuilder.api(AppApi)
  .pipe(Layer.provide(HealthApiLive))
  .pipe(Layer.provide(AuthApiLive))
  .pipe(Layer.provide(AuthSessionApiLive))
  .pipe(Layer.provide(AccountsApiLive))
  .pipe(Layer.provide(AccountTemplatesApiLive))
  .pipe(Layer.provide(AuditLogApiLive))
  .pipe(Layer.provide(AuthorizationAuditApiLive))
  .pipe(Layer.provide(CompaniesApiLive))
  .pipe(Layer.provide(InvitationApiLive))
  .pipe(Layer.provide(JournalEntriesApiLive))
  .pipe(Layer.provide(MembershipApiLive))
  .pipe(Layer.provide(PlatformAdminApiLive))
  .pipe(Layer.provide(PolicyApiLive))
  .pipe(Layer.provide(PolicyEngineLive))
  .pipe(Layer.provide(ReportsApiLive))
  .pipe(Layer.provide(CurrenciesApiLive))
  .pipe(Layer.provide(JurisdictionsApiLive))
  .pipe(Layer.provide(CurrencyApiLive))
  .pipe(Layer.provide(IntercompanyTransactionsApiLive))
  .pipe(Layer.provide(ConsolidationApiLive))
  .pipe(Layer.provide(ConsolidatedReportServiceLive))
  .pipe(Layer.provide(EliminationRulesApiLive))
  .pipe(Layer.provide(FiscalPeriodApiLive))
  .pipe(Layer.provide(YearEndCloseServiceLive))
  .pipe(Layer.provide(UserOrganizationsApiLive))
  .pipe(Layer.provide(AuthorizationServiceWithDependencies))
  .pipe(Layer.provide(AuthMiddlewareWithSessionValidation))

/**
 * HttpLive - Complete test layer for API integration tests
 *
 * Uses NodeHttpServer.layerTest which provides an in-memory HTTP server
 * for testing without binding to a real port.
 *
 * Uses AuthMiddlewareWithSessionValidation for real session token validation.
 */
const HttpLive = HttpApiBuilder.serve().pipe(
  Layer.provide(AppApiLiveWithSessionAuth),
  Layer.provide(DatabaseLayer),
  Layer.provide(AuthorizationConfigGracePeriod),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Generate unique test data to avoid conflicts with other tests in shared database
 */
const generateTestEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
const generateTestPassword = () => `SecureP@ss${Date.now()}${Math.random().toString(36).slice(2)}`

// Schemas for decoding API responses
const UserSchema = Schema.Struct({
  email: Schema.String,
  displayName: Schema.String,
  id: Schema.String
})

const IdentitySchema = Schema.Struct({
  provider: Schema.String,
  id: Schema.String
})

const RegisterResponseSchema = Schema.Struct({
  user: UserSchema,
  identities: Schema.Array(IdentitySchema)
})

const LoginResponseSchema = Schema.Struct({
  token: Schema.String,
  user: UserSchema,
  provider: Schema.String,
  expiresAt: Schema.String
})

const ErrorResponseSchema = Schema.Struct({
  _tag: Schema.String,
  message: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String)
})

const MeResponseSchema = Schema.Struct({
  user: UserSchema,
  identities: Schema.Array(IdentitySchema)
})

const ProviderSchema = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  supportsPasswordLogin: Schema.Boolean,
  supportsRegistration: Schema.Boolean
})

const ProvidersResponseSchema = Schema.Struct({
  providers: Schema.Array(ProviderSchema)
})

// Helper to decode JSON response with schema
const decodeJsonResponse = <A, I>(schema: Schema.Schema<A, I>) =>
  (json: unknown) => Schema.decodeUnknown(schema)(json)

// =============================================================================
// Auth API Integration Tests
// =============================================================================

layer(HttpLive, { timeout: "120 seconds" })("Auth API Integration Tests", (it) => {
  // ===========================================================================
  // Register Endpoint Tests
  // ===========================================================================

  describe("POST /api/auth/register", () => {
    describe("Success cases", () => {
      it.effect("registers new user with valid credentials", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          const response = yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(201)
          const json = yield* response.json
          const body = yield* decodeJsonResponse(RegisterResponseSchema)(json)
          expect(body).toHaveProperty("user")
          expect(body).toHaveProperty("identities")
          expect(body.user).toHaveProperty("email", email)
          expect(body.user).toHaveProperty("displayName", "Test User")
        })
      )

      it.effect("returns user with local identity", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          const response = yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Identity Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(201)
          const json = yield* response.json
          const body = yield* decodeJsonResponse(RegisterResponseSchema)(json)
          expect(body.identities).toHaveLength(1)
          expect(body.identities[0]).toHaveProperty("provider", "local")
        })
      )
    })

    describe("Duplicate email handling", () => {
      it.effect("returns 409 when registering with existing email", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // First registration - should succeed
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "First User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Second registration with same email - should fail
          const response = yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password: generateTestPassword(),
              displayName: "Second User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(409)
          const json = yield* response.json
          const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
          expect(body).toHaveProperty("_tag", "UserExistsError")
          expect(body).toHaveProperty("email", email)
        })
      )
    })

    describe("Weak password handling", () => {
      it.effect("returns 400 for password shorter than 8 characters", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()

          const response = yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password: "short",
              displayName: "Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Password validation happens at schema level (minLength 8)
          expect(response.status).toBe(400)
        })
      )
    })

    describe("Validation errors", () => {
      it.effect("returns 400 for invalid email format", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email: "not-an-email",
              password: generateTestPassword(),
              displayName: "Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(400)
        })
      )

      it.effect("returns 400 for missing required fields", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email: generateTestEmail()
              // missing password and displayName
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(400)
        })
      )
    })
  })

  // ===========================================================================
  // Login Endpoint Tests
  // ===========================================================================

  describe("POST /api/auth/login", () => {
    describe("Success cases", () => {
      it.effect("logs in with valid credentials", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register first
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Login Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Now login
          const response = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: {
                email,
                password
              }
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(200)
          const json = yield* response.json
          const body = yield* decodeJsonResponse(LoginResponseSchema)(json)
          expect(body).toHaveProperty("token")
          expect(body).toHaveProperty("user")
          expect(body).toHaveProperty("provider", "local")
          expect(body).toHaveProperty("expiresAt")
          expect(body.user).toHaveProperty("email", email)
        })
      )

      it.effect("returns valid session token", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Token Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const loginBody = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)
          const token = loginBody.token

          // Verify token works by calling /me
          const meResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          expect(meResponse.status).toBe(200)
        })
      )

      it.effect("sets httpOnly secure cookie on login response", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register first
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Cookie Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login and check Set-Cookie header
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(loginResponse.status).toBe(200)

          // Check for Set-Cookie header (Node.js Response uses headers object directly)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
          const responseAny = loginResponse as any
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const setCookieHeader = responseAny.headers?.["set-cookie"] as string | string[] | undefined
          expect(setCookieHeader).toBeDefined()
          const setCookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader ?? ""
          expect(setCookieString).toContain("accountability_session=")
          expect(setCookieString).toContain("HttpOnly")
          expect(setCookieString).toContain("Secure")
          expect(setCookieString).toContain("SameSite=Lax")
          expect(setCookieString).toContain("Path=/")
        })
      )
    })

    describe("Wrong password handling", () => {
      it.effect("returns 401 for incorrect password", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Wrong Password Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login with wrong password
          const response = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: {
                email,
                password: "wrongPassword123"
              }
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
          const json = yield* response.json
          const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
          expect(body).toHaveProperty("_tag", "AuthUnauthorizedError")
        })
      )
    })

    describe("Unknown user handling", () => {
      it.effect("returns 401 for non-existent user", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: {
                email: `nonexistent-${Date.now()}@example.com`,
                password: generateTestPassword()
              }
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
          const json = yield* response.json
          const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
          expect(body).toHaveProperty("_tag", "AuthUnauthorizedError")
        })
      )
    })

    describe("Provider handling", () => {
      it.effect("returns 404 for non-existent provider", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "google", // Not enabled in test config
              credentials: {
                code: "test-code",
                state: "test-state"
              }
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Depending on implementation, this could be 400 (schema) or 404 (provider not found)
          expect([400, 404]).toContain(response.status)
        })
      )
    })
  })

  // ===========================================================================
  // Logout Endpoint Tests
  // ===========================================================================

  describe("POST /api/auth/logout", () => {
    describe("Success cases", () => {
      it.effect("logs out successfully with valid session", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Logout Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login to get token
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Logout
          const logoutResponse = yield* HttpClientRequest.post("/api/auth/logout").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          // Logout returns 200 OK with success response
          expect(logoutResponse.status).toBe(200)

          // Verify response body
          const logoutJson = yield* logoutResponse.json
          const logoutData = yield* decodeJsonResponse(Schema.Struct({ success: Schema.Boolean }))(logoutJson)
          expect(logoutData.success).toBe(true)
        })
      )

      it.effect("invalidates session after logout", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Session Invalidation Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Logout
          yield* HttpClientRequest.post("/api/auth/logout").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          // Try to use the token again - should fail
          const meResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          expect(meResponse.status).toBe(401)
        })
      )

      it.effect("clears httpOnly cookie on logout response", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Logout Cookie Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login to get token
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Logout and check Set-Cookie header
          const logoutResponse = yield* HttpClientRequest.post("/api/auth/logout").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          expect(logoutResponse.status).toBe(200)

          // Check for Set-Cookie header with expiry in the past (Node.js Response uses headers object directly)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
          const responseAny = logoutResponse as any
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const setCookieHeader = responseAny.headers?.["set-cookie"] as string | string[] | undefined
          expect(setCookieHeader).toBeDefined()
          const setCookieString = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader ?? ""
          expect(setCookieString).toContain("accountability_session=")
          expect(setCookieString).toContain("HttpOnly")
          expect(setCookieString).toContain("Secure")
          expect(setCookieString).toContain("SameSite=Lax")
          expect(setCookieString).toContain("Path=/")
          // Should have expires date to clear the cookie (set to epoch 0)
          expect(setCookieString.toLowerCase()).toContain("expires=")
        })
      )
    })

    describe("Unauthorized handling", () => {
      it.effect("returns 401 without token", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/logout").pipe(
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )

      it.effect("returns 401 with invalid token", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/logout").pipe(
            HttpClientRequest.bearerToken("invalid-session-token-that-does-not-exist"),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )
    })
  })

  // ===========================================================================
  // Me Endpoint Tests
  // ===========================================================================

  describe("GET /api/auth/me", () => {
    describe("Success cases", () => {
      it.effect("returns current user with valid session", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()
          const displayName = "Me Test User"

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Get current user
          const meResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          expect(meResponse.status).toBe(200)
          const meJson = yield* meResponse.json
          const body = yield* decodeJsonResponse(MeResponseSchema)(meJson)
          expect(body).toHaveProperty("user")
          expect(body).toHaveProperty("identities")
          expect(body.user).toHaveProperty("email", email)
          expect(body.user).toHaveProperty("displayName", displayName)
        })
      )

      it.effect("returns linked identities", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Identity List Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Get current user
          const meResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          const meJson = yield* meResponse.json
          const body = yield* decodeJsonResponse(MeResponseSchema)(meJson)
          expect(body.identities).toBeInstanceOf(Array)
          expect(body.identities.length).toBeGreaterThanOrEqual(1)
          expect(body.identities[0]).toHaveProperty("provider", "local")
        })
      )
    })

    describe("Unauthorized handling", () => {
      it.effect("returns 401 without token", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.get("/api/auth/me").pipe(
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )

      it.effect("returns 401 with invalid token", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken("invalid-token-that-does-not-exist"),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )
    })
  })

  // ===========================================================================
  // Protected Endpoints Return 401 Without Token Tests
  // ===========================================================================

  describe("Protected endpoints return 401 without token", () => {
    it.effect("GET /api/auth/me without token returns 401", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        const response = yield* HttpClientRequest.get("/api/auth/me").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
        const json = yield* response.json
        const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
        expect(body).toHaveProperty("_tag", "UnauthorizedError")
      })
    )

    it.effect("POST /api/auth/logout without token returns 401", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        const response = yield* HttpClientRequest.post("/api/auth/logout").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
        const json = yield* response.json
        const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
        expect(body).toHaveProperty("_tag", "UnauthorizedError")
      })
    )

    it.effect("POST /api/auth/refresh without token returns 401", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        const response = yield* HttpClientRequest.post("/api/auth/refresh").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
        const json = yield* response.json
        const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
        expect(body).toHaveProperty("_tag", "UnauthorizedError")
      })
    )

    it.effect("POST /api/auth/link/:provider without token returns 401", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        const response = yield* HttpClientRequest.post("/api/auth/link/google").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )

    it.effect("DELETE /api/auth/identities/:id without token returns 401", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        const response = yield* HttpClientRequest.del("/api/auth/identities/550e8400-e29b-41d4-a716-446655440000").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )
  })

  // ===========================================================================
  // Expired Session Returns 401 Tests
  // ===========================================================================

  describe("Expired session returns 401", () => {
    it.effect("returns 401 for logged out session", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const email = generateTestEmail()
        const password = generateTestPassword()

        // Register
        yield* HttpClientRequest.post("/api/auth/register").pipe(
          HttpClientRequest.bodyUnsafeJson({
            email,
            password,
            displayName: "Expired Session Test"
          }),
          httpClient.execute,
          Effect.scoped
        )

        // Login
        const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
          HttpClientRequest.bodyUnsafeJson({
            provider: "local",
            credentials: { email, password }
          }),
          httpClient.execute,
          Effect.scoped
        )

        const loginJson = yield* loginResponse.json
        const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

        // Logout to invalidate the session
        yield* HttpClientRequest.post("/api/auth/logout").pipe(
          HttpClientRequest.bearerToken(token),
          httpClient.execute,
          Effect.scoped
        )

        // Try to use the invalidated token
        const meResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
          HttpClientRequest.bearerToken(token),
          httpClient.execute,
          Effect.scoped
        )

        expect(meResponse.status).toBe(401)
        const meJson = yield* meResponse.json
        const body = yield* decodeJsonResponse(ErrorResponseSchema)(meJson)
        expect(body).toHaveProperty("_tag", "UnauthorizedError")
      })
    )

    it.effect("returns 401 for non-existent session token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        // Use a made-up session token that doesn't exist
        const fakeToken = "00000000000000000000000000000000000000000000000000000000000fake"

        const response = yield* HttpClientRequest.get("/api/auth/me").pipe(
          HttpClientRequest.bearerToken(fakeToken),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
        const json = yield* response.json
        const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
        expect(body).toHaveProperty("_tag", "UnauthorizedError")
      })
    )
  })

  // ===========================================================================
  // Public Endpoints Don't Require Auth Tests
  // ===========================================================================

  describe("Public endpoints don't require authentication", () => {
    it.effect("GET /api/auth/providers works without token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient

        const response = yield* HttpClientRequest.get("/api/auth/providers").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
        const json = yield* response.json
        const body = yield* decodeJsonResponse(ProvidersResponseSchema)(json)
        expect(body).toHaveProperty("providers")
        expect(body.providers).toBeInstanceOf(Array)
      })
    )

    it.effect("POST /api/auth/register works without token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const email = generateTestEmail()
        const password = generateTestPassword()

        const response = yield* HttpClientRequest.post("/api/auth/register").pipe(
          HttpClientRequest.bodyUnsafeJson({
            email,
            password,
            displayName: "Public Register Test"
          }),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(201)
      })
    )

    it.effect("POST /api/auth/login works without token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const email = generateTestEmail()
        const password = generateTestPassword()

        // Register first
        yield* HttpClientRequest.post("/api/auth/register").pipe(
          HttpClientRequest.bodyUnsafeJson({
            email,
            password,
            displayName: "Public Login Test"
          }),
          httpClient.execute,
          Effect.scoped
        )

        // Login
        const response = yield* HttpClientRequest.post("/api/auth/login").pipe(
          HttpClientRequest.bodyUnsafeJson({
            provider: "local",
            credentials: { email, password }
          }),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
      })
    )
  })

  // ===========================================================================
  // Change Password Endpoint Tests
  // ===========================================================================

  describe("POST /api/auth/change-password", () => {
    describe("Success cases", () => {
      it.effect("changes password with valid current password", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()
          const newPassword = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Change Password Test User"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Change password
          const changePasswordResponse = yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: password,
              newPassword
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(changePasswordResponse.status).toBe(204)
        })
      )

      it.effect("can login with new password after change", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()
          const newPassword = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "New Password Login Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Change password
          yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: password,
              newPassword
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Logout to clear the session
          yield* HttpClientRequest.post("/api/auth/logout").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )

          // Login with new password should succeed
          const newLoginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password: newPassword }
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(newLoginResponse.status).toBe(200)
        })
      )

      it.effect("cannot login with old password after change", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const oldPassword = generateTestPassword()
          const newPassword = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password: oldPassword,
              displayName: "Old Password Fail Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password: oldPassword }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Change password
          const changePasswordResponse = yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: oldPassword,
              newPassword
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(changePasswordResponse.status).toBe(204)

          // Verify new password works
          const newPasswordLoginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password: newPassword }
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(newPasswordLoginResponse.status).toBe(200)

          // Login with old password should fail
          const oldPasswordLoginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password: oldPassword }
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(oldPasswordLoginResponse.status).toBe(401)
        })
      )

      it.effect("invalidates session after password change (SECURITY: requires re-login)", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const oldPassword = generateTestPassword()
          const newPassword = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password: oldPassword,
              displayName: "Session Invalidation Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password: oldPassword }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Verify the token works before password change
          const meBeforeResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )
          expect(meBeforeResponse.status).toBe(200)

          // Change password
          const changePasswordResponse = yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: oldPassword,
              newPassword
            }),
            httpClient.execute,
            Effect.scoped
          )
          expect(changePasswordResponse.status).toBe(204)

          // SECURITY: The old token should no longer work (session was invalidated)
          const meAfterResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken(token),
            httpClient.execute,
            Effect.scoped
          )
          expect(meAfterResponse.status).toBe(401)

          // Login with new password to get a new valid token
          const newLoginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password: newPassword }
            }),
            httpClient.execute,
            Effect.scoped
          )
          expect(newLoginResponse.status).toBe(200)

          const newLoginJson = yield* newLoginResponse.json
          const { token: newToken } = yield* decodeJsonResponse(LoginResponseSchema)(newLoginJson)

          // New token should work
          const meNewTokenResponse = yield* HttpClientRequest.get("/api/auth/me").pipe(
            HttpClientRequest.bearerToken(newToken),
            httpClient.execute,
            Effect.scoped
          )
          expect(meNewTokenResponse.status).toBe(200)
        })
      )
    })

    describe("Wrong current password handling", () => {
      it.effect("returns 401 for incorrect current password", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Wrong Current Password Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Try to change password with wrong current password
          const changePasswordResponse = yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: "wrongPassword123",
              newPassword: generateTestPassword()
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(changePasswordResponse.status).toBe(401)
          const json = yield* changePasswordResponse.json
          const body = yield* decodeJsonResponse(ErrorResponseSchema)(json)
          expect(body).toHaveProperty("_tag", "ChangePasswordError")
        })
      )
    })

    describe("Weak new password handling", () => {
      it.effect("returns 400 for new password shorter than 8 characters", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient
          const email = generateTestEmail()
          const password = generateTestPassword()

          // Register
          yield* HttpClientRequest.post("/api/auth/register").pipe(
            HttpClientRequest.bodyUnsafeJson({
              email,
              password,
              displayName: "Weak New Password Test"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Login
          const loginResponse = yield* HttpClientRequest.post("/api/auth/login").pipe(
            HttpClientRequest.bodyUnsafeJson({
              provider: "local",
              credentials: { email, password }
            }),
            httpClient.execute,
            Effect.scoped
          )

          const loginJson = yield* loginResponse.json
          const { token } = yield* decodeJsonResponse(LoginResponseSchema)(loginJson)

          // Try to change password with weak new password
          const changePasswordResponse = yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: password,
              newPassword: "short"
            }),
            httpClient.execute,
            Effect.scoped
          )

          // Password validation happens at schema level (minLength 8)
          expect(changePasswordResponse.status).toBe(400)
        })
      )
    })

    describe("Authorization handling", () => {
      it.effect("returns 401 without token", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: "currentPass123",
              newPassword: "newPassword123"
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )

      it.effect("returns 401 with invalid token", () =>
        Effect.gen(function* () {
          const httpClient = yield* HttpClient.HttpClient

          const response = yield* HttpClientRequest.post("/api/auth/change-password").pipe(
            HttpClientRequest.bearerToken("invalid-session-token-that-does-not-exist"),
            HttpClientRequest.bodyUnsafeJson({
              currentPassword: "currentPass123",
              newPassword: "newPassword123"
            }),
            httpClient.execute,
            Effect.scoped
          )

          expect(response.status).toBe(401)
        })
      )
    })
  })

  // ===========================================================================
  // Type-Safe Client Tests
  // ===========================================================================

  describe("Type-safe HttpApiClient", () => {
    it.effect("auth group endpoints are properly typed", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi)

        // Verify auth group exists
        expect(client.auth).toBeDefined()
        expect(typeof client.auth.getProviders).toBe("function")
        expect(typeof client.auth.register).toBe("function")
        expect(typeof client.auth.login).toBe("function")
      })
    )

    it.effect("authSession group endpoints are properly typed", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi)

        // Verify authSession group exists
        expect(client.authSession).toBeDefined()
        expect(typeof client.authSession.logout).toBe("function")
        expect(typeof client.authSession.me).toBe("function")
        expect(typeof client.authSession.refresh).toBe("function")
      })
    )

    it.effect("getProviders returns ProvidersResponse", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi)
        const response = yield* client.auth.getProviders()

        expect(response.providers).toBeInstanceOf(Array)
        // Local provider should be enabled
        const localProvider = response.providers.find(p => p.type === "local")
        expect(localProvider).toBeDefined()
        expect(localProvider?.supportsPasswordLogin).toBe(true)
        expect(localProvider?.supportsRegistration).toBe(true)
      })
    )
  })
})
