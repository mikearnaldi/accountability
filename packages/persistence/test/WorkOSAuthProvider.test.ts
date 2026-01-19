/**
 * WorkOSAuthProvider Unit Tests
 *
 * Tests for WorkOSAuthProvider implementation. Uses mock HttpClient
 * to test OAuth flow without making real API calls.
 *
 * @module test/WorkOSAuthProvider
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import {
  HttpClient,
  HttpClientResponse,
  HttpClientError
} from "@effect/platform"
import { Email } from "@accountability/core/authentication/Email"
import { LocalAuthRequest } from "@accountability/core/authentication/AuthRequest"
import {
  isProviderAuthFailedError
} from "@accountability/core/authentication/AuthErrors"
import { WorkOSAuthProvider } from "../src/Services/WorkOSAuthProvider.ts"
import { WorkOSConfig, WorkOSConfigTag } from "../src/Services/WorkOSConfig.ts"
import { WorkOSAuthProviderLive } from "../src/Layers/WorkOSAuthProviderLive.ts"

// =============================================================================
// Test Configuration
// =============================================================================

const testConfig = WorkOSConfig.make({
  apiKey: Redacted.make("sk_test_api_key_1234567890"),
  clientId: "client_test_1234567890",
  redirectUri: "https://app.example.com/callback",
  organizationId: Option.some("org_test_12345"),
  connectionId: Option.none()
})

const testConfigWithConnection = WorkOSConfig.make({
  apiKey: Redacted.make("sk_test_api_key_1234567890"),
  clientId: "client_test_1234567890",
  redirectUri: "https://app.example.com/callback",
  organizationId: Option.none(),
  connectionId: Option.some("conn_test_12345")
})

const testConfigMinimal = WorkOSConfig.make({
  apiKey: Redacted.make("sk_test_api_key_1234567890"),
  clientId: "client_test_1234567890",
  redirectUri: "https://app.example.com/callback",
  organizationId: Option.none(),
  connectionId: Option.none()
})

// =============================================================================
// Mock HTTP Client
// =============================================================================

/**
 * WorkOS profile response for successful authentication
 */
const mockWorkOSProfileResponse = {
  access_token: "workos_access_token_12345",
  profile: {
    id: "profile_12345",
    connection_id: "conn_google_12345",
    connection_type: "GoogleOAuth",
    organization_id: "org_12345",
    email: "user@enterprise.com",
    first_name: "Enterprise",
    last_name: "User",
    idp_id: "google-idp-12345",
    raw_attributes: { custom: "data" }
  }
}

/**
 * Create a mock HTTP client that returns predefined responses
 */
const createMockHttpClient = (
  responseBody: unknown,
  statusCode: number = 200
): HttpClient.HttpClient =>
  HttpClient.make((request, _url, _signal, _fiber) =>
    Effect.gen(function* () {
      // Create a mock Response
      const nativeResponse = new Response(JSON.stringify(responseBody), {
        status: statusCode,
        headers: {
          "Content-Type": "application/json"
        }
      })
      return HttpClientResponse.fromWeb(request, nativeResponse)
    })
  )

/**
 * Create a mock HTTP client that fails with network error
 */
const createFailingHttpClient = (errorMessage: string): HttpClient.HttpClient =>
  HttpClient.make((request, _url, _signal, _fiber) =>
    Effect.fail(
      new HttpClientError.RequestError({
        request,
        reason: "Transport",
        cause: new Error(errorMessage)
      })
    )
  )

// =============================================================================
// Test Layers
// =============================================================================

const ConfigLayer = Layer.succeed(WorkOSConfigTag, testConfig)
const ConfigLayerWithConnection = Layer.succeed(WorkOSConfigTag, testConfigWithConnection)
const ConfigLayerMinimal = Layer.succeed(WorkOSConfigTag, testConfigMinimal)

const SuccessfulHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  createMockHttpClient(mockWorkOSProfileResponse)
)

const FailingHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  createFailingHttpClient("Network error")
)

const InvalidJsonHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request, _url, _signal, _fiber) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response("invalid json {", {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    )
  )
)

const ErrorResponseHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  createMockHttpClient(
    { error: "invalid_grant", error_description: "Code has expired" },
    400
  )
)

/**
 * Test layer with successful responses
 */
const TestLayer = WorkOSAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(SuccessfulHttpClientLayer)
)

/**
 * Test layer with connection-based routing
 */
const TestLayerWithConnection = WorkOSAuthProviderLive.pipe(
  Layer.provide(ConfigLayerWithConnection),
  Layer.provide(SuccessfulHttpClientLayer)
)

/**
 * Test layer with minimal config (no org/connection)
 */
const TestLayerMinimal = WorkOSAuthProviderLive.pipe(
  Layer.provide(ConfigLayerMinimal),
  Layer.provide(SuccessfulHttpClientLayer)
)

/**
 * Test layer with failing HTTP client
 */
const TestLayerFailingHttp = WorkOSAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(FailingHttpClientLayer)
)

/**
 * Test layer with invalid JSON response
 */
const TestLayerInvalidJson = WorkOSAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(InvalidJsonHttpClientLayer)
)

/**
 * Test layer with error response
 */
const TestLayerErrorResponse = WorkOSAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(ErrorResponseHttpClientLayer)
)

// =============================================================================
// Tests
// =============================================================================

describe("WorkOSAuthProvider", () => {
  describe("Provider Properties", () => {
    it.effect("type: returns 'workos'", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        expect(provider.type).toBe("workos")
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("supportsRegistration: returns false", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        expect(provider.supportsRegistration).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("getAuthorizationUrl", () => {
    it.effect("generates correct URL with organization routing", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = provider.getAuthorizationUrl("csrf_state_token_123")

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const url = new URL(result.value)
          expect(url.origin).toBe("https://api.workos.com")
          expect(url.pathname).toBe("/sso/authorize")
          expect(url.searchParams.get("client_id")).toBe("client_test_1234567890")
          expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/callback")
          expect(url.searchParams.get("response_type")).toBe("code")
          expect(url.searchParams.get("state")).toBe("csrf_state_token_123")
          expect(url.searchParams.get("organization")).toBe("org_test_12345")
          expect(url.searchParams.has("connection")).toBe(false)
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("generates correct URL with connection routing", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = provider.getAuthorizationUrl("csrf_state_token_123")

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const url = new URL(result.value)
          expect(url.searchParams.get("connection")).toBe("conn_test_12345")
          expect(url.searchParams.has("organization")).toBe(false)
        }
      }).pipe(Effect.provide(TestLayerWithConnection))
    )

    it.effect("generates URL without routing parameters when neither org nor connection set", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = provider.getAuthorizationUrl("csrf_state_token_123")

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const url = new URL(result.value)
          expect(url.searchParams.has("organization")).toBe(false)
          expect(url.searchParams.has("connection")).toBe(false)
        }
      }).pipe(Effect.provide(TestLayerMinimal))
    )

    it.effect("uses custom redirect URI when provided", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const customUri = "https://custom.example.com/oauth/callback"
        const result = provider.getAuthorizationUrl("state", customUri)

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const url = new URL(result.value)
          expect(url.searchParams.get("redirect_uri")).toBe(customUri)
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("authenticate", () => {
    it.effect("fails with ProviderAuthFailedError (redirect flow required)", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const request = LocalAuthRequest.make({
          email: Email.make("test@example.com"),
          password: Redacted.make("testPassword123!")
        })

        const result = yield* Effect.either(provider.authenticate(request))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.provider).toBe("workos")
            expect(result.left.reason).toContain("OAuth redirect flow")
          }
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("handleCallback", () => {
    it.effect("exchanges code for user profile successfully", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = yield* provider.handleCallback("auth_code_12345", "state")

        expect(result.provider).toBe("workos")
        expect(result.providerId).toBe("profile_12345")
        expect(result.email).toBe("user@enterprise.com")
        expect(result.displayName).toBe("Enterprise User")
        expect(result.emailVerified).toBe(true)
        expect(Option.isSome(result.providerData)).toBe(true)
        if (Option.isSome(result.providerData)) {
          const data = result.providerData.value
          // Profile data is stored in the profile field
          expect(data.profile).toBeDefined()
          if (data.profile) {
            const profile = data.profile
            if (typeof profile === "object" && profile !== null) {
              expect("connection_id" in profile && profile.connection_id).toBe("conn_google_12345")
              expect("connection_type" in profile && profile.connection_type).toBe("GoogleOAuth")
            }
          }
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("builds display name from first and last name", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = yield* provider.handleCallback("code", "state")
        expect(result.displayName).toBe("Enterprise User")
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("falls back to email when name is missing", () => {
      const mockResponseNoName = {
        access_token: "token",
        profile: {
          id: "profile_123",
          connection_id: "conn_123",
          connection_type: "SAML",
          organization_id: null,
          email: "noname@example.com",
          first_name: null,
          last_name: null,
          idp_id: "idp_123",
          raw_attributes: null
        }
      }

      const testLayerNoName = WorkOSAuthProviderLive.pipe(
        Layer.provide(ConfigLayer),
        Layer.provide(
          Layer.succeed(HttpClient.HttpClient, createMockHttpClient(mockResponseNoName))
        )
      )

      return Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = yield* provider.handleCallback("code", "state")
        expect(result.displayName).toBe("noname@example.com")
      }).pipe(Effect.provide(testLayerNoName))
    })

    it.effect("fails with ProviderAuthFailedError on network error", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = yield* Effect.either(provider.handleCallback("code", "state"))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.provider).toBe("workos")
            expect(result.left.reason).toContain("HTTP request failed")
          }
        }
      }).pipe(Effect.provide(TestLayerFailingHttp))
    )

    it.effect("fails with ProviderAuthFailedError on invalid JSON response", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = yield* Effect.either(provider.handleCallback("code", "state"))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.reason).toContain("Failed to parse")
          }
        }
      }).pipe(Effect.provide(TestLayerInvalidJson))
    )

    it.effect("fails with ProviderAuthFailedError on error response from WorkOS", () =>
      Effect.gen(function* () {
        const provider = yield* WorkOSAuthProvider
        const result = yield* Effect.either(provider.handleCallback("code", "state"))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.reason).toContain("Token exchange failed")
            expect(result.left.reason).toContain("400")
          }
        }
      }).pipe(Effect.provide(TestLayerErrorResponse))
    )
  })

  describe("WorkOSConfig", () => {
    it.effect("validates required fields", () =>
      Effect.gen(function* () {
        expect(testConfig.clientId).toBe("client_test_1234567890")
        expect(testConfig.redirectUri).toBe("https://app.example.com/callback")
        expect(Redacted.value(testConfig.apiKey)).toBe("sk_test_api_key_1234567890")
      })
    )

    it.effect("handles optional organizationId", () =>
      Effect.gen(function* () {
        expect(Option.isSome(testConfig.organizationId)).toBe(true)
        expect(Option.isNone(testConfigWithConnection.organizationId)).toBe(true)
      })
    )

    it.effect("handles optional connectionId", () =>
      Effect.gen(function* () {
        expect(Option.isNone(testConfig.connectionId)).toBe(true)
        expect(Option.isSome(testConfigWithConnection.connectionId)).toBe(true)
      })
    )
  })
})
