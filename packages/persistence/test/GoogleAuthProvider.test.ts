/**
 * GoogleAuthProvider Unit Tests
 *
 * Tests for GoogleAuthProvider implementation. Uses mock HttpClient
 * to test OAuth flow without making real API calls.
 *
 * @module test/GoogleAuthProvider
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
import { GoogleAuthProvider } from "../src/Services/GoogleAuthProvider.ts"
import { GoogleConfig, GoogleConfigTag } from "../src/Services/GoogleConfig.ts"
import { GoogleAuthProviderLive } from "../src/Layers/GoogleAuthProviderLive.ts"

// =============================================================================
// Test Configuration
// =============================================================================

const testConfig = GoogleConfig.make({
  clientId: "google_client_id_1234567890.apps.googleusercontent.com",
  clientSecret: Redacted.make("google_client_secret_abcdef"),
  redirectUri: "https://app.example.com/callback"
})

// =============================================================================
// Mock HTTP Client
// =============================================================================

/**
 * Google token response for successful authentication
 */
const mockGoogleTokenResponse = {
  access_token: "ya29.google_access_token_12345",
  expires_in: 3600,
  token_type: "Bearer",
  scope: "openid email profile",
  id_token: "eyJ.id_token.jwt"
}

/**
 * Google userinfo response for successful profile fetch
 */
const mockGoogleUserInfoResponse = {
  id: "google_user_12345",
  email: "user@gmail.com",
  verified_email: true,
  name: "Test User",
  given_name: "Test",
  family_name: "User",
  picture: "https://lh3.googleusercontent.com/photo.jpg"
}

/**
 * Create a mock HTTP client that returns different responses based on URL
 */
const createMockHttpClient = (
  tokenResponse: unknown,
  userInfoResponse: unknown,
  tokenStatusCode: number = 200,
  userInfoStatusCode: number = 200
): HttpClient.HttpClient =>
  HttpClient.make((request, url, _signal, _fiber) =>
    Effect.gen(function* () {
      const urlString = url.toString()
      const isTokenEndpoint = urlString.includes("oauth2.googleapis.com/token")

      const responseBody = isTokenEndpoint ? tokenResponse : userInfoResponse
      const statusCode = isTokenEndpoint ? tokenStatusCode : userInfoStatusCode

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

const ConfigLayer = Layer.succeed(GoogleConfigTag, testConfig)

const SuccessfulHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  createMockHttpClient(mockGoogleTokenResponse, mockGoogleUserInfoResponse)
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

const TokenErrorHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  createMockHttpClient(
    { error: "invalid_grant", error_description: "Code has expired" },
    mockGoogleUserInfoResponse,
    400
  )
)

const UserInfoErrorHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  createMockHttpClient(
    mockGoogleTokenResponse,
    { error: { code: 401, message: "Invalid token" } },
    200,
    401
  )
)

/**
 * Test layer with successful responses
 */
const TestLayer = GoogleAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(SuccessfulHttpClientLayer)
)

/**
 * Test layer with failing HTTP client
 */
const TestLayerFailingHttp = GoogleAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(FailingHttpClientLayer)
)

/**
 * Test layer with invalid JSON response
 */
const TestLayerInvalidJson = GoogleAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(InvalidJsonHttpClientLayer)
)

/**
 * Test layer with token error response
 */
const TestLayerTokenError = GoogleAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(TokenErrorHttpClientLayer)
)

/**
 * Test layer with userinfo error response
 */
const TestLayerUserInfoError = GoogleAuthProviderLive.pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(UserInfoErrorHttpClientLayer)
)

// =============================================================================
// Tests
// =============================================================================

describe("GoogleAuthProvider", () => {
  describe("Provider Properties", () => {
    it.effect("type: returns 'google'", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        expect(provider.type).toBe("google")
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("supportsRegistration: returns false", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        expect(provider.supportsRegistration).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("getAuthorizationUrl", () => {
    it.effect("generates correct URL with required parameters", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = provider.getAuthorizationUrl("csrf_state_token_123")

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const url = new URL(result.value)
          expect(url.origin).toBe("https://accounts.google.com")
          expect(url.pathname).toBe("/o/oauth2/v2/auth")
          expect(url.searchParams.get("client_id")).toBe("google_client_id_1234567890.apps.googleusercontent.com")
          expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/callback")
          expect(url.searchParams.get("response_type")).toBe("code")
          expect(url.searchParams.get("state")).toBe("csrf_state_token_123")
          expect(url.searchParams.get("access_type")).toBe("offline")
          expect(url.searchParams.get("prompt")).toBe("select_account")
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("includes correct OAuth scopes", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = provider.getAuthorizationUrl("state")

        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
          const url = new URL(result.value)
          const scope = url.searchParams.get("scope")
          expect(scope).toContain("openid")
          expect(scope).toContain("email")
          expect(scope).toContain("profile")
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("uses custom redirect URI when provided", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
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
        const provider = yield* GoogleAuthProvider
        const request = LocalAuthRequest.make({
          email: Email.make("test@example.com"),
          password: Redacted.make("testPassword123!")
        })

        const result = yield* Effect.either(provider.authenticate(request))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.provider).toBe("google")
            expect(result.left.reason).toContain("OAuth redirect flow")
          }
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("handleCallback", () => {
    it.effect("exchanges code for user profile successfully", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* provider.handleCallback("auth_code_12345", "state")

        expect(result.provider).toBe("google")
        expect(result.providerId).toBe("google_user_12345")
        expect(result.email).toBe("user@gmail.com")
        expect(result.displayName).toBe("Test User")
        expect(result.emailVerified).toBe(true)
        expect(Option.isSome(result.providerData)).toBe(true)
        if (Option.isSome(result.providerData)) {
          const data = result.providerData.value
          expect(data.profile).toBeDefined()
          if (data.profile && typeof data.profile === "object" && data.profile !== null) {
            expect("picture" in data.profile && data.profile.picture).toBe("https://lh3.googleusercontent.com/photo.jpg")
            expect("given_name" in data.profile && data.profile.given_name).toBe("Test")
            expect("family_name" in data.profile && data.profile.family_name).toBe("User")
          }
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("builds display name from full name", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* provider.handleCallback("code", "state")
        expect(result.displayName).toBe("Test User")
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("falls back to given + family name when name is missing", () => {
      const mockUserInfoNoName = {
        id: "user_123",
        email: "noname@gmail.com",
        verified_email: true,
        given_name: "First",
        family_name: "Last"
        // name is missing
      }

      const testLayerNoName = GoogleAuthProviderLive.pipe(
        Layer.provide(ConfigLayer),
        Layer.provide(
          Layer.succeed(
            HttpClient.HttpClient,
            createMockHttpClient(mockGoogleTokenResponse, mockUserInfoNoName)
          )
        )
      )

      return Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* provider.handleCallback("code", "state")
        expect(result.displayName).toBe("First Last")
      }).pipe(Effect.provide(testLayerNoName))
    })

    it.effect("falls back to email when all names are missing", () => {
      const mockUserInfoNoNames = {
        id: "user_123",
        email: "noname@gmail.com",
        verified_email: true
        // name, given_name, family_name all missing
      }

      const testLayerNoNames = GoogleAuthProviderLive.pipe(
        Layer.provide(ConfigLayer),
        Layer.provide(
          Layer.succeed(
            HttpClient.HttpClient,
            createMockHttpClient(mockGoogleTokenResponse, mockUserInfoNoNames)
          )
        )
      )

      return Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* provider.handleCallback("code", "state")
        expect(result.displayName).toBe("noname@gmail.com")
      }).pipe(Effect.provide(testLayerNoNames))
    })

    it.effect("handles unverified email", () => {
      const mockUserInfoUnverified = {
        id: "user_123",
        email: "unverified@gmail.com",
        verified_email: false,
        name: "Unverified User"
      }

      const testLayerUnverified = GoogleAuthProviderLive.pipe(
        Layer.provide(ConfigLayer),
        Layer.provide(
          Layer.succeed(
            HttpClient.HttpClient,
            createMockHttpClient(mockGoogleTokenResponse, mockUserInfoUnverified)
          )
        )
      )

      return Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* provider.handleCallback("code", "state")
        expect(result.emailVerified).toBe(false)
      }).pipe(Effect.provide(testLayerUnverified))
    })

    it.effect("fails with ProviderAuthFailedError on network error", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* Effect.either(provider.handleCallback("code", "state"))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.provider).toBe("google")
            expect(result.left.reason).toContain("HTTP request")
          }
        }
      }).pipe(Effect.provide(TestLayerFailingHttp))
    )

    it.effect("fails with ProviderAuthFailedError on invalid JSON response", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
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

    it.effect("fails with ProviderAuthFailedError on token error response from Google", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* Effect.either(provider.handleCallback("code", "state"))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.reason).toContain("Token exchange failed")
            expect(result.left.reason).toContain("400")
          }
        }
      }).pipe(Effect.provide(TestLayerTokenError))
    )

    it.effect("fails with ProviderAuthFailedError on userinfo error response from Google", () =>
      Effect.gen(function* () {
        const provider = yield* GoogleAuthProvider
        const result = yield* Effect.either(provider.handleCallback("code", "state"))

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left._tag).toBe("ProviderAuthFailedError")
          if (isProviderAuthFailedError(result.left)) {
            expect(result.left.reason).toContain("Userinfo request failed")
            expect(result.left.reason).toContain("401")
          }
        }
      }).pipe(Effect.provide(TestLayerUserInfoError))
    )
  })

  describe("GoogleConfig", () => {
    it.effect("validates required fields", () =>
      Effect.gen(function* () {
        expect(testConfig.clientId).toBe("google_client_id_1234567890.apps.googleusercontent.com")
        expect(testConfig.redirectUri).toBe("https://app.example.com/callback")
        expect(Redacted.value(testConfig.clientSecret)).toBe("google_client_secret_abcdef")
      })
    )
  })
})
