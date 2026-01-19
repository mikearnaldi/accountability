/**
 * CurrenciesApi Tests
 *
 * Tests for the currency master data endpoint.
 * Verifies:
 * - GET /api/v1/currencies returns list of currencies
 * - isActive filter works correctly (default: true)
 * - Response schema matches expected format
 * - Authentication is required
 *
 * @module CurrenciesApi.test
 */

import { describe, expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { HttpApiBuilder, HttpApiClient, HttpClient, HttpClientRequest } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { AppApi } from "@accountability/api/Definitions/AppApi"
import { CurrencyListResponse, CurrencyItem } from "@accountability/api/Definitions/CurrenciesApi"
import { AppApiLive } from "@accountability/api/Layers/AppApiLive"
import { SimpleTokenValidatorLive } from "@accountability/api/Layers/AuthMiddlewareLive"
import { RepositoriesWithAuthLive } from "@accountability/persistence/Layers/RepositoriesLive"
import { MigrationLayer } from "@accountability/persistence/Layers/MigrationsLive"
import { COMMON_CURRENCIES } from "@accountability/core/currency/Currency"
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

layer(HttpLive, { timeout: "120 seconds" })("CurrenciesApi", (it) => {
  describe("GET /api/v1/currencies", () => {
    it.effect("returns list of currencies with authentication", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/currencies").pipe(
          HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
        const body = yield* response.json
        expect(body).toHaveProperty("currencies")
        // Use expect to verify currencies is a non-empty array
        expect(body).toMatchObject({
          currencies: expect.arrayContaining([expect.any(Object)])
        })
      })
    )

    it.effect("returns currencies in expected format using typed client", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: {}
        })

        expect(response.currencies.length).toBeGreaterThan(0)

        // Verify structure of first currency
        const firstCurrency = response.currencies[0]
        expect(typeof firstCurrency.code).toBe("string")
        expect(typeof firstCurrency.name).toBe("string")
        expect(typeof firstCurrency.symbol).toBe("string")
        expect(typeof firstCurrency.decimalPlaces).toBe("number")
        expect(typeof firstCurrency.isActive).toBe("boolean")
      })
    )

    it.effect("returns active currencies by default", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: {}
        })

        // All returned currencies should be active (default filter is true)
        for (const currency of response.currencies) {
          expect(currency.isActive).toBe(true)
        }
      })
    )

    it.effect("filters by isActive=true", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: { isActive: true }
        })

        for (const currency of response.currencies) {
          expect(currency.isActive).toBe(true)
        }
      })
    )

    it.effect("filters by isActive=false returns empty when all currencies are active", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: { isActive: false }
        })

        // All COMMON_CURRENCIES are active, so filtering by isActive=false should return empty
        expect(response.currencies.length).toBe(0)
      })
    )

    it.effect("returns USD currency with correct properties", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: {}
        })

        // Find USD currency
        const usd = response.currencies.find((c) => c.code === "USD")
        expect(usd).toBeDefined()
        if (usd) {
          expect(usd.code).toBe("USD")
          expect(usd.name).toBe("US Dollar")
          expect(usd.symbol).toBe("$")
          expect(usd.decimalPlaces).toBe(2)
          expect(usd.isActive).toBe(true)
        }
      })
    )

    it.effect("returns JPY with 0 decimal places", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: {}
        })

        // Find JPY currency
        const jpy = response.currencies.find((c) => c.code === "JPY")
        expect(jpy).toBeDefined()
        if (jpy) {
          expect(jpy.decimalPlaces).toBe(0)
        }
      })
    )

    it.effect("returns KWD with 3 decimal places", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: {}
        })

        // Find KWD currency (Kuwaiti Dinar uses 3 decimal places)
        const kwd = response.currencies.find((c) => c.code === "KWD")
        expect(kwd).toBeDefined()
        if (kwd) {
          expect(kwd.decimalPlaces).toBe(3)
        }
      })
    )

    it.effect("returns all COMMON_CURRENCIES", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: {}
        })

        // Should return all active currencies from COMMON_CURRENCIES
        const activeCurrencies = COMMON_CURRENCIES.filter((c) => c.isActive)
        expect(response.currencies.length).toBe(activeCurrencies.length)

        // Verify all expected currency codes are present
        const codes = new Set(response.currencies.map((c) => c.code))
        for (const currency of activeCurrencies) {
          expect(codes.has(currency.code)).toBe(true)
        }
      })
    )
  })

  describe("Authentication", () => {
    it.effect("returns 401 without authentication", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/currencies").pipe(
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(401)
      })
    )

    it.effect("returns 401 with invalid token", () =>
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient
        const response = yield* HttpClientRequest.get("/api/v1/currencies").pipe(
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
        const response = yield* HttpClientRequest.get("/api/v1/currencies").pipe(
          HttpClientRequest.bearerToken("user_22222222-2222-2222-2222-222222222222_user"),
          httpClient.execute,
          Effect.scoped
        )

        expect(response.status).toBe(200)
      })
    )
  })

  describe("Type-Safe HttpApiClient", () => {
    it.effect("currencies group is properly typed", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(AppApi)

        expect(client.currencies).toBeDefined()
        expect(typeof client.currencies.listCurrencies).toBe("function")
      })
    )

    it.effect("listCurrencies returns typed response with valid token", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        const response = yield* client.currencies.listCurrencies({
          urlParams: {}
        })

        expect(response).toBeInstanceOf(CurrencyListResponse)
        expect(Array.isArray(response.currencies)).toBe(true)
        expect(response.currencies.length).toBeGreaterThan(0)

        // Each currency should be a CurrencyItem
        for (const currency of response.currencies) {
          expect(currency).toBeInstanceOf(CurrencyItem)
        }
      })
    )

    it.effect("listCurrencies respects isActive filter via typed client", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.makeWith(AppApi, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.mapRequest(HttpClientRequest.bearerToken("user_11111111-1111-1111-1111-111111111111_admin"))
          )
        })

        // Request with isActive=false
        const response = yield* client.currencies.listCurrencies({
          urlParams: { isActive: false }
        })

        // All COMMON_CURRENCIES are active, so this should return empty
        expect(response.currencies.length).toBe(0)
      })
    )
  })
})
