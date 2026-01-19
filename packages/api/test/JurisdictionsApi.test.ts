/**
 * JurisdictionsApi Tests
 *
 * Tests for the jurisdiction master data endpoint.
 * Verifies:
 * - GET /api/v1/jurisdictions returns list of jurisdictions
 * - Response schema matches expected format { jurisdictions: [{ code, name, defaultCurrency }] }
 * - Returns predefined jurisdictions (US, GB)
 * - Authentication is required
 *
 * @module JurisdictionsApi.test
 */

import { describe, expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { HttpApiBuilder, HttpApiClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import { JurisdictionListResponse, JurisdictionItem } from "@accountability/api/Definitions/JurisdictionsApi"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { SimpleTokenValidatorLive } from "@accountability/api/Layers/AuthMiddlewareLive"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationLayer } from "@accountability/persistence/Layers/MigrationsLive"
import { PREDEFINED_JURISDICTIONS } from "@accountability/core/jurisdiction/Jurisdiction"
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
 */
const HttpLive = HttpApiBuilder.serve().pipe(
  Layer.provide(AppApiLive),
  Layer.provide(SimpleTokenValidatorLive),
  Layer.provide(DatabaseLayer),
  Layer.provideMerge(NodeHttpServer.layerTest)
)

// =============================================================================
// Tests
// =============================================================================

layer(HttpLive, { timeout: "120 seconds" })("JurisdictionsApi", (it) => {
  describe("GET /api/v1/jurisdictions", () => {
    it.effect("returns list of jurisdictions with authentication", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/jurisdictions").pipe(
          HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
        const body = yield* response.json
        expect(body).toHaveProperty("jurisdictions")
        expect(body).toMatchObject({
          jurisdictions: expect.arrayContaining([expect.any(Object)])
        })
      })
    )

    it.effect("returns jurisdictions in expected format using typed client", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.jurisdictions.listJurisdictions()

        expect(response.jurisdictions.length).toBeGreaterThan(0)

        // Verify structure of first jurisdiction
        const firstJurisdiction = response.jurisdictions[0]
        expect(typeof firstJurisdiction.code).toBe("string")
        expect(typeof firstJurisdiction.name).toBe("string")
        expect(typeof firstJurisdiction.defaultCurrency).toBe("string")
      })
    )

    it.effect("returns US jurisdiction with correct properties", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.jurisdictions.listJurisdictions()

        // Find US jurisdiction
        const us = response.jurisdictions.find((j) => j.code === "US")
        expect(us).toBeDefined()
        if (us) {
          expect(us.code).toBe("US")
          expect(us.name).toBe("United States")
          expect(us.defaultCurrency).toBe("USD")
        }
      })
    )

    it.effect("returns GB jurisdiction with correct properties", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.jurisdictions.listJurisdictions()

        // Find GB jurisdiction
        const gb = response.jurisdictions.find((j) => j.code === "GB")
        expect(gb).toBeDefined()
        if (gb) {
          expect(gb.code).toBe("GB")
          expect(gb.name).toBe("United Kingdom")
          expect(gb.defaultCurrency).toBe("GBP")
        }
      })
    )

    it.effect("returns all PREDEFINED_JURISDICTIONS", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.jurisdictions.listJurisdictions()

        // Should return all predefined jurisdictions
        expect(response.jurisdictions.length).toBe(PREDEFINED_JURISDICTIONS.length)

        // Verify all expected jurisdiction codes are present
        const codes = new Set(response.jurisdictions.map((j) => j.code))
        for (const jurisdiction of PREDEFINED_JURISDICTIONS) {
          expect(codes.has(jurisdiction.code)).toBe(true)
        }
      })
    )
  })

  describe("Authentication", () => {
    it.effect("returns 401 without authentication", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/jurisdictions").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )

    it.effect("returns 401 with invalid token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/jurisdictions").pipe(
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
        const response = yield* HttpClientRequest.get("/api/v1/jurisdictions").pipe(
          HttpClientRequest.bearerToken("user_22222222-2222-2222-2222-222222222222_user"),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
      })
    )
  })

  describe("Type-Safe HttpApiClient", () => {
    it.effect("jurisdictions group is properly typed", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi)

        expect(client.jurisdictions).toBeDefined()
        expect(typeof client.jurisdictions.listJurisdictions).toBe("function")
      })
    )

    it.effect("listJurisdictions returns typed response with valid token", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.jurisdictions.listJurisdictions()

        expect(response).toBeInstanceOf(JurisdictionListResponse)
        expect(Array.isArray(response.jurisdictions)).toBe(true)
        expect(response.jurisdictions.length).toBeGreaterThan(0)

        // Each jurisdiction should be a JurisdictionItem
        for (const jurisdiction of response.jurisdictions) {
          expect(jurisdiction).toBeInstanceOf(JurisdictionItem)
        }
      })
    )
  })
})
